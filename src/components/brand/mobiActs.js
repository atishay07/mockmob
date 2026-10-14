// What each Mobi act is: the pose he wears, how long a once act runs, and what the student's
// Celebrations and Reduce motion settings turn it into. Pure data and one pure function, so it is
// tested without a browser (data/tests/mobi_kit.test.mjs).
import { actAllowed } from '../../lib/mobiPrefs.js';

export const MOBI_ACTS = ['hello', 'cheer', 'celebrate', 'correct', 'encourage', 'proud', 'read', 'think', 'loading', 'oops', 'point', 'nudge', 'sleepy', 'rest', 'nod', 'tilt', 'wave'];

// pose: which of the existing poses he wears. ms: how long a once act runs. held: stays after.
export const SPEC = {
  idle: { pose: 'attentive', held: true },
  hello: { pose: 'greeting', ms: 1850 },
  wave: { pose: 'greeting', ms: 1250 },
  cheer: { pose: 'celebrating', ms: 1200 },
  celebrate: { pose: 'celebrating', ms: 2000 },
  proud: { pose: 'celebrating', ms: 2200 },
  correct: { pose: 'celebrating', ms: 1500 },
  encourage: { pose: 'encouraging', ms: 1450 },
  oops: { pose: 'attentive', ms: 1300 },
  nod: { pose: 'attentive', ms: 640 },
  tilt: { pose: 'attentive', ms: 900 },
  nudge: { pose: 'pointing', ms: 1050 },
  read: { pose: 'attentive', held: true },
  think: { pose: 'thinking', held: true },
  loading: { pose: 'thinking', held: true },
  point: { pose: 'pointing', held: true },
  sleepy: { pose: 'idle', held: true },
  rest: { pose: 'idle', held: true },
};

/** What he does and wears for an act under the student's settings. Exported for tests and pages. */
export function resolveAct(act, { celebrations = 'full', reduced = false, still = false } = {}) {
  const known = SPEC[act] ? act : 'idle';
  if (!actAllowed(known, celebrations)) {
    // Quiet keeps the moment as a small nod; Off keeps his stance and plays nothing.
    return celebrations === 'quiet' ? { act: 'nod', live: !(reduced || still) } : { act: 'idle', live: false };
  }
  return { act: known, live: !(reduced || still) };
}

