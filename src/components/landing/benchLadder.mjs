// The Benchmarks scene on the landing shows the real benchmark levels, read from the profiles the app runs
// (src/services/ai-rival/rivalProfiles.js), and a question count the app offers (AIRivalArena: 5, 10, 15 or 20).
// The college and DU levels are Pro levels that cost AI credits, and createAIRivalBattle refuses every charged
// benchmark while paid AI is closed (RELEASE_GATES.aiCommerce, aiCreditWallet aiCommerceOpen). So until that gate
// opens the scene and the tour's words say only the daily level runs, and mark the other two as opening soon; the
// copy switches by itself when aiCommerceReleased() turns true.
import { RIVAL_PROFILES } from '../../services/ai-rival/rivalProfiles.js';
import { aiCommerceReleased } from '../../../data/capabilities.js';

const pct = (profile) => `${Math.round(profile.targetAccuracy * 100)}%`;

export const BENCH_DAILY = RIVAL_PROFILES.NORTH_CAMPUS_RIVAL;
export const BENCH_COUNT = 20;
// The time a benchmark gets, as createAIRivalBattle sets it when the student does not choose one: the count at the
// profile's pace, rounded to whole minutes, plus two minutes, and never under five. 20 daily questions get 20:00.
export const benchMinutes = (count, profile) => Math.max(5, Math.round((count * profile.avgTimePerQuestion) / 60) + 2);
// The sample student's finished run: 14 of 20 right is 70% (on 20 questions accuracy moves in steps of 5%), at
// 52 seconds a question, so the run used 17:20 of the 20:00 the benchmark allows.
export const BENCH_RIGHT = 14;
export const BENCH_YOU = (BENCH_RIGHT * 100) / BENCH_COUNT;
export const BENCH_PACE = 52;
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
export const BENCH_USED = mmss(BENCH_COUNT * BENCH_PACE);
export const BENCH_ALLOWED = mmss(benchMinutes(BENCH_COUNT, BENCH_DAILY) * 60);

/** The ladder, highest first. A level that cannot be run today carries 'soon'. */
export function benchLadder(released = aiCommerceReleased()) {
  const paid = released ? undefined : 'soon';
  return [
    ['DU level', pct(RIVAL_PROFILES.SRCC_DREAM), paid],
    ['College level', pct(RIVAL_PROFILES.HANSRAJ_LEVEL), paid],
    ['Daily', pct(BENCH_DAILY), 'target'],
    ['You, today', `${BENCH_YOU}%`, 'you'],
  ];
}
export const BENCH_LADDER = benchLadder();

/** What the tour says about the levels, by the same gate: the body, and the one line on the levels (its first point on
 *  wide screens, its summary line on phones). */
export function benchCopy(released = aiCommerceReleased()) {
  const cost = RIVAL_PROFILES.HANSRAJ_LEVEL.creditCost;
  return released
    ? {
      body: 'Run a short timed set against a fixed target for accuracy and pace, at daily, college or DU level. See whether you hold the standard with the clock running.',
      levels: `The daily benchmark is free. College and DU levels are Pro, at ${cost} AI credits a run.`,
    }
    : {
      body: 'Run a short timed set against a fixed target for accuracy and pace, and see whether you hold the standard with the clock running.',
      levels: 'The daily benchmark is free; college and DU levels open soon.',
    };
}
