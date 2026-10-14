// What each Mobi act is: the pose he wears, how long a once act runs, and what the student's
// Celebrations and Reduce motion settings turn it into. Pure data and pure functions, so it is
// tested without a browser (data/tests/mobi_kit.test.mjs, data/tests/mobi_choreography.test.mjs).
//
// The act list, the durations, the held flag, the reduced-motion set and the stance an act leaves
// him in are the app's (flutter_app lib/core/mascot/mobi_acts.dart, MobiMoves). Change them there
// first, then here: data/mobi-choreography.json is what the two test suites share.
import { actAllowed } from '../../lib/mobiPrefs.js';

// The 26 acts (idle, standing at ease, is the 27th and is not an act he is asked to do).
export const MOBI_ACTS = [
  'appear', 'hello', 'talk', 'cheer', 'celebrate', 'think', 'point', 'sleepy', 'oops', 'rest', 'read',
  'correct', 'encourage', 'loading', 'sleep', 'nudge', 'proud', 'listen', 'wake',
  'nod', 'tilt', 'wave', 'startle', 'brace', 'relief', 'walk',
];

// pose: which raster pose he wears (there are seven). ms: how long a once act runs, the app's
// MobiMoves.duration in milliseconds. held: he stays in it until the next act. stance: what he is
// left in after the act (the app's MobiStance: stand, point, think, sleepy, rest, read, loading,
// sleep, listen), or null when he goes back to whatever he was doing (a nod, a tilt, a startle do
// not change what he is doing). lids: how far the lids come down over the eyes (0 to 1), drawn in
// CSS over the open-eyed pose. nudge is held: two jabs, then he keeps the point.
export const SPEC = {
  idle: { pose: 'attentive', held: true, stance: 'stand' },
  appear: { pose: 'attentive', ms: 750, stance: 'stand' },
  hello: { pose: 'greeting', ms: 1850, stance: 'stand' },
  talk: { pose: 'attentive', ms: 1600, stance: null },
  cheer: { pose: 'celebrating', ms: 1200, stance: 'stand' },
  celebrate: { pose: 'celebrating', ms: 2000, stance: 'stand' },
  think: { pose: 'thinking', held: true, stance: 'think' },
  point: { pose: 'pointing', held: true, stance: 'point' },
  sleepy: { pose: 'attentive', held: true, stance: 'sleepy', lids: 0.55 },
  oops: { pose: 'attentive', ms: 1300, stance: 'stand' },
  rest: { pose: 'idle', held: true, stance: 'rest' },
  read: { pose: 'attentive', held: true, stance: 'read' },
  correct: { pose: 'celebrating', ms: 1150, stance: 'stand' },
  encourage: { pose: 'encouraging', ms: 1450, stance: 'stand' },
  loading: { pose: 'thinking', held: true, stance: 'loading' },
  sleep: { pose: 'idle', held: true, stance: 'sleep' },
  nudge: { pose: 'pointing', ms: 1050, held: true, stance: 'point' },
  proud: { pose: 'celebrating', ms: 2200, stance: 'stand' },
  listen: { pose: 'attentive', held: true, stance: 'listen' },
  wake: { pose: 'attentive', ms: 1200, stance: 'stand' },
  nod: { pose: 'attentive', ms: 800, stance: null },
  tilt: { pose: 'attentive', ms: 1100, stance: null },
  wave: { pose: 'greeting', ms: 1500, stance: 'stand' },
  startle: { pose: 'celebrating', ms: 950, stance: null },
  brace: { pose: 'attentive', ms: 900, stance: null },
  relief: { pose: 'idle', ms: 1400, stance: null },
  walk: { pose: 'attentive', ms: 1000, stance: 'stand' },
};

// Under Reduce motion these show their still pose (the others show the stance they lead to): the
// app's reducedMotion 'still' (data/mobi-choreography.json).
export const STILL_ACTS = ['hello', 'cheer', 'celebrate', 'proud', 'correct', 'encourage', 'wake', 'nod', 'tilt', 'wave', 'startle', 'brace', 'relief', 'walk'];
const stillSet = new Set(STILL_ACTS);

// Acts that answer a moment and give way: their still pose shows for the act's length, then the
// stance again (the app's MobiMoves.reactions).
export const REACTION_ACTS = ['correct', 'encourage', 'wake', 'nod', 'tilt', 'wave', 'startle', 'brace', 'relief', 'walk'];
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
