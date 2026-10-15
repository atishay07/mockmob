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

/**
 * The line when a link asked for a length the mode does not offer, else null. It says what the page
 * set instead: "Smart practice starts at 10 questions. You asked for 5, so this is set to 15."
 */
export function lengthNote(modeId, asked) {
  const mode = TEST_MODES[modeId];
  if (!mode || mode.fixedCount || !Number.isFinite(asked) || !asked) return null;
  const options = mode.countOptions || [];
  if (options.includes(asked)) return null;
  const name = SESSION_LABEL[modeId] || mode.label;
  const used = resolveCount(mode, asked);
  const tail = `You asked for ${asked}, so this is set to ${used}.`;
  if (asked < options[0]) return `${name} starts at ${options[0]} questions. ${tail}`;
  if (asked > options[options.length - 1]) return `${name} goes up to ${options[options.length - 1]} questions. ${tail}`;
  return `${name} comes in ${options.slice(0, -1).join(', ')} or ${options[options.length - 1]} questions. ${tail}`;
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
      line: sessionLine(id),
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

// ---------------------------------------------------------------------------------------------
// 4. The session panel: its title, how the set is narrowed, what the server quote says

/** The heading over the session: "Quick practice in Accountancy". */
export function asideTitle({ mode = 'quick', subjectName = '' } = {}) {
  const name = SESSION_LABEL[mode] || SESSION_LABEL.quick;
  return subjectName ? `${name} in ${subjectName}` : name;
}

/** "Partnership Fundamentals only." / "Chapters: A, B and 2 more." / "Hard questions only." / both, or '' when nothing narrows the set. */
export function scopeLine({ chapters = [], difficulty = 'auto' } = {}) {
  const parts = [];
  if (chapters.length === 1) parts.push(`${chapters[0]} only`);
  else if (chapters.length > 1) parts.push(`Chapters: ${chaptersSummary(chapters)}`);
  if (difficulty && difficulty !== 'auto') parts.push(`${difficulty[0].toUpperCase()}${difficulty.slice(1)} questions only`);
  return parts.length ? `${parts.join('. ')}.` : '';
}

/**
 * What a /dashboard link asks for, or null when the href is not a practice link (a /test, /result or
 * other page then stays a plain link). Reads the query exactly as parsePrefill does.
 */
export function setupFromHref(href) {
  const value = String(href || '');
  if (value !== PRACTICE_PATH && !value.startsWith(`${PRACTICE_PATH}?`)) return null;
  const at = value.indexOf('?');
  const query = at === -1 ? '' : value.slice(at + 1).split('#')[0];
  return parsePrefill(new URLSearchParams(query));
}

/** Is the session on screen the one a link asked for? `want` is setupFromHref(); `have` is the page's choice. */
export function sameSetup(want, have) {
  if (!want || !have) return false;
  if (want.subject && want.subject !== have.subject) return false;
  if (want.mode && want.mode !== have.mode) return false;
  if (want.mode !== 'full' && want.mode !== 'nta' && want.askedCount && effectiveCount(have.mode, want.count) !== have.count) return false;
  if (want.chapter && !(have.chapters.length === 1 && have.chapters[0] === want.chapter)) return false;
  return true;
}

/**
 * The line under the confirm line, from the server quote (the quote stays the authority on whether a
 * session can start; this only words it in the glossary's terms).
 * Returns { tone: 'ok'|'locked'|'blocked', text, href?, hrefLabel?, retry? } or null.
 */
export function quoteNote(quote, { mode = 'quick', pro = false } = {}) {
  if (!quote || typeof quote !== 'object') return null;
  if (quote.launchable) {
    if (includedToday(quote)) return { tone: 'ok', text: 'This uses today’s included 10-question set.' };
    return pro ? { tone: 'ok', text: '' } : { tone: 'ok', text: 'Credits are used only after the full set is built. If it cannot be built, nothing is used.' };
  }
  const code = quote.reasonCode;
  if (code === 'access_required') {
    return { tone: 'locked', text: lockLine(mode) || quote.reason || '', href: quote.upgradeHref || '/pricing?reason=premium_mode', hrefLabel: 'See Pro' };
  }
  if (code === 'insufficient_credits') {
    const short = Math.max(0, Math.trunc(Number(quote.creditCost) || 0) - Math.max(0, Math.trunc(Number(quote.creditBalance) || 0)));
    return { tone: 'blocked', text: short > 0 ? `You need ${plural(short, 'more practice credit')} for this session.` : 'You do not have enough practice credits for this session.', href: quote.upgradeHref || '/pricing?reason=credits', hrefLabel: 'See Pro' };
  }
  return { tone: 'blocked', text: String(quote.reason || 'This session is not available right now.'), retry: code === 'inventory_unknown' };
}

/** The Start key's label in each state. The words say what happens; there is no spinner text that hides a failure. */
export function startKeyLabel({ mode = 'quick', launching = false, checking = false, available = true } = {}) {
  if (launching) return 'Starting';
  if (checking) return 'Checking';
  return available ? startLabel(mode) : 'Not available';
}

/** A quote is good until its expiresAt. Past that, or with none, the page asks the server again before it starts. */
export function quoteExpired(quote, now = Date.now()) {
  return !quote || !(Date.parse(quote.expiresAt) > now);
}

// ---------------------------------------------------------------------------------------------
// 5. The session on screen: the link's ask, then the student's own choices

export const EMPTY_PICKS = Object.freeze({ subject: null, mode: null, count: null, chapters: null, difficulty: null, ntaScreen: null });

/**
 * Which session the page shows, worked out from plain values.
 *   prefill      parsePrefill() of the link
 *   picks        what the student chose on this page for this link (nulls where they chose nothing)
 *   mySubjectIds the student's practice subjects, in sheet order
 *   chapters     { subject, list: [{ name }], failed } the chapters read for a subject, or null while unread
 * The link decides until the student chooses: a linked subject that is not theirs falls back to their first,
 * a length the mode does not offer snaps to its own, and a linked chapter counts only once the subject's
 * chapter list has been read and holds it (a chapter that is not there is reported, never guessed).
 */
export function resolveSession({ prefill, picks = EMPTY_PICKS, mySubjectIds = [], chapters = null } = {}) {
  const asked = prefill || parsePrefill(null);
  const subjectId = mySubjectIds.includes(picks.subject) ? picks.subject
    : mySubjectIds.includes(asked.subject) ? asked.subject
      : mySubjectIds[0] || null;
  const modeId = picks.mode && TEST_MODES[picks.mode] ? picks.mode : asked.mode || 'quick';
  const mode = TEST_MODES[modeId];
  const count = effectiveCount(modeId, picks.count ?? asked.count);
  const difficulty = mode.allowDifficultyOverride ? picks.difficulty || 'auto' : 'auto';
  const ntaScreen = picks.ntaScreen || asked.ntaScreen;
  const linkedChapter = asked.subject === subjectId ? asked.chapter : null;
  const read = Boolean(chapters) && chapters.subject === subjectId;
  const list = read ? chapters.list || [] : [];
  const linkedChapterFound = Boolean(linkedChapter) && list.some((chapter) => chapter.name === linkedChapter);
  const chapterNames = picks.chapters ?? (linkedChapterFound ? [linkedChapter] : []);
  const chapterMissing = picks.chapters === null && Boolean(linkedChapter) && read && !chapters.failed && !linkedChapterFound;
  return { subjectId, modeId, count, difficulty, ntaScreen, chapterNames, chapterMissing, linkedChapter, chaptersRead: read, chapterList: list };
}
