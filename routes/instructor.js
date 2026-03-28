const express = require('express');
const crypto = require('crypto');
const { Pool } = require('pg');

const router = express.Router();

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '';
const instructorTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_INSTRUCTORS_TABLE || '')
  ? process.env.SUPABASE_INSTRUCTORS_TABLE
  : 'instructor_accounts';
const instructorSlotsTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_INSTRUCTOR_SLOTS_TABLE || '')
  ? process.env.SUPABASE_INSTRUCTOR_SLOTS_TABLE
  : 'instructor_availability_slots';
const activationTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_ACTIVATIONS_TABLE || '')
  ? process.env.SUPABASE_ACTIVATIONS_TABLE
  : 'course_activations';
const purchasesTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_PURCHASES_TABLE || '')
  ? process.env.SUPABASE_PURCHASES_TABLE
  : 'user_purchases';
const usersTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_USERS_TABLE || '')
  ? process.env.SUPABASE_USERS_TABLE
  : 'app_users';
const profileTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_PROFILE_TABLE || '')
  ? process.env.SUPABASE_PROFILE_TABLE
  : 'user_profiles';

const instructorTokenSecret = process.env.INSTRUCTOR_AUTH_SECRET || 'osian-instructor-auth-secret-change-me';
const tokenValiditySeconds = Number.parseInt(String(process.env.INSTRUCTOR_TOKEN_TTL_SECONDS || '43200'), 10) || 43200;

const dbReady = Boolean(connectionString);
const pool = dbReady
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  : null;

let instructorTablesReady = false;

function ensureDatabaseConfigured(res) {
  if (dbReady) return true;
  res.status(500).json({ error: 'Database is not configured.' });
  return false;
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function verifyPasswordWithHash(password, passwordHash) {
  const normalized = String(password || '');
  const stored = String(passwordHash || '');
  const [algo, salt, key] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !key) return Promise.resolve(false);

  return new Promise((resolve) => {
    crypto.scrypt(normalized, salt, 64, (err, derivedKey) => {
      if (err) {
        resolve(false);
        return;
      }

      const computed = Buffer.from(derivedKey.toString('hex'), 'hex');
      const expected = Buffer.from(key, 'hex');
      if (computed.length !== expected.length) {
        resolve(false);
        return;
      }
      resolve(crypto.timingSafeEqual(computed, expected));
    });
  });
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input) {
  const str = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (str.length % 4)) % 4;
  return Buffer.from(str + '='.repeat(padLength), 'base64').toString('utf8');
}

function createInstructorToken(payload) {
  const rawPayload = JSON.stringify(payload);
  const encodedPayload = base64UrlEncode(rawPayload);
  const signature = crypto
    .createHmac('sha256', instructorTokenSecret)
    .update(encodedPayload)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedPayload}.${signature}`;
}

function verifyInstructorToken(token) {
  const value = String(token || '').trim();
  const parts = value.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, providedSig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', instructorTokenSecret)
    .update(encodedPayload)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (providedSig !== expectedSig) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const exp = Number(payload?.exp || 0);
    if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return '';
  return authHeader.slice(7).trim();
}

async function ensureInstructorTables() {
  if (!pool || instructorTablesReady) return;

  await pool.query(`
    create table if not exists ${instructorTable} (
      id serial primary key,
      instructor_uid varchar(128) not null unique,
      email text not null unique,
      display_name text not null,
      password_hash text not null,
      is_active boolean not null default true,
      created_by_uid varchar(128) null,
      created_at timestamp not null default current_timestamp,
      updated_at timestamp not null default current_timestamp
    )
  `);

  await pool.query(`
    create table if not exists ${instructorSlotsTable} (
      id serial primary key,
      instructor_uid varchar(128) not null,
      weekday smallint not null,
      start_time varchar(5) not null,
      end_time varchar(5) not null,
      is_active boolean not null default true,
      created_at timestamp not null default current_timestamp,
      updated_at timestamp not null default current_timestamp,
      unique(instructor_uid, weekday, start_time, end_time),
      constraint valid_weekday check (weekday between 0 and 6)
    )
  `);

  await pool.query(`
    create table if not exists ${activationTable} (
      id serial primary key,
      uid varchar(128) not null,
      course_id integer not null,
      instructor_id varchar(128) null,
      instructor_name text null,
      timeslot_id varchar(128) null,
      timeslot_label text null,
      no_good_timeslot boolean not null default false,
      status varchar(40) not null default 'requested',
      requested_at timestamp not null default current_timestamp,
      created_at timestamp not null default current_timestamp,
      updated_at timestamp not null default current_timestamp,
      unique(uid, course_id)
    )
  `);

  instructorTablesReady = true;
}

async function requireInstructorAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized.' });

  const payload = verifyInstructorToken(token);
  if (!payload?.instructorUid || !payload?.email) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    await ensureInstructorTables();
    const row = await pool.query(
      `
        select instructor_uid, email, display_name, is_active
        from ${instructorTable}
        where instructor_uid = $1 and lower(email) = $2
        limit 1
      `,
      [payload.instructorUid, normalizeEmail(payload.email)],
    );

    if (!row.rows[0] || !row.rows[0].is_active) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    req.instructor = {
      instructorUid: row.rows[0].instructor_uid,
      email: row.rows[0].email,
      displayName: row.rows[0].display_name,
    };

    return next();
  } catch {
    return res.status(500).json({ error: 'Auth validation failed.' });
  }
}

function formatWeekday(index) {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return names[index] || 'Day';
}

function computeNextOccurrence(weekday, startTime) {
  const now = new Date();
  const target = new Date(now);
  const [hour, minute] = String(startTime || '00:00').split(':').map((v) => Number.parseInt(v, 10));
  const safeHour = Number.isFinite(hour) ? hour : 0;
  const safeMinute = Number.isFinite(minute) ? minute : 0;

  const currentWeekday = now.getDay();
  let delta = weekday - currentWeekday;
  if (delta < 0) delta += 7;

  target.setDate(now.getDate() + delta);
  target.setHours(safeHour, safeMinute, 0, 0);

  if (target <= now) {
    target.setDate(target.getDate() + 7);
  }

  return target;
}

router.get('/', (_req, res) => {
  res.render('instructor', {
    title: 'Instructor Sign In - Osian Academy',
    page: 'instructor',
  });
});

router.post('/api/auth/signin', async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const email = normalizeEmail(req.body?.email || '');
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    await ensureInstructorTables();
    const result = await pool.query(
      `
        select instructor_uid, email, display_name, password_hash, is_active
        from ${instructorTable}
        where lower(email) = $1
        limit 1
      `,
      [email],
    );

    const account = result.rows[0];
    if (!account || !account.is_active) {
      return res.status(401).json({ error: 'Invalid instructor credentials.' });
    }

    const validPassword = await verifyPasswordWithHash(password, account.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid instructor credentials.' });
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const token = createInstructorToken({
      instructorUid: account.instructor_uid,
      email: normalizeEmail(account.email),
      exp: nowSeconds + tokenValiditySeconds,
      iat: nowSeconds,
    });

    return res.json({
      ok: true,
      token,
      instructor: {
        instructorUid: account.instructor_uid,
        email: account.email,
        displayName: account.display_name,
      },
    });
  } catch {
    return res.status(500).json({ error: 'Could not sign in.' });
  }
});

router.get('/api/me', requireInstructorAuth, async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  try {
    await ensureInstructorTables();

    const slotsResult = await pool.query(
      `
        select id, weekday, start_time, end_time, is_active
        from ${instructorSlotsTable}
        where instructor_uid = $1 and is_active = true
        order by weekday asc, start_time asc
      `,
      [req.instructor.instructorUid],
    );

    return res.json({
      ok: true,
      instructor: req.instructor,
      availability: slotsResult.rows.map((row) => ({
        id: Number(row.id),
        weekday: Number(row.weekday),
        weekdayLabel: formatWeekday(Number(row.weekday)),
        startTime: row.start_time,
        endTime: row.end_time,
      })),
    });
  } catch {
    return res.status(500).json({ error: 'Could not load instructor profile.' });
  }
});

router.get('/api/classes/upcoming', requireInstructorAuth, async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  try {
    await ensureInstructorTables();

    const rows = await pool.query(
      `
        select
          a.uid,
          a.course_id,
          a.instructor_name,
          a.timeslot_id,
          a.timeslot_label,
          a.no_good_timeslot,
          a.status,
          a.requested_at,
          p.course_title,
          u.email as user_email,
          coalesce(nullif(u.display_name, ''), pr.name, '') as user_name,
          pr.city,
          pr.phone_number
        from ${activationTable} a
        join ${purchasesTable} p on p.uid = a.uid and p.course_id = a.course_id
        left join ${usersTable} u on u.uid = a.uid
        left join ${profileTable} pr on pr.uid = a.uid
        where a.instructor_id = $1
        order by a.requested_at desc
      `,
      [req.instructor.instructorUid],
    );

    const classes = rows.rows.map((row) => {
      let nextClassAt = null;
      const slotLabel = String(row.timeslot_label || '');
      const parsed = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*IST$/.exec(slotLabel);
      if (parsed) {
        const dayMap = {
          Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
        };
        const weekday = dayMap[parsed[1]];
        if (Number.isInteger(weekday)) {
          nextClassAt = computeNextOccurrence(weekday, parsed[2]).toISOString();
        }
      }

      return {
        uid: row.uid,
        courseId: row.course_id,
        courseTitle: row.course_title,
        userEmail: row.user_email || '',
        userName: row.user_name || '',
        userCity: row.city || '',
        userPhoneNumber: row.phone_number || '',
        status: row.status || 'requested',
        noGoodTimeslot: Boolean(row.no_good_timeslot),
        timeslotLabel: slotLabel,
        requestedAt: row.requested_at,
        nextClassAt,
      };
    });

    return res.json({ ok: true, classes });
  } catch {
    return res.status(500).json({ error: 'Could not load upcoming classes.' });
  }
});

module.exports = router;
