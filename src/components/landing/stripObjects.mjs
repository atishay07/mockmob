// The hero features strip's desk objects (round 5, owner 6 Nov 2026, LK160: the drawn line icons "are honestly a regression
// ... rather than the 3D-generated icons"; back to the brand's 3D objects, made better than the round 4 strip). Each feature
// shows the desk object that already means it on this page, so the object that greets a student in the strip is the one
// that stamps the section the link opens (BRAND_STAMPS, homeCopy.mjs) or, for mocks, the tour's Practice slide (TOUR_ICON):
//   Unlimited mocks: questions, an answer sheet with filled bubbles and a pencil: the page's picture of a mock. (Round 4 drew
//     `papers`, a lined pad under a clip, which reads as a notepad and sat beside three other cream rectangles.)
//   Mistake Lab: mistakes, a paper strip torn and mended with lime tape (the Mistake Lab's stamp).
//   Score Recovery: revise, index cards held tight by a lime band: fix it once, check it holds (the Recovery Lab's stamp).
//   DU Compass: compass, a brass pocket compass with a lime needle (the Compass section's stamp).
//   Ask Mobi: Mobi himself, the 3D figure the app's own Ask doors use (greeting), not the flat face mark.
//   Key cards: keycards, a short stack of index cards with a lime felt tab (the Key cards section's stamp).
// The files are cut from the brand's own art by scripts/brand/build-strip-objects.mjs (no generation): trimmed, one visual
// weight, one baseline, a soft contact shadow baked in, at 96, 144 and 192 px wide in a 12:11 box, so 2x and 3x screens get a
// file made for them. Data only: HeroBeatStrip.jsx draws them and homeHero.test.mjs checks the files.

/** The files' widths (px) and the box the strip draws them in (css px at the 16 px root; hero-scene.css .lp-strip__obj). */
export const STRIP_OBJECT_WIDTHS = Object.freeze([96, 144, 192]);
export const STRIP_OBJECT_BOX = Object.freeze({ width: 48, height: 44 });
/** Where every object stands in its box: css px from the top of the 48 x 44 box (the files' shared baseline). */
export const STRIP_OBJECT_BASE = 40.5;

/** The objects, by the strip's icon keys (heroTaps.mjs heroFeatures), and what each is. */
export const STRIP_OBJECTS = Object.freeze({
  questions: Object.freeze({ object: 'an answer sheet with filled bubbles and a pencil', source: 'R7 sheet A' }),
  mistakes: Object.freeze({ object: 'a paper strip torn and mended with lime tape', source: 'R7 sheet A' }),
  revise: Object.freeze({ object: 'index cards held by a lime band', source: 'R7 sheet A' }),
  compass: Object.freeze({ object: 'a brass pocket compass with a lime needle', source: 'R7 sheet B' }),
  mobi: Object.freeze({ object: 'Mobi, waving (his greeting render)', source: 'public/brand/mascot/greeting.webp' }),
  keycards: Object.freeze({ object: 'index cards with a lime felt tab', source: 'R7 sheet A' }),
});

/** The file for one width, or null for a key the strip has no object for. */
export function stripObjectSrc(key, width = STRIP_OBJECT_WIDTHS[0]) {
  return STRIP_OBJECTS[key] ? `/art/icons/strip/${key}-${width}.webp` : null;
}

/** The srcset: every width, so a phone at 2x takes the 96 px file and at 3x the 144 px one. */
export function stripObjectSrcSet(key) {
  return STRIP_OBJECTS[key] ? STRIP_OBJECT_WIDTHS.map((w) => `${stripObjectSrc(key, w)} ${w}w`).join(', ') : undefined;
}

/**
 * The sizes attribute: the box's drawn width (hero-scene.css .lp-strip__obj): 3rem, 2.75rem three across from 1400 px, then
 * 2.5rem on the 18, 22 and 28 px roots of large screens (landing.css). In px: a sizes length is read at the 16 px default.
 */
export const STRIP_OBJECT_SIZES = '(min-width: 3400px) 70px, (min-width: 2560px) 55px, (min-width: 1400px) 45px, 48px';
