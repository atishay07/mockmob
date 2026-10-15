// The rig drawn for an act when nothing is moving: the server render, the first frame before the sim
// starts, and Reduce motion (the app's settledPose, with the mood laid over it). Pure.
import { SPEC } from './mobiActs.js';
import { applyMood } from './mobiRig.js';

/**
 * `live`: the frame before his motion starts, which is the stance he starts from (a held act's own,
 * else standing at ease). Otherwise his still pose for the act (the act's key pose for a reaction or a
 * celebration, no travel; a held act gives its stance).
 */
export function poseRig(moves, book, act, mood = 'calm', { live = false, pointAngle = 1.5, pointSide = 1 } = {}) {
  const spec = SPEC[act] || SPEC.idle;
  const base = live
    ? moves.stance(spec.held ? spec.stance : 'stand', { pointAngle, pointSide })
    : moves.settledPose(SPEC[act] ? act : 'idle', { pointAngle, pointSide });
  return applyMood(book, mood, base);
}
