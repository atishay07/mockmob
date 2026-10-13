// Where to send a student after sign-in. Plain module (browser and node tests).
//
// The return path is never put in the OAuth redirect URL: that would need a looser Supabase
// redirect allow list. It is kept in this browser's localStorage for a short time instead,
// and every read is validated again, so a tampered value can only ever name a same-site page.

const STORAGE_KEY = 'mm_auth_next';
const MAX_AGE_MS = 30 * 60 * 1000;
const MAX_LENGTH = 512;
const BASE = 'https://mockmob.invalid';
// Pages that would loop or make no sense after sign-in.
const BLOCKED_PREFIXES = ['/auth/', '/login', '/signup', '/api/', '/_next/'];

/**
 * Returns a normalised same-site path ("/review?x=1") or null. Rejects absolute and
 * protocol-relative URLs, backslash tricks, control characters and auth pages.
 */
export function safeNextPath(raw) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value || value.length > MAX_LENGTH) return null;
  if (value[0] !== '/' || value[1] === '/' || value[1] === '\\') return null;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null;
  let url;
  try {
    url = new URL(value, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  const lower = url.pathname.toLowerCase();
  if (BLOCKED_PREFIXES.some((prefix) => lower === prefix.replace(/\/$/, '') || lower.startsWith(prefix))) return null;
  return path;
}

function storage(store) {
  if (store) return store;
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Saves a validated return path (or clears a stale one when `raw` is missing or unsafe). */
export function rememberNextPath(raw, { store, now = Date.now() } = {}) {
  const target = storage(store);
  if (!target) return null;
  const path = safeNextPath(raw);
  try {
    if (path) target.setItem(STORAGE_KEY, JSON.stringify({ path, at: now }));
    else target.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be full or blocked; sign-in still works and lands on the dashboard.
  }
  return path;
}

/** Reads and clears the saved return path. Expired or tampered values return null. */
export function takeNextPath({ store, now = Date.now() } = {}) {
  const target = storage(store);
  if (!target) return null;
  let saved = null;
  try {
    saved = JSON.parse(target.getItem(STORAGE_KEY) || 'null');
    target.removeItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!saved || typeof saved.at !== 'number' || now - saved.at > MAX_AGE_MS || now < saved.at - 60_000) return null;
  return safeNextPath(saved.path);
}

/** Where a signed-in student goes: onboarding first, then the saved page, then the dashboard. */
export function postSignInPath({ needsOnboarding, store, now } = {}) {
  const next = takeNextPath({ store, now });
  if (needsOnboarding) return '/onboarding';
  return next || '/dashboard';
}

/** `/login?next=<current page>` for a gate that found no session. */
export function loginPathFor(currentPath) {
  const next = safeNextPath(currentPath);
  return next && next !== '/dashboard' ? `/login?next=${encodeURIComponent(next)}` : '/login';
}
