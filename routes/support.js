const express = require('express');
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

const dbReady = Boolean(connectionString);
const pool = dbReady
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  : null;

let supportTablesReady = false;

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

function toSafeText(value = '', maxLen = 4000) {
  return String(value || '').trim().slice(0, maxLen);
}

function sanitizeImagePayload(image = null) {
  if (!image || typeof image !== 'object') return null;

  const dataUrl = String(image.dataUrl || '').trim();
  const mimeType = String(image.mimeType || '').trim().toLowerCase();
  const fileName = String(image.fileName || '').trim().slice(0, 180);

  if (!dataUrl || !mimeType) return null;
  if (!/^image\/(png|jpeg|jpg|gif|webp)$/.test(mimeType)) return null;
  if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(dataUrl)) return null;

  // Keep payload small enough for DB/API transport.
  if (dataUrl.length > 2_500_000) return null;

  return {
    dataUrl,
    mimeType: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType,
    fileName: fileName || 'upload-image',
  };
}

async function verifyFirebaseToken(idToken) {
  if (!firebaseApiKey || !idToken) {
    return {
      valid: null,
      uid: null,
      email: null,
      providerIds: [],
    };
  }

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
      return {
        valid: false,
        uid: null,
        email: null,
        providerIds: [],
      };
    }

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
      valid: null,
      uid: null,
      email: null,
      providerIds: [],
    };
  }
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return '';
  return authHeader.slice(7).trim();
}

async function requireUserAuth(req, res, next) {
  const idToken = getBearerToken(req);
  if (!idToken) return res.status(401).json({ error: 'Unauthorized.' });

  const verification = await verifyFirebaseToken(idToken);
  if (!verification.valid || !verification.uid || !verification.email) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  req.authUser = verification;
  return next();
}

async function requireAdminAuth(req, res, next) {
  const idToken = getBearerToken(req);
  if (!idToken) return res.status(401).json({ error: 'Unauthorized.' });

  const verification = await verifyFirebaseToken(idToken);
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

  req.authUser = verification;
  return next();
}

async function ensureSupportTables() {
  if (!pool || supportTablesReady) return;

  await pool.query(`
    create table if not exists support_chats (
      id serial primary key,
      uid varchar(128) not null,
      status varchar(20) not null default 'open',
      feedback_requested_at timestamp null,
      feedback_submitted_at timestamp null,
      feedback_rating integer null,
      feedback_comment text null,
      started_at timestamp not null default current_timestamp,
      ended_at timestamp null,
      created_at timestamp not null default current_timestamp,
      updated_at timestamp not null default current_timestamp
    )
  `);

  await pool.query(`
    create table if not exists support_messages (
      id serial primary key,
      chat_id integer not null references support_chats(id) on delete cascade,
      sender_uid varchar(128) null,
      sender_role varchar(20) not null,
      message text not null,
      image_data text null,
      image_mime varchar(80) null,
      image_name varchar(180) null,
      created_at timestamp not null default current_timestamp
    )
  `);

  await pool.query('create index if not exists idx_support_chats_uid on support_chats(uid)');
  await pool.query('create index if not exists idx_support_chats_status on support_chats(status)');
  await pool.query('create index if not exists idx_support_messages_chat_id on support_messages(chat_id)');

  supportTablesReady = true;
}

async function ensureActivatedDashboard(uid) {
  const result = await pool.query(
    `
      select
        coalesce(u.profile_completed, false) as user_completed,
        coalesce(p.completed_profile, false) as profile_completed
      from ${usersTable} u
      left join ${profileTable} p on p.uid = u.uid
      where u.uid = $1
      limit 1
    `,
    [uid],
  );

  if (!result.rows[0]) return false;
  return Boolean(result.rows[0].user_completed || result.rows[0].profile_completed);
}

async function getChatSummaryByUid(uid) {
  const chatRows = await pool.query(
    `
      select
        c.id,
        c.uid,
        c.status,
        c.feedback_requested_at,
        c.feedback_submitted_at,
        c.feedback_rating,
        c.feedback_comment,
        c.started_at,
        c.ended_at,
        c.updated_at,
        coalesce(msg.message, '') as last_message,
        msg.created_at as last_message_at,
        coalesce(msg.sender_role, '') as last_sender_role
      from support_chats c
      left join lateral (
        select m.message, m.created_at, m.sender_role
        from support_messages m
        where m.chat_id = c.id
        order by m.created_at desc
        limit 1
      ) msg on true
      where c.uid = $1
      and c.status != 'ended'
      order by c.updated_at desc, c.id desc
    `,
    [uid],
  );

  return chatRows.rows.map((row) => ({
    id: Number(row.id),
    uid: row.uid,
    status: row.status,
    feedbackRequestedAt: row.feedback_requested_at,
    feedbackSubmittedAt: row.feedback_submitted_at,
    feedbackRating: row.feedback_rating,
    feedbackComment: row.feedback_comment || '',
    startedAt: row.started_at,
    endedAt: row.ended_at,
    updatedAt: row.updated_at,
    lastMessage: row.last_message || '',
    lastMessageAt: row.last_message_at,
    lastSenderRole: row.last_sender_role || '',
  }));
}

async function getChatMessages(chatId) {
  const rows = await pool.query(
    `
      select id, chat_id, sender_uid, sender_role, message, image_data, image_mime, image_name, created_at
      from support_messages
      where chat_id = $1
      order by created_at asc, id asc
    `,
    [chatId],
  );

  return rows.rows.map((row) => ({
    id: Number(row.id),
    chatId: Number(row.chat_id),
    senderUid: row.sender_uid || '',
    senderRole: row.sender_role,
    message: row.message,
    image: row.image_data
      ? {
          dataUrl: row.image_data,
          mimeType: row.image_mime || '',
          fileName: row.image_name || '',
        }
      : null,
    createdAt: row.created_at,
  }));
}

router.post('/chats/start', requireUserAuth, async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const uid = req.authUser.uid;
  if (!isValidUid(uid)) return res.status(400).json({ error: 'Invalid uid.' });

  try {
    await ensureSupportTables();

    const activated = await ensureActivatedDashboard(uid);
    if (!activated) {
      return res.status(403).json({ error: 'Support is available only after dashboard activation.' });
    }

    const existingOpen = await pool.query(
      'select id from support_chats where uid = $1 and status = $2 order by id desc limit 1',
      [uid, 'open'],
    );

    let chatId;
    if (existingOpen.rows[0]) {
      chatId = Number(existingOpen.rows[0].id);
    } else {
      const created = await pool.query(
        'insert into support_chats (uid, status) values ($1, $2) returning id',
        [uid, 'open'],
      );
      chatId = Number(created.rows[0].id);
    }

    const chats = await getChatSummaryByUid(uid);
    const messages = await getChatMessages(chatId);

    return res.json({ ok: true, chatId, chats, messages });
  } catch {
    return res.status(500).json({ error: 'Could not start support chat.' });
  }
});

router.get('/chats/my', requireUserAuth, async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const uid = req.authUser.uid;
  if (!isValidUid(uid)) return res.status(400).json({ error: 'Invalid uid.' });

  try {
    await ensureSupportTables();

    const activated = await ensureActivatedDashboard(uid);
    if (!activated) {
      return res.status(403).json({ error: 'Support is available only after dashboard activation.' });
    }

    const chats = await getChatSummaryByUid(uid);
    return res.json({ ok: true, chats });
  } catch {
    return res.status(500).json({ error: 'Could not load chats.' });
  }
});

router.get('/chats/:chatId/messages', requireUserAuth, async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const uid = req.authUser.uid;
  const chatId = Number.parseInt(String(req.params.chatId || ''), 10);
  if (!Number.isFinite(chatId) || chatId <= 0) {
    return res.status(400).json({ error: 'Invalid chat id.' });
  }

  try {
    await ensureSupportTables();

    const chat = await pool.query('select id, uid from support_chats where id = $1 limit 1', [chatId]);
    if (!chat.rows[0]) return res.status(404).json({ error: 'Chat not found.' });
    if (chat.rows[0].uid !== uid) return res.status(403).json({ error: 'Forbidden.' });

    const messages = await getChatMessages(chatId);
    return res.json({ ok: true, messages });
  } catch {
    return res.status(500).json({ error: 'Could not load messages.' });
  }
});

router.post('/chats/:chatId/messages', requireUserAuth, async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const uid = req.authUser.uid;
  const chatId = Number.parseInt(String(req.params.chatId || ''), 10);
  if (!Number.isFinite(chatId) || chatId <= 0) {
    return res.status(400).json({ error: 'Invalid chat id.' });
  }

  const message = toSafeText(req.body?.message || '', 4000);
  const image = sanitizeImagePayload(req.body?.image || null);
  if (!message && !image) {
    return res.status(400).json({ error: 'Message or image is required.' });
  }

  try {
    await ensureSupportTables();

    const chat = await pool.query(
      'select id, uid, status from support_chats where id = $1 limit 1',
      [chatId],
    );
    if (!chat.rows[0]) return res.status(404).json({ error: 'Chat not found.' });
    if (chat.rows[0].uid !== uid) return res.status(403).json({ error: 'Forbidden.' });
    if (chat.rows[0].status !== 'open') return res.status(400).json({ error: 'Chat has ended.' });

    const inserted = await pool.query(
      `
        insert into support_messages (chat_id, sender_uid, sender_role, message, image_data, image_mime, image_name)
        values ($1, $2, $3, $4, $5, $6, $7)
        returning id, chat_id, sender_uid, sender_role, message, image_data, image_mime, image_name, created_at
      `,
      [chatId, uid, 'user', message || '[image]', image?.dataUrl || null, image?.mimeType || null, image?.fileName || null],
    );

    await pool.query('update support_chats set updated_at = current_timestamp where id = $1', [chatId]);

    const row = inserted.rows[0];
    return res.json({
      ok: true,
      message: {
        id: Number(row.id),
        chatId: Number(row.chat_id),
        senderUid: row.sender_uid || '',
        senderRole: row.sender_role,
        message: row.message,
        image: row.image_data
          ? {
              dataUrl: row.image_data,
              mimeType: row.image_mime || '',
              fileName: row.image_name || '',
            }
          : null,
        createdAt: row.created_at,
      },
    });
  } catch {
    return res.status(500).json({ error: 'Could not send message.' });
  }
});

router.post('/chats/:chatId/feedback', requireUserAuth, async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const uid = req.authUser.uid;
  const chatId = Number.parseInt(String(req.params.chatId || ''), 10);
  if (!Number.isFinite(chatId) || chatId <= 0) {
    return res.status(400).json({ error: 'Invalid chat id.' });
  }

  const rating = Number.parseInt(String(req.body?.rating || ''), 10);
  const comment = toSafeText(req.body?.comment || '', 1000);

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
  }

  try {
    await ensureSupportTables();

    const chat = await pool.query(
      'select id, uid, feedback_requested_at from support_chats where id = $1 limit 1',
      [chatId],
    );
    if (!chat.rows[0]) return res.status(404).json({ error: 'Chat not found.' });
    if (chat.rows[0].uid !== uid) return res.status(403).json({ error: 'Forbidden.' });

    if (!chat.rows[0].feedback_requested_at) {
      return res.status(400).json({ error: 'Feedback has not been requested yet.' });
    }

    await pool.query(
      `
        update support_chats
        set feedback_rating = $2,
            feedback_comment = $3,
            feedback_submitted_at = current_timestamp,
            updated_at = current_timestamp
        where id = $1
      `,
      [chatId, rating, comment || null],
    );

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Could not save feedback.' });
  }
});

router.get('/admin/chats', requireAdminAuth, async (_req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  try {
    await ensureSupportTables();

    const query = `
      with latest as (
        select distinct on (m.chat_id)
          m.chat_id,
          m.message,
          m.sender_role,
          m.created_at
        from support_messages m
        order by m.chat_id, m.created_at desc, m.id desc
      ),
      purchase_counts as (
        select uid, count(*)::int as purchase_count
        from ${purchasesTable}
        group by uid
      )
      select
        c.id,
        c.uid,
        c.status,
        c.feedback_requested_at,
        c.feedback_submitted_at,
        c.feedback_rating,
        c.feedback_comment,
        c.started_at,
        c.ended_at,
        c.updated_at,
        coalesce(u.email, p.email, '') as email,
        coalesce(nullif(u.display_name, ''), p.name, '') as display_name,
        coalesce(pc.purchase_count, 0) as purchase_count,
        coalesce(latest.message, '') as last_message,
        latest.sender_role as last_sender_role,
        latest.created_at as last_message_at
      from support_chats c
      left join ${usersTable} u on u.uid = c.uid
      left join ${profileTable} p on p.uid = c.uid
      left join purchase_counts pc on pc.uid = c.uid
      left join latest on latest.chat_id = c.id
      where c.status != 'ended'
      order by c.updated_at desc, c.id desc
    `;

    const result = await pool.query(query);
    const chats = result.rows.map((row) => ({
      id: Number(row.id),
      uid: row.uid,
      status: row.status,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      updatedAt: row.updated_at,
      feedbackRequestedAt: row.feedback_requested_at,
      feedbackSubmittedAt: row.feedback_submitted_at,
      feedbackRating: row.feedback_rating,
      feedbackComment: row.feedback_comment || '',
      user: {
        uid: row.uid,
        email: row.email || '',
        displayName: row.display_name || '',
        purchaseCount: Number(row.purchase_count || 0),
      },
      lastMessage: row.last_message || '',
      lastSenderRole: row.last_sender_role || '',
      lastMessageAt: row.last_message_at,
    }));

    return res.json({ ok: true, chats });
  } catch {
    return res.status(500).json({ error: 'Could not load admin chats.' });
  }
});

router.get('/admin/chats/:chatId', requireAdminAuth, async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const chatId = Number.parseInt(String(req.params.chatId || ''), 10);
  if (!Number.isFinite(chatId) || chatId <= 0) {
    return res.status(400).json({ error: 'Invalid chat id.' });
  }

  try {
    await ensureSupportTables();

    const chatResult = await pool.query(
      `
        select
          c.id,
          c.uid,
          c.status,
          c.feedback_requested_at,
          c.feedback_submitted_at,
          c.feedback_rating,
          c.feedback_comment,
          c.started_at,
          c.ended_at,
          c.updated_at,
          coalesce(u.email, p.email, '') as email,
          coalesce(nullif(u.display_name, ''), p.name, '') as display_name,
          p.name,
          p.age,
          p.nationality,
          p.phone_number,
          p.gender,
          p.city,
          p.education,
          p.email as profile_email,
          p.completed_profile,
          coalesce(u.profile_completed, false) as user_profile_completed
        from support_chats c
        left join ${usersTable} u on u.uid = c.uid
        left join ${profileTable} p on p.uid = c.uid
        where c.id = $1
        limit 1
      `,
      [chatId],
    );

    if (!chatResult.rows[0]) {
      return res.status(404).json({ error: 'Chat not found.' });
    }

    const chatRow = chatResult.rows[0];

    const purchasesResult = await pool.query(
      `
        select course_id, course_title, purchase_date
        from ${purchasesTable}
        where uid = $1
        order by purchase_date desc
      `,
      [chatRow.uid],
    );

    const messages = await getChatMessages(chatId);

    return res.json({
      ok: true,
      chat: {
        id: Number(chatRow.id),
        uid: chatRow.uid,
        status: chatRow.status,
        startedAt: chatRow.started_at,
        endedAt: chatRow.ended_at,
        updatedAt: chatRow.updated_at,
        feedbackRequestedAt: chatRow.feedback_requested_at,
        feedbackSubmittedAt: chatRow.feedback_submitted_at,
        feedbackRating: chatRow.feedback_rating,
        feedbackComment: chatRow.feedback_comment || '',
      },
      user: {
        uid: chatRow.uid,
        email: chatRow.email || '',
        displayName: chatRow.display_name || '',
      },
      profile: (chatRow.user_profile_completed || chatRow.completed_profile)
        ? {
            name: chatRow.name || chatRow.display_name || '',
            age: Number(chatRow.age || 0),
            nationality: chatRow.nationality || '',
            phoneNumber: chatRow.phone_number || '',
            gender: chatRow.gender || '',
            city: chatRow.city || '',
            education: chatRow.education || '',
            email: chatRow.profile_email || chatRow.email || '',
          }
        : null,
      purchases: purchasesResult.rows.map((row) => ({
        courseId: row.course_id,
        courseTitle: row.course_title,
        purchaseDate: row.purchase_date,
      })),
      messages,
    });
  } catch {
    return res.status(500).json({ error: 'Could not load chat details.' });
  }
});

router.post('/admin/chats/:chatId/messages', requireAdminAuth, async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const chatId = Number.parseInt(String(req.params.chatId || ''), 10);
  if (!Number.isFinite(chatId) || chatId <= 0) {
    return res.status(400).json({ error: 'Invalid chat id.' });
  }

  const message = toSafeText(req.body?.message || '', 4000);
  const image = sanitizeImagePayload(req.body?.image || null);
  if (!message && !image) {
    return res.status(400).json({ error: 'Message or image is required.' });
  }

  try {
    await ensureSupportTables();

    const chat = await pool.query(
      'select id, status from support_chats where id = $1 limit 1',
      [chatId],
    );
    if (!chat.rows[0]) return res.status(404).json({ error: 'Chat not found.' });
    if (chat.rows[0].status !== 'open') return res.status(400).json({ error: 'Chat has ended.' });

    const inserted = await pool.query(
      `
        insert into support_messages (chat_id, sender_uid, sender_role, message, image_data, image_mime, image_name)
        values ($1, $2, $3, $4, $5, $6, $7)
        returning id, chat_id, sender_uid, sender_role, message, image_data, image_mime, image_name, created_at
      `,
      [
        chatId,
        req.authUser.uid,
        'admin',
        message || '[image]',
        image?.dataUrl || null,
        image?.mimeType || null,
        image?.fileName || null,
      ],
    );

    await pool.query('update support_chats set updated_at = current_timestamp where id = $1', [chatId]);

    const row = inserted.rows[0];
    return res.json({
      ok: true,
      message: {
        id: Number(row.id),
        chatId: Number(row.chat_id),
        senderUid: row.sender_uid || '',
        senderRole: row.sender_role,
        message: row.message,
        image: row.image_data
          ? {
              dataUrl: row.image_data,
              mimeType: row.image_mime || '',
              fileName: row.image_name || '',
            }
          : null,
        createdAt: row.created_at,
      },
    });
  } catch {
    return res.status(500).json({ error: 'Could not send admin message.' });
  }
});

router.post('/admin/chats/:chatId/end', requireAdminAuth, async (req, res) => {
  if (!ensureDatabaseConfigured(res)) return;

  const chatId = Number.parseInt(String(req.params.chatId || ''), 10);
  if (!Number.isFinite(chatId) || chatId <= 0) {
    return res.status(400).json({ error: 'Invalid chat id.' });
  }

  try {
    await ensureSupportTables();

    const updated = await pool.query(
      `
        update support_chats
        set status = 'ended',
            ended_at = current_timestamp,
            feedback_requested_at = current_timestamp,
            updated_at = current_timestamp
        where id = $1 and status <> 'ended'
        returning id, status, ended_at, feedback_requested_at
      `,
      [chatId],
    );

    if (!updated.rows[0]) {
      const existing = await pool.query('select id, status from support_chats where id = $1 limit 1', [chatId]);
      if (!existing.rows[0]) return res.status(404).json({ error: 'Chat not found.' });
      return res.status(400).json({ error: 'Chat already ended.' });
    }

    return res.json({
      ok: true,
      chat: {
        id: Number(updated.rows[0].id),
        status: updated.rows[0].status,
        endedAt: updated.rows[0].ended_at,
        feedbackRequestedAt: updated.rows[0].feedback_requested_at,
      },
    });
  } catch {
    return res.status(500).json({ error: 'Could not end chat.' });
  }
});

module.exports = router;
