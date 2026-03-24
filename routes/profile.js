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
const purchasesTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_PURCHASES_TABLE || '')
  ? process.env.SUPABASE_PURCHASES_TABLE
  : 'user_purchases';

const dbReady = Boolean(connectionString);
const pool = dbReady
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  : null;

let purchasesTableReady = false;

function isValidUid(uid = '') {
  return typeof uid === 'string' && /^[a-zA-Z0-9_-]{6,128}$/.test(uid);
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
    const query = `
      select course_id, course_title, purchase_date
      from ${purchasesTable}
      where uid = $1
      order by purchase_date desc
    `;
    const result = await pool.query(query, [uid]);
    return res.json({ purchases: result.rows.map(row => ({
      courseId: row.course_id,
      courseTitle: row.course_title,
      purchaseDate: row.purchase_date,
    })) });
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to load purchases.' });
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
