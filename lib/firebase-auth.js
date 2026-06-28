'use strict';

/**
 * Shared Firebase token verification with in-memory cache.
 *
 * Without caching, every authenticated API request makes a live round-trip to
 * identitytoolkit.googleapis.com (~200–500 ms). With caching, the first call
 * per token pays the cost once; all subsequent calls within the token's
 * lifetime (~1 hour) return instantly from memory.
 */

const firebaseApiKey = process.env.FIREBASE_API_KEY || '';

// Map<idToken, { result, expiresAt }>
const tokenCache = new Map();

function getTokenExpiry(idToken) {
  try {
    const b64 = idToken.split('.')[1];
    if (!b64) return null;
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

// Purge stale entries every 10 minutes so the Map doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of tokenCache) {
    if (now >= entry.expiresAt) tokenCache.delete(key);
  }
}, 10 * 60 * 1000).unref();

/**
 * Verify a Firebase ID token.
 *
 * Returns { valid, uid, email, providerIds, userDeleted }.
 * valid === true  → token is good, uid/email are set
 * valid === false → token rejected by Firebase (expired, revoked, not found)
 * valid === null  → network/config error, treat as temporary failure
 */
async function verifyFirebaseToken(idToken) {
  if (!firebaseApiKey || !idToken) {
    return { valid: null, uid: null, email: null, providerIds: [], userDeleted: false };
  }

  const cached = tokenCache.get(idToken);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.result;
  }

  let result;
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
      const msg = String(data.error?.message || '');
      result = {
        valid: false,
        uid: null,
        email: null,
        providerIds: [],
        userDeleted: msg === 'USER_NOT_FOUND',
      };
    } else {
      const user = data?.users?.[0] || null;
      const providerIds = Array.isArray(user?.providerUserInfo)
        ? user.providerUserInfo.map((p) => String(p?.providerId || '').trim()).filter(Boolean)
        : [];
      result = {
        valid: true,
        uid: user?.localId || null,
        email: String(user?.email || '').trim().toLowerCase() || null,
        providerIds,
        userDeleted: false,
      };
    }
  } catch {
    // Network error — don't cache, let next request retry
    return { valid: null, uid: null, email: null, providerIds: [], userDeleted: false };
  }

  // Cache valid or definitively-invalid results until 5 min before token expiry
  if (result.valid !== null) {
    const tokenExp = getTokenExpiry(idToken);
    const expiresAt = tokenExp
      ? Math.min(tokenExp - 5 * 60 * 1000, Date.now() + 55 * 60 * 1000)
      : Date.now() + 55 * 60 * 1000;
    if (expiresAt > Date.now()) {
      tokenCache.set(idToken, { result, expiresAt });
    }
  }

  return result;
}

module.exports = { verifyFirebaseToken };
