/**
 * IST day-boundary helpers.
 * MockMob is India/CUET/DU focused — daily limits are computed against IST,
 * not UTC, so a battle taken at 11pm IST doesn't unlock another one 30 min
 * later just because UTC ticked over.
 *
 * IST = UTC+05:30, no DST.
 */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** Returns the start-of-day timestamp (epoch ms) in IST for a given Date|number. */
export function istDayStart(input = new Date()) {
  const ts = input instanceof Date ? input.getTime() : Number(input) || Date.now();
  // Shift into IST, floor to day, shift back to UTC.
  const shifted = ts + IST_OFFSET_MS;
  const floored = Math.floor(shifted / 86_400_000) * 86_400_000;
  return floored - IST_OFFSET_MS;
}

/** ISO string at the start of today (IST), used as a SQL filter lower bound. */
export function istDayStartISO(input = new Date()) {
  return new Date(istDayStart(input)).toISOString();
}

/** Returns "YYYY-MM-DD" in IST. */
export function istDayKey(input = new Date()) {
  const ts = input instanceof Date ? input.getTime() : Number(input) || Date.now();
  const shifted = new Date(ts + IST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
