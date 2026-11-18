// Your pace (Marks trend, lane insight 18 Nov 2026): one row per timed paper, its median seconds a question against CUET's
// own pace. PURE.
//
// Where each figure comes from:
//   a paper's median   the paper's device record (selectionMeta.recovery, used only when the server matched it to the
//                      submitted answers) through data/paper_trace.js, the one calculator the result page's Time and
//                      decisions uses: questions with 2 s or more, and a median named only over 10 or more of them
//                      (TIME_RULES), so a row says exactly what that paper's result says
//   the paper's name   src/components/recovery/repairRun.js sourceLabels ("Mock 3", "Quick practice"), as Your papers
//   CUET's pace        data/test_modes.js NTA mode: 60 minutes for 50 questions
// A paper with no usable record (scored in the browser, not matched, or too few timed questions) is left out, never guessed.
// No average of the medians is made.
import { paperTrace } from '../../../data/paper_trace.js';
import { TIME_RULES } from '../../../data/time_decisions.js';
import { CUET_PACE_SEC } from './words.mjs';

export const PACE_ROWS = 8;

const median = (values) => {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

/** One paper's median seconds a question and how many questions it is over, or null when the paper names none. */
export function paperMedian(attempt) {
  const trace = paperTrace(attempt);
  if (trace.state !== 'ready') return null;
  const timed = [...trace.dwell.values()].filter((ms) => ms >= TIME_RULES.minTimedMs);
  if (timed.length < TIME_RULES.minTimedForMedian) return null;
  return { medianSec: Math.round(median(timed) / 1000), timed: timed.length };
}

const at = (a) => {
  const t = typeof a?.completedAt === 'number' ? a.completedAt : Date.parse(a?.completedAt);
  return Number.isFinite(t) ? t : null;
};

/**
 * The pace rows: the newest PACE_ROWS papers that name a median, oldest first (newest last).
 *   attempts  the open attempts, any order
 *   labels    Map(attemptId -> "Mock 3" | "Quick practice")
 *   nameOf    (subject) -> the subject's name
 * -> { paceSec, papers: [{ id, name, subject, subjectName, at, medianSec, timed }] }
 */
export function buildPace(attempts = [], { labels = new Map(), nameOf = (id) => id, limit = PACE_ROWS } = {}) {
  const newestFirst = [...(attempts || [])].filter((a) => a && at(a) !== null).sort((a, b) => at(b) - at(a) || String(a.id).localeCompare(String(b.id)));
  const rows = [];
  for (const a of newestFirst) {
    if (rows.length >= limit) break;
    const m = paperMedian(a);
    if (!m) continue;
    rows.push({ id: a.id, name: labels.get(a.id) || 'Quick practice', subject: a.subject, subjectName: nameOf(a.subject), at: at(a), medianSec: m.medianSec, timed: m.timed });
  }
  return { paceSec: CUET_PACE_SEC, papers: rows.reverse() };
}
