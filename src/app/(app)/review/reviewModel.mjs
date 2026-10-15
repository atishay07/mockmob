// What the Review hub says, worked out from the record and nothing else (web IA plan 2.2 Review, 5.3).
// PURE: no I/O, no React, no clock (callers pass `now`), so it is unit-tested
// (data/tests/review_hub.test.mjs). Copy rules: sentence case, no "!", no em dash, real numbers only.
// The words follow the app's Review (wt-phase2 lib/features/review/copy.dart): Mistakes to repair,
// Where your marks go, Past results, Saved questions, Repair record, and the stages Found, Repaired,
// Checked and Holds.
//
// Order of the page (5.3):
//   1  Mistakes to repair (tonight)   moveFacts.repair names the paper; the paper itself gives the chapters
//   2  Where your marks go            one finding from the record, and a row that opens Your record
//   3  Past results                   each opens its result
//   4  Saved questions                one row
//   5  Repair record                  Found, Repaired, Checked, Holds
//
// The count on the Review badge is the count on the page: both come from groupOpenMistakes().
import { repairMinutes, shortDate } from '../../../../data/next_step_rules.mjs';
import { PLAN_FACTS } from '../../../../data/plan_facts.mjs';
import { moveLabel } from '../../../../data/glossary.mjs';
import { subjectName } from '../../../../data/subject_art.mjs';

/** How many attempts the page asks for (the summary route's own cap is 50). */
export const SUMMARY_LIMIT = 50;
/** The most repair rows the repair-record route returns. */
export const REPAIR_RECORD_LIMIT = 100;
/** Past results shown before "Show all". */
export const PAST_VISIBLE = 5;
/** Chapters shown in the tonight card before "Show all". */
export const CHAPTERS_VISIBLE = 4;
/** Repairs listed under the stage row. */
export const LATEST_REPAIRS = 5;
/** Keep in step with REPAIR_WINDOW_DAYS in src/lib/server/todayFacts.js (a test checks). */
export const REPAIR_WINDOW_DAYS = 30;
export const NO_CHAPTER = 'Chapter not recorded';
export const MOCK_MODES = Object.freeze(['full', 'nta']);

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const whole = (value) => {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const time = (value) => {
  const t = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(t) ? t : null;
};

// ---------------------------------------------------------------------------------------------
// Words

export const isMock = (mode) => MOCK_MODES.includes(String(mode || ''));

/** What a session is called: the plan's names (data/glossary.mjs APPROVED). */
export function modeName(mode) {
  switch (String(mode || '')) {
    case 'quick': return 'Quick practice';
    case 'full': return 'Full mock';
    case 'nta': return 'NTA mode';
    case 'smart': return 'Smart practice';
    default: return 'Practice';
  }
}

/** "Tonight's repair" from 4 PM to 4:59 AM, "Today's repair" otherwise (the same hour rule as Tonight's move). */
export function repairLabel(now = new Date()) {
  return moveLabel(now).startsWith('Tonight') ? "Tonight's repair" : "Today's repair";
}

/** "Q3", "Q3 and Q7", "Q3, Q7 and Q12", or "Q3, Q7, Q9 and 4 more" (the first three are named). */
export function questionsLine(numbers) {
  const list = (numbers || []).filter((n) => Number.isInteger(n) && n > 0);
  if (!list.length) return '';
  const named = list.map((n) => `Q${n}`);
  if (named.length <= 3) return named.length === 1 ? named[0] : `${named.slice(0, -1).join(', ')} and ${named.at(-1)}`;
  return `${named.slice(0, 3).join(', ')} and ${named.length - 3} more`;
}

/** "Repair this one" or "Repair these 4": the number on the key is the number on the page. */
export function repairKey(count) {
  return whole(count) === 1 ? 'Repair this one' : `Repair these ${whole(count)}`;
}

/** "4 mistakes across 3 chapters", or just "4 mistakes" when they share one chapter. */
export function mistakesHeadline(count, chapters) {
  const n = whole(count);
  return chapters > 1 ? `${plural(n, 'mistake')} across ${plural(chapters, 'chapter')}` : plural(n, 'mistake');
}

/** The line under the key: the app's "About 15 minutes. You can stop after any one." */
export function minutesLine(count) {
  const minutes = repairMinutes(count);
  return `${minutes === null ? 'Take your time' : `About ${minutes} minutes`}. You can stop after any one.`;
}

/** What repairing costs, in the plan's words: "1 AI credit each. You have 9." Unknown balance leaves the count out. */
export function costLine(aiBalance = null) {
  const cost = PLAN_FACTS.aiCredits.repairCost.value;
  const have = aiBalance === null || aiBalance === undefined || aiBalance === '' || !Number.isFinite(Number(aiBalance)) ? null : whole(aiBalance);
  return `${plural(cost, 'AI credit')} each.${have === null ? '' : ` You have ${have}.`}`;
}

// ---------------------------------------------------------------------------------------------
// Sources: "Mock 3" or "Quick practice"

const byTime = (a, b) => (time(a.completedAt) ?? 0) - (time(b.completedAt) ?? 0) || String(a.id).localeCompare(String(b.id));

/**
 * What an attempt is called: "Mock 3" for the third full or NTA mock in its subject, otherwise the mode's name.
 * The number is only said when the list is complete (`complete` true): with older papers missing, "Mock 3" could
 * be wrong, so the mode's name is used instead (never a guessed number).
 */
export function sourceLabel(item, items, { complete = true } = {}) {
  if (!isMock(item?.mode)) return modeName(item?.mode);
  if (!complete) return modeName(item.mode);
  const mocks = (items || []).filter((a) => a.subject === item.subject && isMock(a.mode)).sort(byTime);
  const index = mocks.findIndex((a) => a.id === item.id);
  return index >= 0 ? `Mock ${index + 1}` : modeName(item.mode);
}

// ---------------------------------------------------------------------------------------------
// 1. Mistakes to repair

/** The set of "attemptId|questionId" the repair record already covers. */
export function repairedKeys(rows) {
  return new Set((rows || []).filter((r) => r?.attemptId && r?.questionId).map((r) => `${r.attemptId}|${r.questionId}`));
}

/**
 * The open mistakes of one attempt, by chapter. Open means answered wrong (a blank is not a mistake) and not in
 * the repair record. This is the same count Today's hero and the Start sheet say (todayFacts.repairFacts).
 * @returns {{ attemptId: string, count: number, chapters: { chapter: string, numbers: number[], count: number }[] }}
 */
export function groupOpenMistakes(attempt, repaired = new Set()) {
  const snapshot = Array.isArray(attempt?.questionsSnapshot) ? attempt.questionsSnapshot : [];
  const where = new Map(snapshot.map((q, i) => [q?.id, { number: i + 1, chapter: typeof q?.chapter === 'string' && q.chapter.trim() ? q.chapter.trim() : null }]));
  const byChapter = new Map();
  let count = 0;
  for (const d of Array.isArray(attempt?.details) ? attempt.details : []) {
    if (!d || d.isCorrect !== false || typeof d.qid !== 'string') continue;
    if (repaired.has(`${attempt.id}|${d.qid}`)) continue;
    const at = where.get(d.qid);
    const chapter = at?.chapter || NO_CHAPTER;
    const row = byChapter.get(chapter) || { chapter, numbers: [], count: 0 };
    row.count += 1;
    if (at) row.numbers.push(at.number);
    byChapter.set(chapter, row);
    count += 1;
  }
  const chapters = [...byChapter.values()]
    .map((row) => ({ ...row, numbers: row.numbers.sort((a, b) => a - b) }))
    .sort((a, b) => b.count - a.count || a.chapter.localeCompare(b.chapter));
  return { attemptId: attempt?.id ?? null, count, chapters };
}

/** Wrong answers across a list of attempts ({ wrong } each), for "is there anything to repair at all". */
export function wrongAnswers(items) {
  return (items || []).reduce((sum, a) => sum + whole(a?.wrong), 0);
}

/**
 * The first section's state. Inputs are what was read; `null` means the read failed.
 *   moveFacts      from /api/learning/plan (moveFacts.repair names tonight's paper)
 *   repairRows     from /api/me/repair-record, or null
 *   attempt        the full attempt for moveFacts.repair.attemptId, or null when it was not read; attemptFailed true when it failed
 *   attempts       the slim past results (or moveFacts.attempts) for "any wrong answers at all"
 * States: error | empty | clear | open (with `count`, `attemptId`, `paper`, `groups`, `listFailed`)
 */
export function mistakesSection({ moveFacts = null, repairRows = null, attempt = null, attemptFailed = false, attempts = [] } = {}) {
  if (!moveFacts || typeof moveFacts !== 'object' || repairRows === null) return { state: 'error' };
  const repair = moveFacts.repair;
  if (repair?.attemptId && whole(repair.open) > 0) {
    if (attempt) {
      const group = groupOpenMistakes(attempt, repairedKeys(repairRows));
      if (group.count > 0) return { state: 'open', attemptId: attempt.id, count: group.count, chapters: group.chapters, listFailed: false, paper: repair };
    } else if (attemptFailed) {
      // Tonight's paper is known and so is how many are open; only the chapter breakdown is missing.
      return { state: 'open', attemptId: repair.attemptId, count: whole(repair.open), chapters: [], listFailed: true, paper: repair };
    } else {
      return { state: 'loading-list', attemptId: repair.attemptId, count: whole(repair.open), paper: repair };
    }
  }
  return { state: wrongAnswers(attempts) > 0 ? 'clear' : 'empty' };
}

/** The title of the tonight card: "Accountancy, Mock 3" with the date: "14 Oct". */
export function paperTitle(paper, items, { complete = true, timeZone = 'Asia/Kolkata' } = {}) {
  const item = (items || []).find((a) => a.id === paper?.attemptId) || paper || {};
  const source = sourceLabel({ ...item, id: paper?.attemptId ?? item.id }, items, { complete });
  const when = time(item.completedAt ?? paper?.completedAt);
  return { subject: subjectName(item.subject ?? paper?.subject), source, date: when === null ? '' : shortDate(when, timeZone) };
}

export const EMPTY_COPY = Object.freeze({
  title: 'Your mistakes gather here',
  body: 'Every wrong answer lands here, grouped by chapter.',
  action: 'Start practice',
});
export const CLEAR_COPY = Object.freeze({
  title: 'Nothing waiting to repair',
  body: `Mistakes from the last ${REPAIR_WINDOW_DAYS} days are all repaired.`,
  action: 'Start a Quick 10',
});
export const ERROR_COPY = Object.freeze({
  title: 'We could not load your mistakes',
  body: 'Check your connection and try again. Nothing was changed.',
  action: 'Try again',
});
export const OFFLINE_COPY = Object.freeze({
  title: 'You are offline',
  body: 'Your mistakes load when you are back online.',
  action: 'Try again',
});

// ---------------------------------------------------------------------------------------------
// 3. Past results

/**
 * Rows for Past results from the slim attempts (/api/attempts/summary), newest first.
 * `complete` is false when older pages exist: Mock numbers then give way to the mode's name.
 */
export function pastResults(items, { complete = true, timeZone = 'Asia/Kolkata' } = {}) {
  return (items || []).map((a) => {
    const source = sourceLabel(a, items, { complete });
    const when = time(a.completedAt);
    const total = whole(a.total);
    const wrong = whole(a.wrong);
    return {
      id: a.id,
      subject: a.subject,
      subjectLabel: subjectName(a.subject),
      source,
      date: when === null ? '' : shortDate(when, timeZone),
      marks: Number.isFinite(Number(a.marks)) ? Number(a.marks) : null,
      maxMarks: Number.isFinite(Number(a.maxMarks)) ? Number(a.maxMarks) : total * PLAN_FACTS.marking.right.value,
      wrong,
      wrongLine: wrong === 0 ? 'No wrong answers' : `${wrong} wrong`,
      mock: isMock(a.mode),
      href: `/result/${encodeURIComponent(a.id)}`,
    };
  });
}

/** "112 of 250". A negative score keeps its sign; an unreadable one says nothing. */
export function marksLine(row) {
  if (row.marks === null) return '';
  return `${row.marks} of ${row.maxMarks}`;
}

// ---------------------------------------------------------------------------------------------
// 5. Repair record: Found, Repaired, Checked, Holds

export const STAGES = Object.freeze(['Found', 'Repaired', 'Checked', 'Holds']);
export const NOT_YET = 'Not open yet';
export const LIFE_CAPTION = 'Checked and Holds come later, from fresh questions.';
export const RECORD_EMPTY = 'Your first repair will show here, with when it was found and when it was repaired.';

/**
 * The four stages from the repair record and the slim attempts.
 * Found: wrong answers across the attempts read. Repaired: rows in the record. Checked: rows with a finished
 * check, or "Not open yet" while no row can have one. Holds: "Not open yet" (nothing stores it yet).
 * `complete` false means older papers were not read, so Found says "in your last N papers" and no ratio is claimed.
 */
export function repairRecordView({ rows = [], attempts = [], complete = true, timeZone = 'Asia/Kolkata' } = {}) {
  const found = wrongAnswers(attempts);
  const repaired = rows.length;
  const capped = repaired >= REPAIR_RECORD_LIMIT;
  const checkOpen = rows.some((r) => r.checkedState && r.checkedState !== 'not_available');
  const checked = checkOpen ? rows.filter((r) => r.checkedState === 'passed' || r.checkedState === 'not_passed').length : null;
  const papers = (attempts || []).length;
  return {
    found,
    repaired,
    repairedText: capped ? `${REPAIR_RECORD_LIMIT}+` : String(repaired),
    checked,
    checkedText: checked === null ? NOT_YET : String(checked),
    holdsText: NOT_YET,
    scope: complete ? `across your ${plural(papers, 'paper')}` : `in your last ${plural(papers, 'paper')}`,
    progress: complete && !capped && found > 0 && repaired <= found ? `${repaired} of ${found} repaired` : null,
    ratio: found > 0 && repaired <= found ? repaired / found : null,
    latest: rows.slice(0, LATEST_REPAIRS).map((r) => ({
      key: `${r.attemptId}|${r.questionId}`,
      chapter: typeof r.chapter === 'string' && r.chapter ? r.chapter : NO_CHAPTER,
      subjectLabel: subjectName(r.subject),
      line: `Found ${time(r.foundAt) === null ? 'earlier' : shortDate(time(r.foundAt), timeZone)}, repaired ${time(r.repairedAt) === null ? 'earlier' : shortDate(time(r.repairedAt), timeZone)}`,
    })),
  };
}

// ---------------------------------------------------------------------------------------------
// 2. Where your marks go

/** The one finding for the hub, from /api/prepos/insights, or null. */
export function oneFinding(findings) {
  const f = (findings || []).find((x) => x && x.headline && x.detail);
  return f ? { id: f.id, headline: f.headline, detail: f.detail, n: whole(f.n) } : null;
}
