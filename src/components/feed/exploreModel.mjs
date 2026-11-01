// Pure rules of Learn v2's Explore page (R2 ruling 11, LK24, LK26), held by exploreModel.test.mjs. No React here.

/** How many single questions show under the covers before "More questions" (R2 ruling 11: 3, not 12). */
export const FIRST_SHOWN = 3;
/** How many more each press of "More questions" shows. */
export const MORE_STEP = 6;

export const firstShown = () => FIRST_SHOWN;
export const moreShown = (n) => Math.max(FIRST_SHOWN, Number(n) || 0) + MORE_STEP;

/**
 * The head's Saved key: "Saved 2" drawn as the word and the number; a zero or an unknown count draws the word alone (never
 * "Saved 0"). `spoken` gives its screen-reader name ("Saved questions, 2").
 */
export function savedLabel(count, { spoken = false } = {}) {
  const n = Number(count);
  const has = Number.isFinite(n) && n > 0;
  if (spoken) return has ? `Saved questions, ${n.toLocaleString('en-IN')}` : 'Saved questions';
  return has ? `Saved ${n.toLocaleString('en-IN')}` : 'Saved';
}
