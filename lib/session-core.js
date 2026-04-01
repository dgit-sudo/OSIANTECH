const crypto = require('crypto');
const { Pool } = require('pg');

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '';
const firebaseApiKey = process.env.FIREBASE_API_KEY || '';
const adminEmail = String(process.env.ADMIN_EMAIL || 'dhyanamshah38@gmail.com').trim().toLowerCase();

const activationTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_ACTIVATIONS_TABLE || '')
  ? process.env.SUPABASE_ACTIVATIONS_TABLE
  : 'course_activations';
const purchasesTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_PURCHASES_TABLE || '')
  ? process.env.SUPABASE_PURCHASES_TABLE
  : 'user_purchases';
const usersTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_USERS_TABLE || '')
  ? process.env.SUPABASE_USERS_TABLE
  : 'app_users';
const instructorTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_INSTRUCTORS_TABLE || '')
  ? process.env.SUPABASE_INSTRUCTORS_TABLE
  : 'instructor_accounts';
const liveSessionsTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_LIVE_SESSIONS_TABLE || '')
  ? process.env.SUPABASE_LIVE_SESSIONS_TABLE
  : 'live_sessions';

const instructorTokenSecret = process.env.INSTRUCTOR_AUTH_SECRET || 'osian-instructor-auth-secret-change-me';
const sessionAccessSecret = process.env.SESSION_ACCESS_SECRET || 'osian-session-access-secret-change-me';
const sessionTokenTtlSeconds = Number.parseInt(String(process.env.SESSION_ACCESS_TOKEN_TTL_SECONDS || '7200'), 10) || 7200;

const dbReady = Boolean(connectionString);
const pool = dbReady
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  : null;

let tablesReady = false;

function ensureDbConfigured() {
  if (!dbReady || !pool) {
    throw new Error('Database is not configured.');
  }
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isValidUid(uid = '') {
  return typeof uid === 'string' && /^[a-zA-Z0-9_-]{6,128}$/.test(uid);
}

function slugifyCourseName(input = '') {
  const normalized = String(input || '').trim().toLowerCase();
  const slug = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || 'course';
}

function toDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
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

function createSignedToken(payload, secret) {
  const rawPayload = JSON.stringify(payload);
  const encodedPayload = base64UrlEncode(rawPayload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${encodedPayload}.${signature}`;
}

function verifySignedToken(token, secret) {
  const value = String(token || '').trim();
  const parts = value.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, providedSig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (providedSig !== expectedSig) return null;

  try {
    return JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    return null;
  }
}

function verifyInstructorToken(token) {
  const payload = verifySignedToken(token, instructorTokenSecret);
  const exp = Number(payload?.exp || 0);
  if (!payload || !Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

async function verifyFirebaseIdToken(idToken) {
  if (!firebaseApiKey || !idToken) return { valid: null, uid: null, email: null };
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
    );

    if (!response.ok) return { valid: null, uid: null, email: null };
    const data = await response.json();
    if (data?.error) return { valid: false, uid: null, email: null };
    const user = data?.users?.[0] || null;
    return {
      valid: true,
      uid: String(user?.localId || '').trim() || null,
      email: normalizeEmail(user?.email || '') || null,
    };
  } catch {
    return { valid: null, uid: null, email: null };
  }
}

async function resolveActorFromRequest(req) {
  const instructorToken = String(req.headers['x-instructor-token'] || '').trim();
  if (instructorToken) {
    const payload = verifyInstructorToken(instructorToken);
    if (payload?.instructorUid) {
      return {
        role: 'instructor',
        instructorUid: String(payload.instructorUid),
        email: normalizeEmail(payload.email || ''),
      };
    }
  }

  const authHeader = String(req.headers.authorization || '');
  if (authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7).trim();

    const firebase = await verifyFirebaseIdToken(bearerToken);
    if (firebase.valid === true && firebase.uid && firebase.email) {
      if (normalizeEmail(firebase.email) === adminEmail) {
        return {
          role: 'admin',
          uid: firebase.uid,
          email: firebase.email,
        };
      }
      return {
        role: 'learner',
        uid: firebase.uid,
        email: firebase.email,
      };
    }

    const instructorPayload = verifyInstructorToken(bearerToken);
    if (instructorPayload?.instructorUid) {
      return {
        role: 'instructor',
        instructorUid: String(instructorPayload.instructorUid),
        email: normalizeEmail(instructorPayload.email || ''),
      };
    }
  }

  return null;
}

function canOpenJoinWindow(startsAt, endsAt, nowMs = Date.now()) {
  const start = toDate(startsAt);
  const end = toDate(endsAt);
  if (!start || !end || end <= start) return false;
  const joinOpenMs = start.getTime() - (30 * 60 * 1000);
  return nowMs >= joinOpenMs && nowMs <= end.getTime();
}

async function ensureSessionTables() {
  ensureDbConfigured();
  if (tablesReady) return;

  await pool.query(`
    create table if not exists ${liveSessionsTable} (
      id serial primary key,
      meeting_id varchar(64) not null unique,
      course_slug varchar(120) not null,
      course_id integer not null,
      class_no integer not null default 1,
      learner_uid varchar(128) not null,
      learner_email text null,
      instructor_uid varchar(128) not null,
      starts_at timestamp not null,
      ends_at timestamp not null,
      join_path text not null,
      support_requested boolean not null default false,
      support_requested_at timestamp null,
      support_requested_by varchar(32) null,
      created_at timestamp not null default current_timestamp,
      ended_at timestamp null
    )
  `);

  await pool.query(`create index if not exists idx_${liveSessionsTable}_meeting_id on ${liveSessionsTable}(meeting_id)`);
  await pool.query(`create index if not exists idx_${liveSessionsTable}_ongoing on ${liveSessionsTable}(ended_at, ends_at)`);
  await pool.query(`create index if not exists idx_${liveSessionsTable}_instructor on ${liveSessionsTable}(instructor_uid, ended_at)`);
  await pool.query(`create index if not exists idx_${liveSessionsTable}_learner on ${liveSessionsTable}(learner_uid, ended_at)`);

  tablesReady = true;
}

async function getLearnerActivation(uid, courseId) {
  await ensureSessionTables();
  const uidValue = String(uid || '').trim();
  const courseIdNum = Number.parseInt(String(courseId || ''), 10);
  if (!isValidUid(uidValue) || !Number.isFinite(courseIdNum) || courseIdNum <= 0) return null;

  const result = await pool.query(
    `
      select
        a.uid,
        a.course_id,
        a.class_no,
        a.instructor_id,
        a.status,
        a.no_good_timeslot,
        a.selected_class_start_at,
        a.selected_class_end_at,
        p.course_title,
        u.email as learner_email
      from ${activationTable} a
      join ${purchasesTable} p on p.uid = a.uid and p.course_id = a.course_id
      left join ${usersTable} u on u.uid = a.uid
      where a.uid = $1 and a.course_id = $2
      limit 1
    `,
    [uidValue, courseIdNum],
  );

  const row = result.rows[0];
  if (!row) return null;
  return {
    uid: row.uid,
    courseId: Number(row.course_id),
    courseTitle: row.course_title || `course-${row.course_id}`,
    classNo: Number(row.class_no || 1),
    instructorUid: String(row.instructor_id || ''),
    learnerEmail: normalizeEmail(row.learner_email || ''),
    status: String(row.status || ''),
    noGoodTimeslot: Boolean(row.no_good_timeslot),
    startsAt: row.selected_class_start_at,
    endsAt: row.selected_class_end_at,
  };
}

async function getInstructorActivation(instructorUid, learnerUid, courseId) {
  await ensureSessionTables();
  const courseIdNum = Number.parseInt(String(courseId || ''), 10);
  if (!isValidUid(learnerUid) || !Number.isFinite(courseIdNum) || courseIdNum <= 0) return null;

  const result = await pool.query(
    `
      select
        a.uid,
        a.course_id,
        a.class_no,
        a.instructor_id,
        a.status,
        a.no_good_timeslot,
        a.selected_class_start_at,
        a.selected_class_end_at,
        p.course_title,
        u.email as learner_email
      from ${activationTable} a
      join ${purchasesTable} p on p.uid = a.uid and p.course_id = a.course_id
      left join ${usersTable} u on u.uid = a.uid
      where a.uid = $1 and a.course_id = $2 and a.instructor_id = $3
      limit 1
    `,
    [learnerUid, courseIdNum, instructorUid],
  );

  const row = result.rows[0];
  if (!row) return null;
  return {
    uid: row.uid,
    courseId: Number(row.course_id),
    courseTitle: row.course_title || `course-${row.course_id}`,
    classNo: Number(row.class_no || 1),
    instructorUid: String(row.instructor_id || ''),
    learnerEmail: normalizeEmail(row.learner_email || ''),
    status: String(row.status || ''),
    noGoodTimeslot: Boolean(row.no_good_timeslot),
    startsAt: row.selected_class_start_at,
    endsAt: row.selected_class_end_at,
  };
}

async function getMeetingById(meetingId) {
  await ensureSessionTables();
  const id = String(meetingId || '').trim();
  if (!id) return null;
  const result = await pool.query(
    `
      select
        s.meeting_id,
        s.course_slug,
        s.course_id,
        s.class_no,
        s.learner_uid,
        s.learner_email,
        s.instructor_uid,
        s.starts_at,
        s.ends_at,
        s.join_path,
        s.support_requested,
        s.support_requested_at,
        s.support_requested_by,
        s.created_at,
        s.ended_at,
        p.course_title,
        i.display_name as instructor_name
      from ${liveSessionsTable} s
      left join ${purchasesTable} p on p.uid = s.learner_uid and p.course_id = s.course_id
      left join ${instructorTable} i on i.instructor_uid = s.instructor_uid
      where s.meeting_id = $1
      limit 1
    `,
    [id],
  );

  const row = result.rows[0];
  if (!row) return null;
  return {
    meetingId: row.meeting_id,
    courseSlug: row.course_slug,
    courseTitle: row.course_title || row.course_slug,
    courseId: Number(row.course_id),
    classNo: Number(row.class_no || 1),
    learnerUid: row.learner_uid,
    learnerEmail: row.learner_email || '',
    instructorUid: row.instructor_uid,
    instructorName: row.instructor_name || row.instructor_uid,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    joinPath: row.join_path,
    supportRequested: Boolean(row.support_requested),
    supportRequestedAt: row.support_requested_at,
    supportRequestedBy: row.support_requested_by || '',
    createdAt: row.created_at,
    endedAt: row.ended_at,
  };
}

async function createMeetingFromActivation(activation) {
  await ensureSessionTables();
  const nowMs = Date.now();
  if (!canOpenJoinWindow(activation.startsAt, activation.endsAt, nowMs)) {
    throw new Error('Join window is not open yet for this class.');
  }

  if (activation.status !== 'activated' || activation.noGoodTimeslot || !activation.instructorUid) {
    throw new Error('This class is not in a joinable state.');
  }

  const existing = await pool.query(
    `
      select meeting_id
      from ${liveSessionsTable}
      where learner_uid = $1 and course_id = $2 and class_no = $3 and ended_at is null
      order by created_at desc
      limit 1
    `,
    [activation.uid, activation.courseId, activation.classNo],
  );

  if (existing.rows[0]?.meeting_id) {
    const meeting = await getMeetingById(existing.rows[0].meeting_id);
    if (meeting) return meeting;
  }

  const courseSlug = slugifyCourseName(activation.courseTitle);
  let meetingId = '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    meetingId = crypto.randomBytes(8).toString('hex');
    const check = await pool.query(`select 1 from ${liveSessionsTable} where meeting_id = $1 limit 1`, [meetingId]);
    if (!check.rows[0]) break;
    meetingId = '';
  }
  if (!meetingId) throw new Error('Could not allocate meeting id.');

  const joinPath = `/session/${courseSlug}/${meetingId}`;

  await pool.query(
    `
      insert into ${liveSessionsTable}
      (
        meeting_id,
        course_slug,
        course_id,
        class_no,
        learner_uid,
        learner_email,
        instructor_uid,
        starts_at,
        ends_at,
        join_path,
        created_at
      )
      values
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, current_timestamp)
    `,
    [
      meetingId,
      courseSlug,
      activation.courseId,
      activation.classNo,
      activation.uid,
      activation.learnerEmail || null,
      activation.instructorUid,
      activation.startsAt,
      activation.endsAt,
      joinPath,
    ],
  );

  const meeting = await getMeetingById(meetingId);
  if (!meeting) throw new Error('Meeting creation failed.');
  return meeting;
}

function getJoinUrl(req, joinPath) {
  const host = String(req.get('host') || '').trim();
  const proto = String(req.protocol || 'https').trim();
  if (!host) return joinPath;
  return `${proto}://${host}${joinPath}`;
}

function isMeetingActive(meeting, nowMs = Date.now()) {
  if (!meeting || meeting.endedAt) return false;
  const end = toDate(meeting.endsAt);
  if (!end) return false;
  return nowMs <= end.getTime();
}

function authorizeMeetingActor(meeting, actor) {
  if (!meeting || !actor) return { ok: false, reason: 'Unauthorized.' };
  if (!isMeetingActive(meeting)) return { ok: false, reason: 'Meeting is not active.' };

  if (actor.role === 'admin' && normalizeEmail(actor.email) === adminEmail) {
    return { ok: true, role: 'admin' };
  }

  if (actor.role === 'instructor' && actor.instructorUid === meeting.instructorUid) {
    return { ok: true, role: 'instructor' };
  }

  if (actor.role === 'learner' && actor.uid === meeting.learnerUid) {
    return { ok: true, role: 'learner' };
  }

  return { ok: false, reason: 'You are not allowed to join this meeting.' };
}

function createSessionAccessToken(meeting, actorRole, actorIdentity) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + sessionTokenTtlSeconds;
  const payload = {
    mid: meeting.meetingId,
    role: actorRole,
    identity: String(actorIdentity || ''),
    exp,
  };
  return createSignedToken(payload, sessionAccessSecret);
}

function verifySessionAccessToken(token) {
  const payload = verifySignedToken(token, sessionAccessSecret);
  const exp = Number(payload?.exp || 0);
  if (!payload || !Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

async function markMeetingSupportRequested(meetingId, requestedByRole) {
  await ensureSessionTables();
  await pool.query(
    `
      update ${liveSessionsTable}
      set
        support_requested = true,
        support_requested_at = current_timestamp,
        support_requested_by = $2
      where meeting_id = $1 and ended_at is null
    `,
    [meetingId, String(requestedByRole || '').slice(0, 32)],
  );
}

async function listOngoingMeetings() {
  await ensureSessionTables();
  const rows = await pool.query(
    `
      select
        s.meeting_id,
        s.course_slug,
        s.course_id,
        s.class_no,
        s.learner_uid,
        s.learner_email,
        s.instructor_uid,
        i.display_name as instructor_name,
        s.starts_at,
        s.ends_at,
        s.join_path,
        s.support_requested,
        s.support_requested_at,
        s.support_requested_by,
        s.created_at
      from ${liveSessionsTable} s
      left join ${instructorTable} i on i.instructor_uid = s.instructor_uid
      where s.ended_at is null and s.ends_at >= current_timestamp
      order by s.starts_at asc
    `,
  );

  return rows.rows.map((row) => ({
    meetingId: row.meeting_id,
    courseSlug: row.course_slug,
    courseId: Number(row.course_id),
    classNo: Number(row.class_no || 1),
    learnerUid: row.learner_uid,
    learnerEmail: row.learner_email || '',
    instructorUid: row.instructor_uid,
    instructorName: row.instructor_name || row.instructor_uid,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    joinPath: row.join_path,
    supportRequested: Boolean(row.support_requested),
    supportRequestedAt: row.support_requested_at,
    supportRequestedBy: row.support_requested_by || '',
    createdAt: row.created_at,
  }));
}

async function endMeeting(meetingId, actor) {
  const meeting = await getMeetingById(meetingId);
  if (!meeting) {
    throw new Error('Meeting not found.');
  }

  if (meeting.endedAt) {
    return { ok: true, alreadyEnded: true, meeting };
  }

  if (actor.role !== 'instructor' || actor.instructorUid !== meeting.instructorUid) {
    throw new Error('Only the assigned instructor can end this class.');
  }

  const now = Date.now();
  const endAt = toDate(meeting.endsAt);
  if (!endAt || now < endAt.getTime()) {
    throw new Error('Class can be ended only after session end time is reached.');
  }

  await pool.query(
    `update ${liveSessionsTable} set ended_at = current_timestamp where meeting_id = $1 and ended_at is null`,
    [meetingId],
  );

  const updated = await getMeetingById(meetingId);
  return { ok: true, alreadyEnded: false, meeting: updated };
}

module.exports = {
  pool,
  ensureSessionTables,
  resolveActorFromRequest,
  getLearnerActivation,
  getInstructorActivation,
  createMeetingFromActivation,
  getMeetingById,
  getJoinUrl,
  authorizeMeetingActor,
  createSessionAccessToken,
  verifySessionAccessToken,
  markMeetingSupportRequested,
  listOngoingMeetings,
  endMeeting,
  canOpenJoinWindow,
};
