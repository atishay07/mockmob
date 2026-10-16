// The 16 badges (app-you-1016 section 3.2) worked out on the server, for the app and the website
// (docs/design-decisions/badges-api-1016.md). PURE: no I/O, no clock reads. The loader and the cache
// live in badgesStore.js; the rhythm (study weeks, repairs, "Check it held") comes from
// computeRhythm in rhythm.js, so the badge list and the Rhythm card cannot disagree.
//
// A badge is a fact: earned only when a record dates it (`earnedAt`), never guessed. Every rule uses a
// threshold that only grows, so a badge once earned is not taken back. The five attempt-derived badges
// follow the phone's `deriveBadges` exactly, so a badge cannot be earned on one side and not the other.
import { createHash } from 'node:crypto';
import { formatIdFor, MARKS_PER_CORRECT, MARKS_PER_WRONG } from './attemptSummary.js';

export const SERVER_SCORING = ['server_snapshot_v1', 'server_practice_v1'];
/** Most attempts read per call (oldest first). A student past this would miss later best-work badges. */
export const ATTEMPT_LIMIT = 1000;

// Names and conditions: the exact words of app-you-1016 section 3.2. `target` is the denominator of `progress`.
export const BADGE_DEFS = [
  { id: 'first_scored_session', path: 'papers', target: 1, name: 'First scored set', condition: 'Lands when a set with 5 or more answers is scored.' },
  { id: 'first_full_mock', path: 'papers', target: 1, name: 'First full mock', condition: 'Lands when a 50-question full mock is scored.' },
  { id: 'first_nta', path: 'papers', target: 1, name: 'Exam-day rehearsal', condition: 'Lands when you finish a paper in NTA mode.' },
  { id: 'sessions_10', path: 'papers', target: 10, name: '10 scored sets', condition: 'Lands with your 10th scored set of 5 or more answers.' },
  { id: 'full_mocks_5', path: 'papers', target: 5, name: '5 full mocks', condition: 'Lands with your 5th scored full mock or NTA paper.' },
  { id: 'first_repair', path: 'repairs', target: 1, name: 'First repair', condition: 'Lands when you finish your first repair.' },
  { id: 'repairs_5', path: 'repairs', target: 5, name: '5 repairs', condition: 'Lands with your 5th finished repair.' },
  { id: 'repairs_10', path: 'repairs', target: 10, name: '10 repairs', condition: 'Lands with your 10th finished repair.' },
  { id: 'repairs_25', path: 'repairs', target: 25, name: '25 repairs', condition: 'Lands with your 25th finished repair.' },
  { id: 'first_hold', path: 'repairs', target: 1, name: 'It held', condition: 'Lands when a mistake you repaired is answered right on a fresh question.' },
  { id: 'first_week_met', path: 'rhythm', target: 1, name: 'First week at your goal', condition: 'Lands when a week reaches your goal.' },
  { id: 'weeks_met_4', path: 'rhythm', target: 4, name: '4 weeks at your goal', condition: 'Lands when a fourth week reaches its goal. They need not be in a row.' },
  { id: 'run_weeks_3', path: 'rhythm', target: 3, name: '3 weeks in a row', condition: 'Lands when 3 weeks in a row reach your goal.' },
  { id: 'clean_set', path: 'best', target: 1, name: 'Clean set', condition: 'Lands when every answer is right in a scored set of 10 or more questions.' },
  { id: 'four_subjects', path: 'best', target: 4, name: 'Four subjects', condition: 'Lands when you have a scored set in 4 different subjects.' },
  { id: 'new_best', path: 'best', target: 1, name: 'New best', condition: 'Lands when you beat your own marks on the same kind of mock.' },
];

/** Badge ids the rhythm dates (rhythm.js milestones). */
const FROM_RHYTHM = ['first_scored_session', 'first_full_mock', 'first_repair', 'repairs_5', 'repairs_10', 'repairs_25', 'sessions_10', 'first_week_met', 'weeks_met_4', 'run_weeks_3', 'first_hold'];

const text = v => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num = v => Number(v) || 0;
const isoOf = v => { const t = Date.parse(v); return Number.isFinite(t) ? new Date(t).toISOString() : null; };

/**
 * Attempts the badges read: rows of { id, subject, correct, wrong, total, completed_at, mode, scoringVersion }
 * (mode and scoringVersion are selection_meta->>mode and ->>scoringVersion). Only server-scored rows with a
 * valid date count; oldest first, ties by id.
 */
export function scoredAttempts(rows) {
  const out = [];
  for (const r of rows || []) {
    if (!r || !SERVER_SCORING.includes(r.scoringVersion)) continue;
    const at = isoOf(r.completed_at);
    if (!at || !r.id) continue;
    const correct = num(r.correct), wrong = num(r.wrong), total = num(r.total);
    out.push({
      id: String(r.id), at, subject: text(r.subject).trim().toLowerCase(), mode: text(r.mode).trim().toLowerCase() || null,
      correct, wrong, total, marks: correct * MARKS_PER_CORRECT - wrong * MARKS_PER_WRONG, maxMarks: total * MARKS_PER_CORRECT,
      formatId: formatIdFor({ subject: r.subject, total, mode: r.mode, scoringVersion: r.scoringVersion }),
    });
  }
  return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const recordOf = (a, before) => ({ attemptId: a.id, subject: a.subject, mode: a.mode, correct: a.correct, wrong: a.wrong, total: a.total, marks: a.marks, maxMarks: a.maxMarks, ...(before != null ? { before } : {}) });

/**
 * The five attempt-derived badges earned, keyed by id, plus the exact counts toward the two countable ones.
 * Same rules as the phone (derived_badges.dart): first NTA paper, 5th mock (full or NTA), first clean set of 10+
 * questions, the attempt that made 4 subjects (5+ answered each), and the first attempt strictly above an
 * earlier attempt of the same format id.
 */
export function deriveFromAttempts(rows) {
  const scored = scoredAttempts(rows);
  const earned = {};
  const put = (id, a, before) => { if (!earned[id]) earned[id] = { at: a.at, record: recordOf(a, before) }; };
  let mocks = 0;
  const subjects = new Set();
  const bestByFormat = new Map();
  for (const a of scored) {
    if (a.mode === 'nta') put('first_nta', a);
    if (a.mode === 'full' || a.mode === 'nta') { mocks++; if (mocks === 5) put('full_mocks_5', a); }
    if (a.total >= 10 && a.correct === a.total) put('clean_set', a);
    if (a.subject && a.correct + a.wrong >= 5 && !subjects.has(a.subject)) { subjects.add(a.subject); if (subjects.size === 4) put('four_subjects', a); }
    if (a.formatId) {
      const before = bestByFormat.get(a.formatId);
      if (before !== undefined && a.marks > before) put('new_best', a, before);
      if (before === undefined || a.marks > before) bestByFormat.set(a.formatId, a.marks);
    }
  }
  return { earned, counts: { mocks, subjects: subjects.size } };
}

/**
 * The finished list. `rhythm` is the object computeRhythm returns (with the `counts`, `milestones`,
 * `weeksMetStreak` and `bestRunEndedWeek` it carries); `attemptRows` the rows described above.
 * Always the 16 badges in shelf order. `unavailable` names any badge whose record could not be read (the
 * rhythm leaves `first_hold` out then): those read as not earned and a client must not show them as locked.
 */
export function buildBadges({ rhythm, attemptRows, generatedAt }) {
  const dated = new Map((rhythm?.milestones || []).map(m => [m.id, isoOf(m.achievedAt)]));
  const { earned: fromAttempts, counts: ac } = deriveFromAttempts(attemptRows);
  const rc = rhythm?.counts || {};
  // Exact counts toward each badge not earned yet (clamped below the target, so current === target only when earned).
  const toward = {
    sessions_10: num(rc.sessions), full_mocks_5: ac.mocks, four_subjects: ac.subjects,
    repairs_5: num(rc.repairs), repairs_10: num(rc.repairs), repairs_25: num(rc.repairs),
    weeks_met_4: num(rc.weeksMet), run_weeks_3: num(rhythm?.weeksMetStreak),
  };
  const unavailable = [];
  const badges = BADGE_DEFS.map(def => {
    let at = null, record = null;
    if (FROM_RHYTHM.includes(def.id)) {
      if (!dated.has(def.id)) unavailable.push(def.id);
      at = dated.get(def.id) || null;
    } else if (fromAttempts[def.id]) {
      at = fromAttempts[def.id].at;
      record = fromAttempts[def.id].record;
    }
    const earned = at != null;
    const current = earned ? def.target : Math.max(0, Math.min(def.target - 1, Math.trunc(toward[def.id] || 0)));
    return { id: def.id, path: def.path, name: def.name, condition: def.condition, earned, earnedAt: at, progress: { current, target: def.target }, record };
  });
  return {
    version: 1,
    generatedAt: new Date(generatedAt ?? Date.now()).toISOString(),
    total: badges.length,
    earnedCount: badges.filter(b => b.earned).length,
    bestRunEndedWeek: rhythm?.bestRunEndedWeek ?? null,
    unavailable,
    badges,
  };
}

/** Weak ETag over everything except `generatedAt`, so an unchanged list keeps its tag. */
export function etagOf(body) {
  const { generatedAt: _skip, ...rest } = body;
  return `W/"${createHash('sha1').update(JSON.stringify(rest)).digest('base64url').slice(0, 22)}"`;
}
