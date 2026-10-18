// Pro nudges and the Upgrade sheet (owner, 18 Oct 2026, D79 to D81): the rules and the words, pure so node tests can hold them.
//
//   1. Inline nudges: one quiet line with one action at a natural moment (credits low, a set's cost, a scored result,
//      Review's chapter practice, the Start sheet). At most one per screen, never for Pro, and a dismissed one stays
//      quiet for 7 days.
//   2. The Upgrade sheet: opens whenever a Free student taps a Pro feature (their choice, so no cap), and once ever in
//      the first usage session after onboarding, only after the student's first real action (a scored set submitted).
//   3. Its benefit lines come from the student's own record (D81). A personal line is shown only when its fact is
//      known and true; otherwise the plain line for that benefit stands in. Numbers are never invented.
//
// Every line here is true for the offer on sale today (src/lib/payments/offer.js, data/capabilities.js MODE_CAPABILITIES,
// /pricing). No "!", no emoji, no countdown, no scarcity.
import { TEST_MODES } from '../../data/test_modes.js';
import { subjectName } from '../components/start/startModel.mjs';

export const NUDGE_STORE_VERSION = 1;
export const QUIET_DAYS = 7;
export const QUIET_MS = QUIET_DAYS * 86_400_000;
// The first usage session: the browser session that finished onboarding, and at most this long after it.
export const FIRST_SESSION_MS = 6 * 3_600_000;
// The sheet waits this long after the first action lands, so the student sees their result before it.
export const FIRST_ACTION_DELAY_MS = 1800;
export const CHECKOUT_HREF = '/pricing#plans';
export const FULL_MOCK_COST = TEST_MODES.full.creditCost;
const NTA_COUNT = TEST_MODES.nta.fixedCount;
const NTA_MINUTES = Math.round(TEST_MODES.nta.fixedDurationSec / 60);

// The places an inline nudge may stand. Each has one line and one action (the action opens the Upgrade sheet).
export const PLACEMENTS = Object.freeze(['credits_low', 'practice_cost', 'result', 'review_chapter', 'start_sheet']);

// Pro features a Free student can tap. Each opens the sheet with its own headline and its own benefit first.
export const TRIGGERS = Object.freeze(['nta', 'smart', 'difficulty', 'review', 'compass', 'saves', 'mob', 'credits', 'result', 'first_session', 'generic']);

const whole = (n) => (Number.isFinite(Number(n)) && n !== null && n !== '' ? Math.max(0, Math.trunc(Number(n))) : null);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const clean = (s) => (typeof s === 'string' && s.trim() ? s.trim() : null);

// ---------------------------------------------------------------------------------------------------------------
// Who sees anything

/** Pro students never see a nudge or the sheet. Unknown plan (no user) sees nothing either. */
export function nudgesAllowed(user) {
  return Boolean(user && user.id && !user.isPremium);
}

// ---------------------------------------------------------------------------------------------------------------
// The record kept per student on this device: { v, onboardedAt, session, firstShownAt, quiet: { placement: at } }.
// The account has no profile field for it (a server column would need a production migration), so it lives in
// localStorage, read and written inside try/catch by the client store.

export function emptyRecord() {
  return { v: NUDGE_STORE_VERSION, onboardedAt: null, session: null, firstShownAt: null, quiet: {} };
}

export function readRecord(raw) {
  if (!raw || typeof raw !== 'object' || raw.v !== NUDGE_STORE_VERSION) return emptyRecord();
  const quiet = raw.quiet && typeof raw.quiet === 'object' ? Object.fromEntries(Object.entries(raw.quiet).filter(([k, at]) => PLACEMENTS.includes(k) && Number.isFinite(at))) : {};
  return {
    v: NUDGE_STORE_VERSION,
    onboardedAt: Number.isFinite(raw.onboardedAt) ? raw.onboardedAt : null,
    session: clean(raw.session),
    firstShownAt: Number.isFinite(raw.firstShownAt) ? raw.firstShownAt : null,
    quiet,
  };
}

/** Onboarding finished in this browser session: the first usage session starts now. A second onboarding never resets it. */
export function noteOnboarded(record, { now, session }) {
  const r = readRecord(record);
  if (r.onboardedAt || r.firstShownAt) return r;
  return { ...r, onboardedAt: now, session };
}

/** True while the student is still in the first usage session after onboarding and the sheet has not shown. */
export function inFirstSession(record, { now, session }) {
  const r = readRecord(record);
  if (!r.onboardedAt || r.firstShownAt || !session || r.session !== session) return false;
  return now >= r.onboardedAt && now - r.onboardedAt <= FIRST_SESSION_MS;
}

/**
 * Whether the student's first real action opens the sheet. `action` is { kind, at }: kind 'paper' (a scored practice set or
 * mock submitted, which is also how a Today move finishes) or 'move' (a Today move started and finished on its own page).
 * Never for Pro, never on onboarding, never for an action older than onboarding, and only once.
 */
export function firstActionOpens(record, { now, session, user, route = '', action = null }) {
  if (!nudgesAllowed(user)) return false;
  if (String(route).startsWith('/onboarding')) return false;
  if (!action || !['paper', 'move'].includes(action.kind)) return false;
  const r = readRecord(record);
  if (!inFirstSession(r, { now, session })) return false;
  const at = Number(action.at);
  // An action finished before onboarding ended is not this session's first action (60 s of clock slack).
  if (Number.isFinite(at) && at < r.onboardedAt - 60_000) return false;
  return true;
}

export function markFirstShown(record, now) {
  return { ...readRecord(record), firstShownAt: now };
}

// ---------------------------------------------------------------------------------------------------------------
// Inline nudges

/** Whether an inline nudge may show at this placement now: Free only, and not within 7 days of being dismissed. */
export function inlineAllowed(record, { placement, now, user }) {
  if (!nudgesAllowed(user) || !PLACEMENTS.includes(placement)) return false;
  const at = readRecord(record).quiet[placement];
  return !(Number.isFinite(at) && now - at < QUIET_MS);
}

export function quietInline(record, placement, now) {
  const r = readRecord(record);
  if (!PLACEMENTS.includes(placement)) return r;
  return { ...r, quiet: { ...r.quiet, [placement]: now } };
}

/**
 * At most one inline nudge per screen. `claims` maps a screen key to the placement holding it; the first to claim wins,
 * the same placement may claim again (a re-render), and a released claim frees the screen.
 */
export function claimScreen(claims, screen, placement) {
  const held = claims.get(screen);
  if (held && held !== placement) return false;
  claims.set(screen, placement);
  return true;
}

export function releaseScreen(claims, screen, placement) {
  if (claims.get(screen) === placement) claims.delete(screen);
}

/**
 * The line and action for a placement, from facts the page has. Returns null when the placement's condition is not met
 * (credits_low needs a known balance under a Full mock's price).
 */
export function inlineCopy(placement, facts = {}) {
  const balance = whole(facts.balance);
  switch (placement) {
    case 'credits_low':
      if (balance === null || balance >= FULL_MOCK_COST) return null;
      return { text: `Only ${plural(balance, 'practice credit')} left, not enough for a Full mock. Pro practice never runs out.`, action: 'Go unlimited', trigger: 'credits' };
    case 'practice_cost':
      return { text: 'Practise without counting credits. Pro includes every set and every mock.', action: 'Go unlimited', trigger: 'credits' };
    case 'result':
      return { text: 'Keep the momentum. With Pro, your next mock and every one after it cost no credits.', action: 'Go unlimited', trigger: 'result' };
    case 'review_chapter':
      return { text: 'Pro aims Smart practice at chapters like this one, with no credits to spend.', action: 'See Pro', trigger: 'smart' };
    case 'start_sheet':
      return { text: 'Unlimited mocks, NTA mode and Smart practice, all in Pro.', action: 'See Pro', trigger: 'generic' };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The Upgrade sheet's words. Owner D84 (18 Oct, 7:12 pm): nudge and paywall copy is persuasive marketing English,
// benefit-led and specific, and still true: no invented numbers, no fake scarcity, no countdowns, no "!", no emoji.

// The owner's three headline options for the generic sheet; the first is the one in use.
export const HEADLINE_OPTIONS = Object.freeze([
  'Practise without limits',
  'Every mock you need. No credits, no cap.',
  'Rehearse CUET until it feels familiar',
]);
// The owner's three key-label options; the first is the one in use (keyLabel fills in the price on sale).
export const KEY_LABEL_OPTIONS = Object.freeze(['Get Pro for ₹99', 'Unlock unlimited practice', 'Go Pro']);

const GENERIC = Object.freeze({
  title: HEADLINE_OPTIONS[0],
  lede: 'Unlimited mocks, NTA mode on the exam-day screen, and Smart practice that hunts down your weak chapters. One price, no credits to count.',
});

const HEADS = Object.freeze({
  nta: { title: 'Sit the exam before the exam', lede: 'Rehearse on the exam-day screen, against the clock, as many times as you want. Original practice papers, not official ones.' },
  smart: { title: 'Stop guessing what to practise', lede: 'Smart practice reads your record and aims every set at the chapters you miss.' },
  difficulty: { title: 'Train at the level you choose', lede: 'Pick easy, medium or hard for Quick practice and Full mocks. Warm up, or push where it is hardest.' },
  review: { title: 'See every chapter that costs you marks', lede: 'Full chapter review ranks every chapter, with your pace and the answers you changed.' },
  compass: { title: 'See where your practice puts you', lede: 'Compass Pro projects your practice paper by paper against your DU shortlist. A projection, not a prediction.' },
  saves: { title: 'Keep every question worth keeping', lede: 'Free keeps 25 saved questions. Pro keeps all of them.' },
  credits: { title: 'Never ration practice again', lede: 'With Pro, Quick practice and Full mocks use no credits. Take the set you need, when you need it.' },
  first_session: { title: 'One paper down. Keep going without limits.', lede: 'Pro takes the cap off: unlimited mocks, NTA mode and Smart practice, for one price.' },
  result: { title: 'Keep the momentum going', lede: 'Your next paper is ready. With Pro it costs no credits, and neither does the one after it.' },
  mob: GENERIC,
  generic: GENERIC,
});

/** The sheet's headline and lede for a trigger. */
export function sheetHead(trigger) {
  return HEADS[trigger] || GENERIC;
}

/** The sheet's key: names the price on sale today, as /pricing does. */
export function keyLabel(offer) {
  if (offer?.purchasable === 'monthly' && offer.monthly) return `Start Pro for ₹${offer.monthly.rupees}/month`;
  if (offer?.oneTime) return `Get Pro for ₹${offer.oneTime.rupees}`;
  return 'Get Pro';
}

// Each benefit: a plain line (always true) and, when the student's own fact is known, a personal line in its place.
const BENEFITS = Object.freeze({
  unlimited: {
    plain: () => 'Unlimited Quick practice and Full mocks, a fresh paper every time.',
    personal: (f) => {
      const mocks = whole(f.fullMocks);
      if (mocks) return `You have sat ${plural(mocks, 'full mock')}. With Pro, sit as many as it takes.`;
      const sets = whole(f.sessions);
      if (sets) return `${plural(sets, 'practice set')} done. With Pro, the next ones cost no credits.`;
      return null;
    },
  },
  credits: {
    plain: () => 'Zero credits to count: every set and every mock is included.',
    personal: (f) => {
      const spent = whole(f.spentWeek);
      if (spent) return `You spent ${plural(spent, 'practice credit')} this week. On Pro, that is 0.`;
      const balance = whole(f.balance);
      if (balance !== null && balance < FULL_MOCK_COST) return `Only ${plural(balance, 'practice credit')} left. On Pro, you never run out.`;
      return null;
    },
  },
  nta: {
    plain: () => `NTA mode: rehearse on the exam-day screen, ${NTA_COUNT} questions in ${NTA_MINUTES} minutes.`,
    personal: (f) => {
      const subjects = Array.isArray(f.subjects) ? f.subjects.filter(Boolean) : [];
      if (subjects.length === 1) return `NTA mode in ${subjectName(subjects[0])}: the exam-day screen, ${NTA_COUNT} questions in ${NTA_MINUTES} minutes.`;
      if (subjects.length > 1) return `NTA mode in all ${subjects.length} of your subjects: the exam-day screen, ${NTA_COUNT} questions in ${NTA_MINUTES} minutes.`;
      return null;
    },
  },
  smart: {
    plain: () => 'Smart practice aims every set at the chapters you miss.',
    personal: (f) => {
      const chapter = clean(f.weakChapter);
      return chapter ? `${chapter} cost you the most. Smart practice aims your sets at chapters like it.` : null;
    },
  },
  difficulty: { plain: () => 'Set the level for any session: easy, medium or hard.', personal: () => null },
  review: { plain: () => 'Full chapter review: every ranked chapter, your pace and changed answers.', personal: () => null },
  compass: { plain: () => 'Compass Pro: your practice projected against your DU shortlist.', personal: () => null },
  saves: { plain: () => 'Unlimited saved questions. Free keeps 25.', personal: () => null },
});

// The order each trigger leads with; the rest follow in the default order. Four lines at most.
const DEFAULT_ORDER = ['unlimited', 'credits', 'nta', 'smart'];
const LEAD = Object.freeze({
  nta: ['nta'], smart: ['smart'], difficulty: ['difficulty'], review: ['review'], compass: ['compass'], saves: ['saves'],
  credits: ['credits'], result: ['unlimited'], first_session: [], mob: ['unlimited'], generic: [],
});
export const MAX_BENEFITS = 4;

/**
 * The sheet's benefit lines for this student: { id, text, personal }[], at most four. The trigger's own benefit leads;
 * then the lines the student's record makes personal come first. A personal line appears only when its fact is known and
 * true; otherwise the plain line stands in.
 */
export function benefitLines(trigger = 'generic', facts = {}) {
  const lead = LEAD[trigger] || [];
  const order = [...lead, ...DEFAULT_ORDER.filter((id) => !lead.includes(id))];
  const lines = order.map((id) => {
    const b = BENEFITS[id];
    const personal = b.personal(facts || {});
    return { id, text: personal || b.plain(), personal: Boolean(personal) };
  });
  const head = lines.slice(0, lead.length);
  const rest = lines.slice(lead.length);
  return [...head, ...rest.filter((l) => l.personal), ...rest.filter((l) => !l.personal)].slice(0, MAX_BENEFITS);
}

/** The price under the benefits, framed as offer.js frames it. */
export function sheetPrice(offer) {
  if (offer?.purchasable === 'monthly' && offer.monthly) return { figure: `₹${offer.monthly.rupees}`, cycle: 'a month', terms: 'Renews monthly. Cancel anytime in Account.' };
  if (offer?.oneTime) return { figure: `₹${offer.oneTime.rupees}`, cycle: 'once', terms: `One payment covers you through ${offer.oneTime.expires}. No auto-renewal.` };
  return null;
}

/** Map a /pricing link's ?reason= (data/practice_quote.js) to a trigger. */
export function triggerForReason(reason) {
  if (reason === 'premium_mode') return 'generic';
  if (reason === 'credits') return 'credits';
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Facts the pages already hold

/** Practice credits spent in the 7 days before `now`, from Account > Credits history lines ({ at, pool, delta }). null when unknown. */
export function practiceSpentWeek(history, now) {
  if (!Array.isArray(history)) return null;
  let spent = 0;
  for (const line of history) {
    if (line?.pool !== 'practice') continue;
    const at = Date.parse(line.at);
    const delta = Number(line.delta);
    if (!Number.isFinite(at) || !Number.isFinite(delta) || delta >= 0) continue;
    if (now - at <= 7 * 86_400_000 && at <= now) spent += -delta;
  }
  return spent;
}

/** Full mocks (Full and NTA) in a list of attempts that carry their mode; null when no attempt says its mode. */
export function fullMocksIn(attempts) {
  if (!Array.isArray(attempts) || !attempts.length) return Array.isArray(attempts) ? 0 : null;
  const modeOf = (a) => a?.mode || a?.selectionMeta?.mode || null;
  if (!attempts.some((a) => modeOf(a))) return null;
  return attempts.filter((a) => ['full', 'nta'].includes(modeOf(a))).length;
}

/** The chapter with the most mistakes in a list of { chapter, count }, or null. */
export function weakestChapter(chapterCounts) {
  if (!Array.isArray(chapterCounts) || !chapterCounts.length) return null;
  const top = [...chapterCounts].filter((c) => clean(c?.chapter) && whole(c?.count)).sort((a, b) => b.count - a.count)[0];
  return top ? top.chapter : null;
}

/** Merge facts: later known values win, unknown values never overwrite known ones. */
export function mergeFacts(...parts) {
  const out = {};
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    for (const [k, v] of Object.entries(part)) {
      if (v === null || v === undefined || (Array.isArray(v) && !v.length)) continue;
      out[k] = v;
    }
  }
  return out;
}
