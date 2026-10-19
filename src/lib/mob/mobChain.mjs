// The Mob's weekly chain (MOB-BUILD-SPEC-V3 2.3, C2). Computed, not stored: pure, from mob_weeks rows and the clock.
//   - A week is stitched when its quest has done_at.
//   - A missed week uses a week pass if one is held (the chain holds; it does not grow). A pass is earned at every 4th
//     stitched week; the Mob holds at most 1.
//   - Otherwise the chain restarts at 0. The current week is never "missed" before it ends.
// No warnings and no countdowns come from here; the best run is kept by mob_chain_best (it never drops).
import { nextMobReward } from './folds.mjs';

const DAY_MS = 86_400_000;
const addDays = (key, d) => new Date(Date.parse(`${key}T00:00:00Z`) + d * DAY_MS).toISOString().slice(0, 10);
export const WEEK_PASS_EVERY = 4;
export const WEEK_PASS_MAX = 1;

/** weeks: [{ week_start, done_at }]; currentWeek: this IST week's Monday (YYYY-MM-DD). */
export function computeMobChain({ weeks = [], currentWeek, storedBest = 0 }) {
  const done = new Map();
  for (const w of weeks || []) if (w?.done_at) done.set(String(w.week_start).slice(0, 10), true);
  const first = [...done.keys()].sort()[0];
  let chain = 0; let passes = 0; let stitched = 0; let best = 0; let stitchedThisWeek = false;
  const history = [];
  if (first && first <= currentWeek) {
    for (let w = first; w <= currentWeek; w = addDays(w, 7)) {
      if (done.has(w)) {
        chain += 1; stitched += 1;
        if (stitched % WEEK_PASS_EVERY === 0) passes = Math.min(WEEK_PASS_MAX, passes + 1);
        if (w === currentWeek) stitchedThisWeek = true;
        history.push({ week: w, state: 'stitched' });
      } else if (w === currentWeek) {
        history.push({ week: w, state: 'open' });
      } else if (passes > 0) {
        passes -= 1;
        history.push({ week: w, state: 'pass' });
      } else {
        chain = 0;
        history.push({ week: w, state: 'missed' });
      }
      best = Math.max(best, chain);
    }
  }
  best = Math.max(best, Number(storedBest) || 0);
  const restarted = history.length > 1 && history.at(-1).state === 'open' && history.at(-2).state === 'missed';
  return { weeks: chain, best, passes, stitchedThisWeek, restarted, history, next: nextMobReward(chain) };
}
