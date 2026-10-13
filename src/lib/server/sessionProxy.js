// Core of src/proxy.js, with Next and Supabase injected so node tests can drive it with a
// real NextRequest and a fake Supabase Auth server.
//
// Why this exists: Server Components cannot write cookies. Without a proxy that refreshes
// the Supabase session before rendering, a server read with an expired access token spends
// (rotates) the refresh token and cannot hand the new one back to the browser. The browser
// later presents the spent token, Supabase sees reuse, revokes the session, and the student
// is signed out. This refresh-on-every-page step is the documented @supabase/ssr pattern.

import {
  AUTH_STALE_HEADER,
  createAuthSafeFetch,
  hasSupabaseSessionCookie,
  isDeadSessionError,
  isTransientAuthError,
  mayWriteAuthCookies,
} from '../supabase-auth-errors.js';

export const REFRESH_TIMEOUT_MS = 5000;

const REF_COOKIE = 'mm_ref';
const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const REF_PATTERN = /^[a-z0-9._-]{1,64}$/;
const REFERRAL_ENTRYPOINTS = ['/pricing'];
const TIMED_OUT = Symbol('timed_out');

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function isReferralEntrypoint(pathname) {
  return REFERRAL_ENTRYPOINTS.some((entry) => pathname === entry || pathname.startsWith(`${entry}/`));
}

// A creator/referral code from the URL goes into a 30-day cookie. Not httpOnly: the checkout
// reads it for prefill.
export function applyRefCapture(request, response, { secure = process.env.NODE_ENV === 'production' } = {}) {
  if (!isReferralEntrypoint(request.nextUrl.pathname)) return false;
  const ref = request.nextUrl.searchParams.get('ref') ?? request.nextUrl.searchParams.get('code');
  if (!ref) return false;
  const normalized = String(ref).trim().toLowerCase();
  if (!normalized || !REF_PATTERN.test(normalized)) return false;
  if (request.cookies.get(REF_COOKIE)?.value === normalized) return false;
  response.cookies.set(REF_COOKIE, normalized, {
    httpOnly: false,
    sameSite: 'lax',
    secure,
    maxAge: REF_COOKIE_MAX_AGE,
    path: '/',
  });
  return true;
}

/**
 * Refreshes the Supabase session cookies for one request.
 * Returns { response, outcome } where outcome is one of:
 *   'anonymous'  no session cookie (most marketing traffic; no Supabase call at all)
 *   'ok'         session valid (refreshed if it had expired; new cookies on request and response)
 *   'signed_out' Supabase rejected the session; cookies are cleared only when it said the
 *                refresh token or session is over
 *   'transient'  Supabase or the network failed (429 and 5xx included); cookies left untouched,
 *                student stays signed in, and server reads in this request are told not to refresh
 *   'timeout'    refresh took longer than the budget; same as 'transient'
 *   'unconfigured' Supabase env vars missing
 */
export async function refreshSupabaseSession(request, {
  NextResponse,
  createServerClient,
  supabaseUrl,
  supabaseKey,
  timeoutMs = REFRESH_TIMEOUT_MS,
  clientOptions = {},
}) {
  // Only this proxy may say a server read is stale; a client cannot send the header through.
  try {
    request.headers.delete(AUTH_STALE_HEADER);
  } catch {
    // Immutable headers: the stale branch below rebuilds them anyway.
  }
  let response = NextResponse.next({ request });
  if (!supabaseUrl || !supabaseKey) return { response, outcome: 'unconfigured' };
  if (!hasSupabaseSessionCookie(request.cookies.getAll())) return { response, outcome: 'anonymous' };

  // Cookie writes are held until the outcome is known: the library deletes the session on
  // some failures, and a deletion after a temporary failure would sign the student out.
  let pending = null;
  let settled = false;
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    ...clientOptions,
    global: { ...clientOptions.global, fetch: createAuthSafeFetch(clientOptions.global?.fetch) },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        if (settled) return; // Arrived after the time budget; the response is already gone.
        pending = { cookiesToSet, headers };
      },
    },
  });

  // Nothing may run between creating the client and getClaims() (Supabase SSR guidance):
  // getClaims loads the session, refreshes it when expired and verifies the access token.
  let outcome;
  let deadSession = false;
  try {
    const result = await withTimeout(supabase.auth.getClaims(), timeoutMs);
    if (result === TIMED_OUT) outcome = 'timeout';
    else if (result?.error) {
      outcome = isTransientAuthError(result.error) ? 'transient' : 'signed_out';
      deadSession = isDeadSessionError(result.error);
    } else outcome = result?.data?.claims?.sub ? 'ok' : 'signed_out';
  } catch (error) {
    outcome = isTransientAuthError(error) ? 'transient' : 'signed_out';
    deadSession = isDeadSessionError(error);
  }
  settled = true;

  if (pending && mayWriteAuthCookies(pending.cookiesToSet, { deadSession })) {
    // Write to the request first so Server Components in this same request read the fresh
    // tokens, then rebuild the response so it carries those request cookies.
    for (const { name, value } of pending.cookiesToSet) request.cookies.set(name, value);
    response = NextResponse.next({ request });
    for (const { name, value, options } of pending.cookiesToSet) response.cookies.set(name, value, options);
    // no-store headers: a response that sets auth cookies must never be cached by a CDN.
    for (const [key, value] of Object.entries(pending.headers || {})) response.headers.set(key, value);
  } else if (outcome === 'transient' || outcome === 'timeout') {
    // The refresh did not finish. Tell server reads in this request (auth() in src/lib/auth.ts)
    // not to refresh either: they could not write the new token back, and the browser would
    // later present the spent one. The browser refreshes on its own within seconds.
    const headers = new Headers(request.headers);
    headers.set(AUTH_STALE_HEADER, '1');
    response = NextResponse.next({ request: { headers } });
  }
  return { response, outcome };
}
