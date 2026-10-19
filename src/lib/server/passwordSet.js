// Set or change the signed-in student's password (POST /api/me/password). Plain module: Supabase's auth client and the
// cookie store are injected, so node tests drive it against fakes (data/tests/set_password_1020.test.mjs).
//
// The same call the app makes (flutter_app auth_service.dart setPassword: updateUser with a password), made here on the
// SERVER with the student's own cookie session, so Supabase's project rules (minimum length, "secure password change",
// leaked-password check) still decide, and the checks around it (a real session, a rule check, a rate limit) cannot be
// skipped by a modified browser. Nothing here logs, stores or returns the password. A failure is a code and a status only.

import { checkPassword } from '../passwordRules.mjs';
import { createAuthSafeFetch, isDeadSessionError, isTransientAuthError, mayWriteAuthCookies } from '../supabase-auth-errors.js';

/** Maps a Supabase auth error to one of passwordRules.mjs's problem codes. Only the code, name and status are read, never the message. */
export function passwordFailureFrom(error) {
  if (!error) return 'unknown';
  const code = typeof error.code === 'string' ? error.code : '';
  const status = Number(error.status);
  if (status === 429 || (code.startsWith('over_') && code.endsWith('rate_limit'))) return 'rate_limited';
  switch (code) {
    case 'weak_password': return 'weak_password';
    case 'same_password': return 'same_password';
    case 'reauthentication_needed':
    case 'reauthentication_not_valid': return 'reauth_required';
    case 'session_not_found':
    case 'session_expired':
    case 'no_authorization':
    case 'bad_jwt':
    case 'user_not_found': return 'signed_out';
    default: break;
  }
  if (error.name === 'AuthWeakPasswordError') return 'weak_password';
  if (error.name === 'AuthSessionMissingError') return 'signed_out';
  if (isDeadSessionError(error) || status === 401) return 'signed_out';
  if (isTransientAuthError(error)) return 'unavailable';
  // A 422 with no code is how older Supabase Auth reports a refused password.
  if (status === 422) return 'weak_password';
  return 'unknown';
}

/** The HTTP status for each problem code. */
export const PASSWORD_STATUS = Object.freeze({
  too_short: 422, too_long: 422, invalid: 422, weak_password: 422, same_password: 422,
  reauth_required: 403, signed_out: 401, rate_limited: 429, unavailable: 503, unknown: 500,
});

/**
 * Runs the update. Returns { ok: true } or { ok: false, code, status, errorCode } (status and errorCode only for the log).
 *  - `password`: what the student typed; checked here again (the page checks first, the server decides).
 *  - `cookieStore`: next/headers cookies() (getAll, set).
 *  - `createServerClient`, `supabaseUrl`, `supabaseKey`: @supabase/ssr and the public keys.
 * New tokens Supabase hands back are written to the cookies; a deletion is written only when Supabase ended the session.
 */
export async function setAccountPassword({ password, cookieStore, createServerClient, supabaseUrl, supabaseKey, clientOptions = {} }) {
  const rule = checkPassword(password);
  if (!rule.ok) return { ok: false, code: rule.code };
  if (!supabaseUrl || !supabaseKey) return { ok: false, code: 'unavailable' };

  let pending = null;
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    ...clientOptions,
    global: { ...clientOptions.global, fetch: createAuthSafeFetch(clientOptions.global?.fetch) },
    cookies: {
      getAll: () => cookieStore.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (cookiesToSet) => { pending = pending ? [...pending, ...cookiesToSet] : [...cookiesToSet]; },
    },
  });

  let failure = null;
  try {
    // The session requirement: updateUser needs the signed-in student's own session from the cookies. With none it fails
    // with AuthSessionMissingError and nothing is changed.
    const { error } = await supabase.auth.updateUser({ password });
    if (error) failure = error;
  } catch (error) {
    failure = error;
  }

  if (pending && mayWriteAuthCookies(pending, { deadSession: isDeadSessionError(failure) })) {
    for (const { name, value, options } of pending) {
      try { cookieStore.set(name, value, options); } catch { /* a read-only store: the proxy refreshes the session on the next request */ }
    }
  }
  if (failure) {
    return { ok: false, code: passwordFailureFrom(failure), status: Number(failure.status) || null, errorCode: failure.code || failure.name || null };
  }
  return { ok: true };
}
