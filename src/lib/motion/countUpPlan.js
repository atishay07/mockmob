// Where a count-up starts and how long it runs (the app's M15). Pure: useCountUpState plays it.
//
// - The roll takes the countUp token (720 ms, the app's value) on the emphasized curve unless a caller asks otherwise; never under 180 ms.
// - The first time a number is ever shown it rolls from `from` (0 for a "climb"), or shows as it is.
// - Seen before (a memoryKey that remembers): it rolls from the remembered value, and an unchanged value
//   does not roll at all.
// - Later changes roll from whatever is on screen now. Reduced motion, or `enabled: false`: no roll.
import { durations } from './tokens.g.js';

export const COUNT_UP_MIN_MS = 180;

/**
 * The curve a headline count-up (the result's score) rolls on: a name in the token file's curves. Glide (0.15, 0.5, 0.5, 1)
 * over the 720 ms token lands the result's last figures where the lit build's roll did (deploy/1016-batch, about 450 ms
 * visible on a 10-question set) with a longer, calmer tail. Emphasized front-loads the roll: measured on the release 11
 * fixtures it showed 0 to 9 in 60 to 100 ms (owner G31, 19 Oct; tmp/walk-1019/web-fixb/g31).
 */
export const COUNT_UP_CURVE = 'glide';

/**
 * A headline count-up waits for the page to settle before it rolls: a result arrives with its whole page, and frames
 * dropped while it mounts swallowed the first half of the roll (release 11 walk: 0 to 101 of 145 in one frame). The roll
 * starts on the first frame after `frames` frames in a row came within `smoothMs` of each other, or after `maxWaitMs`.
 */
export const COUNT_UP_SETTLE = Object.freeze({ smoothMs: 34, frames: 2, maxWaitMs: 900 });

/** One frame of the settle wait: { since, prev, calm, ready }. Pure, so the rule is tested without a browser. */
export function settleStep(state, now, rule = COUNT_UP_SETTLE) {
  const since = state?.since ?? now;
  const prev = state?.prev ?? null;
  const calm = prev !== null && now - prev <= rule.smoothMs ? (state?.calm || 0) + 1 : 0;
  return { since, prev: now, calm, ready: calm >= rule.frames || now - since >= rule.maxWaitMs };
}

/** { origin, target, span, roll }: roll is false when the value should simply be shown. */
export function planCountUp({ value, first, remembered, from, shown, enabled = true, reduced = false, duration = durations.countUp }) {
  const target = Number(value);
  const span = Math.max(COUNT_UP_MIN_MS, Number.isFinite(duration) ? duration : durations.countUp);
  if (!Number.isFinite(target)) return { origin: value, target: value, span, roll: false };
  let origin;
  if (first) origin = remembered !== undefined && Number.isFinite(Number(remembered)) ? Number(remembered) : (typeof from === 'number' ? from : target);
  else origin = Number(shown);
  const roll = Boolean(enabled) && !reduced && Number.isFinite(origin) && origin !== target;
  return { origin: roll ? origin : target, target, span, roll };
}
