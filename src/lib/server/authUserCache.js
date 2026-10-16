// A short per-instance cache of the MockMob user row that auth() needs on every request, so a
// signed-in request no longer costs one users read each. Plain module, no imports.
//
// What is cached: only the identity columns (id, name, email, image, subjects, role). Plan,
// premium and credit balance are NOT here: credits change inside database functions that this
// process never sees, and other serverless instances cannot be told to forget a payment. Code
// that needs entitlements reads Database.getUserById, which is never cached.
//
// Invalidation: Database.updateUser / createUser forget the user at once on this instance (any
// write, premium and plan included); other instances age the row out after TTL_MS. Rows that
// carry a privileged role are never kept, so a demotion applies immediately everywhere. A miss
// (no row) is never cached, so a row created a moment later is found.

export const AUTH_USER_TTL_MS = 30_000;
const MAX_ENTRIES = 500;
const NEVER_CACHED_ROLES = new Set(['admin', 'moderator']);

export function createAuthUserCache({ ttlMs = AUTH_USER_TTL_MS, maxEntries = MAX_ENTRIES, now = Date.now } = {}) {
  const entries = new Map(); // id -> { row, expires }
  const inflight = new Map(); // id -> Promise
  const versions = new Map(); // id -> number, bumped by invalidate()

  const versionOf = (id) => versions.get(id) || 0;

  function get(id) {
    const hit = entries.get(id);
    if (!hit) return null;
    if (hit.expires <= now()) {
      entries.delete(id);
      return null;
    }
    return hit.row;
  }

  function put(id, row) {
    if (!row || NEVER_CACHED_ROLES.has(String(row.role || '').toLowerCase())) {
      entries.delete(id);
      return;
    }
    if (entries.size >= maxEntries) {
      const oldest = entries.keys().next().value;
      entries.delete(oldest);
    }
    entries.delete(id);
    entries.set(id, { row, expires: now() + ttlMs });
  }

  function invalidate(id) {
    if (!id) return;
    entries.delete(id);
    inflight.delete(id);
    versions.set(id, versionOf(id) + 1);
    if (versions.size > maxEntries * 4) versions.clear();
  }

  /** Returns the cached row, or loads it with fetchRow() (one load at a time per user). */
  async function load(id, fetchRow) {
    if (!id) return null;
    const cached = get(id);
    if (cached) return cached;
    const pending = inflight.get(id);
    if (pending) return pending;
    const startedAt = versionOf(id);
    const promise = (async () => {
      try {
        const row = await fetchRow(id);
        // A write that landed while this read was in flight may have made the row stale.
        if (versionOf(id) === startedAt) put(id, row);
        return row || null;
      } finally {
        if (inflight.get(id) === promise) inflight.delete(id);
      }
    })();
    inflight.set(id, promise);
    return promise;
  }

  function clear() {
    entries.clear();
    inflight.clear();
    versions.clear();
  }

  return { load, get, invalidate, clear, size: () => entries.size };
}

// One cache per server instance, shared by every request it serves.
export const authUserCache = createAuthUserCache();
export const invalidateAuthUser = (id) => authUserCache.invalidate(id);
