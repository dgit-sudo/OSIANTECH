const express = require('express');
const { Pool } = require('pg');

const router = express.Router();

const { verifyFirebaseToken } = require('../lib/firebase-auth');
const firebaseApiKey = process.env.FIREBASE_API_KEY || '';
const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
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
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    })
  : null;

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

    await client.query(`delete from ${purchasesTable} where uid = $1`, [sourceUid]);
    await client.query(`delete from ${profileTable} where uid = $1`, [sourceUid]);
    await client.query(`delete from ${usersTable} where uid = $1`, [sourceUid]);

    const scopedTables = await getUidScopedTables(client);
    const preservedTables = new Set([purchasesTable, profileTable, usersTable]);
    for (const table of scopedTables) {
      if (preservedTables.has(table)) continue;
      await client.query(`delete from ${table} where uid = $1`, [sourceUid]);
    }

    await client.query('commit');

    return res.json({
      ok: true,
      transferredCourses: transferSummary.transferredCourses,
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

router.post('/api/users/:uid/delete', requireAdminAuth, async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const uid = String(req.params.uid || '').trim();
  if (!isValidUid(uid)) {
    return res.status(400).json({ error: 'Invalid uid.' });
  }

  try {
    await deleteUserRemnants(uid);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Could not delete user.' });
  }
});

module.exports = router;
