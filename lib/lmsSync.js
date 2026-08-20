/**
 * LMS Synchronization Module (Chamilo / Moodle LMS Integration)
 * Automatically syncs student course purchases to the Learning Management System
 */

const { Pool } = require('pg');

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '';
const purchasesTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_PURCHASES_TABLE || '')
  ? process.env.SUPABASE_PURCHASES_TABLE
  : 'user_purchases';
const profileTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_PROFILES_TABLE || '')
  ? process.env.SUPABASE_PROFILES_TABLE
  : 'user_profiles';

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30000,
    })
  : null;

/**
 * Sync a purchased course to Chamilo LMS
 * @param {Object} params
 * @param {string} params.uid - Student Firebase UID
 * @param {string} [params.email] - Student Email
 * @param {string|number} params.courseId - Course ID
 * @param {string} params.courseTitle - Course Title
 */
async function syncCourseToLms({ uid, email, courseId, courseTitle }) {
  const lmsBaseUrl = String(
    process.env.CHAMILO_URL ||
    process.env.LMS_URL ||
    process.env.LMS_SSO_URL ||
    'https://learn.osian.tech'
  ).replace(/\/+$/, '');

  const syncEndpoint = process.env.CHAMILO_ENROLL_URL || `${lmsBaseUrl}/api/v2/courses/enroll`;
  const lmsSecret = process.env.CHAMILO_API_KEY || process.env.LMS_SYNC_SECRET || '';

  const courseCode = `OSIAN_${courseId}`;

  console.log(`[LMS Sync] Initiating enrollment sync for UID: ${uid}, Email: ${email || 'N/A'}, Course: [${courseId}] "${courseTitle}" -> ${lmsBaseUrl}`);

  // Fetch email from profile table if not passed
  let studentEmail = email || '';
  if (!studentEmail && pool) {
    try {
      const res = await pool.query(`SELECT email, name FROM ${profileTable} WHERE uid = $1 LIMIT 1`, [uid]);
      if (res.rows[0]?.email) studentEmail = res.rows[0].email;
    } catch (_e) {
      // ignore
    }
  }

  const payload = {
    uid,
    email: studentEmail,
    courseId: Number(courseId),
    courseCode,
    courseTitle,
    enrolledAt: new Date().toISOString(),
    source: 'osian-store',
  };

  try {
    const res = await fetch(syncEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(lmsSecret ? { 'Authorization': `Bearer ${lmsSecret}`, 'X-LMS-Secret': lmsSecret } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      console.log(`[LMS Sync] ✅ Successfully synced course ${courseId} to LMS for user ${uid}`);
      return { success: true, status: res.status };
    } else {
      console.log(`[LMS Sync] ℹ️ LMS endpoint responded with status ${res.status}. Enrollment recorded in master DB.`);
      return { success: false, status: res.status };
    }
  } catch (err) {
    // Network / offline notice - safe non-blocking
    console.log(`[LMS Sync] ℹ️ LMS webhook notice (${err.message}). Enrollment active in master purchases DB.`);
    return { success: false, error: err.message };
  }
}

/**
 * Get all courses for a user for Chamilo LMS sync verification
 */
async function getUserLmsCourses(uidOrEmail) {
  if (!pool || !uidOrEmail) return [];
  try {
    const query = `
      SELECT course_id, course_title, purchase_date
      FROM ${purchasesTable}
      WHERE uid = $1 
         OR uid IN (SELECT uid FROM ${profileTable} WHERE lower(email) = lower($1))
      ORDER BY purchase_date ASC
    `;
    const res = await pool.query(query, [uidOrEmail]);
    return res.rows.map(r => ({
      courseId: r.course_id,
      courseCode: `OSIAN_${r.course_id}`,
      courseTitle: r.course_title,
      purchaseDate: r.purchase_date,
    }));
  } catch (err) {
    console.error('[LMS Sync] Error fetching user courses:', err.message);
    return [];
  }
}

module.exports = {
  syncCourseToLms,
  getUserLmsCourses,
};
