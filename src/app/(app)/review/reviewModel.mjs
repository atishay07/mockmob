// What Review and Progress say about the student's record (web redesign W2.4).
// Pure functions, no React and no browser, so the wording and the counts are unit tested
// (reviewModel.test.mjs next to this file).
//
// Vocabulary (owner decision D9): a mistake moves Found, Repaired, Checked, Holds.
//   Found     a question missed or left blank in a saved session (the server counts both)
//   Repaired  the server stored an explained repair for a wrong answer (/api/me/repair-record)
//   Checked   a fresh, unseen question on the same idea was answered right
//   Holds     the idea still held on a later check. No source records this yet, so it stays open.
// Never "fixed" or "mastered". Zero, unknown and not-yet-available are written differently.

export const STAGES = Object.freeze(['found', 'repaired', 'checked', 'holds']);
export const STAGE_LABEL = Object.freeze({ found: 'Found', repaired: 'Repaired', checked: 'Checked', holds: 'Holds' });

/** "1 session", "3 sessions"; an explicit plural for irregular words. */
export function plural(n, word, many = `${word}s`) {
  return `${n} ${n === 1 ? word : many}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "3 Oct" for a date this year, "3 Oct 2025" otherwise. Empty for a missing or broken date, so a
 * caller never prints "Invalid Date". Day and month are read in India time (the product's clock).
 */
export function shortDate(value, now = Date.now()) {
  if (value === null || value === undefined || value === '') return '';
  const t = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(t)) return '';
  const ist = (ms) => new Date(ms + 330 * 60 * 1000);
  const d = ist(t);
  const label = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return d.getUTCFullYear() === ist(now).getUTCFullYear() ? label : `${label} ${d.getUTCFullYear()}`;
}

/** "Business studies" from "business_studies"; the published subject names keep their capitals. */
const SUBJECT_NAMES = {
  accountancy: 'Accountancy', business_studies: 'Business Studies', economics: 'Economics', english: 'English',
  general_test: 'General Test', gat: 'General Test', mathematics: 'Mathematics', applied_mathematics: 'Applied Mathematics',
  entrepreneurship: 'Entrepreneurship', hindi: 'Hindi',
};
export function subjectName(id = '') {
  const key = String(id || '');
  if (SUBJECT_NAMES[key]) return SUBJECT_NAMES[key];
  const words = key.replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Practice';
}

/** A concept id ("accountancy:partnership_admission") as words a student reads. */
export function conceptName(id = '') {
  const tail = String(id || '').split(':').pop() || '';
  const words = tail.replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Concept';
}

const num = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** The saved sessions, newest first, with safe numbers. */
export function sessionsFrom(ordinaryReview) {
  const rows = Array.isArray(ordinaryReview) ? ordinaryReview.filter((a) => a && a.id) : [];
  return rows
    .map((a) => ({ id: String(a.id), subject: a.subject || '', completedAt: a.completedAt ?? null, correct: num(a.correct), total: num(a.total), open: num(a.mistakes) }))
    .sort((x, y) => (Date.parse(y.completedAt) || Number(y.completedAt) || 0) - (Date.parse(x.completedAt) || Number(x.completedAt) || 0));
}

/** Totals across sessions. `answered` is questions served, so the line says "of N questions". */
export function recordTotals(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  return {
    sessions: list.length,
    found: list.reduce((s, a) => s + a.open, 0),
    questions: list.reduce((s, a) => s + a.total, 0),
    correct: list.reduce((s, a) => s + a.correct, 0),
    lastAt: list[0]?.completedAt ?? null,
    withOpen: list.filter((a) => a.open > 0).length,
  };
}

/** One session's line: "8 Oct. 12 of 15 right." */
export function sessionLine(session, now) {
  const date = shortDate(session.completedAt, now);
  const score = `${session.correct} of ${session.total} right`;
  return date ? `${date}. ${score}.` : `${score}.`;
}

/** The tag on a session row: what is left to look at there. */
export function sessionTag(session) {
  if (session.total === 0) return { tone: 'quiet', text: 'No questions recorded' };
  if (session.open === 0) return { tone: 'good', text: 'Nothing missed' };
  return { tone: 'open', text: `${session.open} to look at` };
}

/**
 * The four stages for the record thread.
 *   repairs       rows from /api/me/repair-record; undefined while loading, null when it failed
 *   repairLimit   the limit the page asked for, so a full page reads "100+"
 * Each stage: { key, label, value (string), note (string),
 *               state: 'count' | 'zero' | 'loading' | 'unknown' | 'closed' }
 */
export function stageThread({ totals, repairs, repairLimit = 100 }) {
  const found = totals?.found ?? 0;
  const known = Array.isArray(repairs);
  const repaired = known ? repairs.length : null;
  const checksOpen = known && repairs.some((r) => r && r.checkedState && r.checkedState !== 'not_available');
  const checked = known ? repairs.filter((r) => r?.checkedState === 'passed').length : null;

  const foundStage = {
    key: 'found', label: STAGE_LABEL.found,
    value: String(found),
    note: found === 0 ? 'Nothing missed or left blank yet' : `Missed or left blank, in ${plural(totals.withOpen, 'session')}`,
    state: found === 0 ? 'zero' : 'count',
  };
  const repairedStage = repairs === undefined
    ? { key: 'repaired', label: STAGE_LABEL.repaired, value: '', note: 'Reading your repairs', state: 'loading' }
    : !known
    ? { key: 'repaired', label: STAGE_LABEL.repaired, value: '', note: 'Your repairs could not be read just now', state: 'unknown' }
    : {
      key: 'repaired', label: STAGE_LABEL.repaired,
      value: repaired >= repairLimit ? `${repairLimit}+` : String(repaired),
      note: repaired === 0 ? 'Repair a wrong answer from its session' : 'Explained, from the session it was found in',
      state: repaired === 0 ? 'zero' : 'count',
    };
  const checkedStage = !known
    ? (repairs === undefined
      ? { key: 'checked', label: STAGE_LABEL.checked, value: '', note: 'Reading your repairs', state: 'loading' }
      : { key: 'checked', label: STAGE_LABEL.checked, value: '', note: 'Could not be read just now', state: 'unknown' })
    : checksOpen
    ? { key: 'checked', label: STAGE_LABEL.checked, value: String(checked), note: checked === 0 ? 'Waiting for a fresh question' : 'Right on a fresh question', state: checked === 0 ? 'zero' : 'count' }
    : { key: 'checked', label: STAGE_LABEL.checked, value: '', note: 'Fresh checks are not open yet', state: 'closed' };
  const holdsStage = { key: 'holds', label: STAGE_LABEL.holds, value: '', note: 'Opens after a later check', state: 'closed' };
  return [foundStage, repairedStage, checkedStage, holdsStage];
}

/** The one line under the thread. Honest about what is and is not counted yet. */
export function threadCaption(thread) {
  const closed = thread.filter((s) => s.state === 'closed').map((s) => s.label);
  if (thread.some((s) => s.key === 'checked' && s.state !== 'closed' && s.state !== 'count' && s.state !== 'zero')) {
    return 'Each mistake moves from Found to Repaired, then Checked on a fresh question. Holds is not open yet.';
  }
  if (closed.length === 2) return 'Each mistake moves from Found to Repaired. Checked and Holds come from fresh questions later, and are not open yet.';
  if (closed.length === 1) return 'Each mistake moves from Found to Repaired, then Checked on a fresh question. Holds is not open yet.';
  return 'Each mistake moves from Found to Repaired, then Checked and Holds on fresh questions.';
}

/** A repair record row as words: "Found 3 Oct in Accountancy. Repaired 5 Oct." */
export function repairLines(row, now) {
  const found = shortDate(row?.foundAt, now);
  const repaired = shortDate(row?.repairedAt, now);
  const subject = subjectName(row?.subject);
  const checked = row?.checkedState === 'passed' ? 'Checked on a fresh question.'
    : row?.checkedState === 'not_passed' ? 'Missed again on a fresh question. Worth another look.'
      : row?.checkedState === 'pending' ? 'Waiting for a fresh question.'
        : 'Fresh checks are not open yet.';
  return {
    title: row?.chapter || subject,
    found: found ? `Found ${found} in ${subject}.` : `Found in ${subject}.`,
    repaired: repaired ? `Repaired ${repaired}.` : 'Repaired.',
    checked,
    stage: row?.checkedState === 'passed' ? 'checked' : 'repaired',
  };
}

/** Questions answered right, always with its denominator. No percentage under 20 questions. */
export function rightLine(totals) {
  if (!totals || totals.questions === 0) return { value: 'None yet', detail: 'Finish a session to start your record' };
  const pct = Math.round((totals.correct / totals.questions) * 100);
  return {
    value: `${totals.correct} of ${totals.questions}`,
    detail: totals.questions < 20 ? 'Answered right. Too few questions for a percentage' : `Answered right, about ${pct}%`,
  };
}

/** The server note under Progress, rewritten without internal words. */
export function evidenceNote(data) {
  if (!data) return '';
  if (typeof data.note === 'string' && /^Current question evidence is unavailable/i.test(data.note)) {
    return 'Question checks are unavailable right now, so improvement claims are paused.';
  }
  const left = num(data.invalidatedChecks);
  if (left > 0) return `${plural(left, 'older answer')} ${left === 1 ? 'is' : 'are'} left out because ${left === 1 ? 'its question was' : 'their questions were'} changed or withdrawn.`;
  return '';
}

/** A concept check (learning episode) as a row. */
export function checkRow(p) {
  const size = num(p?.sampleSize);
  return {
    title: p?.concept ? String(p.concept) : 'Concept',
    detail: p?.evidenceLabel ? String(p.evidenceLabel) : 'Waiting for fresh questions',
    tag: size === 0 ? 'No fresh check yet' : plural(size, 'fresh check'),
  };
}

/** A playbook strategy as words. */
const STRATEGY = { two_pass: 'Two passes through the paper', concept_repair: 'Repair the concept first', timed_practice: 'Practice against the clock' };
export function strategyName(id) {
  return STRATEGY[id] || conceptName(id);
}

/** The state of a page that loads one record: what the student sees first. */
export function pageState({ data, error, offline }) {
  if (data) return 'ready';
  if (error) return offline ? 'offline' : 'error';
  return 'loading';
}
