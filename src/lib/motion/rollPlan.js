// The app's monumental number roll, as a plan the web plays (flutter_app lib/core/widgets/monumental_number.dart).
//
// Each digit has its own fixed-width slot and rolls up into it: a column of the digits it passes through moves up until
// the last one sits in the slot. On the first show a slot rolls up from 0 (a 0 arrives from the 9 below it, so every
// slot moves); when the value changes a slot rolls on from the digit it showed, wrapping through 9 to 0, and an unchanged
// digit stays still. Digit i of n starts 8% of the roll after the one before it (never later than 40%) and every slot
// lands together, 500 ms (the numberRoll token) after the roll starts, on the emphasized curve. Pure: RollNumber.jsx plays
// it, roll-number.test.mjs checks it against the app's numbers.
import { durations, ease } from './tokens.g.js';

export const ROLL = Object.freeze({
  /** The whole roll (the app's Motion.numberRoll). */
  ms: durations.numberRoll,
  /** Each slot starts this share of the roll after the one before it ... */
  stepShare: 0.08,
  /** ... and never later than this share. */
  maxStartShare: 0.4,
  /** Every slot travels on the app's emphasized curve. */
  easing: ease.emphasized,
});

export const isDigit = (ch) => typeof ch === 'string' && ch.length === 1 && ch >= '0' && ch <= '9';

/**
 * The digits a slot shows on its way to `digit`, first to last. From `from` when the value changed (wrapping 9 to 0),
 * else from 0; 0 itself arrives from 9, so every slot moves on a first roll. An unchanged digit is one cell (no travel).
 */
export function rollCells(digit, from = null) {
  const d = Number(digit);
  if (from === null || from === undefined) return d === 0 ? [9, 0] : Array.from({ length: d + 1 }, (_, i) => i);
  const f = Number(from);
  if (f === d) return [d];
  const steps = (((d - f) % 10) + 10) % 10;
  return Array.from({ length: steps + 1 }, (_, i) => (f + i) % 10);
}

/**
 * The roll of `value` ("183", "4.5"): one entry per character. A digit gets { ch, digit, cells, delay, duration }, with
 * delay and duration in ms from the moment the roll starts; anything else is { ch } and is drawn as it is. `previous` is
 * the value shown before (null: from zero); its digits are right-aligned to these, so 171 to 183 moves three slots a
 * little. `delay` holds the whole roll (the app's delay). `landsIn` is when the last slot lands.
 */
export function planRoll(value, { previous = null, delay = 0, ms = ROLL.ms } = {}) {
  const chars = [...String(value ?? '')];
  const n = chars.filter(isDigit).length;
  const before = previous === null || previous === undefined ? null : [...String(previous)].filter(isDigit).map(Number);
  let index = 0;
  const slots = chars.map((ch) => {
    if (!isDigit(ch)) return { ch };
    const i = index;
    index += 1;
    let from = null;
    if (before) {
      const j = before.length - (n - i);
      from = j >= 0 ? before[j] : null;
    }
    const start = n <= 1 ? 0 : Math.min(i * ROLL.stepShare, ROLL.maxStartShare) * ms;
    return { ch, digit: Number(ch), cells: rollCells(Number(ch), from), delay: delay + start, duration: ms - start };
  });
  return { slots, landsIn: delay + ms, moves: slots.some((s) => s.cells && s.cells.length > 1) };
}

/** How far a column of `count` cells travels, as a share of its own height (CSS translate percentages). */
export const travelShare = (count) => (count <= 1 ? 0 : (count - 1) / count);
