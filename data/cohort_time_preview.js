// Illustrative cohort time numbers for the development preview (/preview/arena?view=result&mock=full&cohort=time) and the
// tests that check each gate. Never real students. Pure: it only reads the paper's own per-question times.
import { buildTimeDecisions } from './time_decisions.js';

/**
 * The Lab's illustrative cohort read with the nightly table's time numbers added (slice 5, spec 4.13): counts scaled by
 * three so the gates can be met, and per question the median of the students who got it right, how many timed students
 * changed their answer and moved off the key, and how many crossed out the key. `state` 'pass' meets every gate; 'gated'
 * is one short of each (29 timed right answers, 19 timed students, 19 with strike data, 4 slow questions). Seven
 * questions are ones the student took 2.6 times the median on, so the ledger finding passes. Never real students.
 */
export function fixtureCohortTime(cohort, attempt, answerReviews, state = 'pass') {
  const td = buildTimeDecisions(attempt, { answerReviews });
  const ms = new Map((td.rows || []).map((r) => [r.qid, r.ms]));
  const gated = state === 'gated';
  let slowLeft = gated ? 4 : 7;
  const changedBy = [6, 0, 1, 3];
  const movedBy = [4, 0, 1, 1];
  const struckBy = [9, 0, 1, 4];
  const byQid = {};
  Object.entries(cohort.byQid).forEach(([qid, read], i) => {
    const own = ms.get(qid);
    const slow = slowLeft > 0 && Number.isFinite(own) && own >= 30000;
    if (slow) slowLeft -= 1;
    const medianMs = slow ? Math.round(own / 2.6 / 1000) * 1000 : Number.isFinite(own) && own > 0 ? Math.max(8000, Math.round(own / 1.1 / 1000) * 1000) : 48000;
    byQid[qid] = {
      ...read, n: read.n * 3, right: read.right * 3, counts: read.counts.map((c) => c * 3),
      time: {
        right: { n: gated ? 29 : 30 + (i % 7) * 3, medianMs },
        timed: gated ? 19 : 27 + (i % 5),
        changed: gated ? 3 : changedBy[i % 4], movedOff: gated ? 1 : movedBy[i % 4],
        strike: { n: gated ? 19 : 30 + (i % 3), struck: gated ? 2 : struckBy[i % 4] },
      },
    };
  });
  return { ...cohort, byQid };
}
