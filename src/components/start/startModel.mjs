// The Start sheet's pure rules (web v2, 15 Oct 2026).
//
// No React and no browser globals, so src/components/start/__tests__/startModel.test.mjs runs them
// under node --test. StartSheet.jsx renders what these functions return.
//
// Truth rules:
// - The hero is the live site's own next step (/api/learning/plan primary): the same title and link
//   Today shows, so the two never disagree. Nothing here invents a move. Its reason is the plan's,
//   except for plain practice, where the planner's reason describes the planner (heroReason).
// - Every count, minute and credit comes from data/test_modes.js (the launcher's and the API's
//   single source) and the student's own balance. Nothing is spent in the sheet: each row opens
//   Practice set up for that session, and Practice shows the cost again before Start.
// - Copy: sentence case, no "!", no em dash.
//
// Logic ported from wt-web-ia (src/lib/navigation.js startActions, src/components/shell/shellModel.mjs
// sheetRows and morphFrom, data/next_step_rules.mjs practiceHref), rebased on the live plan API.
import { TEST_MODES, practiceCreditCost } from '../../../data/test_modes.js';
import { DAILY_FREE_LINE, DAILY_FREE_SHORT, DAILY_SET, PRICE_AT_START_LINE, PRICE_AT_START_SHORT, dailySetState, isDailySet } from '../../lib/dailySet.mjs';
import { CUET_MAX_SUBJECTS } from '../../lib/cuetRules.mjs';
import { FIRST_FULL_MOCK_COPY, FIRST_FULL_MOCK_STATE } from '../../../data/first_full_mock.js';

export const PRACTICE_HREF = '/dashboard';
export const SUBJECT_KEY = 'mm:start-subject:v1';
export const MAX_SUBJECTS = CUET_MAX_SUBJECTS;

// ---------------------------------------------------------------------------------------------
// Subjects: the 15 public CUET subjects (data/cuet_controls.js order) and the app's lit objects.
// Alt text says what the object is; the subject name is always printed beside it.
const art = (name, width, height, footX, footWidth, ground, object) => Object.freeze({ name, width, height, footX, footWidth, ground, object });
export const SUBJECT_ART = Object.freeze({
  accountancy: art('accountancy', 512, 335, 0.54, 0.80, 0.92, 'A desk calculator on a ledger page'),
  business: art('business', 512, 435, 0.55, 0.80, 0.96, 'An open briefcase with a growth chart, coins and a calculator'),
  economics: art('economics', 403, 512, 0.50, 0.88, 0.96, 'A kitchen scale with an onion'),
  english: art('english', 512, 316, 0.48, 0.80, 0.88, 'A folded newspaper and a fountain pen'),
  generaltest: art('generaltest', 512, 406, 0.50, 0.86, 0.93, 'A puzzle cube and a compass'),
  mathematics: art('mathematics', 512, 355, 0.52, 0.80, 0.90, 'A pair of compasses and a protractor on graph paper'),
  physics: art('physics', 512, 461, 0.50, 0.88, 0.95, 'A Newton’s cradle'),
  chemistry: art('chemistry', 504, 512, 0.50, 0.88, 0.955, 'A conical flask and a test tube'),
  biology: art('biology', 298, 512, 0.50, 0.86, 0.955, 'A brass microscope'),
  history: art('history', 512, 352, 0.50, 0.88, 0.92, 'A carved seal and a scroll'),
  politicalscience: art('politicalscience', 512, 393, 0.50, 0.84, 0.94, 'A bound constitution and a gavel'),
  geography: art('geography', 363, 512, 0.50, 0.58, 0.955, 'A globe'),
  psychology: art('psychology', 512, 509, 0.53, 0.72, 0.955, 'A glass brain on a stand'),
  sociology: art('sociology', 512, 410, 0.50, 0.90, 0.945, 'Wooden figures on a woven mat'),
  computerscience: art('computerscience', 512, 408, 0.50, 0.80, 0.92, 'A laptop showing code'),
  language: art('language', 512, 300, 0.56, 0.74, 0.90, 'An open notebook and a pencil'),
});

const subject = (id, name, artName, aliases = []) => Object.freeze({ id, name, art: artName, aliases });
export const START_SUBJECTS = Object.freeze([
  subject('english', 'English', 'english'),
  subject('general_test', 'General Test', 'generaltest', ['gat', 'gt']),
  subject('accountancy', 'Accountancy', 'accountancy'),
  subject('business_studies', 'Business Studies', 'business', ['bst']),
  subject('economics', 'Economics', 'economics'),
  subject('mathematics', 'Mathematics', 'mathematics', ['applied_mathematics']),
  subject('physics', 'Physics', 'physics'),
  subject('chemistry', 'Chemistry', 'chemistry'),
  subject('biology', 'Biology', 'biology'),
  subject('history', 'History', 'history'),
  subject('political_science', 'Political Science', 'politicalscience'),
  subject('geography', 'Geography', 'geography'),
  subject('psychology', 'Psychology', 'psychology'),
  subject('sociology', 'Sociology', 'sociology'),
  subject('computer_science', 'Computer Science', 'computerscience'),
]);

const norm = (value) => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

/** The subject record for a public or internal id, or null when the sheet does not know it. */
export function subjectFor(id) {
  const key = norm(id);
  if (!key) return null;
  return START_SUBJECTS.find((s) => s.id === key || s.aliases.includes(key)) || null;
}

/** The name students read, for a known id; '' otherwise (the sheet never prints a raw id). */
export function subjectName(id) {
  return subjectFor(id)?.name || '';
}

/** The art record for a subject id, or null (the row then keeps its drawn graphic). */
export function subjectArt(id) {
  const s = subjectFor(id);
  return s ? SUBJECT_ART[s.art] : null;
}

/** The student's subjects the sheet can offer, in their sheet order, deduplicated, at most the CUET cap (5). */
export function startSubjects(userSubjects = []) {
  const out = [];
  for (const raw of Array.isArray(userSubjects) ? userSubjects : []) {
    const s = subjectFor(typeof raw === 'string' ? raw : raw?.id);
    if (s && !out.includes(s.id)) out.push(s.id);
    if (out.length >= MAX_SUBJECTS) break;
  }
  return out;
}

/** The selected subject: the stored choice when it is still one of theirs, else their first. */
export function pickSubject(subjects = [], stored = null) {
  const s = subjectFor(stored);
  if (s && subjects.includes(s.id)) return s.id;
  return subjects[0] || null;
}

/**
 * Where the object sits in a box of `w` x `h` px: centred and wholly inside (never cropped), with
 * room under it for the contact shadow, which sits under the object's foot. Mirrors the app's
 * SubjectRender.rectIn. `align: 'bottom'` stands every object on the same floor line instead (a row of
 * chips, where a wide calculator and a tall stamp must share one shelf). Returns
 * { x, y, width, height, shadow: { x, y, width } } in px, or null.
 */
export function artBox(a, w, h = w, { pad = 0.08, align = 'center' } = {}) {
  if (!a || !(w > 0) || !(h > 0)) return null;
  const inner = { l: w * pad, t: h * pad, r: w * (1 - pad), b: h * (1 - pad * 1.6) };
  const iw = inner.r - inner.l;
  const ih = inner.b - inner.t;
  const scale = Math.min(iw / a.width, ih / a.height);
  const width = a.width * scale;
  const height = a.height * scale;
  const x = inner.l + (iw - width) / 2;
  const y = align === 'bottom' ? inner.b - height : inner.t + (ih - height) / 2;
  const r = (v) => Math.round(v * 10) / 10;
  return { x: r(x), y: r(y), width: r(width), height: r(height),
    shadow: { x: r(x + width * (a.footX - a.footWidth / 2)), y: r(y + height * a.ground), width: r(width * a.footWidth) } };
}

// ---------------------------------------------------------------------------------------------
// Sessions, costs and links. Numbers come from TEST_MODES only.

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const whole = (value) => (value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Math.max(0, Math.trunc(Number(value))));

export const SESSION = Object.freeze({
  quickCount: 10,
  quickMinutes: Math.round((10 * TEST_MODES.quick.durationPerQuestionSec) / 60),
  quickCost: practiceCreditCost('quick', 10),         // the 10-question set; Quick practice is 1 credit a question
  quickCostPerQuestion: TEST_MODES.quick.creditPerQuestion,
  fullCount: TEST_MODES.full.fixedCount,
  fullMinutes: Math.round(TEST_MODES.full.fixedDurationSec / 60),
  fullCost: practiceCreditCost('full', 50),
  ntaCount: TEST_MODES.nta.fixedCount,
  ntaMinutes: Math.round(TEST_MODES.nta.fixedDurationSec / 60),
  ntaPro: TEST_MODES.nta.premium === true,
  smartCount: TEST_MODES.smart.defaultCount,
  smartPro: TEST_MODES.smart.premium === true,
});

/** /dashboard set up for a session. Nothing is charged there until Start. */
export function practiceHref({ subject = null, mode = 'quick', count = null, chapter = null, screen = null, pick = null } = {}) {
  const q = new URLSearchParams();
  const s = subjectFor(subject);
  if (s) q.set('subject', s.id);
  q.set('mode', mode);
  if (count) q.set('count', String(count));
  if (chapter) q.set('chapter', chapter);
  if (screen) q.set('interface', screen);
  // ?pick=chapters: Practice opens with the chapter picker already open (the sheet's By chapter row).
  if (pick === 'chapters') q.set('pick', 'chapters');
  return `${PRACTICE_HREF}?${q.toString()}`;
}

/**
 * Credits a session uses on Free, 0 on Pro, or null when the mode needs Pro. Quick practice is 1 a question, so
 * `count` (the set's size) decides it; without one the 10-question set is meant, as on the Start sheet's rows.
 */
export function sessionCost(mode, { pro = false, count = null } = {}) {
  const m = TEST_MODES[mode];
  if (!m) return null;
  if (m.premium) return pro ? 0 : null;
  if (pro) return 0;
  const cost = practiceCreditCost(mode, whole(count) || (mode === 'quick' ? SESSION.quickCount : m.fixedCount));
  // A count the mode does not offer is priced as the default set: the server resolves it to that set too.
  return cost === null ? practiceCreditCost(mode, m.defaultCount) : cost;
}

/**
 * The cost line under a row. 'Uses 10 of your 40 credits.' / 'Included with Pro.' /
 * 'Needs Pro.' / 'Uses 50 credits. You have 40.' (not enough) / 'Uses 10 credits.'
 * (balance unknown). `short` drops the trailing sentence for narrow rows.
 *
 * Today's included 10-question set (src/lib/dailySet.mjs): when the server quote said it is free, a Quick set of 10 reads
 * 'Free: today's included set.' and prints no number or balance; when the allowance has not been read, it prints no number
 * and says Practice shows the price before it starts. 'priced' (the default) is the price as before. Any other count, and
 * a full mock, are never changed by the allowance.
 *
 * The first full mock in each subject is free (C-dec 1, data/first_full_mock.js). `firstFullMock` is that rule's state for the
 * row's subject, as the server quote said it (src/lib/useFirstFullMock.js): 'available' reads 'Your first one is free' (no
 * number, no balance); 'unknown' (not read yet, or the read failed) prints no number and says Practice shows the price; 'used'
 * and null (the default, for a caller that never reads it) print the price as before. Only a full mock reads it.
 */
export function costLine(mode, { pro = false, balance = null, short = false, count = null, dailySet = DAILY_SET.priced, firstFullMock = null } = {}) {
  const cost = sessionCost(mode, { pro, count });
  if (cost === null) return { text: short ? 'Needs Pro' : 'Needs Pro.', tone: 'locked' };
  if (pro) return { text: short ? 'Included with Pro' : 'Included with Pro.', tone: 'included' };
  if (mode === 'full' && firstFullMock === FIRST_FULL_MOCK_STATE.available) return { text: short ? FIRST_FULL_MOCK_COPY.tile : FIRST_FULL_MOCK_COPY.price, tone: 'included' };
  if (mode === 'full' && firstFullMock === FIRST_FULL_MOCK_STATE.unknown) return { text: short ? PRICE_AT_START_SHORT : PRICE_AT_START_LINE, tone: 'cost' };
  // The count the server resolves to (a stray count becomes the default set), because that is the set the allowance covers.
  const asked = whole(count) || SESSION.quickCount;
  if (isDailySet(mode, practiceCreditCost(mode, asked) === null ? TEST_MODES[mode]?.defaultCount : asked)) {
    const daily = dailySetState(dailySet);
    if (daily === DAILY_SET.free) return { text: short ? DAILY_FREE_SHORT : DAILY_FREE_LINE, tone: 'cost' };
    if (daily === DAILY_SET.unknown) return { text: short ? PRICE_AT_START_SHORT : PRICE_AT_START_LINE, tone: 'cost' };
  }
  const have = whole(balance);
  // The short form fits a half-width tile on a 390 px phone in two lines at most: '50 credits. You have 40.'
  if (have === null) return { text: short ? plural(cost, 'credit') : `Uses ${plural(cost, 'credit')}.`, tone: 'cost' };
  if (have < cost) return { text: short ? `${plural(cost, 'credit')}. You have ${have}.` : `Uses ${plural(cost, 'credit')}. You have ${have}.`, tone: 'short' };
  return { text: short ? `${cost} of your ${plural(have, 'credit')}` : `Uses ${cost} of your ${plural(have, 'credit')}.`, tone: 'cost' };
}

/** The header's balance line: what the cost lines are measured against. */
export function balanceLine({ pro = false, balance = null } = {}) {
  if (pro) return 'Pro: practice and mocks are included';
  const have = whole(balance);
  return have === null ? null : `You have ${plural(have, 'credit')}`;
}

// ---------------------------------------------------------------------------------------------
// The hero: the live next step (src/lib/server/learning.js learningRecord -> data/learning_engine.js
// learningPlan primary), with a button word and a graphic chosen from its kind.

const HERO_KINDS = Object.freeze({
  resume_session: { cta: 'Resume', graphic: 'resume' },
  fresh_check: { cta: 'Start the check', graphic: 'check' },
  repair: { cta: 'Continue', graphic: 'repair' },
  investigate: { cta: 'Look into it', graphic: 'repair' },
  baseline: { cta: 'Start the baseline', graphic: 'subject' },
  ordinary_practice: { cta: 'Set it up', graphic: 'subject' },
});

/** A local path inside MockMob, or null. Rejects other origins, protocol-relative and script URLs. */
export function safeHref(href) {
  const value = String(href || '');
  if (!value.startsWith('/') || value.startsWith('//') || /[\s\\]/.test(value)) return null;
  return value;
}

function hrefParts(href) {
  const [path, query = ''] = String(href || '').split('?');
  return { path, params: new URLSearchParams(query.split('#')[0]) };
}

/**
 * The line under the hero's title. The planner's reason for plain practice explains the planner
 * itself (which recovery pathways are released, which concept rules apply), so for that kind the
 * student reads what the session is and what follows it instead. Every other kind keeps the plan's
 * own reason, word for word.
 */
export function heroReason(primary, { count = null, minutes = null, named = false } = {}) {
  if (primary?.kind !== 'ordinary_practice') return primary?.reason ? String(primary.reason) : null;
  const n = whole(count) || SESSION.quickCount;
  const timed = Math.round((n * TEST_MODES.quick.durationPerQuestionSec) / 60);
  const review = Math.max(0, (whole(minutes) || 0) - timed);
  // A following move's key already says the set ("Start 10 questions in Economics"), so the line starts at the time.
  const lead = named ? `About ${timed} minutes` : `${plural(n, 'question')}, about ${timed} minutes`;
  return review
    ? `${lead}, then ${review} minutes on why each miss happened.`
    : `${lead}. Then see why each miss happened.`;
}

/**
 * A following move's title: the mode, as the Practice page's card leads with it (owner G26, 19 Oct; R11 found the sheet
 * still led with '10 Economics questions'). 'Quick practice', 'Full mock', 'NTA mode', 'Smart practice'. The chosen chip
 * names the subject; the count and the subject are said once, on the key (followingKey).
 */
export function followingTitle(mode) {
  return String(TEST_MODES[mode]?.label || TEST_MODES.quick.label);
}

/** A following move's key, in the Practice page's words: 'Start 10 questions in Economics', 'Start the full mock in Economics'. */
export function followingKey(mode, count, name) {
  const fallback = mode === 'smart' ? SESSION.smartCount : SESSION.quickCount;
  const n = whole(count) || fallback;
  const words = mode === 'full' ? 'the full mock' : mode === 'nta' ? 'the NTA paper' : `${n} ${n === 1 ? 'question' : 'questions'}`;
  return `Start ${words}${name ? ` in ${name}` : ''}`;
}

/**
 * The hero row from the plan, or null when there is no usable plan.
 * {
 *   id: 'move', kind, eyebrow, title, reason, href, cta, graphic ('subject'|'resume'|'check'|'repair'),
 *   subject (id or null), cost ({ text, tone } or null), quick (true when it is a 10-question set)
 * }
 * A practice link without a subject takes the chosen subject, so it opens set up for it.
 */
export function heroFromPlan(plan, { subject = null, pro = false, balance = null, tonightKey = null, dailySet = DAILY_SET.priced, firstFullMock = null } = {}) {
  const primary = plan?.primary;
  const href = safeHref(primary?.href);
  if (!primary || !href || !primary.title) return null;
  const known = HERO_KINDS[primary.kind] || { cta: 'Start', graphic: 'subject' };
  const { path, params } = hrefParts(href);
  const practice = path === PRACTICE_HREF;
  let linked = subjectFor(params.get('subject'))?.id || null;
  const linkedByPlan = Boolean(linked);
  let finalHref = href;
  if (practice && !linked && subjectFor(subject)) {
    params.set('subject', subjectFor(subject).id);
    finalHref = `${path}?${params.toString()}`;
    linked = subjectFor(subject).id;
  }
  // Like Today's button: tonight's plain practice carries the plan's key, so finishing it marks
  // tonight's practice as recorded (data/study_progress.js tonightMetadata).
  if (practice && primary.kind === 'ordinary_practice' && !plan?.sequence?.length && [10, 20, 30].includes(Number(plan?.minutes))
    && /^[a-zA-Z0-9_-]{12,100}$/.test(String(tonightKey || ''))) {
    params.set('tonightKey', tonightKey);
    params.set('tonightMinutes', String(plan.minutes));
    finalHref = `${path}?${params.toString()}`;
  }
  const mode = practice ? (params.get('mode') || 'quick') : null;
  const count = whole(params.get('count'));
  // START-1017 D3: a move that follows the chosen subject (plain practice whose link named no subject) sits under the
  // subject rail and its title names the subject, so the picture and the words change together (owner F6). A move bound
  // to something else (a resume, a repair, a check, a linked subject) sits above the rail and keeps the plan's title.
  const followsSubject = Boolean(practice && !linkedByPlan && linked && TEST_MODES[mode]);
  return {
    id: 'move',
    kind: String(primary.kind || 'next'),
    title: followsSubject ? followingTitle(mode) : String(primary.title),
    planTitle: String(primary.title),
    followsSubject,
    reason: heroReason(primary, { count, minutes: plan?.minutes, named: followsSubject }),
    href: finalHref,
    cta: followsSubject ? followingKey(mode, count, subjectName(linked)) : known.cta,
    graphic: known.graphic === 'subject' && !linked && !subjectFor(subject) ? 'check' : known.graphic,
    subject: linked || (known.graphic === 'subject' ? subjectFor(subject)?.id || null : null),
    // The free first full mock was read for the chosen subject only: a hero linked to another subject prints no number.
    cost: practice && TEST_MODES[mode] ? costLine(mode, { pro, balance, count, dailySet, firstFullMock: firstFullMock === null ? null : linked && linked === subjectFor(subject)?.id ? firstFullMock : FIRST_FULL_MOCK_STATE.unknown }) : null,
    quick: practice && mode === 'quick' && count === SESSION.quickCount,
  };
}

// ---------------------------------------------------------------------------------------------
// The rows. At most: the hero, Quick practice, Full mock, NTA mode; then Choose your own.

/**
 * @param {object} o
 * @param {object|null} o.plan     the /api/learning/plan body, or null while it loads or failed
 * @param {string[]} o.subjects    startSubjects() of the student
 * @param {string|null} o.subject  the chosen subject id
 * @param {boolean} o.pro
 * @param {number|null} o.balance  credits, null when unknown
 * @param {string|null} o.tonightKey the key Today's plan uses to record tonight's practice
 * @param {'free'|'priced'|'unknown'} [o.dailySet] what the server quote said about today's included 10-question set
 * @param {'available'|'used'|'unknown'|null} [o.firstFullMock] whether the chosen subject's first full mock is still free
 * @returns {{ hero: object|null, rows: object[], choose: object }}
 */
export function startRows({ plan = null, subjects = [], subject = null, pro = false, balance = null, tonightKey = null, dailySet = DAILY_SET.priced, firstFullMock = null } = {}) {
  const chosen = subjectFor(subject)?.id || subjects[0] || null;
  const name = subjectName(chosen);
  const hero = heroFromPlan(plan, { subject: chosen, pro, balance, tonightKey, dailySet, firstFullMock });
  const rows = [];
  // Every session names what pressing it does (owner F5): 'Set up' opens Practice set up for it (nothing is spent there),
  // 'Pick chapters' opens it with the chapter list open, 'Open Practice' opens it to choose.
  // A hero that is already "10 questions" in the chosen subject is Quick practice: one row, not two. A fixed hero (a
  // resume, a repair, a linked subject) does not follow the chips, so the Quick practice row comes back under them.
  if (!(hero?.quick && hero?.followsSubject)) {
    rows.push({ id: 'quick', title: 'Quick practice', detail: `${SESSION.quickCount} ${name ? `${name} ` : ''}questions, about ${SESSION.quickMinutes} minutes`,
      href: practiceHref({ subject: chosen, mode: 'quick', count: SESSION.quickCount }), graphic: 'subject', subject: chosen, cost: costLine('quick', { pro, balance, short: true, dailySet }), badge: String(SESSION.quickCount), go: 'start', action: 'Set up' });
  }
  rows.push({ id: 'full', title: 'Full mock', detail: `${SESSION.fullCount} ${name ? `${name} ` : ''}questions, ${SESSION.fullMinutes} minutes, a new paper every time`,
    href: practiceHref({ subject: chosen, mode: 'full' }), graphic: 'stopwatch', subject: chosen, cost: costLine('full', { pro, balance, short: true, firstFullMock }), go: 'start', action: 'Set up' });
  rows.push({ id: 'nta', title: 'NTA mode', detail: `The exam-day screen${name ? ` in ${name}` : ''}, ${SESSION.ntaCount} questions in ${SESSION.ntaMinutes} minutes`,
    // Locked: Practice shows the screen preview and what Pro adds, so the row still opens it. The outlined Pro tag
    // marks the lock on the tile; the cost line says it in words.
    href: practiceHref({ subject: chosen, mode: 'nta', screen: 'nta' }), graphic: 'exam', subject: chosen, cost: costLine('nta', { pro, balance, short: true }), tag: SESSION.ntaPro && !pro ? 'Pro' : null, go: 'start', action: 'Set up' });
  // By chapter is Quick practice with the chapters asked first (the app's entry, START-1017 A-rule 2): it opens Practice
  // with the chapter list open.
  rows.push({ id: 'chapter', title: 'By chapter', detail: `Pick ${name ? `${name} ` : ''}chapters, then ${SESSION.quickCount} questions`,
    href: practiceHref({ subject: chosen, mode: 'quick', count: SESSION.quickCount, pick: 'chapters' }), graphic: 'chapters', subject: chosen, cost: costLine('quick', { pro, balance, short: true, dailySet }), go: 'start', action: 'Pick chapters' });
  rows.push({ id: 'smart', title: 'Smart practice', detail: `${SESSION.smartCount} ${name ? `${name} ` : ''}questions on the topics you miss most`,
    href: practiceHref({ subject: chosen, mode: 'smart' }), graphic: 'weights', subject: chosen, cost: costLine('smart', { pro, balance, short: true }), tag: SESSION.smartPro && !pro ? 'Pro' : null, go: 'start', action: 'Set up' });
  const choose = { id: 'choose', title: 'Choose your own', detail: 'Any subject, chapters, mode and length', href: PRACTICE_HREF, graphic: 'fan', subjects: subjects.slice(0, 3), go: 'open', action: 'Open' };
  // What the label over the rows says: under a fixed hero the rows are the chosen subject's ("Or start in Economics").
  const section = !hero ? 'Pick a session' : hero.followsSubject ? 'Or start something else' : name ? `Or start in ${name}` : 'Or start something else';
  return { hero, rows, choose, section };
}

// ---------------------------------------------------------------------------------------------
// Motion helpers.

/**
 * The morph from the Start key into the sheet. Returns the transform that places the sheet over the
 * key, or null when either box is missing or empty.
 */
export function morphFrom(keyRect, panelRect) {
  if (!keyRect || !panelRect || !(panelRect.width > 0) || !(panelRect.height > 0) || !(keyRect.width > 0) || !(keyRect.height > 0)) return null;
  const dx = (keyRect.left + keyRect.width / 2) - (panelRect.left + panelRect.width / 2);
  const dy = (keyRect.top + keyRect.height / 2) - (panelRect.top + panelRect.height / 2);
  const sx = Math.max(0.05, Math.min(1, keyRect.width / panelRect.width));
  const sy = Math.max(0.05, Math.min(1, keyRect.height / panelRect.height));
  const r = (v) => Math.round(v * 1000) / 1000;
  return { dx: r(dx), dy: r(dy), sx: r(sx), sy: r(sy), transform: `translate(${r(dx)}px, ${r(dy)}px) scale(${r(sx)}, ${r(sy)})` };
}

/**
 * What a swipe down on the phone sheet does when the finger lifts: 'close' past a quarter of the
 * sheet (at most 160 px) or on a quick flick, else 'settle' back.
 */
export function dragOutcome({ dy = 0, velocity = 0, height = 0 } = {}) {
  const distance = Math.min(160, Math.max(72, height * 0.25));
  if (dy >= distance) return 'close';
  if (dy > 24 && velocity > 0.55) return 'close';
  return 'settle';
}

/** The sheet's drag offset for a finger at `dy`: free downwards, a firm rubber band upwards. */
export function dragOffset(dy) {
  const n = Number(dy) || 0;
  return n >= 0 ? n : -Math.round(Math.sqrt(-n) * 2);
}

/**
 * A spring as a CSS linear() easing: damping ratio `zeta`, sampled at `points` steps over the time
 * it takes to settle. Rounded to 3 places. With zeta 0.72 it overshoots by about 4 percent.
 */
export function springEasing({ zeta = 0.72, points = 28 } = {}) {
  const omega = 1;
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  // Settles to within 0.2 percent at about -ln(0.002) / (zeta * omega).
  const end = -Math.log(0.002) / (zeta * omega);
  const values = [];
  for (let i = 0; i <= points; i += 1) {
    const t = (i / points) * end;
    const x = 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t));
    values.push(i === points ? 1 : Math.round(x * 1000) / 1000);
  }
  return `linear(${values.join(', ')})`;
}

/** The sheet's title follows the clock, as the app's QuickStartSheet.titleFor does: tonight from 4 PM. */
export function sheetTitle(date = new Date()) {
  const hour = date instanceof Date && !Number.isNaN(date.getTime()) ? date.getHours() : 12;
  return hour >= 16 ? 'Pick tonight’s work' : 'Pick today’s work';
}

/** ?start=open|quick|full|nta on a signed-in page opens the sheet (deep links, app shortcuts). */
export function startRequestFromSearch(search = '') {
  let value = null;
  try { value = new URLSearchParams(search).get('start'); } catch { value = null; }
  if (value === null) return null;
  return { row: ['quick', 'full', 'nta', 'move', 'choose'].includes(value) ? value : null };
}
