// What the Practice page says and sends, worked out from plain values (web IA plan 2.2 Practice, IA5).
//
// PURE: no React, no browser, no I/O, no clock. Unit tested in data/tests/practice_ia5.test.mjs.
//
// Three jobs:
//   1. The prefill contract. /dashboard?subject=&mode=&count=&chapter= (plus interface=nta, tonightKey and
//      tonightMinutes) is how Today, "Do these next", the Start sheet, a lesson and the app open a set up
//      session. parsePrefill() reads it exactly as the page always has, and launchHref()/startHref() build
//      the /test link exactly as before, so every existing link keeps working.
//   2. The session rows: one name, one line and one cost per session type, with the costs read from
//      data/plan_facts.mjs and the names from data/glossary.mjs. Nothing here types a credit number.
//   3. The confirm line: "10 questions, about 10 minutes. +5 right, -1 wrong. Uses 10 of your 40 practice
//      credits." Nothing is spent on the first tap; the server quote stays the authority on whether a
//      session can start, this only says what it takes.
//
// Copy rules: sentence case, no "!", no em dash, the app's own words (wt-phase2 practice/copy.dart).
import { PLAN_FACTS, confirmLine, costLine, markingLine, quickMinutes, sessionCost } from '../../../../data/plan_facts.mjs';
import { APPROVED } from '../../../../data/glossary.mjs';
import { TEST_MODES, resolveCount } from '../../../../data/test_modes.js';

export const PRACTICE_PATH = '/dashboard';

/** The order the plan gives: Quick practice, Full mock, NTA mode, Smart practice (Pro). */
export const SESSION_ORDER = Object.freeze(['quick', 'full', 'nta', 'smart']);
const PREFILL_MODES = Object.freeze(['quick', 'full', 'smart', 'nta']);

/** The name students read for a session type (the glossary; Smart practice is the app's own name). */
export const SESSION_LABEL = Object.freeze({
  quick: APPROVED.quickPractice,
  full: APPROVED.fullMock,
  nta: APPROVED.ntaMode,
  smart: 'Smart practice',
});

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const range = (list) => (list.length > 1 ? `${list[0]} to ${list[list.length - 1]}` : String(list[0]));

// ---------------------------------------------------------------------------------------------
// 1. The prefill contract

/** The reader's `get(name)` for a URLSearchParams, a ReadonlyURLSearchParams, a Map-like or a plain object. */
function reader(source) {
  if (!source) return () => null;
  if (typeof source.get === 'function') return (name) => source.get(name);
  return (name) => (Object.prototype.hasOwnProperty.call(source, name) ? source[name] : null);
}

/**
 * What the link asks for. The rules are the page's own, unchanged:
 *   subject    any text (the page checks it against the student's practice subjects)
 *   mode       quick, full, smart or nta; anything else is "not asked"
 *   count      only a Quick practice length (5, 10, 15 or 20) is accepted, else 10
 *   chapter    any text (the page checks it against the subject's chapters)
 *   ntaScreen  interface=nta opens NTA mode on the conventional screen, else MockMob's own
 * `askedCount` is the number as written, so the page can say when a mode does not offer that length.
 */
export function parsePrefill(source) {
  const get = reader(source);
  const requested = Number(get('count'));
  const mode = get('mode');
  return {
    subject: get('subject') || null,
    mode: PREFILL_MODES.includes(mode) ? mode : null,
    count: TEST_MODES.quick.countOptions.includes(requested) ? requested : 10,
    askedCount: Number.isFinite(requested) && requested > 0 ? requested : null,
    chapter: get('chapter') || null,
    ntaScreen: get('interface') === 'nta' ? 'nta' : 'mockmob',
  };
}

/**
 * The length a mode will run at: Full mock and NTA mode are fixed, the others take their own options,
 * and a length the mode does not offer snaps to its default (the same rule as resolveCount).
 */
export function effectiveCount(modeId, count) {
  const mode = TEST_MODES[modeId] || TEST_MODES.quick;
  return resolveCount(mode, count);
}

/** The line when a link asked for a length the mode does not offer ("Smart practice comes in 10, 15 or 20 questions. You asked for 5."), else null. */
export function lengthNote(modeId, asked) {
  const mode = TEST_MODES[modeId];
  if (!mode || mode.fixedCount || !Number.isFinite(asked) || !asked) return null;
  const options = mode.countOptions || [];
  if (options.includes(asked)) return null;
  const name = SESSION_LABEL[modeId] || mode.label;
  if (asked < options[0]) return `${name} starts at ${options[0]} questions. You asked for ${asked}.`;
  if (asked > options[options.length - 1]) return `${name} goes up to ${options[options.length - 1]} questions. You asked for ${asked}.`;
  return `${name} comes in ${options.slice(0, -1).join(', ')} or ${options[options.length - 1]} questions. You asked for ${asked}.`;
}

/** The /test link a session opens, exactly as the page has always built it. */
export function launchHref({ subject, count, mode, chapters = [], difficulty = 'auto', pro = false, ntaScreen = 'mockmob' }) {
  const m = TEST_MODES[mode] || TEST_MODES.quick;
  const chapterParam = chapters.length > 0 ? `&chapters=${encodeURIComponent(chapters.join(','))}` : '';
  const difficultyParam = m.allowDifficultyOverride && pro && difficulty !== 'auto' ? `&difficulty=${encodeURIComponent(difficulty)}` : '';
  const modeParam = `&mode=${encodeURIComponent(m.id)}`;
  const interfaceParam = m.id === 'nta' && ntaScreen === 'nta' ? '&interface=nta' : '';
  return `/test?subject=${subject}&count=${count}${modeParam}${chapterParam}${difficultyParam}${interfaceParam}`;
}

/** The two values a Tonight's move link carries through to the runner (tonightKey, tonightMinutes). */
export function tonightParams(source) {
  const get = reader(source);
  const out = new URLSearchParams();
  for (const name of ['tonightKey', 'tonightMinutes']) if (get(name)) out.set(name, get(name));
  return out;
}

/** What Start opens: the /test link plus the server's idempotency token and any Tonight's move values. */
export function startHref(launch, { generationKey, tonight = new URLSearchParams() }) {
  const carried = tonight.toString();
  return `${launchHref(launch)}&generationKey=${encodeURIComponent(generationKey)}${carried ? `&${carried}` : ''}`;
}

// ---------------------------------------------------------------------------------------------
// 2. The session rows

/** One line on what a session is. The app's words, with every number from plan_facts or the mode table. */
export function sessionLine(modeId) {
  const s = PLAN_FACTS.sessions;
  switch (modeId) {
    case 'quick': return `${range(s.quickCounts.value)} questions, your pick.`;
    case 'full': return `${s.fullQuestions.value} questions, ${s.fullMinutes.value} minutes, timed like the exam.`;
    case 'nta': return `${s.ntaQuestions.value} questions, ${s.ntaMinutes.value} minutes, on the exam-day screen.`;
    case 'smart': return `Leans toward the chapters you miss. ${range(TEST_MODES.smart.countOptions)} questions.`;
    default: return '';
  }
}

/** The Pro note on a locked session, with the free way forward beside it (the app's gated lines). */
export function lockLine(modeId) {
  if (modeId === 'nta') return `${APPROVED.proLock}. A ${SESSION_LABEL.full.toLowerCase()} is open to you now.`;
  if (modeId === 'smart') return `${APPROVED.proLock}. ${SESSION_LABEL.quick} is open to you now.`;
  return null;
}

/** The session a locked row points to instead. */
export function lockedAlternative(modeId) {
  return modeId === 'nta' ? 'full' : modeId === 'smart' ? 'quick' : null;
}

/** The cost shown on a row: "10 practice credits", "Included with Pro" or "Comes with Pro". Read from plan_facts. */
export function rowCost(modeId, { pro = false } = {}) {
  const cost = sessionCost(modeId, { pro });
  if (cost === null) return APPROVED.proLock;
  if (pro) return 'Included with Pro';
  return plural(cost, 'practice credit');
}

/**
 * The rows, in the plan's order. `isLocked(modeId)` says whether this student's plan lacks the mode
 * (the capability table in data/capabilities.js decides, not this file).
 */
export function sessionRows({ pro = false, isLocked = () => false } = {}) {
  return SESSION_ORDER.map((id) => {
    const locked = Boolean(isLocked(id)) && !pro;
    return {
      id,
      label: SESSION_LABEL[id],
      line: locked ? lockLine(id) : sessionLine(id),
      cost: locked ? APPROVED.proLock : rowCost(id, { pro }),
      locked,
      tag: locked ? 'Pro' : null,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// 3. The confirm line

/**
 * What this session takes, as the plan words it. Costs come from plan_facts; when the server quote
 * says today's included set covers it, that is said instead of a credit price.
 *   quick, full   the plan's own confirmLine (the length from plan_facts)
 *   nta           50 questions, 60 minutes
 *   smart         the chosen length; `minutes` is the server's estimate when it has one, else a minute each
 */
export function confirmText({ mode = 'quick', count = 10, pro = false, balance = null, freeToday = false, minutes = null } = {}) {
  const s = PLAN_FACTS.sessions;
  if (mode === 'quick' || mode === 'full') {
    const full = confirmLine({ mode, count, pro, balance });
    return freeToday && !pro ? full.replace(/Uses .*$/, 'Free today, no credits used.') : full;
  }
  const what = mode === 'nta'
    ? `${plural(s.ntaQuestions.value, 'question')}, ${s.ntaMinutes.value} minutes.`
    : `${plural(count, 'question')}, about ${minutes || quickMinutes(count)} minutes.`;
  return `${what} ${markingLine()} ${costLine(mode, { pro, balance })}`;
}

/** The server quote's answer for the session on screen, or null while it is not that session's. */
export function quoteFor(quote, { subject, mode, count }) {
  if (!quote || quote.state === undefined) return null;
  return quote.subject?.storedId === subject && quote.mode?.id === mode && quote.count === count ? quote : null;
}

/** Does today's included set cover this session at no credit? Only the quote can say. */
export function includedToday(matchedQuote) {
  return Boolean(matchedQuote?.launchable && matchedQuote.allowance?.state === 'available' && matchedQuote.creditCost === 0);
}

/** "Partnership and Goodwill", "A, B and 2 more": the chapters a session is limited to. */
export function chaptersSummary(names = []) {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

/** The Fine-tune summary: "Optional. Balanced mix, all chapters." or "Hard only, 2 chapters." */
export function fineTuneHint({ difficulty = 'auto', chapters = [] } = {}) {
  const level = difficulty === 'auto' ? 'Balanced mix' : `${difficulty[0].toUpperCase()}${difficulty.slice(1)} only`;
  const where = chapters.length ? plural(chapters.length, 'chapter') : 'all chapters';
  return difficulty === 'auto' && chapters.length === 0 ? `Optional. ${level}, ${where}.` : `${level}, ${where}.`;
}

const START_LABEL = Object.freeze({
  quick: 'Start quick practice',
  full: 'Start full mock',
  nta: 'Start NTA mode',
  smart: 'Start smart practice',
});

/** The Start key's words for a session ("Start quick practice"). */
export function startLabel(modeId) {
  return START_LABEL[modeId] || START_LABEL.quick;
}
