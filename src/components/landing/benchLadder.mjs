// The Benchmarks scene on the landing shows the real benchmark levels, read from the profiles the app runs
// (src/services/ai-rival/rivalProfiles.js), and a question count the app offers (AIRivalArena: 5, 10, 15 or 20).
import { RIVAL_PROFILES } from '../../services/ai-rival/rivalProfiles.js';

const pct = (profile) => `${Math.round(profile.targetAccuracy * 100)}%`;

export const BENCH_DAILY = RIVAL_PROFILES.NORTH_CAMPUS_RIVAL;
export const BENCH_COUNT = 20;
export const BENCH_YOU = 72; // the sample student's run in the scene

export const BENCH_LADDER = [
  ['DU level', pct(RIVAL_PROFILES.SRCC_DREAM)],
  ['College level', pct(RIVAL_PROFILES.HANSRAJ_LEVEL)],
  ['Daily', pct(BENCH_DAILY), 'target'],
  ['You, today', `${BENCH_YOU}%`, 'you'],
];
