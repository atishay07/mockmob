// The Benchmarks scene on the landing shows the real benchmark levels, read from the profiles the app runs
// (src/services/ai-rival/rivalProfiles.js), and a question count the app offers (AIRivalArena: 5, 10, 15 or 20).
import { RIVAL_PROFILES } from '../../services/ai-rival/rivalProfiles.js';

const pct = (profile) => `${Math.round(profile.targetAccuracy * 100)}%`;

export const BENCH_DAILY = RIVAL_PROFILES.NORTH_CAMPUS_RIVAL;
export const BENCH_COUNT = 20;
// The sample student's finished run: 14 of 20 right is 70% (on 20 questions accuracy moves in steps of 5%), at
// 52 seconds a question, so the run used 17:20 of the 18:20 the clock allows (20 × the profile's pace).
export const BENCH_RIGHT = 14;
export const BENCH_YOU = (BENCH_RIGHT * 100) / BENCH_COUNT;
export const BENCH_PACE = 52;
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
export const BENCH_USED = mmss(BENCH_COUNT * BENCH_PACE);
export const BENCH_ALLOWED = mmss(BENCH_COUNT * BENCH_DAILY.avgTimePerQuestion);

export const BENCH_LADDER = [
  ['DU level', pct(RIVAL_PROFILES.SRCC_DREAM)],
  ['College level', pct(RIVAL_PROFILES.HANSRAJ_LEVEL)],
  ['Daily', pct(BENCH_DAILY), 'target'],
  ['You, today', `${BENCH_YOU}%`, 'you'],
];
