// Numbers move only when the truth moves (the app's MmNumberMemory, lib/core/widgets/count_up.dart).
// A count with a memoryKey remembers what it last showed, in memory only (never stored): showing
// the same value again draws it at once, with no roll; a new value rolls from the remembered one and
// is tinted while it moves, volt for a rise and dim ink for a fall. 256 keys at most, the oldest go
// first. Clear it on sign-out so the next student never sees the last student's numbers as unchanged.

export const NUMBER_MEMORY_CAPACITY = 256;

const memory = new Map();

/** The value `key` last showed, or undefined. */
export function recallNumber(key) {
  return memory.get(String(key));
}

/** Records that `key` now shows `value` (and makes it the newest key). */
export function rememberNumber(key, value) {
  const k = String(key);
  memory.delete(k);
  memory.set(k, value);
  while (memory.size > NUMBER_MEMORY_CAPACITY) memory.delete(memory.keys().next().value);
}

/** Forgets every number (sign-out, tests). */
export function clearNumberMemory() {
  memory.clear();
}

export function numberMemorySize() {
  return memory.size;
}

/** A number from a value: numbers as they are; text keeps only digits, the point and the minus sign ("1,240 min" is 1240). */
export function numericOf(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Which way a remembered number moved from `from` to `to`: 1 up, -1 down, 0 level or unknown. */
export function numberDirection(from, to) {
  const a = numericOf(from);
  const b = numericOf(to);
  if (a === null || b === null || a === b) return 0;
  return b > a ? 1 : -1;
}

/** The tint name for a direction: 'rise', 'fall' or null. */
export const inkFor = (direction) => (direction > 0 ? 'rise' : direction < 0 ? 'fall' : null);
