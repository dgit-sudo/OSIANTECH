const express = require('express');
const crypto = require('crypto');
const { Pool } = require('pg');

const router = express.Router();

const firebaseApiKey = process.env.FIREBASE_API_KEY || '';
const adminEmail = String(process.env.ADMIN_EMAIL || 'dhyanamshah38@gmail.com').trim().toLowerCase();
const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '';
const profileTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_PROFILE_TABLE || '')
  ? process.env.SUPABASE_PROFILE_TABLE
  : 'user_profiles';
const usersTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_USERS_TABLE || '')
  ? process.env.SUPABASE_USERS_TABLE
  : 'app_users';
const purchasesTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_PURCHASES_TABLE || '')
  ? process.env.SUPABASE_PURCHASES_TABLE
  : 'user_purchases';
const activationTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_ACTIVATIONS_TABLE || '')
  ? process.env.SUPABASE_ACTIVATIONS_TABLE
  : 'course_activations';
const classScheduleTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_CLASS_SCHEDULE_TABLE || '')
  ? process.env.SUPABASE_CLASS_SCHEDULE_TABLE
  : 'course_class_schedules';
const liveSessionsTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_LIVE_SESSIONS_TABLE || '')
  ? process.env.SUPABASE_LIVE_SESSIONS_TABLE
  : 'live_sessions';
const instructorTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_INSTRUCTORS_TABLE || '')
  ? process.env.SUPABASE_INSTRUCTORS_TABLE
  : 'instructor_accounts';
const instructorSlotsTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_INSTRUCTOR_SLOTS_TABLE || '')
  ? process.env.SUPABASE_INSTRUCTOR_SLOTS_TABLE
  : 'instructor_availability_slots';

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
  res.status(500).json({
    error: 'Database is not configured. Set SUPABASE_DB_URL or DATABASE_URL.',
  });
  return false;
}

function isValidUid(uid = '') {
  return typeof uid === 'string' && /^[a-zA-Z0-9_-]{6,128}$/.test(uid);
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function asSafeDisplayName(value = '') {
  return String(value || '').trim().slice(0, 120);
}

function makeInstructorUid() {
  return `inst_${crypto.randomBytes(8).toString('hex')}`;
}

async function hashInstructorPassword(password) {
  const normalized = String(password || '');
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await new Promise((resolve, reject) => {
    crypto.scrypt(normalized, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString('hex'));
    });
  });
  return `scrypt$${salt}$${key}`;
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
      slot_date date null,
      weekday smallint not null,
      start_time varchar(5) not null,
      end_time varchar(5) not null,
      timezone varchar(80) not null default 'Asia/Kolkata',
      is_active boolean not null default true,
      created_at timestamp not null default current_timestamp,
      updated_at timestamp not null default current_timestamp,
      unique(instructor_uid, weekday, start_time, end_time),
      constraint valid_weekday check (weekday between 0 and 6)
    )
  `);

  await pool.query(`alter table ${instructorSlotsTable} add column if not exists slot_date date null`);
  await pool.query(`alter table ${instructorSlotsTable} add column if not exists timezone varchar(80) not null default 'Asia/Kolkata'`);

  await pool.query(`create index if not exists idx_${instructorTable}_email on ${instructorTable}(email)`);
  await pool.query(`create index if not exists idx_${instructorSlotsTable}_uid on ${instructorSlotsTable}(instructor_uid)`);
  await pool.query(`create index if not exists idx_${instructorSlotsTable}_weekday on ${instructorSlotsTable}(weekday)`);
  await pool.query(`create index if not exists idx_${instructorSlotsTable}_slot_date on ${instructorSlotsTable}(slot_date)`);
  await pool.query(`
    create unique index if not exists uq_${instructorSlotsTable}_date_time
    on ${instructorSlotsTable}(instructor_uid, slot_date, start_time, end_time)
    where slot_date is not null
  `);

  instructorTablesReady = true;
}

async function pruneExpiredInstructorSlots() {
  if (!pool) return;
  await ensureInstructorTables();
  await pool.query(
    `
      update ${instructorSlotsTable}
      set is_active = false,
          updated_at = current_timestamp
      where is_active = true
        and slot_date is not null
        and ((slot_date + end_time::time) at time zone coalesce(nullif(timezone, ''), 'Asia/Kolkata')) <= current_timestamp
    `,
  );
}

async function verifyFirebaseToken(idToken) {
  if (!firebaseApiKey || !idToken) return {
    valid: null, uid: null, email: null, providerIds: [],
  };
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
    );

    const data = await response.json();
    if (data.error) return {
      valid: false, uid: null, email: null, providerIds: [],
    };

    const user = data?.users?.[0] || null;
    const providerIds = Array.isArray(user?.providerUserInfo)
      ? user.providerUserInfo
        .map((provider) => String(provider?.providerId || '').trim())
        .filter(Boolean)
      : [];

    return {
      valid: true,
      uid: user?.localId || null,
      email: String(user?.email || '').trim().toLowerCase() || null,
      providerIds,
    };
  } catch {
    return {
      valid: null, uid: null, email: null, providerIds: [],
    };
  }
}

async function lookupExistingFirebaseUids(uids = []) {
  const normalized = [...new Set((uids || []).map((uid) => String(uid || '').trim()).filter(isValidUid))];
  if (!firebaseApiKey || !normalized.length) {
    return new Set(normalized);
  }

  const existing = new Set();
  const chunkSize = 100;

  for (let i = 0; i < normalized.length; i += chunkSize) {
    const chunk = normalized.slice(i, i + chunkSize);
    try {
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ localId: chunk }),
        },
      );
      if (!response.ok) {
        return new Set(normalized);
      }
      const data = await response.json();
      if (data?.error) {
        return new Set(normalized);
      }
      if (Array.isArray(data?.users)) {
        data.users.forEach((user) => {
          const uid = String(user?.localId || '').trim();
          if (isValidUid(uid)) existing.add(uid);
        });
      }
    } catch {
      return new Set(normalized);
    }
  }

  return existing;
}

async function getUidScopedTables(client) {
  const result = await client.query(
    `
      select distinct table_name
      from information_schema.columns
      where table_schema = 'public' and column_name = 'uid'
    `,
  );

  return result.rows
    .map((row) => String(row.table_name || '').trim())
    .filter((table) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table));
}

async function deleteUserRemnants(uid) {
  if (!pool || !isValidUid(uid)) return;
  const client = await pool.connect();
  try {
    await client.query('begin');
    const discoveredTables = await getUidScopedTables(client);
    const priorityTables = [purchasesTable, profileTable, usersTable];
    const allUidTables = [...new Set([...priorityTables, ...discoveredTables])];
    for (const table of allUidTables) {
      await client.query(`delete from ${table} where uid = $1`, [uid]);
    }
    await client.query('commit');
  } catch {
    await client.query('rollback');
  } finally {
    client.release();
  }
}

function dedupeUsersByIdentity(users = []) {
  const byKey = new Map();
  users.forEach((user) => {
    const emailKey = normalizeEmail(user?.email || '');
    const key = emailKey || String(user?.uid || '').trim();
    if (!key) return;
    const prev = byKey.get(key);
    const prevTime = Date.parse(prev?.updatedAt || prev?.createdAt || 0) || 0;
    const nextTime = Date.parse(user?.updatedAt || user?.createdAt || 0) || 0;
    if (!prev || nextTime >= prevTime) {
      byKey.set(key, user);
    }
  });
  return [...byKey.values()];
}

function weekdayFromDate(slotDate) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(String(slotDate || ''))
    ? new Date(`${slotDate}T00:00:00+05:30`)
    : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  return parsed.getUTCDay();
}


async function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const verification = await verifyFirebaseToken(authHeader.slice(7).trim());
  if (!verification.valid || !verification.uid || !verification.email) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  if (verification.email !== adminEmail) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  const hasGoogleProvider = Array.isArray(verification.providerIds)
    && verification.providerIds.includes('google.com');
  if (!hasGoogleProvider) {
    return res.status(403).json({ error: 'Admin must sign in with Google.' });
  }

  req.admin = verification;
  return next();
}

router.get('/', (_req, res) => {
  res.render('admin', {
    title: 'Admin - Osian Academy',
    page: 'admin',
    adminEmail,
  });
});

router.get('/api/users', requireAdminAuth, async (_req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  try {
    const query = `
      with activated as (
        select
          u.uid,
          u.email,
          coalesce(nullif(u.display_name, ''), p.name, '') as display_name,
          coalesce(u.profile_completed, false) as user_completed,
          coalesce(p.completed_profile, false) as profile_completed,
          p.name,
          p.age,
          p.nationality,
          p.phone_number,
          p.gender,
          p.city,
          p.education,
          p.email as profile_email,
          u.created_at,
          u.updated_at
        from ${usersTable} u
        left join ${profileTable} p on p.uid = u.uid
        where coalesce(u.profile_completed, false) = true
           or coalesce(p.completed_profile, false) = true
      ),
      purchases_agg as (
        select uid, count(*)::int as purchase_count
        from ${purchasesTable}
        group by uid
      )
      select
        a.uid,
        a.email,
        a.display_name,
        a.user_completed,
        a.profile_completed,
        a.name,
        a.age,
        a.nationality,
        a.phone_number,
        a.gender,
        a.city,
        a.education,
        a.profile_email,
        a.created_at,
        a.updated_at,
        coalesce(pa.purchase_count, 0) as purchase_count
      from activated a
      left join purchases_agg pa on pa.uid = a.uid
      order by coalesce(a.updated_at, a.created_at) desc nulls last
    `;

    const result = await pool.query(query);
    const initialUsers = result.rows.map((row) => {
      const purchaseCount = Number(row.purchase_count || 0);
      return {
        uid: row.uid,
        email: row.email || row.profile_email || '',
        displayName: row.display_name || row.name || '',
        completedProfile: Boolean(row.user_completed || row.profile_completed),
        purchaseCount,
        hasPurchases: purchaseCount > 0,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
      };
    });

    const existingFirebaseUids = await lookupExistingFirebaseUids(initialUsers.map((u) => u.uid));
    const staleUsers = initialUsers.filter((u) => !existingFirebaseUids.has(u.uid));
    if (staleUsers.length) {
      await Promise.all(staleUsers.map((u) => deleteUserRemnants(u.uid)));
    }

    const users = dedupeUsersByIdentity(initialUsers.filter((u) => existingFirebaseUids.has(u.uid)));

    return res.json({
      usersWithPurchases: users.filter((u) => u.hasPurchases),
      usersWithoutPurchases: users.filter((u) => !u.hasPurchases),
      activatedUsers: users,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to load admin users.' });
  }
});

router.get('/api/users/:uid/profile', requireAdminAuth, async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const uid = String(req.params.uid || '').trim();
  if (!isValidUid(uid)) {
    return res.status(400).json({ error: 'Invalid uid.' });
  }

  try {
    const query = `
      select
        u.uid,
        u.email as user_email,
        u.display_name,
        u.profile_completed,
        p.name,
        p.age,
        p.nationality,
        p.phone_number,
        p.gender,
        p.city,
        p.education,
        p.email as profile_email,
        p.completed_profile,
        p.created_at,
        p.updated_at
      from ${usersTable} u
      left join ${profileTable} p on p.uid = u.uid
      where u.uid = $1
      limit 1
    `;
    const result = await pool.query(query, [uid]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const row = result.rows[0];
    const completed = Boolean(row.profile_completed || row.completed_profile);
    if (!completed) {
      return res.status(404).json({ error: 'Profile is not activated yet.' });
    }

    return res.json({
      profile: {
        uid,
        email: row.profile_email || row.user_email || '',
        name: row.name || row.display_name || '',
        age: Number(row.age || 0),
        nationality: row.nationality || '',
        phoneNumber: row.phone_number || '',
        gender: row.gender || '',
        city: row.city || '',
        education: row.education || '',
        completedProfile: completed,
      },
    });
  } catch {
    return res.status(500).json({ error: 'Failed to load profile.' });
  }
});

router.post('/api/transfer-courses', requireAdminAuth, async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const sourceUid = String(req.body?.sourceUid || '').trim();
  const targetUid = String(req.body?.targetUid || '').trim();

  if (!isValidUid(sourceUid) || !isValidUid(targetUid)) {
    return res.status(400).json({ error: 'Invalid source or target uid.' });
  }

  if (sourceUid === targetUid) {
    return res.status(400).json({ error: 'Source and target must be different.' });
  }

  const client = await pool.connect();
  let transferSummary = {
    transferredCourses: 0,
    transferredActivationRows: 0,
    transferredScheduleRows: 0,
    transferredLiveSessionRows: 0,
  };

  try {
    await client.query('begin');

    const accountCheck = await client.query(
      `
        select
          u.uid,
          coalesce(u.profile_completed, false) as user_completed,
          coalesce(p.completed_profile, false) as profile_completed
        from ${usersTable} u
        left join ${profileTable} p on p.uid = u.uid
        where u.uid in ($1, $2)
      `,
      [sourceUid, targetUid],
    );

    if (accountCheck.rows.length !== 2) {
      await client.query('rollback');
      return res.status(404).json({ error: 'Source or target account not found.' });
    }

    const byUid = new Map(accountCheck.rows.map((row) => [row.uid, row]));
    const source = byUid.get(sourceUid);
    const target = byUid.get(targetUid);

    const sourceEmailResult = await client.query(
      `select email from ${usersTable} where uid = $1 limit 1`,
      [sourceUid],
    );
    const targetEmailResult = await client.query(
      `select email from ${usersTable} where uid = $1 limit 1`,
      [targetUid],
    );
    const sourceEmail = normalizeEmail(sourceEmailResult.rows[0]?.email || '');
    const targetEmail = normalizeEmail(targetEmailResult.rows[0]?.email || '');

    const sourceActivated = Boolean(source?.user_completed || source?.profile_completed);
    const targetActivated = Boolean(target?.user_completed || target?.profile_completed);
    if (!sourceActivated || !targetActivated) {
      await client.query('rollback');
      return res.status(400).json({ error: 'Both accounts must be activated dashboard accounts.' });
    }

    const sourcePurchaseCountResult = await client.query(
      `select count(*)::int as c from ${purchasesTable} where uid = $1`,
      [sourceUid],
    );
    const targetPurchaseCountResult = await client.query(
      `select count(*)::int as c from ${purchasesTable} where uid = $1`,
      [targetUid],
    );

    const sourceCount = Number(sourcePurchaseCountResult.rows[0]?.c || 0);
    const targetCount = Number(targetPurchaseCountResult.rows[0]?.c || 0);

    if (sourceCount <= 0) {
      await client.query('rollback');
      return res.status(400).json({ error: 'Source account has no courses to transfer.' });
    }

    if (targetCount > 0) {
      await client.query('rollback');
      return res.status(400).json({ error: 'Target account must be a new account with no courses.' });
    }

    const transferResult = await client.query(
      `
        insert into ${purchasesTable} (uid, course_id, course_title, purchase_date, created_at)
        select $1, course_id, course_title, purchase_date, created_at
        from ${purchasesTable}
        where uid = $2
        on conflict (uid, course_id) do nothing
        returning course_id
      `,
      [targetUid, sourceUid],
    );

    transferSummary.transferredCourses = transferResult.rowCount || 0;

    const activationTransferResult = await client.query(
      `
        update ${activationTable}
        set uid = $1, updated_at = current_timestamp
        where uid = $2
      `,
      [targetUid, sourceUid],
    );
    transferSummary.transferredActivationRows = activationTransferResult.rowCount || 0;

    await client.query(
      `
        delete from ${classScheduleTable}
        where uid = $1
          and exists (
            select 1
            from ${classScheduleTable} t
            where t.uid = $2
              and t.course_id = ${classScheduleTable}.course_id
              and t.class_no = ${classScheduleTable}.class_no
          )
      `,
      [targetUid, sourceUid],
    );

    const scheduleTransferResult = await client.query(
      `
        update ${classScheduleTable}
        set uid = $1, updated_at = current_timestamp
        where uid = $2
      `,
      [targetUid, sourceUid],
    );
    transferSummary.transferredScheduleRows = scheduleTransferResult.rowCount || 0;

    const liveSessionTransferResult = await client.query(
      `
        update ${liveSessionsTable}
        set
          learner_uid = $1,
          learner_email = $2
        where learner_uid = $3 and ended_at is null
      `,
      [targetUid, targetEmail || null, sourceUid],
    );
    transferSummary.transferredLiveSessionRows = liveSessionTransferResult.rowCount || 0;

    await client.query(`delete from ${purchasesTable} where uid = $1`, [sourceUid]);
    await client.query(`delete from ${profileTable} where uid = $1`, [sourceUid]);
    await client.query(`delete from ${usersTable} where uid = $1`, [sourceUid]);

    const scopedTables = await getUidScopedTables(client);
    const preservedTables = new Set([purchasesTable, profileTable, usersTable, activationTable, classScheduleTable]);
    for (const table of scopedTables) {
      if (preservedTables.has(table)) continue;
      await client.query(`delete from ${table} where uid = $1`, [sourceUid]);
    }

    await client.query('commit');

    return res.json({
      ok: true,
      transferredCourses: transferSummary.transferredCourses,
      transferredActivationRows: transferSummary.transferredActivationRows,
      transferredScheduleRows: transferSummary.transferredScheduleRows,
      transferredLiveSessionRows: transferSummary.transferredLiveSessionRows,
      sourceUid,
      targetUid,
      sourceEmail,
      targetEmail,
    });
  } catch {
    await client.query('rollback');
    return res.status(500).json({ error: 'Failed to transfer courses.' });
  } finally {
    client.release();
  }
});

router.get('/api/instructors', requireAdminAuth, async (_req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  try {
    await ensureInstructorTables();
    const rows = await pool.query(
      `
        select
          i.instructor_uid,
          i.email,
          i.display_name,
          i.is_active,
          i.created_at,
          i.updated_at,
          coalesce(slot_counts.total_slots, 0) as total_slots
        from ${instructorTable} i
        left join (
          select instructor_uid, count(*)::int as total_slots
          from ${instructorSlotsTable}
          where is_active = true
          group by instructor_uid
        ) slot_counts on slot_counts.instructor_uid = i.instructor_uid
        order by i.created_at desc
      `,
    );

    return res.json({
      instructors: rows.rows.map((row) => ({
        instructorUid: row.instructor_uid,
        email: row.email,
        displayName: row.display_name,
        isActive: Boolean(row.is_active),
        totalSlots: Number(row.total_slots || 0),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch {
    return res.status(500).json({ error: 'Failed to load instructors.' });
  }
});

router.post('/api/instructors', requireAdminAuth, async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const email = normalizeEmail(req.body?.email || '');
  const password = String(req.body?.password || '');
  const displayName = asSafeDisplayName(req.body?.displayName || '');

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Valid email is required.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  if (!displayName) {
    return res.status(400).json({ error: 'Display name is required.' });
  }

  try {
    await ensureInstructorTables();

    const existingUser = await pool.query(
      `select uid from ${usersTable} where lower(email) = $1 limit 1`,
      [email],
    );
    if (existingUser.rows[0]) {
      return res.status(400).json({
        error: 'This email already exists as a learner account. Instructor cannot be created with it.',
      });
    }

    const existingInstructor = await pool.query(
      `select instructor_uid from ${instructorTable} where lower(email) = $1 limit 1`,
      [email],
    );
    if (existingInstructor.rows[0]) {
      return res.status(400).json({ error: 'Instructor account with this email already exists.' });
    }

    const passwordHash = await hashInstructorPassword(password);
    const instructorUid = makeInstructorUid();

    await pool.query(
      `
        insert into ${instructorTable}
          (instructor_uid, email, display_name, password_hash, is_active, created_by_uid, updated_at)
        values
          ($1, $2, $3, $4, true, $5, current_timestamp)
      `,
      [instructorUid, email, displayName, passwordHash, req.admin.uid || null],
    );

    return res.json({ ok: true, instructorUid });
  } catch {
    return res.status(500).json({ error: 'Failed to create instructor.' });
  }
});

router.patch('/api/instructors/:instructorUid', requireAdminAuth, async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const instructorUid = String(req.params.instructorUid || '').trim();
  if (!/^inst_[a-zA-Z0-9]+$/.test(instructorUid)) {
    return res.status(400).json({ error: 'Invalid instructor id.' });
  }

  const nextEmail = normalizeEmail(req.body?.email || '');
  const nextPassword = String(req.body?.password || '');
  const nextDisplayName = asSafeDisplayName(req.body?.displayName || '');
  const updates = [];
  const values = [];

  try {
    await ensureInstructorTables();

    if (nextEmail) {
      if (!isValidEmail(nextEmail)) {
        return res.status(400).json({ error: 'Invalid email format.' });
      }

      const existingUser = await pool.query(
        `select uid from ${usersTable} where lower(email) = $1 limit 1`,
        [nextEmail],
      );
      if (existingUser.rows[0]) {
        return res.status(400).json({
          error: 'This email already exists as a learner account. Instructor email reset blocked.',
        });
      }

      const dupInstructor = await pool.query(
        `
          select instructor_uid
          from ${instructorTable}
          where lower(email) = $1 and instructor_uid <> $2
          limit 1
        `,
        [nextEmail, instructorUid],
      );
      if (dupInstructor.rows[0]) {
        return res.status(400).json({ error: 'Another instructor already uses this email.' });
      }

      updates.push('email = $' + (values.length + 1));
      values.push(nextEmail);
    }

    if (nextDisplayName) {
      updates.push('display_name = $' + (values.length + 1));
      values.push(nextDisplayName);
    }

    if (nextPassword) {
      if (nextPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }
      const passwordHash = await hashInstructorPassword(nextPassword);
      updates.push('password_hash = $' + (values.length + 1));
      values.push(passwordHash);
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'No updates provided.' });
    }

    updates.push('updated_at = current_timestamp');
    values.push(instructorUid);

    const result = await pool.query(
      `
        update ${instructorTable}
        set ${updates.join(', ')}
        where instructor_uid = $${values.length}
        returning instructor_uid
      `,
      values,
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Instructor not found.' });
    }

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Failed to update instructor.' });
  }
});

router.get('/api/instructors/:instructorUid/slots', requireAdminAuth, async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const instructorUid = String(req.params.instructorUid || '').trim();
  if (!/^inst_[a-zA-Z0-9]+$/.test(instructorUid)) {
    return res.status(400).json({ error: 'Invalid instructor id.' });
  }

  try {
    await ensureInstructorTables();
    await pruneExpiredInstructorSlots();
    const rows = await pool.query(
      `
        select id, slot_date, weekday, start_time, end_time, timezone, is_active
        from ${instructorSlotsTable}
        where instructor_uid = $1 and is_active = true
        order by slot_date asc nulls last, weekday asc, start_time asc
      `,
      [instructorUid],
    );

    return res.json({
      slots: rows.rows.map((row) => ({
        id: Number(row.id),
        slotDate: row.slot_date || null,
        weekday: Number(row.weekday),
        startTime: row.start_time,
        endTime: row.end_time,
        timezone: row.timezone || 'Asia/Kolkata',
        isActive: Boolean(row.is_active),
      })),
    });
  } catch {
    return res.status(500).json({ error: 'Failed to load instructor slots.' });
  }
});

router.post('/api/instructors/:instructorUid/slots', requireAdminAuth, async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const instructorUid = String(req.params.instructorUid || '').trim();
  const slotDate = String(req.body?.slotDate || '').trim();
  const startTime = String(req.body?.startTime || '').trim();
  const endTime = String(req.body?.endTime || '').trim();
  const timezone = 'Asia/Kolkata';
  const weekday = weekdayFromDate(slotDate);

  if (!/^inst_[a-zA-Z0-9]+$/.test(instructorUid)) {
    return res.status(400).json({ error: 'Invalid instructor id.' });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(slotDate) || weekday === null) {
    return res.status(400).json({ error: 'Please choose a valid slot date.' });
  }

  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) {
    return res.status(400).json({ error: 'Invalid start/end time.' });
  }

  const validHourRange = /^\d{2}:00$/.test(startTime) && /^\d{2}:00$/.test(endTime);
  if (!validHourRange) {
    return res.status(400).json({ error: 'Use full-hour values like 13:00 to 15:00.' });
  }

  try {
    await ensureInstructorTables();
    const exists = await pool.query(
      `select instructor_uid from ${instructorTable} where instructor_uid = $1 limit 1`,
      [instructorUid],
    );
    if (!exists.rows[0]) {
      return res.status(404).json({ error: 'Instructor not found.' });
    }

    const existing = await pool.query(
      `
        select id
        from ${instructorSlotsTable}
        where instructor_uid = $1 and slot_date = $2 and start_time = $3 and end_time = $4
        limit 1
      `,
      [instructorUid, slotDate, startTime, endTime],
    );

    if (existing.rows[0]) {
      await pool.query(
        `
          update ${instructorSlotsTable}
          set is_active = true, weekday = $1, timezone = $2, updated_at = current_timestamp
          where id = $3
        `,
        [weekday, timezone, Number(existing.rows[0].id)],
      );
    } else {
      await pool.query(
        `
          insert into ${instructorSlotsTable}
            (instructor_uid, slot_date, weekday, start_time, end_time, timezone, is_active, updated_at)
          values ($1, $2, $3, $4, $5, $6, true, current_timestamp)
        `,
        [instructorUid, slotDate, weekday, startTime, endTime, timezone],
      );
    }

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Failed to save slot.' });
  }
});

router.delete('/api/instructors/:instructorUid/slots/:slotId', requireAdminAuth, async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const instructorUid = String(req.params.instructorUid || '').trim();
  const slotId = Number.parseInt(String(req.params.slotId || ''), 10);

  if (!/^inst_[a-zA-Z0-9]+$/.test(instructorUid) || !Number.isFinite(slotId) || slotId <= 0) {
    return res.status(400).json({ error: 'Invalid parameters.' });
  }

  try {
    await ensureInstructorTables();
    await pool.query(
      `delete from ${instructorSlotsTable} where id = $1 and instructor_uid = $2`,
      [slotId, instructorUid],
    );
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Failed to delete slot.' });
  }
});

module.exports = router;