// Pro nudges and the Upgrade sheet (owner, 18 Oct 2026, D79 to D81): the rules and the words, pure so node tests can hold them.
//
//   1. Inline nudges: one quiet line with one action at a natural moment (credits low, a set's cost, a scored result,
//      Review's chapter practice, the Start sheet). At most one per screen, never for Pro, never on a paper (the runner,
//      a Mob paper), a dismissed one stays quiet for 7 days, and after a "Not now" on the sheet every inline nudge stays
//      quiet for a day (a no is never answered with another ask).
//   2. The Upgrade sheet: opens whenever a Free student taps a Pro feature (their choice, so no cap), and once ever in
//      the first usage session after onboarding, only after the student's first real action (a scored set submitted),
//      never on onboarding, never in the first 2 minutes after it, never over a paper or another open sheet.
//   3. Its benefit lines come from the student's own record (D81). A personal line is shown only when its fact is
//      known and true; otherwise the plain line for that benefit stands in. Numbers are never invented.
//
// Every line here is true for the offer on sale today (src/lib/payments/offer.js, data/capabilities.js MODE_CAPABILITIES,
// /pricing, src/lib/paperCopy.mjs for "one central bank"). Pro makes practice need no credits; Ask Mobi replies still
// use credits on Pro, so no line says Pro means "no credits" without "for practice" beside it. One credits balance (D78):
// the words say "credits", never "practice credits". No "!", no emoji, no countdown, no scarcity.
import { TEST_MODES } from '../../data/test_modes.js';
import { subjectName } from '../components/start/startModel.mjs';

export const NUDGE_STORE_VERSION = 1;
export const QUIET_DAYS = 7;
export const QUIET_MS = QUIET_DAYS * 86_400_000;
// The first usage session: the browser session that finished onboarding, and at most this long after it.
export const FIRST_SESSION_MS = 6 * 3_600_000;
// The sheet waits this long after the first action lands, so the student sees their result before it.
export const FIRST_ACTION_DELAY_MS = 1800;
// Never right after onboarding: an action that lands this soon after it waits for the next one.
export const ONBOARDING_GAP_MS = 2 * 60_000;
// After a "Not now" on the sheet, inline nudges stay quiet this long.
export const DECLINE_QUIET_MS = 86_400_000;
// Routes where nothing may ask unprompted: a paper being sat (the runner, which also runs Mob papers) and onboarding.
const QUIET_ROUTES = Object.freeze(['/test', '/onboarding']);
export function quietRoute(route = '') {
  const path = String(route || '').split(/[?#]/)[0];
  return QUIET_ROUTES.some((p) => path === p || path.startsWith(`${p}/`));
}
export const CHECKOUT_HREF = '/pricing#plans';
export const FULL_MOCK_COST = TEST_MODES.full.creditCost;
const NTA_COUNT = TEST_MODES.nta.fixedCount;
const NTA_MINUTES = Math.round(TEST_MODES.nta.fixedDurationSec / 60);
// Subjects with an NTA mode blueprint (data/nta_blueprints/index.json "subjects"; a test holds the two in step). A personal
// NTA line names only these, so it never promises NTA mode in a subject that has none.
export const NTA_SUBJECTS = Object.freeze(['english', 'general_test', 'accountancy', 'business_studies', 'economics', 'mathematics', 'physics', 'chemistry', 'biology', 'computer_science', 'geography', 'history', 'political_science', 'psychology', 'sociology']);

// The places an inline nudge may stand. Each has one line and one action (the action opens the Upgrade sheet).
export const PLACEMENTS = Object.freeze(['credits_low', 'practice_cost', 'result', 'review_chapter', 'start_sheet', 'keycards']);

// Pro features a Free student can tap. Each opens the sheet with its own headline and its own benefit first.
export const TRIGGERS = Object.freeze(['nta', 'smart', 'difficulty', 'review', 'compass', 'saves', 'mob', 'mob_limit', 'study', 'benchmark', 'keycards', 'credits', 'result', 'first_session', 'generic']);

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
// The record kept per student on this device: { v, onboardedAt, session, firstShownAt, declinedAt, quiet: { placement: at } }.
// The account has no profile field for it (a server column would need a production migration), so it lives in
// localStorage, read and written inside try/catch by the client store.

export function emptyRecord() {
  return { v: NUDGE_STORE_VERSION, onboardedAt: null, session: null, firstShownAt: null, declinedAt: null, quiet: {} };
}

export function readRecord(raw) {
  if (!raw || typeof raw !== 'object' || raw.v !== NUDGE_STORE_VERSION) return emptyRecord();
  const quiet = raw.quiet && typeof raw.quiet === 'object' ? Object.fromEntries(Object.entries(raw.quiet).filter(([k, at]) => PLACEMENTS.includes(k) && Number.isFinite(at))) : {};
  return {
    v: NUDGE_STORE_VERSION,
    onboardedAt: Number.isFinite(raw.onboardedAt) ? raw.onboardedAt : null,
    session: clean(raw.session),
    firstShownAt: Number.isFinite(raw.firstShownAt) ? raw.firstShownAt : null,
    declinedAt: Number.isFinite(raw.declinedAt) ? raw.declinedAt : null,
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
  if (quietRoute(route)) return false;
  if (!action || !['paper', 'move'].includes(action.kind)) return false;
  const r = readRecord(record);
  if (!inFirstSession(r, { now, session })) return false;
  // Never right after onboarding: an action this soon waits for the next one (the record stays unmarked).
  if (now - r.onboardedAt < ONBOARDING_GAP_MS) return false;
  const at = Number(action.at);
  // An action finished before onboarding ended is not this session's first action (60 s of clock slack).
  if (Number.isFinite(at) && at < r.onboardedAt - 60_000) return false;
  return true;
}

/**
 * At the moment the first-session sheet is due to open (a beat after the result lands): still a Free student, still not
 * shown, not on a paper or onboarding, and no other sheet open. A false here leaves the record unmarked, so the next
 * real action in the same first session tries again.
 */
export function firstSheetMayOpen(record, { user, route = '', otherSheetOpen = false }) {
  if (!nudgesAllowed(user) || quietRoute(route) || otherSheetOpen) return false;
  return !readRecord(record).firstShownAt;
}

/** "Not now" (or the close) on the sheet: inline nudges rest for a day. */
export function markDeclined(record, now) {
  return { ...readRecord(record), declinedAt: now };
}

export function markFirstShown(record, now) {
  return { ...readRecord(record), firstShownAt: now };
}

// ---------------------------------------------------------------------------------------------------------------
// Inline nudges

/** Whether an inline nudge may show at this placement now: Free only, never on a paper, not within a day of a "Not now" on the sheet, and not within 7 days of being dismissed. */
export function inlineAllowed(record, { placement, now, user, route = '' }) {
  if (!nudgesAllowed(user) || !PLACEMENTS.includes(placement) || quietRoute(route)) return false;
  const r = readRecord(record);
  if (Number.isFinite(r.declinedAt) && now - r.declinedAt < DECLINE_QUIET_MS) return false;
  const at = r.quiet[placement];
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
 * (credits_low needs a known balance under a Full mock's price). The owner's own words lead (D79): "Get unlimited mocks"
 * and "No credits needed for practice with Pro".
 */
export function inlineCopy(placement, facts = {}) {
  const balance = whole(facts.balance);
  switch (placement) {
    case 'credits_low':
      if (balance === null || balance >= FULL_MOCK_COST) return null;
      return { text: `${plural(balance, 'credit')} left, short of a ${FULL_MOCK_COST}-credit Full mock. With Pro, practice needs no credits at all.`, action: 'Get unlimited mocks', trigger: 'credits' };
    case 'practice_cost':
      return { text: 'No credits needed for practice with Pro. Every set and every Full mock, included.', action: 'Get unlimited mocks', trigger: 'credits' };
    case 'result':
      return { text: 'Keep the momentum. With Pro, your next paper and every one after it need no credits.', action: 'Get unlimited mocks', trigger: 'result' };
    case 'review_chapter':
      return { text: 'Smart practice in Pro weights every set toward chapters like this one.', action: 'See Smart practice', trigger: 'smart' };
    case 'start_sheet':
      return { text: 'Unlimited mocks, NTA mode and Smart practice. One Pro price, no credits needed for practice.', action: 'See Pro', trigger: 'generic' };
    // Key cards home (KEYCARDS-BUILD-SPEC.md section 3, Free): the spec's own factual line.
    case 'keycards':
      return { text: 'Pro opens every card in every chapter and keeps them on a schedule.', action: 'See Pro', trigger: 'keycards' };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The Upgrade sheet's words. Owner D84 (18 Oct, 7:12 pm): nudge and paywall copy is persuasive marketing English,
// benefit-led and specific, and still true: no invented numbers, no fake scarcity, no countdowns, no "!", no emoji.
// docs/brain/PRO-NUDGE-COPY-1018.md holds the options with the reasons; the first of each is the one in use.

export const HEADLINE_OPTIONS = Object.freeze([
  'Unlimited mocks. No credits needed for practice.',
  'Practise until exam day feels familiar',
  'Every mock you need, from one central bank',
]);
// The key's words (D185, owner 20 Oct: the key always says Get Pro). The price is never inside the key: the sheet says it beside
// the key (sheetPrice), as /pricing does.
export const KEY_LABEL_OPTIONS = Object.freeze(['Get Pro']);

const GENERIC = Object.freeze({
  title: HEADLINE_OPTIONS[0],
  lede: 'Every paper is built fresh from one central question bank, so there is no fixed set of mocks to run out of. Pro adds NTA mode, Smart practice and full chapter review, all for one price.',
});

const HEADS = Object.freeze({
  nta: { title: 'Sit CUET before CUET', lede: 'Rehearse the whole paper on an exam-day style screen, against the clock, as often as you like. Original practice papers, not official ones.' },
  smart: { title: 'Practise what is costing you marks', lede: 'Smart practice reads your record and weights every set toward the chapters you miss, so more of your time goes where your marks leak.' },
  difficulty: { title: 'Choose how hard it gets', lede: 'Set easy, medium or hard for Quick practice and Full mocks. Warm up gently, or train where it is toughest.' },
  review: { title: 'See every chapter that costs you marks', lede: 'Full chapter review ranks every chapter, with your pace and the answers you changed, so you know exactly what to fix next.' },
  compass: { title: 'Know what your practice is worth', lede: 'Compass Pro projects each CUET paper from your own practice, with a range, and checks it against your DU shortlist. A projection, not a prediction.' },
  saves: { title: 'Your 25 free saves are full', lede: 'This question was not saved. Remove one to make room, or keep every question worth keeping with Pro, ready for revision.' },
  credits: { title: 'Stop rationing your practice', lede: 'With Pro, Quick practice and Full mocks need no credits. Take the paper you need, the moment you need it.' },
  mob: { title: 'See your whole Mob, every week', lede: 'Pro opens the full side-by-side: who picked what, who changed an answer and how long each question took. Plus past weeks and up to 3 Mobs you start.' },
  // The Mob limit the student just hit on Free (release 9 rules, src/lib/mob/model.mjs): one Mob paper a week across all their
  // Mobs, and one Mob they start (they may JOIN any number by invite). PRO_MAX_MOBS = 3 is how many a Pro student may START;
  // src/lib/server/mob/service.js gives Pro every Mob's weekly paper. The sheet answers the weekly-paper limit first.
  mob_limit: { title: "Sit every Mob's weekly paper", lede: "Free includes one Mob paper a week and one Mob you start. With Pro, sit every Mob's weekly paper, start up to 3 Mobs, and see the full side-by-side after each one." },
  // Study preferences (src/components/study/StudyWorkspace.jsx): the weekly plan and mixed revision are Pro; lessons stay free.
  study: { title: 'Plan your week, day by day', lede: "Pro saves a weekly plan, a subject and the minutes for each day, and mixes up to 20 concepts you have learned into one revision session. Lessons, reviews and Today's plan stay free." },
  // The benchmark rivals (src/components/ai/AIRivalArena.jsx, src/services/usage/getDailyUsage.js LIMITS.paid).
  benchmark: { title: 'All four rivals, no daily limit', lede: 'Free includes one benchmark a day against one rival. Pro opens all four standard rivals with no daily limit. The stronger rivals also use credits.' },
  // Key cards (data/keycards.js KEYCARD_RULES.free): 5 cards a chapter, 10 reviews a day on Free.
  keycards: { title: 'Every Key card, on a schedule', lede: 'Pro opens every card in every chapter and keeps them on a schedule. Free opens 5 cards a chapter and 10 card reviews a day.' },
  // Never counts papers: the sheet can open on a later paper in the first session (a paper within 2 minutes of
  // onboarding, or one the student left before the sheet was due, does not open it), so "first" would not always be true.
  first_session: { title: 'Paper done. Now take the limits off.', lede: 'Pro gives you unlimited mocks from one central bank, NTA mode and Smart practice, for one price. No credits needed for practice.' },
  result: { title: 'Keep the momentum going', lede: 'Your next paper is built fresh from the bank. With Pro it needs no credits, and neither does the one after it.' },
  generic: GENERIC,
});

/** The sheet's headline and lede for a trigger. */
export function sheetHead(trigger) {
  return HEADS[trigger] || GENERIC;
}

/** The sheet's key: Get Pro, whatever is on sale (D185). The price sits beside it (sheetPrice). */
export function keyLabel() {
  return KEY_LABEL_OPTIONS[0];
}

// Each benefit: a plain line (always true) and, when the student's own fact is known, a personal line in its place.
const BENEFITS = Object.freeze({
  unlimited: {
    plain: () => 'Unlimited Quick practice and Full mocks, each paper built fresh from one central bank.',
    personal: (f) => {
      const mocks = whole(f.fullMocks);
      if (mocks) return `You have sat ${plural(mocks, 'full mock')}. With Pro, sit as many as it takes.`;
      const sets = whole(f.sessions);
      if (sets) return `${plural(sets, 'practice set')} done. With Pro, the next ones need no credits.`;
      return null;
    },
  },
  credits: {
    plain: () => 'No credits needed for practice: every set and every Full mock is included.',
    personal: (f) => {
      const spent = whole(f.spentWeek);
      if (spent) return `You spent ${plural(spent, 'credit')} on practice this week. With Pro, that would be 0.`;
      const balance = whole(f.balance);
      if (balance !== null && balance < FULL_MOCK_COST) return `${plural(balance, 'credit')} left. With Pro, practice never runs out.`;
      return null;
    },
  },
  nta: {
    plain: () => `NTA mode: the exam-day style screen, ${NTA_COUNT} questions in ${NTA_MINUTES} minutes.`,
    personal: (f) => {
      const all = Array.isArray(f.subjects) ? f.subjects.filter(Boolean) : [];
      const subjects = all.filter((id) => NTA_SUBJECTS.includes(id === 'gat' ? 'general_test' : id));
      // Every one of the student's subjects must have NTA mode before "all N" is said; otherwise one named, or the plain line.
      if (subjects.length > 1 && subjects.length < all.length) return null;
      if (subjects.length === 1) return `NTA mode in ${subjectName(subjects[0])}: the exam-day style screen, ${NTA_COUNT} questions in ${NTA_MINUTES} minutes.`;
      if (subjects.length > 1) return `NTA mode in all ${subjects.length} of your subjects: the exam-day style screen, ${NTA_COUNT} questions in ${NTA_MINUTES} minutes.`;
      return null;
    },
  },
  smart: {
    plain: () => 'Smart practice weights every set toward the chapters you miss.',
    personal: (f) => {
      const weak = clean(f.weakChapter);
      if (weak) return `${weak} had the most mistakes on your paper. Smart practice weights your sets toward chapters like it.`;
      const focus = clean(f.focusChapter);
      return focus ? `Smart practice weights your sets toward chapters like ${focus}.` : null;
    },
  },
  difficulty: { plain: () => 'Set the level for any session: easy, medium or hard.', personal: () => null },
  review: { plain: () => 'Full chapter review: every chapter ranked, with your pace and changed answers.', personal: () => null },
  compass: { plain: () => 'Compass Pro: your practice projected against your DU shortlist.', personal: () => null },
  saves: { plain: () => 'Unlimited saved questions. Free keeps 25.', personal: () => null },
  mob: { plain: () => "Your Mob's shared trap with its repair, and extra papers on a chapter you choose.", personal: () => null },
  mob_more: { plain: () => "Every Mob's weekly paper, not one a week, and up to 3 Mobs you start.", personal: () => null },
  study: { plain: () => 'A saved weekly plan and mixed revision of up to 20 learned concepts.', personal: () => null },
  benchmark: { plain: () => 'All four standard benchmark rivals, with no daily limit.', personal: () => null },
  keycards: { plain: () => 'Every Key card in every chapter, in NCERT’s exact words, kept on a schedule in Revise.', personal: () => null },
});

// The order each trigger leads with; the rest follow in the default order. Four lines at most.
const DEFAULT_ORDER = ['unlimited', 'credits', 'nta', 'smart'];
const LEAD = Object.freeze({
  nta: ['nta'], smart: ['smart'], difficulty: ['difficulty'], review: ['review'], compass: ['compass'], saves: ['saves'],
  credits: ['credits'], result: ['unlimited'], first_session: [], mob: ['mob'], mob_limit: ['mob_more', 'mob'], study: ['study'],
  benchmark: ['benchmark'], keycards: ['keycards'], generic: [],
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
  if (reason === 'benchmark') return 'benchmark';
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

/**
 * The chapter with the most mistakes in a list of { chapter, count }, or null. Only a clear top counts: at least 2
 * mistakes and more than any other chapter, so "had the most mistakes" is always true.
 */
export function weakestChapter(chapterCounts) {
  if (!Array.isArray(chapterCounts) || !chapterCounts.length) return null;
  const rows = chapterCounts.filter((c) => clean(c?.chapter) && whole(c?.count)).sort((a, b) => b.count - a.count);
  if (!rows.length || rows[0].count < 2 || (rows[1] && rows[1].count === rows[0].count)) return null;
  return rows[0].chapter;
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
