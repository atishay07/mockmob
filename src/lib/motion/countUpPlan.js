// Where a count-up starts and how long it runs (the app's M15). Pure: useCountUpState plays it.
//
// - The roll takes the countUp token (720 ms, the app's value) on the emphasized curve unless a caller asks otherwise; never under 180 ms.
// - The first time a number is ever shown it rolls from `from` (0 for a "climb"), or shows as it is.
// - Seen before (a memoryKey that remembers): it rolls from the remembered value, and an unchanged value
//   does not roll at all.
// - Later changes roll from whatever is on screen now. Reduced motion, or `enabled: false`: no roll.
import { durations } from './tokens.g.js';

export const COUNT_UP_MIN_MS = 180;

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
