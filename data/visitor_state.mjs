// Who is looking at the home page, as far as this browser can tell.
//
// Kinds (also the value of <html data-visitor>, which a tiny script sets before first paint
// so the right hero shows without a flash):
//   new        signed out, first visit on this device. The marketing page.
//   returning  signed out, has been here (or signed in) before. A sign-in path first.
//   member     signed in. An Enter-the-Arena action first. `plan` is 'free' or 'pro'.
//
// Everything here is pure so it can be unit tested; browser storage is injected.
import { resumableDraft } from './session_draft.js';

export const VISITOR_KEY = 'mm:visitor:v1';
export const ARENA_FIRST_KEY = 'mm:arena-first:v1';
export const ARENA_HREF = '/dashboard';

const KINDS = ['new', 'returning', 'member'];

/** Reads a stored hint. Anything unexpected is treated as no hint. */
export function parseHint(raw) {
  try {
    const hint = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!hint || typeof hint !== 'object') return { kind: 'new', plan: null };
    if (hint.kind === 'member') return { kind: 'member', plan: hint.plan === 'pro' ? 'pro' : 'free' };
    if (hint.kind === 'returning') return { kind: 'returning', plan: null };
  } catch { /* corrupt value */ }
  return { kind: 'new', plan: null };
}

export const serializeHint = (hint) => JSON.stringify(hint.kind === 'member' ? { kind: 'member', plan: hint.plan === 'pro' ? 'pro' : 'free' } : { kind: hint.kind });

export const planOf = (user) => (user?.isPremium ? 'pro' : 'free');

export function firstName(user) {
  const name = String(user?.name || '').trim();
  return name ? name.split(/\s+/)[0].slice(0, 24) : '';
}

/**
 * The visitor right now. `status` is the AuthProvider status; `hint` is the stored hint, used
 * while the first auth check is still running and when MockMob could not be reached (the
 * student is not signed out in that case).
 */
export function visitorState({ status, user, hint }) {
  const stored = parseHint(hint);
  if (status === 'authenticated') return { kind: 'member', plan: planOf(user), confirmed: true, name: firstName(user) };
  if (status === 'unauthenticated') {
    // Signed out now. Someone who was here before is a returning visitor either way.
    return { kind: stored.kind === 'new' ? 'new' : 'returning', plan: null, confirmed: true, name: '' };
  }
  // loading or unavailable: trust the hint.
  return { kind: stored.kind, plan: stored.kind === 'member' ? stored.plan : null, confirmed: false, name: firstName(user) };
}

/**
 * What to remember after an auth change. Returns the hint to store, or null for "leave it".
 * A first visit by a signed-out visitor is recorded as returning so the next visit is
 * recognised; an unavailable check never changes the hint.
 */
export function nextHint({ status, user, current }) {
  const stored = parseHint(current);
  if (status === 'authenticated') {
    const plan = planOf(user);
    return stored.kind === 'member' && stored.plan === plan ? null : { kind: 'member', plan };
  }
  if (status === 'unauthenticated') return stored.kind === 'returning' ? null : { kind: 'returning' };
  return null;
}

const money = (n) => Number.isFinite(n) ? String(Math.max(0, Math.trunc(n))) : '0';

function untilLabel(premiumUntil) {
  const at = premiumUntil ? new Date(premiumUntil) : null;
  if (!at || Number.isNaN(at.getTime())) return '';
  return at.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

/** Copy for the signed-in hero panel. `resume` is the result of findResumableTest, or null. */
export function memberCopy(state, user, resume = null) {
  const pro = state.plan === 'pro';
  const name = state.name;
  const until = pro ? untilLabel(user?.premiumUntil) : '';
  const credits = user && 'creditBalance' in user ? money(user.creditBalance) : null;
  let plan;
  if (pro) plan = until ? `Pro plan · active until ${until}` : 'Pro plan · unlimited practice';
  else plan = credits === null ? 'Free plan' : `Free plan · ${credits} practice credit${credits === '1' ? '' : 's'} left`;
  const unlimited = pro && until ? 'Unlimited practice' : '';
  return {
    eyebrow: name ? `Welcome back, ${name}` : 'Welcome back',
    title: resume ? 'Your test is waiting.' : 'Your Arena is ready.',
    line: resume
      ? `${resume.minutesLeft} min left on your ${resume.label}. Your answers are saved on this device.`
      : 'Practise, review your mistakes and see what to work on tonight.',
    plan,
    unlimited,
    primary: resume ? { label: 'Resume your test', href: resume.href } : { label: 'Enter the Arena', href: ARENA_HREF },
    // Resume is the main action while a test is live; the Arena stays one tap away.
    secondary: resume ? { label: 'Go to the Arena', href: ARENA_HREF } : pro ? { label: 'Review your mistakes', href: '/review' } : { label: 'Compare plans', href: '/pricing' },
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

/**
 * Should "/" send this student straight into the Arena? Only when they asked for that, are
 * confirmed signed in, and opened the site fresh (typed the address or followed a link from
 * elsewhere). Coming from a MockMob page, for example the logo, means they want the home page.
 */
export function shouldEnterArena({ preference, state, landedOnHome, referrer, origin, search = '' }) {
  if (preference !== '1' || state?.kind !== 'member' || !state.confirmed) return false;
  // Only the page a full load opened on: following the logo from inside the app is a request for home.
  if (!landedOnHome) return false;
  if (new URLSearchParams(search).has('home')) return false;
  if (referrer) {
    try { if (new URL(referrer).origin === origin) return false; } catch { return false; }
  }
  return true;
}

/**
 * Runs in <head> before first paint (inline, so it cannot depend on a bundle). It only sets
 * the attribute; the app keeps it current afterwards. Stay in sync with parseHint.
 */
export const VISITOR_BOOT_SCRIPT = `(function(){try{var h=JSON.parse(localStorage.getItem('${VISITOR_KEY}')||'null');var k=h&&(h.kind==='member'||h.kind==='returning')?h.kind:'new';document.documentElement.dataset.visitor=k}catch(e){document.documentElement.dataset.visitor='new'}})()`;

export { KINDS };
