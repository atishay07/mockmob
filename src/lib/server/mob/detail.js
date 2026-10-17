// What a sitting keeps beside its picks for the Pro side-by-side: seconds and changed answers per question, in paper
// order. Read from the attempt's own record (data/paper_trace.js, the one time calculator), so the Mob never disagrees
// with the result page. Null when the device kept no usable record: the side-by-side then shows picks without time.
// No 'server-only' and no '@/' imports, so node:test drives it (data/tests/mob.test.mjs).
import { readTrace } from '../../../../data/paper_trace.js';

/** { t: [seconds | -1 per question], c: [changed answers per question] } or null. */
export function detailFromAttempt(questionIds, attempt) {
  const rec = attempt?.selectionMeta?.recovery;
  const ids = Array.isArray(questionIds) ? questionIds : [];
  if (!ids.length || !rec || rec.telemetry !== 'self_reported') return null;
  try {
    const trace = readTrace(rec);
    if (trace.timeline.length < 2) return null;
    const changes = Array.isArray(rec.observed?.answerChanges) ? rec.observed.answerChanges : [];
    return {
      t: ids.map((id) => (trace.dwell.has(id) ? Math.max(0, Math.min(36000, Math.round(trace.dwell.get(id) / 1000))) : -1)),
      c: ids.map((id) => Math.min(20, changes.filter((x) => x?.qid === id).length)),
    };
  } catch { return null; }
}
