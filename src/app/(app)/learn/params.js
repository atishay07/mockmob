// Small readers for the Learn v2 pages (server only; a plain module, not a route). Next 16 hands a page its params and
// searchParams as Promises of string | string[] | undefined, so every page reads one value through these.

/** The first value of a search param, or '' when it is missing. */
export function one(value) {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' ? v : '';
}

/** A comma list ("a,b,c") as an array of non-empty items, capped. */
export function list(value, max = 200) {
  return one(value).split(',').map((s) => s.trim()).filter(Boolean).slice(0, max);
}

/** Whole minutes between 1 and 120, else the fallback. */
export function minutesOf(value, fallback = null) {
  const n = Number(one(value));
  return Number.isInteger(n) && n >= 1 && n <= 120 ? n : fallback;
}

/** A chapter key as the Key cards decks write it: "<subject>.<chapter-slug>". Anything else is not a chapter. */
const CHAPTER_KEY = /^[a-z0-9_]{1,40}\.[a-z0-9._-]{1,120}$/i;
export function chapterKeyOf(value) {
  let text = one(value);
  if (text.includes('%')) { try { text = decodeURIComponent(text); } catch { return ''; } }
  return CHAPTER_KEY.test(text) ? text : '';
}

/** A run id as the service writes it: letters, digits, dash and underscore. */
export function runIdOf(value) {
  const text = one(value);
  return /^[A-Za-z0-9_-]{6,80}$/.test(text) ? text : '';
}

/** The Learn v2 flag, read the way ExploreCovers reads it: on only when NEXT_PUBLIC_LEARN2 is exactly 'on'. */
export const learn2On = () => process.env.NEXT_PUBLIC_LEARN2 === 'on';
