'use strict';

/**
 * Lightweight in-memory TTL cache for API responses.
 * Entries are automatically evicted after their TTL expires.
 */

const store = new Map();

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function set(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function invalidate(key) {
  store.delete(key);
}

function invalidatePrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

// Prune expired entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now >= v.expiresAt) store.delete(k);
  }
}, 2 * 60 * 1000).unref();

module.exports = { get, set, invalidate, invalidatePrefix };
