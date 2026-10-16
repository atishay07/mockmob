// Server-side Supabase reads for src/lib/auth.ts, with Supabase and the cookie store injected so
// node tests can drive them against a fake Supabase Auth server. Plain module: no server-only
// or next/* imports.

import {
  createAuthSafeFetch,
  isDeadSessionError,
  isTransientAuthError,
  mayWriteAuthCookies,
} from '../supabase-auth-errors.js';

/**
 * Reads the signed-in Supabase user from the request cookies.
 * Returns { user, transient }: transient is true when Supabase or the network failed and the
 * session may well be fine (callers answer 503, never 401).
 *
 * - `stale`: src/proxy.js could not refresh this request's session. Refreshing here would
 *   spend the refresh token where (in a Server Component) the new one cannot be written back,
 *   so the read is reported as transient without calling Supabase.
 * - Cookie writes are held until the outcome is known. New tokens are always written; a
 *   deletion is written only when Supabase definitively ended the session.
 */
export const READ_TIMEOUT_MS = 5000;
const TIMED_OUT = Symbol('timed_out');

export async function readCookieUser({
  cookieStore,
  createServerClient,
  supabaseUrl,
  supabaseKey,
  stale = false,
  timeoutMs = READ_TIMEOUT_MS,
  clientOptions = {},
}) {
  if (!supabaseUrl || !supabaseKey) return { user: null, transient: false };
  if (stale) return { user: null, transient: true };

  let pending = null;
  let settled = false;
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    ...clientOptions,
    global: { ...clientOptions.global, fetch: createAuthSafeFetch(clientOptions.global?.fetch) },
    cookies: {
      getAll: () => cookieStore.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (cookiesToSet) => {
        if (settled) return; // Arrived after the time budget; the answer has already gone out.
        pending = pending ? [...pending, ...cookiesToSet] : [...cookiesToSet];
      },
    },
  });

  let user = null;
  let failure = null;
  let timedOut = false;
  try {
    // getUser asks Supabase Auth, so a deleted or banned account is refused at once. That
    // matters because a valid identity can create the MockMob user row. The library retries a
    // failed refresh for up to 30 s; the budget keeps /api/auth/me answering (503) well before.
    const result = await withTimeout(supabase.auth.getUser(), timeoutMs);
    if (result === TIMED_OUT) timedOut = true;
    else if (result.error) failure = result.error;
    else user = result.data?.user || null;
  } catch (error) {
    failure = error;
  }
  settled = true;
  if (timedOut) return { user: null, transient: true };

  if (pending && mayWriteAuthCookies(pending, { deadSession: isDeadSessionError(failure) })) {
    for (const { name, value, options } of pending) {
      try {
        cookieStore.set(name, value, options);
      } catch {
        // Server Components cannot write cookies. src/proxy.js refreshes the session before
        // rendering and marks the request stale when it could not, so a page read does not
        // need to write.
      }
    }
  }

  if (failure) return { user: null, transient: isTransientAuthError(failure) };
  return { user, transient: false };
}

/**
 * True when Supabase has confirmed the account's email. MockMob accounts are keyed by email,
 * so an identity whose email nobody proved (a sign-up made directly against the Auth API) must
 * never resolve to a MockMob account. `confirmed_at` is not used: a confirmed phone would set it.
 */
export function hasConfirmedEmail(user) {
  return Boolean(user?.email && user.email_confirmed_at);
}

const UNIQUE_VIOLATION = '23505';

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Finds or creates the MockMob user row for a confirmed Supabase identity: by Supabase user id
 * first, then by email (older rows). Two first requests at once (the callback page and the
 * AuthProvider both call /api/auth/me) can both try to create the row; the loser reads the
 * winner's row instead of failing.
 *
 * onCreated (optional) runs once, only for the request whose insert created the row (not for the loser of
 * the race, not for an older row found by email). It is given nothing, so it cannot see who signed up,
 * and a failure in it is ignored: it must never change the sign-in result.
 */
export async function ensureDbUser(identity, db, { onCreated } = {}) {
  if (!identity?.email) return null;

  let dbUser = (identity.id ? await db.getUserById(identity.id) : null) || await db.getUserByEmail(identity.email);
  if (!dbUser) {
    try {
      const row = {
        id: identity.id,
        name: identity.name || identity.email.split('@')[0],
        email: identity.email,
        image: identity.image || null,
        subjects: [],
      };
      // ensureUser (data/db.js) is idempotent: the loser of a race gets the winner's row with created false.
      // A db without it (a test double) keeps the older create-and-catch path below.
      const { user: account, created } = typeof db.ensureUser === 'function'
        ? await db.ensureUser(row)
        : { user: await db.createUser(row), created: true };
      if (created && typeof onCreated === 'function') {
        try { await onCreated(); } catch { /* counting is never allowed to break sign-in */ }
      }
      return account;
    } catch (error) {
      if (String(error?.code) !== UNIQUE_VIOLATION) throw error;
      dbUser = (identity.id ? await db.getUserById(identity.id) : null) || await db.getUserByEmail(identity.email);
      if (!dbUser) throw error;
      return dbUser;
    }
  }

  const updates = {};
  if (!dbUser.name && identity.name) updates.name = identity.name;
  if (!dbUser.email && identity.email) updates.email = identity.email;
  if (!dbUser.image && identity.image) updates.image = identity.image;

  if (Object.keys(updates).length > 0) {
    dbUser = await db.updateUser(dbUser.id, updates);
  }

  return dbUser;
}
