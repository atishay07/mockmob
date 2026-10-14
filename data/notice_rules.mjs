// Notices: what the site tells a person about the state they are really in, and when it stays quiet.
//
// One slot per surface, one notice in it. Triggers are real state only (offline, a submit waiting,
// credits at zero, Pro ending, a feature that cannot run and why), never a timer or a guess. A
// dismissed notice stays dismissed on this device until the state it describes changes.
//
// Everything here is pure so it can be unit tested. Browser storage is injected.
//
// Surfaces (where a slot is mounted):
//   runner   the timed test screen. A toast that overlays the page and lets taps through. It is
//            never a strip across the top of a timed test, and it cannot be dismissed: the person
//            has something to do (or something waiting).
//   app      the signed-in pages. An inline row at the top of the page, never on the test route.
//   result   a result page. An inline row above the answer list.
// There is no marketing surface: a stranger on a marketing page is never shown a notice.
//
// Owner touches (plan 10, D8): the order in NOTICE_PRIORITY, and which captions stay (CAPTION_RULES).

export const NOTICE_STORAGE_KEY = 'mm:notices:v1';
const MAX_STORED = 40;

export const NOTICE_SURFACES = ['runner', 'app', 'result'];
export const NOTICE_TONES = ['info', 'warn', 'error', 'ok'];

/** Lower comes first. When two notices compete for one slot, the first in this order wins. */
export const NOTICE_PRIORITY = [
  'runner-submit-waiting',
  'runner-offline',
  'runner-syncing',
  'session-expiring',
  'maintenance',
  'feature-unavailable',
  'credits-zero',
  'pro-ending',
  'app-on-play',
  'result-report-pointer',
];

const priorityOf = (id) => {
  const at = NOTICE_PRIORITY.indexOf(id);
  return at === -1 ? NOTICE_PRIORITY.length : at;
};

/** The slot's shape follows its surface: the test screen gets a toast, everything else an inline row. */
export const placementFor = (surface) => (surface === 'runner' ? 'toast' : 'inline');

/** The shell's slot never shows on the timed test route. */
export function slotShows(surface, pathname = '') {
  if (surface === 'app') return !/^\/test(\/|$)/.test(String(pathname || ''));
  return NOTICE_SURFACES.includes(surface);
}

function make({ id, surface, tone, what, next = '', why, stateKey, dismissible = false, audience = 'any', action = null, acknowledged = false }) {
  return {
    id,
    surface,
    priority: priorityOf(id),
    tone,
    what,
    next,
    text: [what, next].filter(Boolean).join(' '),
    why,
    stateKey: String(stateKey ?? 'on'),
    dismissible,
    audience,
    action,
    acknowledged,
  };
}

// ---- Builders. Each returns one notice, or null when the real state does not call for one. ----

/** The test screen: a submit waiting for the connection, offline, or an account session waiting to sync. */
export function runnerNotices({ pendingSubmission = false, online = true, syncStatus = 'saved', hasTicket = false } = {}) {
  const out = [];
  if (pendingSubmission) {
    out.push(make({
      id: 'runner-submit-waiting', surface: 'runner', tone: 'warn',
      what: 'Not submitted yet. Your answers are safe on this device.',
      next: 'Reconnect soon: they send on their own while the submission window is open.',
      why: 'You pressed submit while offline or the server could not be reached.',
      stateKey: 'waiting',
    }));
  }
  if (!online) {
    out.push(make({
      id: 'runner-offline', surface: 'runner', tone: 'warn',
      what: 'You are offline. Keep answering: answers stay on this device and the timer keeps running.',
      next: 'Reconnect before you submit.',
      why: 'This device has no connection right now.',
      stateKey: 'offline',
    }));
  }
  if (!hasTicket && syncStatus === 'pending') {
    out.push(make({
      id: 'runner-syncing', surface: 'runner', tone: 'warn',
      what: 'Reconnecting.',
      next: 'Your answers are kept on this device until they sync.',
      why: 'Your answers have not reached your account yet.',
      stateKey: 'syncing',
    }));
  }
  return out;
}

/** A sign-in that is about to end. `expiresAtMs` is a millisecond timestamp. */
export function sessionExpiringNotice({ expiresAtMs, now = Date.now(), windowMs = 10 * 60 * 1000 } = {}) {
  if (!Number.isFinite(expiresAtMs)) return null;
  const left = expiresAtMs - now;
  if (left <= 0 || left > windowMs) return null;
  const minutes = Math.max(1, Math.round(left / 60000));
  return make({
    id: 'session-expiring', surface: 'app', tone: 'warn', audience: 'member',
    what: `Your sign-in ends in about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`,
    next: 'Finish what you are doing, then sign in again.',
    why: 'Your session is close to its end and could not be renewed.',
    stateKey: `expires:${Math.floor(expiresAtMs / 60000)}`,
  });
}

/** A maintenance flag. `message` is the plain-language line the operator wrote. */
export function maintenanceNotice({ active = false, message = '' } = {}) {
  const what = String(message || '').trim();
  if (!active || !what) return null;
  return make({
    id: 'maintenance', surface: 'app', tone: 'warn',
    what: /[.?]$/.test(what) ? what : `${what}.`,
    next: 'Try again in a few minutes.',
    why: 'MockMob is being worked on.',
    stateKey: `maintenance:${what.slice(0, 40)}`,
  });
}

/**
 * A feature that cannot run, and the engine's plain reason (for example NTA mode when no paper can
 * be built). `alternative` is what the person can do instead.
 */
export function featureUnavailableNotice({ feature = '', reason = '', alternative = '' } = {}) {
  const name = String(feature || '').trim();
  const why = String(reason || '').trim();
  if (!name || !why) return null;
  return make({
    id: 'feature-unavailable', surface: 'app', tone: 'info', dismissible: true, audience: 'member',
    what: `${name} is not available right now. ${/[.?]$/.test(why) ? why : `${why}.`}`,
    next: String(alternative || '').trim() || 'Try again later.',
    why: `${name} checks it can build something reliable before it starts.`,
    stateKey: `unavailable:${name}:${why.slice(0, 40)}`,
  });
}

/** A free member with no practice credits left. Pro never sees this. */
export function creditsZeroNotice({ isPremium = false, creditBalance = null } = {}) {
  if (isPremium || !Number.isFinite(creditBalance) || creditBalance > 0) return null;
  return make({
    id: 'credits-zero', surface: 'app', tone: 'info', dismissible: true, audience: 'member',
    what: 'You have no practice credits left.',
    next: 'Plan and credits shows how to get more.',
    action: { label: 'Plan and credits', href: '/pricing' },
    why: 'Starting a practice set uses credits, and your balance is zero.',
    stateKey: 'zero',
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pro ending within `withinDays`. Nothing for a free member or a plan with no end date. */
export function proEndingNotice({ isPremium = false, premiumUntil = null, now = Date.now(), withinDays = 5 } = {}) {
  if (!isPremium || !premiumUntil) return null;
  const end = new Date(premiumUntil).getTime();
  if (!Number.isFinite(end)) return null;
  const left = end - now;
  if (left <= 0 || left > withinDays * DAY_MS) return null;
  const date = new Date(end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  return make({
    id: 'pro-ending', surface: 'app', tone: 'info', dismissible: true, audience: 'member',
    what: `Pro ends on ${date}.`,
    next: 'Plan and credits shows your options.',
    action: { label: 'Plan and credits', href: '/pricing' },
    why: 'Your Pro plan has an end date within the next few days.',
    stateKey: `ends:${new Date(end).toISOString().slice(0, 10)}`,
  });
}

/** The Android app, only after the Play listing is live (D13), on Android, for a member. */
export function appOnPlayNotice({ playListingLive = false, isAndroid = false, isMember = false } = {}) {
  if (!playListingLive || !isAndroid || !isMember) return null;
  return make({
    id: 'app-on-play', surface: 'app', tone: 'info', dismissible: true, audience: 'member',
    what: 'MockMob is on Google Play.',
    next: 'Your practice carries over when you sign in.',
    action: { label: 'See the app', href: '/app' },
    why: 'You are on an Android phone and signed in.',
    stateKey: 'live',
  });
}

/** The result page's pointer to the per-question report button. */
export function resultReportNotice() {
  return make({
    id: 'result-report-pointer', surface: 'result', tone: 'info', dismissible: true,
    what: 'Spotted a mistake? Open the question and choose “Report a problem with this question”.',
    why: 'Every question on this page can be reported. Dismiss this and it stays hidden on this device.',
    stateKey: 'v1',
  });
}

// ---- Choosing ----

/**
 * The one notice a slot shows, or null.
 * `dismissed` is the stored { id: stateKey } map; `dismissalsReady` is false until it has been
 * read, so a dismissible notice never flashes in and then disappears.
 */
export function chooseNotice(candidates, { surface, dismissed = {}, visitor = { kind: 'new' }, dismissalsReady = true } = {}) {
  if (!NOTICE_SURFACES.includes(surface)) return null;
  const isMember = visitor?.kind === 'member';
  const pool = (Array.isArray(candidates) ? candidates : []).filter((n) => {
    if (!n || typeof n !== 'object' || n.surface !== surface || !n.id) return false;
    if (n.audience === 'member' && !isMember) return false;
    if (n.dismissible) {
      if (!dismissalsReady) return false;
      if (dismissed && dismissed[n.id] === n.stateKey) return false;
    }
    return true;
  });
  pool.sort((a, b) => (a.priority - b.priority) || String(a.id).localeCompare(String(b.id)));
  return pool[0] || null;
}

// ---- Dismissals, per device ----

export function parseDismissed(raw) {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out = {};
    for (const [id, key] of Object.entries(value)) {
      if (Object.keys(out).length >= MAX_STORED) break;
      if (typeof id === 'string' && id.length <= 60 && typeof key === 'string' && key.length <= 80) out[id] = key;
    }
    return out;
  } catch {
    return {};
  }
}

/** The map after dismissing `notice`. A notice that cannot be dismissed is left alone. */
export function dismissNotice(map, notice) {
  if (!notice || !notice.dismissible) return map || {};
  const next = { ...(map || {}), [notice.id]: notice.stateKey };
  const ids = Object.keys(next);
  if (ids.length > MAX_STORED) delete next[ids[0]];
  return next;
}

/**
 * Forget a dismissal once the state it described has ended. `evaluatedIds` are the notices whose
 * state was just checked; any of them that are not in `activeIds` no longer apply, so a later return
 * of the same state shows the notice again.
 */
export function reconcileDismissed(map, evaluatedIds = [], activeIds = []) {
  const active = new Set(activeIds);
  let changed = false;
  const next = { ...(map || {}) };
  for (const id of evaluatedIds) {
    if (!active.has(id) && id in next) { delete next[id]; changed = true; }
  }
  return changed ? next : (map || {});
}

export function readDismissed(storage) {
  try {
    return parseDismissed(storage?.getItem(NOTICE_STORAGE_KEY));
  } catch {
    return {};
  }
}

/** Returns true when the write went through. Storage can be blocked; the notice then returns next visit. */
export function writeDismissed(storage, map) {
  try {
    storage.setItem(NOTICE_STORAGE_KEY, JSON.stringify(parseDismissed(map)));
    return true;
  } catch {
    return false;
  }
}

// ---- Truth rules for notice copy ----

const BANNED_WORDS = /\b(elevate|seamless|unleash|next-gen|game-changer|delve)\b/i;
const BUILD_TALK = /\b(staging|gate|evidence-certified|released pathway|localhost|endpoint|cron)\b/i;
const SUCCESS_WORDS = /\b(saved|submitted|sent|done|success|successful|completed)\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;

/**
 * Problems with a notice, as strings. An empty list means it follows the rules: plain words, no
 * exclamation marks or em dashes, no emoji, no arrows appended to text, no build talk, a recovery
 * line on warnings and errors, no success wording without an acknowledgement, a reason on every
 * notice, and the timed test only ever gets a toast that cannot be dismissed.
 */
export function validateNotice(notice) {
  const problems = [];
  if (!notice || typeof notice !== 'object') return ['not a notice'];
  const text = String(notice.text || '');
  if (!NOTICE_SURFACES.includes(notice.surface)) problems.push(`unknown surface: ${notice.surface}`);
  if (!NOTICE_TONES.includes(notice.tone)) problems.push(`unknown tone: ${notice.tone}`);
  if (!notice.id) problems.push('missing id');
  if (!notice.stateKey) problems.push('missing state key');
  if (!text.trim()) problems.push('empty text');
  if (text.length > 220) problems.push('text is longer than 220 characters');
  if (text.includes('!')) problems.push('exclamation mark');
  if (/[—]/.test(text)) problems.push('em dash');
  if (EMOJI.test(text)) problems.push('emoji');
  if (/[→↗›»]/.test(text) || /->|=>/.test(text)) problems.push('arrow in text');
  if (BANNED_WORDS.test(text)) problems.push('banned word');
  if (BUILD_TALK.test(text)) problems.push('build talk');
  if ((notice.tone === 'warn' || notice.tone === 'error') && !String(notice.next || '').trim()) {
    problems.push('a warning or error needs a next step');
  }
  if (notice.next && !text.includes(notice.next)) problems.push('text does not include the next step');
  if (notice.tone === 'ok' && SUCCESS_WORDS.test(text) && notice.acknowledged !== true) problems.push('success wording without an acknowledgement');
  if (!String(notice.why || '').trim()) problems.push('missing reason');
  if (notice.surface === 'runner' && notice.dismissible) problems.push('a notice on the timed test cannot be dismissed');
  if (notice.action && (!notice.action.label || !notice.action.href)) problems.push('action needs a label and a link');
  if (notice.action && /[→↗›]/.test(notice.action.label)) problems.push('arrow in action label');
  return problems;
}

// ---- Captions (D8) ----
//
// A caption stays only where it prevents a wrong impression. Where it moves to is decided here, so
// a page body is never the default home of a generic line.
//   footer        the site footer (and About for non-affiliation)
//   at-the-date   next to the date or rule it qualifies
//   demo-label   on the illustrative screen it labels
//   at-the-claim  next to the projection or figure it qualifies
//   cut           removed: it protects no one
export const CAPTION_HOMES = ['footer', 'at-the-date', 'demo-label', 'at-the-claim', 'cut'];

export const CAPTION_RULES = [
  {
    id: 'provisional-2027',
    text: '2027 exam specifications remain provisional until officially confirmed.',
    homes: ['footer', 'at-the-date'],
    notInPageBody: ['src/app/(app)/today/page.jsx'],
  },
  {
    id: 'access-and-credits-preserved',
    text: 'Existing access and credits are preserved.',
    homes: ['cut'],
    notInPageBody: ['src/app/(app)/today/page.jsx'],
  },
  {
    id: 'non-affiliation',
    text: 'MockMob is an independent exam preparation platform and is not affiliated with NTA, Delhi University, or any official examining body.',
    homes: ['footer'],
    alsoOn: ['src/app/about/page.js'],
  },
  {
    id: 'illustrative-demos',
    text: 'Illustrative demos; your screens use your own practice.',
    homes: ['demo-label'],
  },
  {
    id: 'not-an-official-pyq',
    text: 'Not an official PYQ or a scored diagnostic.',
    homes: ['demo-label'],
  },
  {
    id: 'compass-projection',
    text: 'A projection from your own record, not a prediction or an admission chance.',
    homes: ['at-the-claim'],
  },
];

/** Where a caption lives. Unknown captions have no home: they should not be added without a rule. */
export function captionHomes(id) {
  return CAPTION_RULES.find((rule) => rule.id === id)?.homes || [];
}

/** Lines the footer should carry (the footer itself belongs to the navigation package). */
export const FOOTER_CAPTIONS = Object.freeze({
  provisional2027: 'CUET UG 2027 dates, paper rules and marking are provisional until NTA publishes them.',
  nonAffiliation: CAPTION_RULES.find((rule) => rule.id === 'non-affiliation').text,
});
