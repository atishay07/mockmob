// The sixteen badges and the personal bests, worked out from the student's own records. PURE: no I/O,
// no clock. A port of the app's rules (flutter_app/lib/features/rhythm: badges, derived_badges.dart,
// milestone_tracks.dart, milestone_progress.dart, fastest_answer.dart, badge_record.dart; brief
// docs/design-decisions/app-you-1016.md), so the same attempts give the same badges and bests on the
// phone and here. Every badge is a fact: earned only when a record dates it, never taken back
// (every rule uses a threshold that only grows), and a locked one says exactly what earns it.
//
// Three sources, as in the app:
//   server   the server's milestone list (GET /api/me/rhythm, milestones[])
//   derived  worked out here from the complete attempts list, server-scored attempts only, each
//            dated by its own completedAt (first_nta, full_mocks_5, clean_set, four_subjects, new_best)
//   newServer  ids the server dates from events: first_hold, run_weeks_3. They are earned only when
//            the server lists them with a date. Until then they are shown locked, with what earns
//            them; run_weeks_3 is also earned, undated, when the server's own best run already
//            proves three weeks in a row (never falsely locked, never given a made-up date).
import { dwellByQuestion } from '../../data/session_recovery.js';
import { dayKeyNow } from './rhythmView.js';

export const MARKS_RIGHT = 5;
export const MARKS_WRONG = 1;
/** Answers quicker than this are not counted as the fastest (a tap through, not a read). */
export const FASTEST_FLOOR_MS = 3000;
/** Closed weeks the server sends at most (HISTORY_WEEKS in lib/server/rhythm.js). */
export const RHYTHM_HISTORY_WEEKS = 12;
/** A set counts toward "scored sets" with at least this many answered questions. */
export const MIN_ANSWERED = 5;

const SERVER_SCORED = new Set(['server_practice_v1', 'server_snapshot_v1']);

export const BADGE_PATHS = [
  { id: 'papers', title: 'Papers', link: { label: 'Choose practice', href: '/dashboard' } },
  { id: 'repairs', title: 'Repairs', link: { label: 'Open your mistakes', href: '/review' } },
  { id: 'rhythm', title: 'Weeks at your goal', link: null },
  // Not a sequence: each badge of this path says its own condition and none waits on another.
  { id: 'best', title: 'Your best work', link: { label: 'Choose practice', href: '/dashboard' } },
];

/** The sixteen, in shelf order. `source` says where the date comes from. */
export const BADGE_STEPS = [
  { id: 'first_scored_session', path: 'papers', name: 'First scored set', condition: 'Lands when a set with 5 or more answers is scored.', source: 'server' },
  { id: 'first_full_mock', path: 'papers', name: 'First full mock', condition: 'Lands when a 50-question full mock is scored.', source: 'server' },
  { id: 'first_nta', path: 'papers', name: 'Exam-day rehearsal', condition: 'Lands when you finish a paper in NTA mode.', source: 'derived' },
  { id: 'sessions_10', path: 'papers', name: '10 scored sets', condition: 'Lands with your 10th scored set of 5 or more answers.', source: 'server', target: 10 },
  { id: 'full_mocks_5', path: 'papers', name: '5 full mocks', condition: 'Lands with your 5th scored full mock or NTA paper.', source: 'derived', target: 5 },
  { id: 'first_repair', path: 'repairs', name: 'First repair', condition: 'Lands when you finish your first repair.', source: 'server' },
  { id: 'repairs_5', path: 'repairs', name: '5 repairs', condition: 'Lands with your 5th finished repair.', source: 'server' },
  { id: 'repairs_10', path: 'repairs', name: '10 repairs', condition: 'Lands with your 10th finished repair.', source: 'server' },
  { id: 'repairs_25', path: 'repairs', name: '25 repairs', condition: 'Lands with your 25th finished repair.', source: 'server' },
  { id: 'first_hold', path: 'repairs', name: 'It held', condition: 'Lands when a mistake you repaired is answered right on a fresh question.', source: 'newServer' },
  { id: 'first_week_met', path: 'rhythm', name: 'First week at your goal', condition: 'Lands when a week reaches your goal.', source: 'server' },
  { id: 'weeks_met_4', path: 'rhythm', name: '4 weeks at your goal', condition: 'Lands when a fourth week reaches its goal. They need not be in a row.', source: 'server', target: 4 },
  { id: 'run_weeks_3', path: 'rhythm', name: '3 weeks in a row', condition: 'Lands when 3 weeks in a row reach your goal.', source: 'newServer' },
  { id: 'clean_set', path: 'best', name: 'Clean set', condition: 'Lands when every answer is right in a scored set of 10 or more questions.', source: 'derived' },
  { id: 'four_subjects', path: 'best', name: 'Four subjects', condition: 'Lands when you have a scored set in 4 different subjects.', source: 'derived', target: 4 },
  { id: 'new_best', path: 'best', name: 'New best', condition: 'Lands when you beat your own marks on the same kind of mock.', source: 'derived' },
];

export const DERIVED_IDS = BADGE_STEPS.filter((s) => s.source === 'derived').map((s) => s.id);
const TARGETS = Object.fromEntries(BADGE_STEPS.filter((s) => s.target).map((s) => [s.id, s.target]));

// ---------------------------------------------------------------------------------------------
// Reading an attempt

const int = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0);
const modeOf = (a) => (typeof a?.mode === 'string' && a.mode) || (typeof a?.selectionMeta?.mode === 'string' && a.selectionMeta.mode) || '';
const isMock = (a) => modeOf(a) === 'full' || modeOf(a) === 'nta';
const isServerScored = (a) => SERVER_SCORED.has(a?.selectionMeta?.scoringVersion);
export const marksOf = (a) => int(a?.correct) * MARKS_RIGHT - int(a?.wrong) * MARKS_WRONG;
export const maxMarksOf = (a) => int(a?.total) * MARKS_RIGHT;
const subjectKey = (a) => String(a?.subject ?? '').trim().toLowerCase();
const completedMs = (a) => (Number.isFinite(Number(a?.completedAt)) ? Number(a.completedAt) : 0);

/** Server-scored attempts, oldest first (a stable sort: equal times keep the list order). */
const scoredOldestFirst = (attempts) => (Array.isArray(attempts) ? attempts : [])
  .filter((a) => a && isServerScored(a))
  .map((a, i) => [a, i])
  .sort((x, y) => completedMs(x[0]) - completedMs(y[0]) || x[1] - y[1])
  .map(([a]) => a);

// ---------------------------------------------------------------------------------------------
// The five badges worked out here

/** Each derived badge earned in `attempts`, keyed by id: { id, at (ms), attemptId, before? }. */
export function deriveBadges(attempts) {
  const out = {};
  const put = (id, a, before) => {
    if (out[id]) return;
    out[id] = { id, at: completedMs(a), attemptId: a.id, ...(before == null ? {} : { before }) };
  };
  let mocks = 0;
  const subjects = new Set();
  const bestByFormat = new Map();
  for (const a of scoredOldestFirst(attempts)) {
    if (modeOf(a) === 'nta') put('first_nta', a);
    if (isMock(a)) { mocks += 1; if (mocks === 5) put('full_mocks_5', a); }
    if (int(a.total) >= 10 && int(a.correct) === int(a.total)) put('clean_set', a);
    const subject = subjectKey(a);
    if (subject && int(a.correct) + int(a.wrong) >= 5 && !subjects.has(subject)) {
      subjects.add(subject);
      if (subjects.size === 4) put('four_subjects', a);
    }
    const format = typeof a.formatId === 'string' ? a.formatId : '';
    if (format) {
      const before = bestByFormat.get(format);
      const marks = marksOf(a);
      if (before !== undefined && marks > before) put('new_best', a, before);
      if (before === undefined || marks > before) bestByFormat.set(format, marks);
    }
  }
  return out;
}

/** The exact counts toward the countable derived badges not earned yet. */
export function derivedProgress(attempts) {
  const scored = scoredOldestFirst(attempts);
  const mocks = scored.filter(isMock).length;
  const subjects = new Set(scored.filter((a) => subjectKey(a) && int(a.correct) + int(a.wrong) >= 5).map(subjectKey)).size;
  return { ...(mocks < 5 ? { full_mocks_5: mocks } : {}), ...(subjects < 4 ? { four_subjects: subjects } : {}) };
}

/**
 * The server's milestones with the derived badges merged in: a derived id the server already dates
 * keeps the server's date; otherwise the attempt's date is used, or the id is listed as not earned
 * so the badge always shows. `at` values are ISO strings (server) or ms (derived); the result is ms.
 */
export function mergeDerived(server, derived, derivedIds = DERIVED_IDS) {
  const out = [];
  const seen = new Set();
  for (const m of server || []) {
    if (!m || typeof m.id !== 'string') continue;
    seen.add(m.id);
    const at = toMs(m.achievedAt);
    const d = derived?.[m.id];
    out.push({ id: m.id, achievedAt: at != null ? at : d ? d.at : null });
  }
  for (const id of new Set([...derivedIds, ...Object.keys(derived || {})])) {
    if (seen.has(id)) continue;
    out.push({ id, achievedAt: derived?.[id]?.at ?? null });
  }
  return out;
}

function toMs(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------------------------
// Counts toward the next badges

/** Counts the attempts list gives: scored sets, plus the derived counts. */
export function attemptCounts(attempts) {
  const sets = (Array.isArray(attempts) ? attempts : []).filter((a) => a && isServerScored(a) && int(a.correct) + int(a.wrong) >= MIN_ANSWERED).length;
  return { sessions_10: sets, ...derivedProgress(attempts) };
}

/**
 * Step id to the count so far, only where it can be counted exactly: scored sets and the derived
 * counts from the attempts, and weeks at the goal from the closed-week history while that history
 * reaches back to the first week. Repairs are never counted (some are done in the app). A count
 * that disagrees with the server (it reaches the target while the server has not dated the step)
 * is dropped, never shown.
 * @param {object} [counts] from attemptCounts(), when the attempts are known
 * @param {object} [rhythm] the /api/me/rhythm body
 */
export function milestoneProgress(counts, rhythm) {
  const out = { ...(counts || {}) };
  const history = rhythm?.history;
  if (rhythm && Array.isArray(history) && history.length < RHYTHM_HISTORY_WEEKS) {
    out.weeks_met_4 = history.filter((w) => w?.met).length + (rhythm.metThisWeek ? 1 : 0);
  }
  const earned = new Set((rhythm?.milestones || []).filter((m) => toMs(m?.achievedAt) != null).map((m) => m.id));
  for (const id of Object.keys(out)) {
    if (earned.has(id) || out[id] >= (TARGETS[id] ?? Infinity) || out[id] < 0) delete out[id];
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// The badge board

/**
 * The four paths in shelf order, every badge with its state.
 *   earned  has a date (or, for run_weeks_3 only, is proven by the server's best run: `undated`)
 *   next    the first not earned badge of a path (on "Your best work" every badge not earned)
 *   later   not earned, after the next one
 * @param {Array<{id:string, achievedAt:number|null}>} merged from mergeDerived()
 * @param {object} [rhythm] the /api/me/rhythm body (for the proof of run_weeks_3)
 */
export function badgePaths(merged, rhythm) {
  const at = new Map((merged || []).filter((m) => m.achievedAt != null).map((m) => [m.id, m.achievedAt]));
  const proofRun = Number(rhythm?.bestRun) >= 3 || Number(rhythm?.weeksMetStreak) >= 3;
  return layoutPaths((step) => {
    const date = at.get(step.id);
    if (date != null) return { earned: true, earnedAt: date };
    if (step.id === 'run_weeks_3' && proofRun) return { earned: true, earnedAt: null, undated: true };
    return { earned: false };
  });
}

/**
 * The four paths from a per-badge answer: { earned, earnedAt?, undated?, unknown?, name?, condition? }.
 * The first badge of a path not earned is "next" (on "Your best work" every one not earned is); a
 * badge the server could not read this time is "unknown", never "next" and never called locked.
 */
function layoutPaths(stateOf) {
  return BADGE_PATHS.map((path) => {
    let nextTaken = false;
    const steps = BADGE_STEPS.filter((s) => s.path === path.id).map((step) => {
      const st = stateOf(step) || { earned: false };
      let status;
      if (st.earned) status = 'earned';
      else if (st.unknown) status = 'unknown';
      else if (path.id === 'best') status = 'next';
      else if (!nextTaken) { nextTaken = true; status = 'next'; }
      else status = 'later';
      return {
        ...step,
        ...(typeof st.name === 'string' && st.name ? { name: st.name } : {}),
        ...(typeof st.condition === 'string' && st.condition ? { condition: st.condition } : {}),
        status, earnedAt: st.earned ? st.earnedAt ?? null : null, undated: !!st.undated,
      };
    });
    const earned = steps.filter((s) => s.status === 'earned').length;
    return { ...path, steps, earned, total: steps.length, next: steps.find((s) => s.status === 'next') || null };
  });
}

/**
 * The same board from the server's own list (GET /api/me/badges, contract
 * docs/design-decisions/badges-api-1016.md): its dates, words, counts and papers are the authority.
 * Null when the body is not that contract, so the caller can fall back to the papers it holds.
 * @returns {null | {paths, progress, records, bestRunEndedWeek: string|null}}
 */
export function badgePathsFromApi(body) {
  if (!body || body.version !== 1 || !Array.isArray(body.badges)) return null;
  const byId = new Map(body.badges.filter((b) => b && typeof b.id === 'string').map((b) => [b.id, b]));
  if (!BADGE_STEPS.some((s) => byId.has(s.id))) return null;
  const unavailable = new Set(Array.isArray(body.unavailable) ? body.unavailable : []);
  const progress = {};
  const records = {};
  const paths = layoutPaths((step) => {
    const b = byId.get(step.id);
    if (!b) return { earned: false };
    const current = Number(b.progress?.current);
    const target = Number(b.progress?.target);
    if (!b.earned && Number.isFinite(current) && Number.isFinite(target) && target > 1 && current >= 0 && current < target) progress[step.id] = { current, target };
    const r = b.record;
    if (b.earned && r && typeof r === 'object' && r.attemptId) {
      records[step.id] = { attemptId: r.attemptId, subject: r.subject, mode: r.mode, at: toMs(b.earnedAt) ?? 0, marks: int(r.marks), max: int(r.maxMarks ?? r.max), ...(r.before == null ? {} : { before: int(r.before) }) };
    }
    if (b.earned) return { earned: true, earnedAt: toMs(b.earnedAt), name: b.name, condition: b.condition };
    return { earned: false, unknown: unavailable.has(step.id), name: b.name, condition: b.condition };
  });
  const week = typeof body.bestRunEndedWeek === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.bestRunEndedWeek) ? body.bestRunEndedWeek : null;
  return { paths, progress, records, bestRunEndedWeek: week };
}

/** "None earned yet" or "6 of 16 earned". */
export function earnedLine(paths) {
  const earned = paths.reduce((n, p) => n + p.earned, 0);
  const total = paths.reduce((n, p) => n + p.total, 0);
  return earned === 0 ? 'None earned yet' : `${earned} of ${total} earned`;
}

/**
 * Counts as entries {current, target} for soFarLine() and fractionOf(): the local counts get their
 * targets from the badge list; the server's own entries (badgePathsFromApi) are used as sent.
 */
export function countEntries(progress) {
  const out = {};
  for (const [id, n] of Object.entries(progress || {})) {
    if (n && typeof n === 'object') out[id] = n;
    else if (Number.isFinite(n) && TARGETS[id]) out[id] = { current: n, target: TARGETS[id] };
  }
  return out;
}

/** The badge with its count so far, e.g. "6 of 10 so far", or null where nothing can be counted exactly. */
export function soFarLine(stepId, entries) {
  const e = entries?.[stepId];
  if (!e || !Number.isFinite(e.current) || !e.target) return null;
  if (stepId === 'four_subjects') return `${e.current} of ${e.target} subjects`;
  return `${e.current} of ${e.target} so far`;
}

/** 0 to 1 when a count is known, else null (no bar is drawn on a guess). */
export function fractionOf(stepId, entries) {
  const e = entries?.[stepId];
  if (!e || !Number.isFinite(e.current) || !e.target) return null;
  return Math.min(1, Math.max(0, e.current / e.target));
}

// ---------------------------------------------------------------------------------------------
// Words: subject names, dates, the paper behind a badge

const SUBJECT_ALIASES = { business: 'business_studies', gat: 'general_test', bst: 'business_studies' };
const SUBJECT_NAMES = {
  english: 'English', general_test: 'General Test', accountancy: 'Accountancy', business_studies: 'Business Studies',
  economics: 'Economics', mathematics: 'Mathematics', physics: 'Physics', chemistry: 'Chemistry', biology: 'Biology',
  history: 'History', political_science: 'Political Science', geography: 'Geography', psychology: 'Psychology',
  sociology: 'Sociology', computer_science: 'Computer Science',
};

export function subjectName(id) {
  const slug = String(id ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const canonical = SUBJECT_ALIASES[slug] || slug;
  if (SUBJECT_NAMES[canonical]) return SUBJECT_NAMES[canonical];
  const words = canonical.split('_').filter(Boolean);
  return words.length ? words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') : 'Practice';
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** '12 October' for an instant (ms), as the day falls in the student's time zone. */
export function dayMonth(ms, timeZone) {
  if (!Number.isFinite(ms)) return '';
  const key = dayKeyNow(timeZone, ms);
  return `${Number(key.slice(8, 10))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;
}

/** '2026-10-05' as '5 October'. */
const weekDate = (key) => `${Number(key.slice(8, 10))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function paperKind(mode) {
  return mode === 'full' ? 'full mock' : mode === 'nta' ? 'NTA mode paper' : 'practice set';
}

/**
 * The paper behind each derived badge earned, keyed by badge id (the badge sheet's record line).
 * A badge whose attempt is not in `attempts` has none, so no source is ever made up.
 */
export function badgeRecords(derived, attempts) {
  const byId = new Map((attempts || []).filter(Boolean).map((a) => [a.id, a]));
  const out = {};
  for (const d of Object.values(derived || {})) {
    const a = byId.get(d.attemptId);
    if (!a) continue;
    out[d.id] = { attemptId: a.id, subject: a.subject, mode: modeOf(a), at: completedMs(a), marks: marksOf(a), max: maxMarksOf(a), ...(d.before == null ? {} : { before: d.before }) };
  }
  return out;
}

/** "From your Accountancy full mock, 12 October: 152 of 250 (before: 142)". */
export function recordLine(record, timeZone) {
  if (!record) return '';
  const before = record.before == null ? '' : ` (before: ${record.before})`;
  return `From your ${subjectName(record.subject)} ${paperKind(record.mode)}, ${dayMonth(record.at, timeZone)}: ${record.marks} of ${record.max}${before}`;
}

// ---------------------------------------------------------------------------------------------
// The fastest right answer

/**
 * The shortest timed right answer across the server-scored papers whose timings are usable.
 * Answers under 3 seconds are not counted. Null when no paper carries a timing: never a guess.
 * A paper whose recovery record is present but not self-reported (inconsistent or invalid) is
 * skipped; older papers with no recovery record keep their per-answer timings. Time on a question
 * is the paper's own time trace when it has one (the figure the result page shows), else the
 * answer's saved timeMs.
 */
export function fastestRightAnswer(attempts) {
  let best = null;
  for (const a of Array.isArray(attempts) ? attempts : []) {
    if (!a || !isServerScored(a)) continue;
    const recovery = a.selectionMeta?.recovery;
    const hasRecovery = recovery && typeof recovery === 'object';
    if (hasRecovery && recovery.telemetry !== 'self_reported') continue;
    const dwell = hasRecovery && Array.isArray(recovery.timeline) ? dwellByQuestion(recovery) : null;
    const details = Array.isArray(a.details) ? a.details : [];
    const order = new Map((Array.isArray(a.questionsSnapshot) ? a.questionsSnapshot : []).map((q, i) => [q?.id, i + 1]));
    for (let i = 0; i < details.length; i++) {
      const d = details[i];
      if (d?.isCorrect !== true) continue;
      const t = dwell && d.qid != null && Number.isFinite(dwell[d.qid]) ? dwell[d.qid] : Number.isFinite(d?.timeMs) ? d.timeMs : null;
      if (t == null || t < FASTEST_FLOOR_MS) continue;
      if (!best || t < best.timeMs) {
        best = { timeMs: t, seconds: Math.round(t / 1000), subject: a.subject, at: completedMs(a), attemptId: a.id, question: order.get(d.qid) || i + 1 };
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Personal bests

const shareOf = (b) => (b?.best?.max > 0 ? b.best.marks / b.best.max : -1);
const isMockFormat = (b) => b?.mode === 'full' || b?.mode === 'nta';
function topShare(list) {
  let best = null;
  for (const b of list) if (b?.best?.max > 0 && (!best || shareOf(b) > shareOf(best))) best = b;
  return best;
}

/** The longest run of study weeks at the goal: the server's best run, never below the run now. */
export const longestRun = (rhythm) => Math.max(Number(rhythm?.bestRun) || 0, Number(rhythm?.weeksMetStreak) || 0);

/**
 * The value-first rows of Personal bests, each a real record with its denominator or its date; a
 * row with nothing true to say is left off.
 * @param {{bests?: Array, fastest?: object|null, rhythm?: object|null, timeZone?: string, bestRunEndedWeek?: string|null}} p
 *   bestRunEndedWeek is the Monday the longest run ended (from GET /api/me/badges); it is said only
 *   while that run is over, and when the server does not send it no date is shown or made up
 *   bests come from /api/me/bests (one per comparable mock type, retakes excluded)
 */
export function bestsRows({ bests = [], fastest = null, rhythm = null, timeZone, bestRunEndedWeek = null } = {}) {
  const rows = [];
  const mock = topShare(bests.filter(isMockFormat));
  const set = mock ? null : topShare(bests.filter((b) => !isMockFormat(b)));
  const paper = mock || set;
  if (paper) {
    rows.push({
      key: 'paper', value: `${paper.best.marks} / ${paper.best.max}`, label: mock ? 'Best full mock' : 'Best set',
      note: [subjectName(paper.subject), paper.best.completedAt ? dayMonth(paper.best.completedAt, timeZone) : ''].filter(Boolean).join(', '),
      href: paper.best.attemptId ? `/result/${paper.best.attemptId}` : null,
    });
  }
  if (rhythm) {
    const run = longestRun(rhythm);
    const now = Number(rhythm.weeksMetStreak) || 0;
    const goal = Number(rhythm.daysGoal) || 0;
    rows.push({
      key: 'run', value: plural(run, 'week'), label: 'Longest run at your goal',
      note: run === 0
        ? 'Your first week at your goal starts the count.'
        : `${now === 0 ? 'Not in a run right now' : `Now: ${plural(now, 'week')} in a row`}.${goal ? ` Goal: ${plural(goal, 'study day')} a week.` : ''}${bestRunEndedWeek && now < run ? ` Ended the week of ${weekDate(bestRunEndedWeek)}.` : ''}`,
      href: null,
    });
  }
  if (fastest) {
    rows.push({
      key: 'fastest', value: `${fastest.seconds} s`, label: 'Fastest right answer',
      note: `${subjectName(fastest.subject)}, question ${fastest.question}, ${dayMonth(fastest.at, timeZone)}`,
      href: fastest.attemptId ? `/result/${fastest.attemptId}` : null,
    });
  }
  return rows;
}

const MODE_NOUN = { full: 'full mock', nta: 'NTA mock', quick: 'quick set', smart: 'smart set' };

/** Best against latest for each comparable mock type, newest first (as /api/me/bests sends them). */
export function formatLines(bests, timeZone) {
  return (Array.isArray(bests) ? bests : []).filter((b) => b?.best?.max > 0).map((b) => {
    const questions = Math.round(b.best.max / MARKS_RIGHT);
    const sameMarks = b.latest?.attemptId === b.best?.attemptId;
    return {
      key: b.formatId,
      title: `${subjectName(b.subject)}, ${MODE_NOUN[b.mode] || 'practice set'}, ${plural(questions, 'question')}`,
      best: `${b.best.marks} of ${b.best.max}`,
      bestOn: b.best.completedAt ? dayMonth(b.best.completedAt, timeZone) : '',
      latest: sameMarks ? null : `${b.latest.marks} of ${b.latest.max}`,
      latestOn: !sameMarks && b.latest?.completedAt ? dayMonth(b.latest.completedAt, timeZone) : '',
      fraction: Math.min(1, Math.max(0, b.best.marks / b.best.max)),
      latestFraction: sameMarks ? null : Math.min(1, Math.max(0, b.latest.marks / b.latest.max)),
      attempts: b.attempts,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// What the server sends the page (one small body instead of the whole attempts dump)

/**
 * Everything the badges and bests need from the attempts, in one small serialisable body. The
 * client adds the rhythm (it already holds it) with badgePaths() and bestsRows().
 * `bests` is passed in (computeBests of lib/server/recap.js) so this module stays free of it.
 */
export function buildStudyRecord(attempts, bests = []) {
  const derived = deriveBadges(attempts);
  return {
    derived,
    records: badgeRecords(derived, attempts),
    counts: attemptCounts(attempts),
    fastest: fastestRightAnswer(attempts),
    bests,
    scoredAttempts: scoredOldestFirst(attempts).length,
  };
}
