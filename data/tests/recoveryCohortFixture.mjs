// SIMULATED learners driven through the real engine. Software fixture only: it exercises the
// metrics pipeline and must never be reported as student evidence or academic calibration.
import { createEpisode, advanceEpisode, permittedStep } from '../learning_engine.js';

const HOUR = 3_600_000; const DAY = 24 * HOUR;
const T0 = Date.parse('2026-10-05T04:30:00Z');

// A learner answers probes by a hypothesis, repairs correctly, then follows a check script.
// checks: array of 'pass' | 'fail' | 'expire' | 'stop' (stop = never returns).
function learner(p, { id, hypothesis, conflict = false, checks = [], stopInRepair = false, gapHours = 26, invalidate = false }) {
  let at = T0; let e = createEpisode(p, { id, at });
  const step = () => permittedStep(p, e, at);
  for (let n = 0; e.state === 'investigating'; n++) {
    const probe = step(); const h = conflict && n === 1 ? p.hypotheses.find(x => x !== hypothesis) : hypothesis;
    e = advanceEpisode(p, e, { itemId: probe.id, type: probe.type, value: probe.matrix[h][0] }, at += 60_000);
  }
  if (stopInRepair) return { e, at };
  const repairAll = () => { while (['repairing', 'needs_repair'].includes(e.state)) { const s = step(); e = advanceEpisode(p, e, { itemId: s.id, type: s.type, value: s.answer }, at += 90_000); } };
  repairAll();
  for (const outcome of checks) {
    if (outcome === 'stop') break;
    if (e.nextDueAt) at = Math.max(at, e.nextDueAt) + gapHours * HOUR - 24 * HOUR;
    const s = step(); if (!s) break;
    const wrong = (s.answer + 1) % s.options.length;
    e = outcome === 'expire' ? advanceEpisode(p, e, { itemId: s.id, type: 'choice', value: null }, at, { incompleteCheck: 'expired' })
      : advanceEpisode(p, e, { itemId: s.id, type: 'choice', value: outcome === 'pass' ? s.answer : wrong }, at);
    if (['needs_repair'].includes(e.state)) repairAll();
  }
  if (invalidate) e = { ...e, state: 'invalidated', nextDueAt: null };
  return { e, at };
}

export const COHORT_SCRIPT = [
  { hypothesis: 'secure', checks: ['pass', 'pass', 'pass'] },
  { hypothesis: 'secure', checks: ['pass', 'pass', 'pass', 'pass'] },
  { hypothesis: 'old_ratio_default', checks: ['pass', 'pass', 'pass'] },
  { hypothesis: 'old_ratio_default', checks: ['pass', 'fail', 'pass', 'pass'] },
  { hypothesis: 'old_ratio_default', checks: ['pass', 'stop'] },
  { hypothesis: 'new_ratio_used', checks: ['pass', 'pass', 'stop'] },
  { hypothesis: 'new_ratio_used', checks: ['fail', 'pass', 'expire'] },
  { hypothesis: 'direction_reversed', checks: ['pass', 'pass', 'pass'] },
  { hypothesis: 'direction_reversed', stopInRepair: true },
  { hypothesis: 'old_ratio_default', conflict: true, checks: ['pass', 'pass'] },
  { hypothesis: 'secure', checks: ['pass', 'pass'], invalidate: true },
  { hypothesis: 'new_ratio_used', checks: ['pass'] },
];

/** Rows shaped like learning_episodes, evaluated at a fixed "now" 30 days after the start. */
export function simulatedCohort(p) {
  return COHORT_SCRIPT.map((spec, i) => {
    const { e } = learner(p, { id: `sim-${i + 1}`, ...spec });
    return { id: `sim-${i + 1}`, user_id: `sim-user-${i + 1}`, concept_id: p.id, pathway: { version: p.version }, projection: e, created_at: new Date(T0).toISOString(), simulated: true };
  });
}
export const COHORT_NOW = T0 + 30 * DAY;
export { learner as simulateLearner, T0 };
