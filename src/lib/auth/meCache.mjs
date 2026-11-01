// The last good /api/auth/me answer, kept on this device so a signed-in student's pages draw at once on a hard load
// (speed.md item 1, LK28). The live answer replaces it within a second; a 401 signs out as before.
//   key    mm:me:v1  ->  { id, at, me }
//   used   only while the Supabase session cookie names the same user, and for at most 7 days
//   gone   on sign-out, on a session that ended, and whenever the cookie names another user
// Pure helpers (storage and cookies are passed in) so node --test can pin them (data/tests/auth_me_cache.test.mjs).

export const ME_CACHE_KEY = 'mm:me:v1';
export const ME_CACHE_MAX_AGE_MS = 7 * 86400000;

const SESSION_COOKIE_RE = /^(sb-[^.]+-auth-token)(?:\.(\d+))?$/;
const BASE64_PREFIX = 'base64-';

function fromBase64Url(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function jwtSubject(token) {
  if (typeof token !== 'string') return null;
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const sub = JSON.parse(fromBase64Url(part))?.sub;
    return typeof sub === 'string' && sub ? sub : null;
  } catch {
    return null;
  }
}

/**
 * The user id inside the Supabase session cookie ({ name, value } pairs, chunked as name.0, name.1, ...), or null when
 * there is no readable session. Read only to match the kept profile to the cookie; the server still decides who is signed in.
 */
export function sessionUserIdFromCookies(cookies) {
  if (!Array.isArray(cookies)) return null;
  const groups = new Map();
  for (const { name, value } of cookies) {
    const m = SESSION_COOKIE_RE.exec(String(name || ''));
    if (!m || !value) continue;
    const list = groups.get(m[1]) || [];
    list.push({ index: m[2] == null ? -1 : Number(m[2]), value: String(value) });
    groups.set(m[1], list);
  }
  for (const list of groups.values()) {
    const whole = list.find((c) => c.index === -1);
    const chunks = whole ? [whole] : list.filter((c) => c.index >= 0).sort((a, b) => a.index - b.index);
    let raw = chunks.map((c) => c.value).join('');
    try { raw = decodeURIComponent(raw); } catch { /* already plain */ }
    try {
      const text = raw.startsWith(BASE64_PREFIX) ? fromBase64Url(raw.slice(BASE64_PREFIX.length)) : raw;
      const session = JSON.parse(text);
      const id = session?.user?.id || jwtSubject(session?.access_token) || (Array.isArray(session) ? jwtSubject(session[0]) : null);
      if (typeof id === 'string' && id) return id;
    } catch {
      // An unreadable cookie: no kept profile is used; the live check decides.
    }
  }
  return null;
}

export function readCachedMe(storage, userId, now = Date.now()) {
  if (!storage || !userId) return null;
  try {
    const raw = storage.getItem(ME_CACHE_KEY);
    if (!raw) return null;
    const kept = JSON.parse(raw);
    const fresh = Number.isFinite(kept?.at) && now - kept.at >= 0 && now - kept.at < ME_CACHE_MAX_AGE_MS;
    if (!fresh || kept.id !== userId || kept.me?.user?.id !== userId) {
      storage.removeItem(ME_CACHE_KEY);
      return null;
    }
    return kept.me;
  } catch {
    return null;
  }
}

export function writeCachedMe(storage, me, now = Date.now()) {
  const id = me?.user?.id;
  if (!storage || !id) return;
  try { storage.setItem(ME_CACHE_KEY, JSON.stringify({ id, at: now, me })); } catch { /* storage is optional */ }
}

export function clearCachedMe(storage) {
  try { storage?.removeItem(ME_CACHE_KEY); } catch { /* storage is optional */ }
}
