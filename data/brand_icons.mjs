// MockMob's branded icon set (R7 packet I, LK60; docs/brain/learn-1031/r7/I-ICONS.md). One desk object per meaning, each a
// square transparent webp in two sizes under public/art/icons/: <name>-96.webp and <name>-192.webp (sharp at 3x for 64 px).
// The object is centred in its square with a little air, so every icon sits on the same optical box.

export const BRAND_ICON_SIZES = [96, 192];

export const BRAND_ICONS = Object.freeze({
  keycards: { meaning: 'Key cards' },
  questions: { meaning: 'Questions' },
  mistakes: { meaning: 'Your mistakes' },
  lesson: { meaning: 'Lesson' },
  print: { meaning: 'Print sheet' },
  revise: { meaning: 'Revise' },
  feeds: { meaning: 'Chapter feeds' },
  saved: { meaning: 'Saved' },
  papers: { meaning: 'Your papers' },
  compass: { meaning: 'Admission Compass' },
  today: { meaning: 'Today' },
  mob: { meaning: 'Mob' },
  you: { meaning: 'You' },
});

export const BRAND_ICON_NAMES = Object.freeze(Object.keys(BRAND_ICONS));

/** The file for a drawn size: the 96 px file up to 48 px boxes at 2x, else the 192 px one. */
export function brandIconSrc(name, size = 40) {
  if (!BRAND_ICONS[name]) return null;
  return `/art/icons/${name}-${size <= 48 ? 96 : 192}.webp`;
}

export function brandIconSrcSet(name) {
  if (!BRAND_ICONS[name]) return undefined;
  return BRAND_ICON_SIZES.map((w) => `/art/icons/${name}-${w}.webp ${w}w`).join(', ');
}
