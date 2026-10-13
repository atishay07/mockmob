// Shared by the proxy, server auth and the browser AuthProvider. Plain module: no
// server-only or client-only imports, so node tests can load it directly.

const TRANSIENT_MESSAGE_RE = /fetch failed|failed to fetch|network|timeout|timed out|econnreset|econnrefused|enotfound|eai_again|socket hang up|load failed|aborted/i;
const DEAD_SESSION_MESSAGE_RE = /refresh token|refresh_token|session (?:not found|expired)|jwt expired/i;

/**
 * True when an auth failure says nothing about the student's session: Supabase or the
 * network was briefly unreachable, slow or rate limited. Callers must keep the session
 * (and the student signed in) and retry, never sign out.
 */
export function isTransientAuthError(error) {
  if (!error) return false;
  if (error.name === 'AuthRetryableFetchError') return true;
  const status = Number(error.status);
  if (Number.isFinite(status) && (status === 0 || status === 408 || status === 429 || status >= 500)) return true;
  if (error.code === 'over_request_rate_limit') return true;
  return TRANSIENT_MESSAGE_RE.test(String(error.message || ''));
}

/** True when Supabase rejected the refresh token: the session is over and must be cleared locally. */
export function isDeadSessionError(error) {
  if (!error || isTransientAuthError(error)) return false;
  if (error.code === 'refresh_token_not_found' || error.code === 'refresh_token_already_used' || error.code === 'session_not_found' || error.code === 'session_expired') return true;
  return DEAD_SESSION_MESSAGE_RE.test(String(error.message || ''));
}

const REFRESH_PATH_RE = /\/auth\/v1\/token$/;

function isRefreshTokenCall(input) {
  try {
    const url = new URL(String(input?.url ?? input));
    return REFRESH_PATH_RE.test(url.pathname) && url.searchParams.get('grant_type') === 'refresh_token';
  } catch {
    return false;
  }
}

/**
 * Wraps fetch for every Supabase client that refreshes tokens (proxy, server, browser).
 *
 * @supabase/auth-js only treats a network error, 502, 503, 504 and the 52x codes as
 * retryable. On any other refresh failure, a 429 rate limit or a 500 included, it deletes
 * the session and emits SIGNED_OUT before our own error rules ever run. A 429 is likely in
 * production: the proxy and API routes refresh from Vercel's servers, so all students share a
 * few outgoing addresses and Supabase counts "Token refreshes" per address. This turns a 429
 * or 5xx answer to a refresh-token grant into a 503, which the library keeps the session for.
 * Other grants (password, PKCE) and other endpoints pass through untouched, so their own
 * messages, such as "too many tries", still work.
 */
export function createAuthSafeFetch(baseFetch) {
  return async function authSafeFetch(input, init) {
    const doFetch = baseFetch || globalThis.fetch;
    const res = await doFetch(input, init);
    if (!(res.status === 429 || res.status >= 500) || res.status === 503 || !isRefreshTokenCall(input)) return res;
    const headers = new Headers(res.headers);
    // The body is re-read below, so encoding and length no longer describe it.
    headers.delete('content-encoding');
    headers.delete('content-length');
    const body = await res.text().catch(() => '');
    return new Response(body, { status: 503, statusText: 'Service Unavailable', headers });
  };
}

export const authSafeFetch = createAuthSafeFetch();

/** Supabase writes the session to `sb-<project-ref>-auth-token` (chunked as `.0`, `.1`, ...). */
export const SUPABASE_SESSION_COOKIE_RE = /^sb-[^.]+-auth-token(?:\.\d+)?$/;

export function hasSupabaseSessionCookie(cookies) {
  return Array.isArray(cookies) && cookies.some(({ name, value }) => Boolean(value) && SUPABASE_SESSION_COOKIE_RE.test(String(name)));
}

/**
 * True when a batch of cookie writes from @supabase/ssr only deletes cookies (an empty value
 * or Max-Age 0). A batch that carries a new token must always reach the browser: Supabase has
 * already rotated the refresh token, and losing the new one leads to a reuse sign-out.
 */
export function isCookieRemovalOnly(cookiesToSet) {
  return Array.isArray(cookiesToSet) && cookiesToSet.length > 0 && cookiesToSet.every(({ value, options }) => !value || options?.maxAge === 0);
}

/**
 * Whether a server-side cookie batch may be written, given how the session check ended.
 * New tokens are always written. Deletions are written only when Supabase definitively
 * ended the session; after a transient failure or a timeout they are dropped.
 */
export function mayWriteAuthCookies(cookiesToSet, { deadSession }) {
  if (!isCookieRemovalOnly(cookiesToSet)) return true;
  return Boolean(deadSession);
}

/** Set by src/proxy.js when its own refresh failed transiently; server reads must not refresh then. */
export const AUTH_STALE_HEADER = 'x-mm-auth-stale';
