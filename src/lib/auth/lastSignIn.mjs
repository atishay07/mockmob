// O8 (15 Nov 2026): this device remembers how the student last signed in, so /login can put that way first. Pure, no React.
//
// What is kept, in localStorage only, never on the server:
//   LAST_SIGN_IN_KEY     { method: 'google' | 'email', email: 'a***@gmail.com' | null, at }   after a sign-in finished
//   PENDING_SIGN_IN_KEY  { method, email: masked | null, at }   while a sign-in is under way (Google's redirect, an emailed code)
// The full address is never written: only its first letter and its domain. A sign-in is only remembered once it has worked:
// the card notes the way it starts (pending), and the auth provider turns that into the remembered way when a session is
// confirmed (commitPendingSignIn). A pending note older than 30 minutes is ignored. "Not you?" forgets both.

export const LAST_SIGN_IN_KEY = 'mm:last-sign-in:v1';
export const PENDING_SIGN_IN_KEY = 'mm:sign-in-pending:v1';
export const PENDING_TTL_MS = 30 * 60_000;
const METHODS = new Set(['google', 'email']);
// A masked address and nothing else: one character, three stars, @, a domain with a dot.
const MASKED_RE = /^[^\s@*]\*\*\*@[^\s@*]+\.[^\s@*]+$/;

/** "asha.k@gmail.com" -> "a***@gmail.com"; null for anything that is not an address. */
export function maskEmail(email) {
  const s = String(email || '').trim().toLowerCase();
  const at = s.lastIndexOf('@');
  if (at < 1 || at === s.length - 1) return null;
  const domain = s.slice(at + 1);
  const masked = `${Array.from(s)[0]}***@${domain}`;
  return MASKED_RE.test(masked) ? masked : null;
}

function readJson(store, key) {
  try {
    const raw = store?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(store, key, value) {
  try { store?.setItem(key, JSON.stringify(value)); } catch { /* storage is optional (private mode, full) */ }
}

function remove(store, key) {
  try { store?.removeItem(key); } catch { /* storage is optional */ }
}

function clean(value) {
  if (!value || typeof value !== 'object' || !METHODS.has(value.method)) return null;
  const email = value.method === 'email' && typeof value.email === 'string' && MASKED_RE.test(value.email) ? value.email : null;
  return { method: value.method, email, at: Number.isFinite(value.at) ? value.at : 0 };
}

/** A sign-in is starting this way (the Google key, a code sent, One Tap). The address is masked before it is kept. */
export function notePendingSignIn(store, method, email = null, now = Date.now()) {
  if (!METHODS.has(method)) return;
  write(store, PENDING_SIGN_IN_KEY, { method, email: method === 'email' ? maskEmail(email) : null, at: now });
}

/** A session was just confirmed: a fresh pending note becomes the remembered way. Returns it, or null when there was none. */
export function commitPendingSignIn(store, now = Date.now()) {
  const pending = clean(readJson(store, PENDING_SIGN_IN_KEY));
  if (!pending) return null;
  remove(store, PENDING_SIGN_IN_KEY);
  if (now - pending.at > PENDING_TTL_MS || pending.at > now + 60_000) return null;
  const last = { method: pending.method, email: pending.email, at: now };
  write(store, LAST_SIGN_IN_KEY, last);
  return last;
}

/** The remembered way, or null. Raw text in, so a React store can compare snapshots by value. */
export function parseLastSignIn(raw) {
  try {
    return clean(typeof raw === 'string' && raw ? JSON.parse(raw) : null);
  } catch {
    return null;
  }
}

export function readLastSignIn(store) {
  return clean(readJson(store, LAST_SIGN_IN_KEY));
}

/** "Not you?": this device forgets the way and any sign-in under way. */
export function forgetLastSignIn(store) {
  remove(store, LAST_SIGN_IN_KEY);
  remove(store, PENDING_SIGN_IN_KEY);
}

/** The line /login shows a returning visitor, or null. */
export function lastSignInLine(last) {
  const parts = lastSignInParts(last);
  return parts ? `${parts.lead}${parts.who ? ` ${parts.who}` : ''}.` : null;
}

/** The same line in parts, so the card can keep the masked address on one line: { lead, who } or null. */
export function lastSignInParts(last) {
  if (!last) return null;
  if (last.method === 'google') return { lead: 'Last time you used Google', who: null };
  if (last.method === 'email') return last.email ? { lead: 'Last time you used the email code for', who: last.email } : { lead: 'Last time you used the email code', who: null };
  return null;
}

export const LAST_SIGN_IN_COPY = Object.freeze({ notYou: 'Not you?' });
