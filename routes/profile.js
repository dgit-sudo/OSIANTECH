const express = require('express');
const { Pool } = require('pg');

const router = express.Router();
const firebaseApiKey = process.env.FIREBASE_API_KEY || '';
const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '';
const profileTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_PROFILE_TABLE || '')
  ? process.env.SUPABASE_PROFILE_TABLE
  : 'user_profiles';
const usersTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_USERS_TABLE || '')
  ? process.env.SUPABASE_USERS_TABLE
  : 'app_users';
const adminEmail = String(process.env.ADMIN_EMAIL || 'dhyanamshah38@gmail.com').trim().toLowerCase();
const purchasesTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_PURCHASES_TABLE || '')
  ? process.env.SUPABASE_PURCHASES_TABLE
  : 'user_purchases';
const classScheduleTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_CLASS_SCHEDULE_TABLE || '')
  ? process.env.SUPABASE_CLASS_SCHEDULE_TABLE
  : 'course_class_schedules';
const activationTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_ACTIVATIONS_TABLE || '')
  ? process.env.SUPABASE_ACTIVATIONS_TABLE
  : 'course_activations';
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

let purchasesTableReady = false;
let activationsTableReady = false;
let instructorTablesReady = false;
let classScheduleTableReady = false;

function isValidUid(uid = '') {
  return typeof uid === 'string' && /^[a-zA-Z0-9_-]{6,128}$/.test(uid);
}

function isAdminEmail(email = '') {
  return String(email).trim().toLowerCase() === adminEmail;
}

function ensureDatabaseConfigured(res) {
  if (dbReady) return true;
  res.status(500).json({
    error: 'Database is not configured. Set SUPABASE_DB_URL or DATABASE_URL.',
  });
  return false;
}

async function ensurePurchasesTable() {
  if (!pool || purchasesTableReady) return;

  await pool.query(`
    create table if not exists ${purchasesTable} (
      id serial primary key,
      uid varchar(128) not null,
      course_id integer not null,
      course_title text not null,
      purchase_date timestamp default current_timestamp,
      created_at timestamp default current_timestamp,
      unique(uid, course_id),
      constraint valid_ids check (uid <> '' and course_id > 0)
    )
  `);

  await pool.query(`create index if not exists idx_${purchasesTable}_uid on ${purchasesTable}(uid)`);
  await pool.query(`create index if not exists idx_${purchasesTable}_course_id on ${purchasesTable}(course_id)`);
  await pool.query(`create index if not exists idx_${purchasesTable}_purchase_date on ${purchasesTable}(purchase_date desc)`);

  purchasesTableReady = true;
}

async function ensureActivationsTable() {
  if (!pool || activationsTableReady) return;

  await pool.query(`
    create table if not exists ${activationTable} (
      id serial primary key,
      uid varchar(128) not null,
      course_id integer not null,
      instructor_id varchar(128) null,
      instructor_name text null,
      timeslot_id varchar(128) null,
      timeslot_label text null,
      learner_timezone varchar(80) null,
      class_no integer not null default 1,
      selected_slot_date date null,
      selected_class_start_at timestamp null,
      selected_class_end_at timestamp null,
      no_good_timeslot boolean not null default false,
      status varchar(40) not null default 'requested',
      requested_at timestamp not null default current_timestamp,
      created_at timestamp not null default current_timestamp,
      updated_at timestamp not null default current_timestamp,
      unique(uid, course_id)
    )
  `);

  await pool.query(`alter table ${activationTable} add column if not exists learner_timezone varchar(80) null`);
  await pool.query(`alter table ${activationTable} add column if not exists class_no integer not null default 1`);
  await pool.query(`alter table ${activationTable} add column if not exists selected_slot_date date null`);
  await pool.query(`alter table ${activationTable} add column if not exists selected_class_start_at timestamp null`);
  await pool.query(`alter table ${activationTable} add column if not exists selected_class_end_at timestamp null`);

  await pool.query(`create index if not exists idx_${activationTable}_uid on ${activationTable}(uid)`);
  await pool.query(`create index if not exists idx_${activationTable}_course_id on ${activationTable}(course_id)`);
  await pool.query(`create index if not exists idx_${activationTable}_instructor_start on ${activationTable}(instructor_id, selected_class_start_at)`);

  activationsTableReady = true;
}

async function ensureClassScheduleTable() {
  if (!pool || classScheduleTableReady) return;

  await pool.query(`
    create table if not exists ${classScheduleTable} (
      id serial primary key,
      uid varchar(128) not null,
      course_id integer not null,
      class_no integer not null,
      slot_date date not null,
      start_at timestamp not null,
      end_at timestamp not null,
      created_at timestamp not null default current_timestamp,
      updated_at timestamp not null default current_timestamp,
      unique(uid, course_id, class_no),
      unique(uid, course_id, slot_date)
    )
  `);

  await pool.query(`create index if not exists idx_${classScheduleTable}_uid_course on ${classScheduleTable}(uid, course_id)`);
  await pool.query(`create index if not exists idx_${classScheduleTable}_slot_date on ${classScheduleTable}(slot_date)`);

  classScheduleTableReady = true;
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
  await pool.query(`create index if not exists idx_${instructorSlotsTable}_slot_date on ${instructorSlotsTable}(slot_date)`);
  await pool.query(`
    create unique index if not exists uq_${instructorSlotsTable}_date_time
    on ${instructorSlotsTable}(instructor_uid, slot_date, start_time, end_time)
    where slot_date is not null
  `);

  instructorTablesReady = true;
}

async function syncInstructorSlotActivity() {
  if (!pool) return;
  await ensureInstructorTables();
  await pool.query(
    `
      update ${instructorSlotsTable}
      set is_active = (
        ((slot_date + end_time::time) at time zone coalesce(nullif(timezone, ''), 'Asia/Kolkata')) > current_timestamp
      ),
      updated_at = case
        when is_active is distinct from (
          ((slot_date + end_time::time) at time zone coalesce(nullif(timezone, ''), 'Asia/Kolkata')) > current_timestamp
        ) then current_timestamp
        else updated_at
      end
      where slot_date is not null
    `,
  );
}

function isValidTimeZone(value = '') {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: String(value || '') });
    return true;
  } catch {
    return false;
  }
}

function normalizeTimeZone(value = '') {
  const tz = String(value || '').trim();
  return isValidTimeZone(tz) ? tz : 'Asia/Kolkata';
}

function parseIstDateTime(slotDate, hhmm) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(slotDate || ''))) return null;
  const rawTime = String(hhmm || '').trim();
  const match = rawTime.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const [year, month, day] = String(slotDate).split('-').map((v) => Number.parseInt(v, 10));
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - (330 * 60 * 1000);
  const date = new Date(utcMs);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatUtcRangeInTimeZone(startUtcIso, endUtcIso, timeZone) {
  const start = new Date(startUtcIso);
  const end = new Date(endUtcIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
  const dayFmt = new Intl.DateTimeFormat('en-IN', {
    timeZone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeFmt = new Intl.DateTimeFormat('en-IN', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${dayFmt.format(start)} ${timeFmt.format(start)} - ${timeFmt.format(end)}`;
}

function todayIstDateString() {
  const now = new Date();
  const istMs = now.getTime() + (330 * 60 * 1000);
  const ist = new Date(istMs);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function getCurrentDbTimeMs() {
  if (!pool) return Date.now();
  try {
    const result = await pool.query('select current_timestamp as now_ts');
    const raw = result.rows?.[0]?.now_ts;
    const value = raw ? new Date(raw).getTime() : Number.NaN;
    return Number.isFinite(value) ? value : Date.now();
  } catch {
    return Date.now();
  }
}

async function getBookedSlotStarts(instructorId, exclude = {}) {
  await ensureActivationsTable();
  const rows = await pool.query(
    `
      select timeslot_id
      from ${activationTable}
      where instructor_id = $1
        and no_good_timeslot = false
        and status = 'activated'
        and timeslot_id is not null
        and not (uid = $2 and course_id = $3)
    `,
    [instructorId, String(exclude.uid || ''), Number(exclude.courseId || 0)],
  );

  return new Set(
    rows.rows
      .map((row) => {
        const token = String(row.timeslot_id || '');
        const split = token.split('|');
        if (split.length !== 2) return '';
        const iso = new Date(split[1]);
        return Number.isNaN(iso.getTime()) ? '' : iso.toISOString();
      })
      .filter(Boolean),
  );
}

async function getInstructorAvailability(options = {}) {
  const includeDebug = Boolean(options.includeDebug);
  const learnerTimeZone = normalizeTimeZone(options.learnerTimeZone || 'Asia/Kolkata');
  const excludeUid = String(options.excludeUid || '').trim();
  const excludeCourseId = Number.parseInt(String(options.excludeCourseId || '0'), 10) || 0;
  const nowMs = await getCurrentDbTimeMs();

  await ensureInstructorTables();
  await syncInstructorSlotActivity();

  const rows = await pool.query(
    `
      select
        i.instructor_uid,
        i.display_name,
        s.id as slot_id,
        s.slot_date::text as slot_date,
        s.start_time,
        s.end_time,
        s.timezone
      from ${instructorTable} i
      left join ${instructorSlotsTable} s
        on s.instructor_uid = i.instructor_uid and s.is_active = true and s.slot_date is not null
      where i.is_active = true
      order by i.display_name asc, s.slot_date asc, s.start_time asc
    `,
  );

  const byInstructor = new Map();
  const bookedByInstructor = new Map();
  const debugByInstructor = new Map();

  function ensureDebugStats(instructorId, instructorName) {
    if (!debugByInstructor.has(instructorId)) {
      debugByInstructor.set(instructorId, {
        instructorId,
        instructorName,
        missingSlotRows: 0,
        rawSlotRows: 0,
        invalidRanges: 0,
        endedRanges: 0,
        totalHourChunks: 0,
        expiredChunks: 0,
        bookedChunks: 0,
        includedChunks: 0,
      });
    }
    return debugByInstructor.get(instructorId);
  }

  for (const row of rows.rows) {
    const instructorId = row.instructor_uid;
    const stats = ensureDebugStats(instructorId, row.display_name);
    if (!byInstructor.has(instructorId)) {
      byInstructor.set(instructorId, {
        instructorId,
        instructorName: row.display_name,
        timeSlots: [],
      });
    }

    if (!bookedByInstructor.has(instructorId)) {
      bookedByInstructor.set(
        instructorId,
        await getBookedSlotStarts(instructorId, { uid: excludeUid, courseId: excludeCourseId }),
      );
    }

    if (!row.slot_id || !row.slot_date) {
      stats.missingSlotRows += 1;
      continue;
    }
    stats.rawSlotRows += 1;

    const rangeStart = parseIstDateTime(row.slot_date, row.start_time);
    const rangeEnd = parseIstDateTime(row.slot_date, row.end_time);
    if (!rangeStart || !rangeEnd || rangeStart >= rangeEnd) {
      stats.invalidRanges += 1;
      continue;
    }
    if (rangeEnd.getTime() <= nowMs) {
      stats.endedRanges += 1;
      continue;
    }

    let cursorMs = rangeStart.getTime();
    const endMs = rangeEnd.getTime();
    while (cursorMs + 3600000 <= endMs) {
      const nextMs = cursorMs + 3600000;
      stats.totalHourChunks += 1;
      if (nextMs <= nowMs) {
        stats.expiredChunks += 1;
        cursorMs = nextMs;
        continue;
      }
      const startIso = new Date(cursorMs).toISOString();
      const endIso = new Date(nextMs).toISOString();
      const bookedSet = bookedByInstructor.get(instructorId);
      if (!bookedSet || !bookedSet.has(startIso)) {
        stats.includedChunks += 1;
        byInstructor.get(instructorId).timeSlots.push({
          slotId: `${row.slot_id}|${startIso}`,
          baseSlotId: String(row.slot_id),
          slotDate: row.slot_date,
          startAtUtc: startIso,
          endAtUtc: endIso,
          sourceTimeZone: row.timezone || 'Asia/Kolkata',
          label: formatUtcRangeInTimeZone(startIso, endIso, learnerTimeZone),
        });
      } else {
        stats.bookedChunks += 1;
      }
      cursorMs = nextMs;
    }
  }

  const instructors = [...byInstructor.values()];
  if (!includeDebug) return instructors;
  return {
    instructors,
    debugStats: [...debugByInstructor.values()],
  };
}

async function getInstructorById(instructorId = '') {
  await ensureInstructorTables();
  const result = await pool.query(
    `
      select instructor_uid, display_name
      from ${instructorTable}
      where instructor_uid = $1 and is_active = true
      limit 1
    `,
    [instructorId],
  );
  if (!result.rows[0]) return null;
  return {
    instructorId: result.rows[0].instructor_uid,
    instructorName: result.rows[0].display_name,
  };
}

async function getInstructorSlot(instructorId, slotId) {
  const raw = String(slotId || '').trim();
  const split = raw.split('|');
  if (split.length !== 2) return null;

  const baseSlotId = Number.parseInt(split[0], 10);
  const startIso = String(split[1] || '').trim();
  if (!Number.isFinite(baseSlotId) || baseSlotId <= 0) return null;
  const selectedStart = new Date(startIso);
  if (Number.isNaN(selectedStart.getTime())) return null;
  const selectedEnd = new Date(selectedStart.getTime() + 3600000);
  const nowMs = await getCurrentDbTimeMs();

  await ensureInstructorTables();
  const result = await pool.query(
    `
      select id, slot_date::text as slot_date, start_time, end_time, timezone
      from ${instructorSlotsTable}
      where instructor_uid = $1 and id = $2 and is_active = true and slot_date is not null
      limit 1
    `,
    [instructorId, baseSlotId],
  );

  if (!result.rows[0]) return null;
  const row = result.rows[0];
  const rangeStart = parseIstDateTime(row.slot_date, row.start_time);
  const rangeEnd = parseIstDateTime(row.slot_date, row.end_time);
  if (!rangeStart || !rangeEnd) return null;
  if (selectedEnd.getTime() <= nowMs) return null;

  const inRange = selectedStart.getTime() >= rangeStart.getTime()
    && selectedEnd.getTime() <= rangeEnd.getTime();
  if (!inRange) return null;

  return {
    slotId: `${baseSlotId}|${selectedStart.toISOString()}`,
    baseSlotId: String(baseSlotId),
    slotDate: row.slot_date,
    startAtUtc: selectedStart.toISOString(),
    endAtUtc: selectedEnd.toISOString(),
    sourceTimeZone: row.timezone || 'Asia/Kolkata',
  };
}

function mapUserRow(row) {
  return {
    uid: row.uid,
    email: row.email,
    displayName: row.display_name || '',
    authProvider: row.auth_provider || '',
    profileCompleted: Boolean(row.profile_completed),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function mapProfileRow(row) {
  return {
    uid: row.uid,
    name: row.name || '',
    age: Number(row.age || 0),
    nationality: row.nationality || '',
    phoneNumber: row.phone_number || '',
    gender: row.gender || '',
    city: row.city || '',
    education: row.education || '',
    email: row.email || '',
    completedProfile: Boolean(row.completed_profile),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function verifyFirebaseToken(idToken) {
  if (!firebaseApiKey || !idToken) return { valid: null, uid: null };
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
    if (data.error) {
      const msg = data.error?.message || '';
      return { valid: false, userDeleted: msg === 'USER_NOT_FOUND' };
    }
    return {
      valid: true,
      uid: data?.users?.[0]?.localId || null,
    };
  } catch {
    return { valid: null };
  }
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

async function deleteUserFromSupabase(uid) {
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

router.post('/sync-user', async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const body = req.body || {};
  const uid = String(body.uid || '').trim();
  const email = String(body.email || '').trim();
  const displayName = String(body.displayName || '').trim();
  const provider = String(body.provider || '').trim() || 'password';

  if (!isValidUid(uid)) {
    return res.status(400).json({ error: 'Invalid uid.' });
  }

  if (!email) {
    return res.status(400).json({ error: 'Email is required for sync.' });
  }

  if (isAdminEmail(email)) {
    return res.status(403).json({ error: 'Admin account cannot use learner sign in or sign up.' });
  }

  try {
    const now = new Date().toISOString();
    const query = `
      insert into ${usersTable} (
        uid, email, display_name, auth_provider, profile_completed, created_at, updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7)
      on conflict (uid) do update set
        email = excluded.email,
        display_name = coalesce(excluded.display_name, ${usersTable}.display_name),
        auth_provider = excluded.auth_provider,
        updated_at = excluded.updated_at
      returning uid, email, display_name, auth_provider, profile_completed, created_at, updated_at
    `;
    const values = [uid, email, displayName || null, provider, false, now, now];
    const result = await pool.query(query, values);

    return res.json({ user: mapUserRow(result.rows[0]) });
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to sync user.' });
  }
});

router.get('/:uid', async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const { uid } = req.params;
  if (!isValidUid(uid)) {
    return res.status(400).json({ error: 'Invalid uid.' });
  }

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const verification = await verifyFirebaseToken(authHeader.slice(7));
    if (verification.valid === false && verification.userDeleted) {
      await deleteUserFromSupabase(uid);
      return res.status(401).json({ error: 'Account has been deleted.' });
    }
  }

  try {
    const query = `
      select uid, name, age, nationality, phone_number, gender, city, education, email, completed_profile, created_at, updated_at
      from ${profileTable}
      where uid = $1
      limit 1
    `;
    const result = await pool.query(query, [uid]);

    if (!result.rows[0]) {
      return res.json({ profile: null });
    }

    return res.json({ profile: mapProfileRow(result.rows[0]) });
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to load profile.' });
  }
});

router.put('/:uid', async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const { uid } = req.params;
  if (!isValidUid(uid)) {
    return res.status(400).json({ error: 'Invalid uid.' });
  }

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const verification = await verifyFirebaseToken(authHeader.slice(7));
    if (verification.valid === false && verification.userDeleted) {
      await deleteUserFromSupabase(uid);
      return res.status(401).json({ error: 'Account has been deleted.' });
    }
  }

  const body = req.body || {};
  const nextProfile = {
    name: String(body.name || '').trim(),
    age: Number(body.age || 0),
    nationality: String(body.nationality || '').trim(),
    phoneNumber: String(body.phoneNumber || '').trim(),
    gender: String(body.gender || '').trim(),
    city: String(body.city || '').trim(),
    education: String(body.education || '').trim(),
    email: String(body.email || '').trim(),
    completedProfile: Boolean(body.completedProfile),
  };

  const missingRequired = !nextProfile.name
    || !nextProfile.age
    || !nextProfile.nationality
    || !nextProfile.phoneNumber
    || !nextProfile.city
    || !nextProfile.education;

  if (missingRequired) {
    return res.status(400).json({ error: 'Missing required profile fields.' });
  }

  try {
    const now = new Date().toISOString();
    const profileQuery = `
      insert into ${profileTable} (
        uid, name, age, nationality, phone_number, gender, city, education, email, completed_profile, created_at, updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      on conflict (uid) do update set
        name = excluded.name,
        age = excluded.age,
        nationality = excluded.nationality,
        phone_number = excluded.phone_number,
        gender = excluded.gender,
        city = excluded.city,
        education = excluded.education,
        email = excluded.email,
        completed_profile = excluded.completed_profile,
        updated_at = excluded.updated_at
      returning uid, name, age, nationality, phone_number, gender, city, education, email, completed_profile, created_at, updated_at
    `;
    const profileValues = [
      uid,
      nextProfile.name,
      nextProfile.age,
      nextProfile.nationality,
      nextProfile.phoneNumber,
      nextProfile.gender || null,
      nextProfile.city,
      nextProfile.education,
      nextProfile.email || null,
      true,
      now,
      now,
    ];
    const profileResult = await pool.query(profileQuery, profileValues);
    const profileRow = profileResult.rows[0];

    const userQuery = `
      insert into ${usersTable} (
        uid, email, display_name, auth_provider, profile_completed, created_at, updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7)
      on conflict (uid) do update set
        email = coalesce(excluded.email, ${usersTable}.email),
        display_name = coalesce(excluded.display_name, ${usersTable}.display_name),
        profile_completed = excluded.profile_completed,
        updated_at = excluded.updated_at
    `;
    const userValues = [
      uid,
      profileRow.email || nextProfile.email || null,
      profileRow.name || null,
      'password',
      true,
      now,
      now,
    ];
    await pool.query(userQuery, userValues);

    return res.json({ profile: mapProfileRow(profileRow) });
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to save profile.' });
  }
});

// Get user's purchased courses
router.get('/:uid/purchases', async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const { uid } = req.params;
  if (!isValidUid(uid)) {
    return res.status(400).json({ error: 'Invalid uid.' });
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const verification = await verifyFirebaseToken(authHeader.slice(7));
  if (verification.valid === false && verification.userDeleted) {
    await deleteUserFromSupabase(uid);
    return res.status(401).json({ error: 'Account has been deleted.' });
  }
  if (verification.valid === false || (verification.valid === true && verification.uid !== uid)) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    await ensurePurchasesTable();
    await ensureActivationsTable();
    const query = `
      select p.course_id,
             p.course_title,
             p.purchase_date,
             a.instructor_id,
             a.instructor_name,
             a.timeslot_id,
             a.timeslot_label,
             a.learner_timezone,
             a.class_no,
             a.selected_slot_date,
             a.selected_class_start_at,
             a.selected_class_end_at,
             a.no_good_timeslot,
             a.status,
             a.requested_at
      from ${purchasesTable}
      p
      left join ${activationTable} a
        on a.uid = p.uid and a.course_id = p.course_id
      where p.uid = $1
      order by p.purchase_date desc
    `;
    const result = await pool.query(query, [uid]);
    return res.json({ purchases: result.rows.map(row => ({
      courseId: row.course_id,
      courseTitle: row.course_title,
      purchaseDate: row.purchase_date,
      activation: row.requested_at
        ? {
            instructorId: row.instructor_id || '',
            instructorName: row.instructor_name || '',
            timeslotId: row.timeslot_id || '',
            timeslotLabel: row.timeslot_label || '',
            learnerTimezone: row.learner_timezone || '',
            classNo: Number(row.class_no || 1),
            selectedSlotDate: row.selected_slot_date || null,
            selectedClassStartAt: row.selected_class_start_at || null,
            selectedClassEndAt: row.selected_class_end_at || null,
            noGoodTimeslot: Boolean(row.no_good_timeslot),
            status: row.status || 'requested',
            requestedAt: row.requested_at,
          }
        : null,
    })) });
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to load purchases.' });
  }
});

router.get('/:uid/purchases/:courseId/activation-options', async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');

  const { uid, courseId } = req.params;
  if (!isValidUid(uid)) {
    return res.status(400).json({ error: 'Invalid uid.' });
  }

  const courseIdNum = Number.parseInt(String(courseId || ''), 10);
  if (!Number.isFinite(courseIdNum) || courseIdNum <= 0) {
    return res.status(400).json({ error: 'Invalid courseId.' });
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const verification = await verifyFirebaseToken(authHeader.slice(7));
  if (verification.valid === false && verification.userDeleted) {
    await deleteUserFromSupabase(uid);
    return res.status(401).json({ error: 'Account has been deleted.' });
  }
  if (verification.valid === false || (verification.valid === true && verification.uid !== uid)) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const requestedTimeZone = normalizeTimeZone(req.query?.timeZone || req.query?.timezone || 'Asia/Kolkata');
  const debugEnabled = String(req.query?.debug || '').trim() === '1'
    || String(process.env.ACTIVATION_DEBUG_LOG || '').trim() === '1';

  try {
    await ensurePurchasesTable();
    await ensureActivationsTable();
    await ensureClassScheduleTable();
    await ensureInstructorTables();

    const purchase = await pool.query(
      `select course_id from ${purchasesTable} where uid = $1 and course_id = $2 limit 1`,
      [uid, courseIdNum],
    );
    if (!purchase.rows[0]) {
      return res.status(404).json({ error: 'Course purchase not found.' });
    }

    const existing = await pool.query(
      `
        select
          instructor_id,
          instructor_name,
          timeslot_id,
          timeslot_label,
          learner_timezone,
          class_no,
          selected_slot_date,
          selected_class_start_at,
          selected_class_end_at,
          no_good_timeslot,
          status,
          requested_at
        from ${activationTable}
        where uid = $1 and course_id = $2
        limit 1
      `,
      [uid, courseIdNum],
    );

    const activation = existing.rows[0]
      ? {
          instructorId: existing.rows[0].instructor_id || '',
          instructorName: existing.rows[0].instructor_name || '',
          timeslotId: existing.rows[0].timeslot_id || '',
          timeslotLabel: existing.rows[0].timeslot_label || '',
          learnerTimezone: existing.rows[0].learner_timezone || '',
          classNo: Number(existing.rows[0].class_no || 1),
          selectedSlotDate: existing.rows[0].selected_slot_date || null,
          selectedClassStartAt: existing.rows[0].selected_class_start_at || null,
          selectedClassEndAt: existing.rows[0].selected_class_end_at || null,
          noGoodTimeslot: Boolean(existing.rows[0].no_good_timeslot),
          status: existing.rows[0].status || 'requested',
          requestedAt: existing.rows[0].requested_at,
        }
      : null;

    const learnerTimeZone = normalizeTimeZone(activation?.learnerTimezone || requestedTimeZone);
    const availability = await getInstructorAvailability({
      learnerTimeZone,
      excludeUid: uid,
      excludeCourseId: courseIdNum,
      includeDebug: debugEnabled,
    });
    const instructors = Array.isArray(availability) ? availability : availability.instructors;
    const availabilityDebugStats = Array.isArray(availability?.debugStats) ? availability.debugStats : [];

    if (debugEnabled) {
      const slotStats = instructors.map((item) => {
        const extra = availabilityDebugStats.find((s) => s.instructorId === String(item?.instructorId || '')) || {};
        return {
        instructorId: String(item?.instructorId || ''),
        instructorName: String(item?.instructorName || ''),
        slotCount: Array.isArray(item?.timeSlots) ? item.timeSlots.length : 0,
        filterStats: {
          rawSlotRows: Number(extra.rawSlotRows || 0),
          missingSlotRows: Number(extra.missingSlotRows || 0),
          invalidRanges: Number(extra.invalidRanges || 0),
          endedRanges: Number(extra.endedRanges || 0),
          totalHourChunks: Number(extra.totalHourChunks || 0),
          expiredChunks: Number(extra.expiredChunks || 0),
          bookedChunks: Number(extra.bookedChunks || 0),
          includedChunks: Number(extra.includedChunks || 0),
        },
        previewSlots: Array.isArray(item?.timeSlots)
          ? item.timeSlots.slice(0, 3).map((slot) => ({
            slotId: slot?.slotId || '',
            startAtUtc: slot?.startAtUtc || '',
            endAtUtc: slot?.endAtUtc || '',
            label: slot?.label || '',
          }))
          : [],
      };
      });

      const nowDbMs = await getCurrentDbTimeMs();
      const logPayload = {
        tag: 'activation-options-debug',
        uid,
        courseId: courseIdNum,
        requestedTimeZone,
        learnerTimeZone,
        nowServerIso: new Date().toISOString(),
        nowDbIso: new Date(nowDbMs).toISOString(),
        activation: activation
          ? {
              instructorId: activation.instructorId,
              timeslotId: activation.timeslotId,
              noGoodTimeslot: activation.noGoodTimeslot,
              status: activation.status,
            }
          : null,
        instructorCount: instructors.length,
        slotStats,
      };

      // eslint-disable-next-line no-console
      console.log(JSON.stringify(logPayload));

      return res.json({
        instructors,
        activation,
        learnerTimeZone,
        debug: {
          nowServerIso: logPayload.nowServerIso,
          nowDbIso: logPayload.nowDbIso,
          instructorCount: logPayload.instructorCount,
          slotStats,
        },
      });
    }

    return res.json({ instructors, activation, learnerTimeZone });
  } catch {
    return res.status(500).json({ error: 'Failed to load activation options.' });
  }
});

router.post('/:uid/purchases/:courseId/activate', async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const { uid, courseId } = req.params;
  if (!isValidUid(uid)) {
    return res.status(400).json({ error: 'Invalid uid.' });
  }

  const courseIdNum = Number.parseInt(String(courseId || ''), 10);
  if (!Number.isFinite(courseIdNum) || courseIdNum <= 0) {
    return res.status(400).json({ error: 'Invalid courseId.' });
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const verification = await verifyFirebaseToken(authHeader.slice(7));
  if (verification.valid === false && verification.userDeleted) {
    await deleteUserFromSupabase(uid);
    return res.status(401).json({ error: 'Account has been deleted.' });
  }
  if (verification.valid === false || (verification.valid === true && verification.uid !== uid)) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const instructorId = String(req.body?.instructorId || '').trim();
  const timeslotId = String(req.body?.timeslotId || '').trim();
  const noGoodTimeslot = Boolean(req.body?.noGoodTimeslot);
  const learnerTimeZone = normalizeTimeZone(req.body?.learnerTimezone || 'Asia/Kolkata');

  try {
    await ensurePurchasesTable();
    await ensureActivationsTable();
    await ensureInstructorTables();

    const purchase = await pool.query(
      `select course_id from ${purchasesTable} where uid = $1 and course_id = $2 limit 1`,
      [uid, courseIdNum],
    );
    if (!purchase.rows[0]) {
      return res.status(404).json({ error: 'Course purchase not found.' });
    }

    const instructor = await getInstructorById(instructorId);
    if (!instructor) {
      return res.status(400).json({ error: 'Please select a valid instructor.' });
    }

    const existingActivation = await pool.query(
      `
        select class_no, selected_slot_date, selected_class_start_at, selected_class_end_at
        from ${activationTable}
        where uid = $1 and course_id = $2
        limit 1
      `,
      [uid, courseIdNum],
    );
    const previousClassNo = Number(existingActivation.rows[0]?.class_no || 1);
    const previousSlotDate = String(existingActivation.rows[0]?.selected_slot_date || '').trim();
    const previousClassStart = existingActivation.rows[0]?.selected_class_start_at
      ? new Date(existingActivation.rows[0].selected_class_start_at).toISOString()
      : '';
    const previousClassEndMs = existingActivation.rows[0]?.selected_class_end_at
      ? new Date(existingActivation.rows[0].selected_class_end_at).getTime()
      : Number.NaN;

    let selectedSlot = null;
    if (!noGoodTimeslot) {
      selectedSlot = await getInstructorSlot(instructor.instructorId, timeslotId);
      if (!selectedSlot) {
        return res.status(400).json({ error: 'Please select a valid timeslot for the chosen instructor.' });
      }

      const slotConflict = await pool.query(
        `
          select id
          from ${activationTable}
          where instructor_id = $1
            and timeslot_id = $2
            and no_good_timeslot = false
            and status = 'activated'
            and not (uid = $3 and course_id = $4)
          limit 1
        `,
        [instructor.instructorId, selectedSlot.slotId, uid, courseIdNum],
      );

      if (slotConflict.rows[0]) {
        return res.status(409).json({ error: 'This one-hour slot has just been booked. Please choose another slot.' });
      }
    }

    const selectedLabel = selectedSlot
      ? formatUtcRangeInTimeZone(selectedSlot.startAtUtc, selectedSlot.endAtUtc, learnerTimeZone)
      : null;
    let classNo = Math.max(previousClassNo, 1);
    if (!noGoodTimeslot && selectedSlot && previousClassStart && selectedSlot.startAtUtc !== previousClassStart) {
      const nowMs = await getCurrentDbTimeMs();
      const ended = Number.isFinite(previousClassEndMs) && nowMs > previousClassEndMs;
      classNo = ended ? previousClassNo + 1 : previousClassNo;
    }

    if (!noGoodTimeslot && selectedSlot) {
      const sameDateDifferentClass = await pool.query(
        `
          select id
          from ${classScheduleTable}
          where uid = $1 and course_id = $2 and slot_date = $3 and class_no <> $4
          limit 1
        `,
        [uid, courseIdNum, selectedSlot.slotDate, classNo],
      );

      if (sameDateDifferentClass.rows[0]) {
        return res.status(409).json({
          error: 'Two classes of the same course cannot be scheduled on the same date.',
        });
      }

      if (classNo > previousClassNo && previousSlotDate && selectedSlot.slotDate === previousSlotDate) {
        return res.status(409).json({
          error: 'Class 2 (or higher) cannot be on the same date as the previous class.',
        });
      }
    }

    const result = await pool.query(
      `
        insert into ${activationTable}
          (
            uid,
            course_id,
            instructor_id,
            instructor_name,
            timeslot_id,
            timeslot_label,
            learner_timezone,
            class_no,
            selected_slot_date,
            selected_class_start_at,
            selected_class_end_at,
            no_good_timeslot,
            status,
            requested_at,
            updated_at
          )
        values
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, current_timestamp, current_timestamp)
        on conflict (uid, course_id) do update set
          instructor_id = excluded.instructor_id,
          instructor_name = excluded.instructor_name,
          timeslot_id = excluded.timeslot_id,
          timeslot_label = excluded.timeslot_label,
          learner_timezone = excluded.learner_timezone,
          class_no = excluded.class_no,
          selected_slot_date = excluded.selected_slot_date,
          selected_class_start_at = excluded.selected_class_start_at,
          selected_class_end_at = excluded.selected_class_end_at,
          no_good_timeslot = excluded.no_good_timeslot,
          status = excluded.status,
          requested_at = excluded.requested_at,
          updated_at = excluded.updated_at
        returning
          instructor_id,
          instructor_name,
          timeslot_id,
          timeslot_label,
          learner_timezone,
          class_no,
          selected_slot_date,
          selected_class_start_at,
          selected_class_end_at,
          no_good_timeslot,
          status,
          requested_at
      `,
      [
        uid,
        courseIdNum,
        instructor.instructorId,
        instructor.instructorName,
        selectedSlot?.slotId || null,
        selectedLabel,
        learnerTimeZone,
        classNo,
        selectedSlot?.slotDate || null,
        selectedSlot?.startAtUtc || null,
        selectedSlot?.endAtUtc || null,
        noGoodTimeslot,
        noGoodTimeslot ? 'awaiting-manual-slot' : 'activated',
      ],
    );

    const row = result.rows[0];

    if (!noGoodTimeslot && selectedSlot) {
      await pool.query(
        `
          insert into ${classScheduleTable}
            (uid, course_id, class_no, slot_date, start_at, end_at, updated_at)
          values
            ($1, $2, $3, $4, $5, $6, current_timestamp)
          on conflict (uid, course_id, class_no) do update set
            slot_date = excluded.slot_date,
            start_at = excluded.start_at,
            end_at = excluded.end_at,
            updated_at = excluded.updated_at
        `,
        [uid, courseIdNum, classNo, selectedSlot.slotDate, selectedSlot.startAtUtc, selectedSlot.endAtUtc],
      );
    }

    return res.json({
      ok: true,
      activation: {
        instructorId: row.instructor_id || '',
        instructorName: row.instructor_name || '',
        timeslotId: row.timeslot_id || '',
        timeslotLabel: row.timeslot_label || '',
        learnerTimezone: row.learner_timezone || '',
        classNo: Number(row.class_no || 1),
        selectedSlotDate: row.selected_slot_date || null,
        selectedClassStartAt: row.selected_class_start_at || null,
        selectedClassEndAt: row.selected_class_end_at || null,
        noGoodTimeslot: Boolean(row.no_good_timeslot),
        status: row.status || 'requested',
        requestedAt: row.requested_at,
      },
    });
  } catch {
    return res.status(500).json({ error: 'Could not save course activation.' });
  }
});

// Check if user has purchased a specific course
router.get('/:uid/purchased/:courseId', async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const { uid, courseId } = req.params;
  if (!isValidUid(uid)) {
    return res.status(400).json({ error: 'Invalid uid.' });
  }

  const courseIdNum = Number.parseInt(String(courseId || ''), 10);
  if (!Number.isFinite(courseIdNum) || courseIdNum <= 0) {
    return res.status(400).json({ error: 'Invalid courseId.' });
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const verification = await verifyFirebaseToken(authHeader.slice(7));
  if (verification.valid === false && verification.userDeleted) {
    await deleteUserFromSupabase(uid);
    return res.status(401).json({ error: 'Account has been deleted.' });
  }
  if (verification.valid === false || (verification.valid === true && verification.uid !== uid)) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    await ensurePurchasesTable();
    const query = `
      select course_id from ${purchasesTable}
      where uid = $1 and course_id = $2
      limit 1
    `;
    const result = await pool.query(query, [uid, courseIdNum]);
    return res.json({ purchased: result.rows.length > 0 });
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to check purchase status.' });
  }
});

// Record a purchase
router.post('/:uid/purchases', async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const { uid } = req.params;
  if (!isValidUid(uid)) {
    return res.status(400).json({ error: 'Invalid uid.' });
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const verification = await verifyFirebaseToken(authHeader.slice(7));
  if (verification.valid === false && verification.userDeleted) {
    await deleteUserFromSupabase(uid);
    return res.status(401).json({ error: 'Account has been deleted.' });
  }
  if (verification.valid === false || (verification.valid === true && verification.uid !== uid)) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const body = req.body || {};
  const courseId = Number.parseInt(String(body.courseId || ''), 10);
  const courseTitle = String(body.courseTitle || '').trim();

  if (!Number.isFinite(courseId) || courseId <= 0) {
    return res.status(400).json({ error: 'Invalid courseId.' });
  }

  if (!courseTitle) {
    return res.status(400).json({ error: 'courseTitle is required.' });
  }

  try {
    await ensurePurchasesTable();
    const now = new Date().toISOString();
    
    // Check if already purchased
    const checkQuery = `
      select course_id from ${purchasesTable}
      where uid = $1 and course_id = $2
      limit 1
    `;
    const checkResult = await pool.query(checkQuery, [uid, courseId]);
    if (checkResult.rows.length > 0) {
      return res.json({ ok: true, message: 'Course already purchased (idempotent)' });
    }

    // Insert purchase
    const insertQuery = `
      insert into ${purchasesTable} (uid, course_id, course_title, purchase_date)
      values ($1, $2, $3, $4)
      returning uid, course_id, course_title, purchase_date
    `;
    const insertResult = await pool.query(insertQuery, [uid, courseId, courseTitle, now]);
    const row = insertResult.rows[0];

    return res.json({ ok: true, purchase: {
      courseId: row.course_id,
      courseTitle: row.course_title,
      purchaseDate: row.purchase_date,
    }});
  } catch (error) {
    console.error('Failed to record purchase:', error);
    return res.status(500).json({ error: 'Failed to record purchase.' });
  }
});

module.exports = router;
