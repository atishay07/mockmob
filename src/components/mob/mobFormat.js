// Small words and times for the Mob screens: 12-hour IST, relative where it helps, no arrows, no exclamation marks.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "42s", "1m 11s", "2m". Whole seconds, as the paper clock shows them. */
export function secLabel(seconds) {
  const s = Math.max(0, Math.round(Number(seconds)));
  if (!Number.isFinite(s)) return '';
  if (s < 60) return `${s}s`;
  return s % 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s / 60}m`;
}

/** "12 Oct" from a Monday date key (YYYY-MM-DD). */
export function dayLabel(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
  if (!m) return '';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] || ''}`.trim();
}

/** "Week of 12 Oct". */
export const weekLabel = (key) => (dayLabel(key) ? `Week of ${dayLabel(key)}` : 'This week');

export const countLabel = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** How many times an answer was changed: "Changed once", "Changed 2 times". */
export const changedLabel = (n) => (n === 1 ? 'Changed once' : `Changed ${n} times`);

/** The right way to say what a pick was: letter plus a word, so colour is never the only signal. */
export const verdictWord = (row) => (row.picked === null ? 'No answer' : row.right === true ? 'Right' : row.right === false ? 'Wrong' : '');
