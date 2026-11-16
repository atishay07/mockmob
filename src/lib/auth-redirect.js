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
// The page a brand-new account was promised, kept through onboarding (16 Nov 2026; see firstRunDestination below).
const FIRST_RUN_KEY = 'mm_first_run_next';
const FIRST_RUN_MAX_AGE_MS = 60 * 60 * 1000;
// The one line the promised page says when the student arrives (firstRunPromise.mjs has the words), read once.
const ARRIVAL_KEY = 'mm_arrival';
const ARRIVAL_MAX_AGE_MS = 10 * 60 * 1000;

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
    // A new sign-in starts here: a page an earlier sign-up on this device was promised (and never reached) is dropped.
    target.removeItem(FIRST_RUN_KEY);
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

// F10 (15 Nov): which card a sign-in started from (sign-up or log-in) and the email typed there, kept for 30 minutes in
// this browser. A sign-in that fails at /auth/callback sends the student back to the card they came from, with the email
// they typed, instead of always to the log-in page's "Welcome back".
const START_KEY = 'mm_auth_from';
const START_MODES = new Set(['signup', 'login']);
const EMAIL_SHAPE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{1,63}$/;

export function rememberAuthStart(mode, email, { store, now = Date.now() } = {}) {
  const target = storage(store);
  if (!target || !START_MODES.has(mode)) return;
  const typed = typeof email === 'string' ? email.trim() : '';
  try {
    target.setItem(START_KEY, JSON.stringify({ mode, email: EMAIL_SHAPE.test(typed) ? typed : null, at: now }));
  } catch {
    // Storage blocked: the callback falls back to the log-in page, as before.
  }
}

/** { mode, email, failed } for a sign-in started here in the last 30 minutes, or null. Never throws. */
export function readAuthStart({ store, now = Date.now() } = {}) {
  const target = storage(store);
  if (!target) return null;
  try {
    const saved = JSON.parse(target.getItem(START_KEY) || 'null');
    if (!saved || !START_MODES.has(saved.mode) || typeof saved.at !== 'number') return null;
    if (now - saved.at > MAX_AGE_MS || now < saved.at - 60_000) return null;
    const email = typeof saved.email === 'string' && EMAIL_SHAPE.test(saved.email) ? saved.email : null;
    return { mode: saved.mode, email, failed: saved.failed === true };
  } catch {
    return null;
  }
}

/** The callback could not finish: mark it, so the sign-up card fills the email back in once. Returns the saved start. */
export function markAuthStartFailed({ store, now = Date.now() } = {}) {
  const start = readAuthStart({ store, now });
  const target = storage(store);
  if (!start || !target) return start;
  try { target.setItem(START_KEY, JSON.stringify({ mode: start.mode, email: start.email, failed: true, at: now })); } catch { /* best effort */ }
  return start;
}

/** The email to fill back in on the card after a failed callback (once), or ''. */
export function takeFailedAuthEmail(mode, { store, now = Date.now() } = {}) {
  const start = readAuthStart({ store, now });
  if (!start?.failed || start.mode !== mode || !start.email) return '';
  forgetAuthStart({ store });
  return start.email;
}

export function forgetAuthStart({ store } = {}) {
  const target = storage(store);
  try { target?.removeItem(START_KEY); } catch { /* best effort */ }
}

/** The arena's front door: onboarding until subjects are chosen, then Today (which fits new and returning students, free and paid). */
export function arenaHomePath({ needsOnboarding } = {}) {
  return needsOnboarding ? '/onboarding' : '/today';
}

/** A friend's Mob invite (/join/<code>): the one saved page a new account opens before onboarding. */
export const isInvitePath = (path) => typeof path === 'string' && /^\/join\/[0-9A-Za-z%-]{4,24}(?:[?#]|$)/.test(path);

// ---------- The page a sign-up door promised, kept through onboarding (16 Nov 2026) ----------
// Before this, a new account went to /onboarding and the saved page was thrown away, so a student who signed up "to keep these
// cards" landed on a generic first set. Now a page from this short list survives onboarding: onboarding still runs first and in
// full, and its last key opens the page instead. The list is the doors that exist (tmp/1116-tools/first-minute-map.md); anything
// else, and anything a new account cannot use yet (a result, a paper, Review), ends onboarding as before. Only exact paths: the
// query and the hash are dropped (the plans' #plans anchor is the one kept), so nothing a link adds can ride along.

/** "<subject>.<chapter-slug>", as the Key cards decks write a chapter (src/app/(app)/learn/params.js chapterKeyOf). */
const CHAPTER_KEY = /^[a-z0-9_]{1,40}\.[a-z0-9._-]{1,120}$/i;
const FIRST_RUN_PAGES = Object.freeze({
  '/cards': 'cards', // Key cards (Learn when Learn v2 is on): the home sample's Key cards and the /key-cards index
  '/daily': 'daily', // the Daily Five
  '/sunday': 'sunday', // the Sunday Mock (/sunday-mock)
  '/pricing': 'pricing', // the Pro key on /pricing, signed out
  '/mob': 'mob', // "Start your own Mob" on a full or expired invite
  '/cuet-cutoff-calculator': 'cutoffs', // "Sign in to save" on the calculator
  '/recovery': 'recovery', // Score Recovery, once it is released
});

/**
 * The promised page for a new account, as { kind, path, chapter? }, or null. `raw` passes safeNextPath first (same site only,
 * no //, no backslash, no control characters, no scheme, 512 characters at most), then must be one of the pages above, or one
 * chapter's Key cards (/cards/<chapterKey>). The path is rebuilt from the parts that matched.
 */
export function firstRunDestination(raw) {
  const safe = safeNextPath(raw);
  if (!safe) return null;
  let url;
  try { url = new URL(safe, BASE); } catch { return null; }
  if (url.origin !== BASE) return null;
  const kind = Object.hasOwn(FIRST_RUN_PAGES, url.pathname) ? FIRST_RUN_PAGES[url.pathname] : null;
  if (kind === 'pricing') return { kind, path: url.hash === '#plans' ? '/pricing#plans' : '/pricing' };
  if (kind) return { kind, path: url.pathname };
  const deck = /^\/cards\/([^/]+)$/.exec(url.pathname);
  if (!deck) return null;
  let chapter;
  try { chapter = decodeURIComponent(deck[1]); } catch { return null; }
  return CHAPTER_KEY.test(chapter) ? { kind: 'chapter', path: `/cards/${chapter}`, chapter } : null;
}

/**
 * Keeps a new account's promised page while onboarding runs (an hour at most). Returns the destination kept, or null. A sign-in
 * that promised no page drops any page an earlier sign-in on this device left behind, so it never carries over to this account.
 */
export function keepFirstRunPath(raw, { store, now = Date.now() } = {}) {
  const target = storage(store);
  if (!target) return null;
  const dest = firstRunDestination(raw);
  try {
    if (dest) target.setItem(FIRST_RUN_KEY, JSON.stringify({ path: dest.path, at: now }));
    else target.removeItem(FIRST_RUN_KEY);
  } catch {
    return null;
  }
  return dest;
}

/** The promised page onboarding should end on, re-validated, or null. Read as often as needed; forgetFirstRunPath clears it. */
export function peekFirstRunPath({ store, now = Date.now() } = {}) {
  const target = storage(store);
  if (!target) return null;
  try {
    const saved = JSON.parse(target.getItem(FIRST_RUN_KEY) || 'null');
    const fresh = saved && typeof saved.at === 'number' && now - saved.at <= FIRST_RUN_MAX_AGE_MS && now >= saved.at - 60_000;
    const dest = fresh ? firstRunDestination(saved.path) : null;
    if (!dest && saved) target.removeItem(FIRST_RUN_KEY);
    return dest;
  } catch {
    return null;
  }
}

export function forgetFirstRunPath({ store } = {}) {
  const target = storage(store);
  try { target?.removeItem(FIRST_RUN_KEY); } catch { /* best effort */ }
}

/** Sign-out: the promised page and the arrival line belong to the student who signed out, never to the next one here. */
export function forgetFirstRun({ store } = {}) {
  const target = storage(store);
  try { target?.removeItem(FIRST_RUN_KEY); target?.removeItem(ARRIVAL_KEY); } catch { /* best effort */ }
}

/** Marks the promised page as reached, so it says its one line (once, within ten minutes). */
export function noteArrival(dest, { store, now = Date.now() } = {}) {
  const target = storage(store);
  if (!target || !dest?.kind) return;
  try { target.setItem(ARRIVAL_KEY, JSON.stringify({ kind: dest.kind, chapter: dest.chapter || null, at: now })); } catch { /* the page just says nothing */ }
}

/** Whether a fresh arrival mark names this page (`kind`, and for a chapter its key). Reads only. */
export function peekArrival(kind, { chapter = null, store, now = Date.now() } = {}) {
  const target = storage(store);
  if (!target) return false;
  try {
    const saved = JSON.parse(target.getItem(ARRIVAL_KEY) || 'null');
    if (!saved || typeof saved.at !== 'number' || now - saved.at > ARRIVAL_MAX_AGE_MS || now < saved.at - 60_000) return false;
    return saved.kind === kind && (kind !== 'chapter' || saved.chapter === chapter);
  } catch {
    return false;
  }
}

/**
 * True once, when the student has just arrived at this page from a sign-up door. The mark is cleared when it is taken here, so
 * the line shows once on this device; a mark for another page is left for that page, and an old one is dropped.
 */
export function takeArrival(kind, { chapter = null, store, now = Date.now() } = {}) {
  const target = storage(store);
  if (!target) return false;
  const here = peekArrival(kind, { chapter, store: target, now });
  try {
    const saved = JSON.parse(target.getItem(ARRIVAL_KEY) || 'null');
    if (here || (saved && !(typeof saved.at === 'number' && now - saved.at <= ARRIVAL_MAX_AGE_MS))) target.removeItem(ARRIVAL_KEY);
  } catch {
    try { target.removeItem(ARRIVAL_KEY); } catch { /* best effort */ }
  }
  return here;
}

/**
 * Where a signed-in student goes: onboarding first, then the saved page, then the arena's front door. A friend's invite is
 * the exception: a new student who signed up from it opens it first (the Fold and the seat are the reason they came), and
 * onboarding follows from Today. Any other page a new account was promised is kept for the end of onboarding when it is on
 * the list above (firstRunDestination); a returning student goes straight to it, and the page says its one line.
 */
export function postSignInPath({ needsOnboarding, store, now = Date.now() } = {}) {
  const next = takeNextPath({ store, now });
  if (needsOnboarding) {
    if (isInvitePath(next)) return next;
    keepFirstRunPath(next, { store, now });
    return arenaHomePath({ needsOnboarding });
  }
  const dest = firstRunDestination(next);
  if (dest) noteArrival(dest, { store, now });
  return next || arenaHomePath({ needsOnboarding });
}

/** `/signup?next=<current page>`: the invite page's first key, so a new student lands back on the invite after the account exists. */
export function signupPathFor(currentPath) {
  const next = safeNextPath(currentPath);
  return next && next !== '/dashboard' ? `/signup?next=${encodeURIComponent(next)}` : '/signup';
}

/** `/login?next=<current page>` for a gate that found no session. */
export function loginPathFor(currentPath) {
  const next = safeNextPath(currentPath);
  return next && next !== '/dashboard' ? `/login?next=${encodeURIComponent(next)}` : '/login';
}
