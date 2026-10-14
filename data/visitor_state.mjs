// Who is looking at the site, as far as this browser can tell.
//
// Kinds (also the value of <html data-visitor>, which a tiny script sets before first paint
// so the right version of a page shows without a flash):
//   new        signed out and never signed in on this device (a first visit, a reload, a tenth visit
//              to the sample). The marketing page. Visiting is not a reason to say "welcome back".
//   returning  signed out, but signed in on this device before. A log-in path first.
//   member     signed in. Practice first. `plan` is 'free' or 'pro'.
//
// <html data-visitor-plan> ('free' | 'pro') is set alongside it so plan-specific parts of the page
// (an upgrade button a Pro student should not see) can be shown or hidden without a flash.
//
// <html data-visitor-stage="first"> marks a member who has no scored session yet (plan state S3).
// It is set only when the hint says so for certain (started: false, learnt from the attempts
// list). An unknown stage is treated as an active member, so a student with a history is never
// told to take their first check. The contract other packages read:
//   hint      { kind: 'member', plan: 'free' | 'pro', started?: boolean } | { kind: 'returning' }
//   classes   vs-first-only (members in stage first), vs-hide-first (everyone else)
//
// Hints hold no personal data: kind, plan and the stage flag only.
// Everything here is pure so it can be unit tested; browser storage is injected.
import { resumableDraft } from './session_draft.js';

export const VISITOR_KEY = 'mm:visitor:v1';
/** Where a signed-in student starts when they open mockmob.in fresh: 'practice' | 'today' | 'home'. */
export const START_ON_KEY = 'mm:start-on:v1';
/** The old opt-in checkbox ("open the Arena first"). Read for compatibility, removed on the next save. */
export const ARENA_FIRST_KEY = 'mm:arena-first:v1';
export const PRACTICE_HREF = '/dashboard';
/** @deprecated Kept for files outside the member-entry package. Use PRACTICE_HREF. */
export const ARENA_HREF = PRACTICE_HREF;
/** The day-one action: Practice with 10 questions chosen. The cost and time show on its confirm line. */
export const FIRST_CHECK_HREF = '/dashboard?count=10';

export const START_ON_OPTIONS = Object.freeze([
  Object.freeze({ id: 'practice', label: 'Practice', href: PRACTICE_HREF }),
  Object.freeze({ id: 'today', label: 'Today', href: '/today' }),
  Object.freeze({ id: 'home', label: 'Home', href: null }),
]);
export const DEFAULT_START_ON = 'practice';

const KINDS = ['new', 'returning', 'member'];

/** Reads a stored hint. Anything unexpected is treated as no hint. `started` is null when unknown. */
export function parseHint(raw) {
  try {
    const hint = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!hint || typeof hint !== 'object') return { kind: 'new', plan: null, started: null };
    if (hint.kind === 'member') {
      const started = hint.started === true ? true : hint.started === false ? false : null;
      return { kind: 'member', plan: hint.plan === 'pro' ? 'pro' : 'free', started };
    }
    if (hint.kind === 'returning') return { kind: 'returning', plan: null, started: null };
  } catch { /* corrupt value */ }
  return { kind: 'new', plan: null, started: null };
}

export function serializeHint(hint) {
  if (hint.kind !== 'member') return JSON.stringify({ kind: hint.kind });
  const out = { kind: 'member', plan: hint.plan === 'pro' ? 'pro' : 'free' };
  if (typeof hint.started === 'boolean') out.started = hint.started;
  return JSON.stringify(out);
}

/** 'first' only for a member known to have no scored session yet; null otherwise. */
export function stageOf(hint) {
  const parsed = parseHint(hint);
  return parsed.kind === 'member' && parsed.started === false ? 'first' : null;
}

export const planOf = (user) => (user?.isPremium ? 'pro' : 'free');

export function firstName(user) {
  const name = String(user?.name || '').trim();
  return name ? name.split(/\s+/)[0].slice(0, 24) : '';
}

/**
 * The visitor right now. `status` is the AuthProvider status; `hint` is the stored hint, used
 * while the first auth check is still running and when MockMob could not be reached (the
 * student is not signed out in that case). The stage always comes from the hint: the session
 * check carries no attempt count.
 */
export function visitorState({ status, user, hint }) {
  const stored = parseHint(hint);
  const stage = stageOf(hint);
  if (status === 'authenticated') return { kind: 'member', plan: planOf(user), confirmed: true, name: firstName(user), stage };
  if (status === 'unauthenticated') {
    // Signed out now. Someone who was signed in on this device before is a returning visitor.
    return { kind: stored.kind === 'new' ? 'new' : 'returning', plan: null, confirmed: true, name: '', stage: null };
  }
  // loading or unavailable: trust the hint.
  return { kind: stored.kind, plan: stored.kind === 'member' ? stored.plan : null, confirmed: false, name: firstName(user), stage };
}

/**
 * What to remember after an auth change. Returns the hint to store, or null for "leave it".
 * Signing in is remembered as a member. Signing out turns a member into a returning visitor.
 * A visitor who was never signed in stays new however often they visit, and an unavailable
 * check never changes the hint.
 *
 * `started` is what the attempts list said for a confirmed member: true (has a scored session),
 * false (none yet) or undefined (not checked, or the check failed). Once true it stays true:
 * attempts do not disappear, and an empty or failed read must never send an active student
 * back to day one.
 */
export function nextHint({ status, user, current, started }) {
  const stored = parseHint(current);
  if (status === 'authenticated') {
    const plan = planOf(user);
    const known = stored.kind === 'member' ? stored.started : null;
    let nextStarted = known;
    if (started === true) nextStarted = true;
    else if (started === false && known !== true) nextStarted = false;
    if (stored.kind === 'member' && stored.plan === plan && stored.started === nextStarted) return null;
    return nextStarted === null ? { kind: 'member', plan } : { kind: 'member', plan, started: nextStarted };
  }
  if (status === 'unauthenticated') return stored.kind === 'member' ? { kind: 'returning' } : null;
  return null;
}

/** Reads the body of /api/attempts/summary?limit=1: true or false when certain, else undefined. */
export function startedFromSummary(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.items)) return undefined;
  return body.items.length > 0;
}

export const STARTED_CHECK_GAP_MS = 20000;
const ON_TEST = /^\/test(\/|$)/;

/**
 * Whether to ask the server if this member has a scored session yet. Only for a confirmed
 * member whose hint is not already "started", never on the test screen (nothing competes with a
 * timed test), at most once every STARTED_CHECK_GAP_MS, except straight after leaving the test
 * screen, where a first result has most likely just been saved.
 */
export function shouldCheckStarted({ status, hint, pathname = '', previousPath = '', lastCheckAt = 0, now = Date.now(), inFlight = false }) {
  if (status !== 'authenticated' || inFlight) return false;
  if (parseHint(hint).started === true) return false;
  if (ON_TEST.test(pathname)) return false;
  if (ON_TEST.test(previousPath)) return true;
  return !lastCheckAt || now - lastCheckAt >= STARTED_CHECK_GAP_MS;
}

const money = (n) => Number.isFinite(n) ? String(Math.max(0, Math.trunc(n))) : '0';

function untilLabel(premiumUntil) {
  const at = premiumUntil ? new Date(premiumUntil) : null;
  if (!at || Number.isNaN(at.getTime())) return '';
  return at.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

/**
 * Copy for the signed-in hero panel. `resume` is the result of findResumableTest, or null.
 * Three situations, in priority order:
 *   a test in progress (S6)   Resume your test
 *   no scored session (S3)    Start your 10-question check, and nothing competing with it
 *   active member (S4, S5)    Continue practice
 * The plan line is two parts (plan, detail) rendered side by side, not a dotted string.
 */
export function memberCopy(state, user, resume = null) {
  const pro = state.plan === 'pro';
  const first = state.stage === 'first';
  const name = state.name;
  const until = pro ? untilLabel(user?.premiumUntil) : '';
  const credits = user && 'creditBalance' in user ? money(user.creditBalance) : null;
  const plan = pro ? 'Pro plan' : 'Free plan';
  let planDetail = '';
  if (pro) planDetail = until ? `Active until ${until}` : 'Unlimited practice';
  else if (credits !== null) planDetail = `${credits} practice credit${credits === '1' ? '' : 's'} left`;

  // "Welcome back" is for someone who has been here before; a brand-new member is welcomed.
  const hello = first ? 'Welcome' : 'Welcome back';
  const greeting = name ? `${hello}, ${name}` : hello;

  if (resume) {
    return {
      greeting,
      title: 'Your test is waiting.',
      line: `${resume.minutesLeft} min left on your ${resume.label}. Your answers are saved on this device.`,
      plan, planDetail,
      primary: { label: 'Resume your test', href: resume.href },
      // Resume is the main action while a test is live; Practice stays one tap away.
      secondary: { label: 'Go to Practice', href: PRACTICE_HREF },
    };
  }
  if (first) {
    return {
      greeting,
      title: 'Start with a 10-question check.',
      line: 'Choose a subject. Afterwards you see where your marks went and what to work on first.',
      plan, planDetail,
      primary: { label: 'Start your 10-question check', href: FIRST_CHECK_HREF },
      secondary: null,
    };
  }
  return {
    greeting,
    title: 'Back to practice.',
    line: 'Practice, review your mistakes and see what to work on tonight.',
    plan, planDetail,
    primary: { label: 'Continue practice', href: PRACTICE_HREF },
    secondary: pro ? { label: 'Review your mistakes', href: '/review' } : { label: 'Compare plans', href: '/pricing' },
  };
}

/** Subject ids look like commerce_accountancy; show something readable. */
const readable = (id) => String(id || '').replace(/[_-]+/g, ' ').trim();

/**
 * The newest unfinished test saved on this device for this student, or null. Reads only keys
 * the runner wrote for this user id, and only drafts the runner itself would still resume.
 */
export function findResumableTest(storage, userId, now = Date.now()) {
  if (!storage || !userId) return null;
  const prefix = `mm:test:${userId}:`;
  let best = null;
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(prefix) || key.includes(':integrity')) continue;
      let saved;
      try { saved = JSON.parse(storage.getItem(key)); } catch { continue; }
      if (!saved || typeof saved.resumeUrl !== 'string' || !/^\/test\?[^#\s]+$/.test(saved.resumeUrl)) continue;
      if (saved.pendingSubmission) continue;
      if (!resumableDraft(saved, { generationKey: saved.generationKey, sessionId: saved.selectionMeta?.sessionId, now })) continue;
      if (!best || saved.endsAt > best.endsAt) {
        const subject = new URLSearchParams(saved.resumeUrl.split('?')[1]).get('subject');
        best = { endsAt: saved.endsAt, href: saved.resumeUrl, label: `${readable(subject) || 'practice'} test`, minutesLeft: Math.max(1, Math.ceil((saved.endsAt - now) / 60000)) };
      }
    }
  } catch { /* storage unavailable */ }
  return best;
}

/** A stored start page, or the default. The old checkbox only ever stored '1' (Practice). */
export function parseStartOn(raw) {
  return START_ON_OPTIONS.some((option) => option.id === raw) ? raw : DEFAULT_START_ON;
}

/**
 * The start page this device remembers. `available` is false when storage cannot be read
 * (private mode, blocked site data), in which case the default applies and cannot be changed.
 */
export function readStartOn(storage) {
  try {
    if (!storage) return { value: DEFAULT_START_ON, available: false };
    return { value: parseStartOn(storage.getItem(START_ON_KEY)), available: true };
  } catch {
    return { value: DEFAULT_START_ON, available: false };
  }
}

/** Saves a start page. Returns true only when the browser accepted it. Clears the old checkbox. */
export function writeStartOn(storage, value) {
  if (!START_ON_OPTIONS.some((option) => option.id === value)) return false;
  try {
    storage.setItem(START_ON_KEY, value);
    try { storage.removeItem(ARENA_FIRST_KEY); } catch { /* the old key is optional */ }
    return storage.getItem(START_ON_KEY) === value;
  } catch {
    return false;
  }
}

/**
 * The start page belongs to the student who chose it, not to the browser: signing out forgets
 * it, so the next person to sign in on this device gets the default (Practice).
 */
export function forgetStartOn(storage) {
  try { storage?.removeItem(START_ON_KEY); } catch { /* storage is optional */ }
  try { storage?.removeItem(ARENA_FIRST_KEY); } catch { /* storage is optional */ }
}
/** @deprecated AuthProvider still calls this name on sign-out. Same as forgetStartOn. */
export const forgetArenaFirst = forgetStartOn;

/**
 * Where "/" should send this student, or null to stay on the home page (decision D2: on by
 * default). Only for a confirmed member who opened the site fresh: typed the address, used a
 * bookmark or followed a link from elsewhere. Never when they came from a MockMob page (the logo
 * means home), asked for home with ?home, reloaded the home page or came back to it with the
 * back button, or chose Home as their start page.
 */
export function startDestination({ preference, state, landedOnHome, referrer, origin, search = '', navigationType = 'navigate' }) {
  if (state?.kind !== 'member' || !state.confirmed) return null;
  // Only the page a full load opened on: following the logo from inside the app is a request for home.
  if (!landedOnHome) return null;
  if (navigationType === 'reload' || navigationType === 'back_forward') return null;
  if (new URLSearchParams(search).has('home')) return null;
  if (referrer) {
    try { if (new URL(referrer).origin === origin) return null; } catch { return null; }
  }
  const choice = START_ON_OPTIONS.find((option) => option.id === parseStartOn(preference));
  return choice?.href || null;
}

/**
 * What the home page does on this load. `latched` is true once a confirmed decision has already
 * been made in this document (the page script keeps it for the life of the page, across in-app
 * navigation). Every confirmed decision latches, including "stay on home" (?home, a reload, Home
 * chosen as the start page): the external document.referrer never changes inside the app, so
 * without the latch a later click on the logo would look like a fresh visit and bounce the
 * student to Practice. An unconfirmed session decides nothing yet and does not latch.
 */
export function startRedirectPlan({ latched = false, ...input }) {
  if (latched || !input.state?.confirmed) return { latch: false, destination: null };
  return { latch: true, destination: startDestination(input) };
}

/**
 * Runs in <head> before first paint (inline, so it cannot depend on a bundle). It only sets
 * the attributes; the app keeps them current afterwards. Stay in sync with parseHint and stageOf.
 */
export const VISITOR_BOOT_SCRIPT = `(function(){var d=document.documentElement;try{var h=JSON.parse(localStorage.getItem('${VISITOR_KEY}')||'null');var k=h&&(h.kind==='member'||h.kind==='returning')?h.kind:'new';d.dataset.visitor=k;d.dataset.visitorPlan=k==='member'&&h.plan==='pro'?'pro':'free';if(k==='member'&&h.started===false)d.dataset.visitorStage='first';else delete d.dataset.visitorStage}catch(e){d.dataset.visitor='new';d.dataset.visitorPlan='free';delete d.dataset.visitorStage}})()`;

export { KINDS };
