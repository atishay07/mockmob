// What each Mobi act is, as the page needs to know it: how long a once act runs, whether it is held,
// the stance it leaves him in, and what the student's Celebrations and Reduce motion settings turn
// it into. Pure data and pure functions, so it is tested without a browser
// (data/tests/mobi_kit.test.mjs, data/tests/mobi_choreography.test.mjs, data/tests/mobi_rig.test.mjs).
//
// The motion itself is the rig table (data/mobi_rig.v2.json, evaluated by mobiRig.js and mobiSim.js).
// The act list, the durations, the held flag, the reduced-motion set and the stance an act leaves him
// in are the app's (flutter_app lib/core/mascot, MobiMoves); data/mobi-choreography.json and the rig
// JSON are what the test suites check this file against. Change them in the app first.
import { actAllowed } from '../../lib/mobiPrefs.js';

// The 31 acts (idle, standing at ease, is the 32nd and is not an act he is asked to do). The first 26
// are the original set; hop, curious, focus, sympathy and idea came with rig v2 (15 Oct 2026).
export const MOBI_ACTS = [
  'appear', 'hello', 'talk', 'cheer', 'celebrate', 'think', 'point', 'sleepy', 'oops', 'rest', 'read',
  'correct', 'encourage', 'loading', 'sleep', 'nudge', 'proud', 'listen', 'wake',
  'nod', 'tilt', 'wave', 'startle', 'brace', 'relief', 'walk',
  'hop', 'curious', 'focus', 'sympathy', 'idea',
];

// ms: how long a once act runs, the app's MobiMoves.duration in milliseconds (a held act has none,
// except nudge, whose two jabs run for it). held: he stays in it until the next act. stance: what he
// is left in after the act (the app's MobiStance: stand, point, think, sleepy, rest, read, loading,
// sleep, listen), or null when he goes back to whatever he was doing (a nod, a tilt, a startle do
// not change what he is doing). nudge is held: two jabs, then he keeps the point.
export const SPEC = {
  idle: { held: true, stance: 'stand' },
  appear: { ms: 750, stance: 'stand' },
  hello: { ms: 1850, stance: 'stand' },
  talk: { ms: 1600, stance: null },
  cheer: { ms: 1200, stance: 'stand' },
  celebrate: { ms: 2000, stance: 'stand' },
  think: { held: true, stance: 'think' },
  point: { held: true, stance: 'point' },
  sleepy: { held: true, stance: 'sleepy' },
  oops: { ms: 1300, stance: 'stand' },
  rest: { held: true, stance: 'rest' },
  read: { held: true, stance: 'read' },
  correct: { ms: 1150, stance: 'stand' },
  encourage: { ms: 1450, stance: 'stand' },
  loading: { held: true, stance: 'loading' },
  sleep: { held: true, stance: 'sleep' },
  nudge: { ms: 1050, held: true, stance: 'point' },
  proud: { ms: 2200, stance: 'stand' },
  listen: { held: true, stance: 'listen' },
  wake: { ms: 1200, stance: 'stand' },
  nod: { ms: 800, stance: null },
  tilt: { ms: 1100, stance: null },
  wave: { ms: 1500, stance: 'stand' },
  startle: { ms: 950, stance: null },
  brace: { ms: 900, stance: null },
  relief: { ms: 1400, stance: null },
  walk: { ms: 1000, stance: 'stand' },
  hop: { ms: 800, stance: null },
  curious: { ms: 1400, stance: null },
  focus: { ms: 1100, stance: null },
  sympathy: { ms: 1800, stance: null },
  idea: { ms: 1350, stance: 'stand' },
};

// Under Reduce motion these show their still pose (the others show the stance they lead to): the
// app's reducedMotion 'still' (data/mobi-choreography.json).
export const STILL_ACTS = [
  'hello', 'cheer', 'celebrate', 'proud', 'correct', 'encourage', 'wake', 'nod', 'tilt', 'wave', 'startle', 'brace', 'relief', 'walk',
  'hop', 'curious', 'focus', 'sympathy', 'idea',
];
const stillSet = new Set(STILL_ACTS);

// Acts that answer a moment and give way: their still pose shows for the act's length, then the
// stance again (the app's MobiMoves.reactions).
export const REACTION_ACTS = [
  'correct', 'encourage', 'wake', 'nod', 'tilt', 'wave', 'startle', 'brace', 'relief', 'walk',
  'hop', 'curious', 'focus', 'sympathy', 'idea',
];
const reactionSet = new Set(REACTION_ACTS);

/** How long (ms) a once act asks callers to wait before it reports done, given whether it moves. */
export function actWait(act, live) {
  const spec = SPEC[act];
  if (!spec || (spec.held && !spec.ms)) return 0;
  if (live) return spec.ms;
  return reactionSet.has(act) ? spec.ms : 0;
}

/**
 * The act he rests in after `act`: the app's stance as a web act ('stand' is idle). `null` when he
 * goes back to whatever he was doing (a nod, a tilt, a startle, a brace, a relief, talking).
 */
export function stanceAfter(act) {
  const spec = SPEC[act];
  if (!spec) return 'idle';
  if (spec.stance === null) return null;
  return spec.stance === 'stand' ? 'idle' : spec.stance;
}

/** The rig stance name for a web act name ('idle' is 'stand'). */
export const rigStance = (act) => (act === 'idle' ? 'stand' : act);

/** What he does and wears for an act under the student's settings. Exported for tests and pages. */
export function resolveAct(act, { celebrations = 'full', reduced = false, still = false } = {}) {
  const known = SPEC[act] ? act : 'idle';
  if (!actAllowed(known, celebrations)) {
    // Quiet keeps the moment as a small nod; Off keeps his stance and plays nothing.
    return celebrations === 'quiet' ? { act: 'nod', live: !(reduced || still) } : { act: 'idle', live: false };
  }
  if ((reduced || still) && !SPEC[known].held && !stillSet.has(known)) {
    // Under Reduce motion an act that is only motion (appear, talk, a shrug) leaves him in his stance.
    return { act: stanceAfter(known) || 'idle', live: false };
  }
  return { act: known, live: !(reduced || still) };
}
