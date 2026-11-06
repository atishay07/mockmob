// The hero features strip's icons (round 5, owner 6 Nov 2026: the strip's small photographic desk objects "need
// improvement"; they read muddy and inconsistent at 30 to 36 px). One custom-drawn line set instead: a 24 px grid, a
// 1.75 px stroke with round caps and joins in the strip's ink (currentColor), and one small detail an icon in the brand
// accent (--brand-word: volt in Night, the Day text green #526700 in Day). No tile, no fill behind, no glow; each says its
// feature: Unlimited mocks = stacked answer sheets with an infinity mark; Mistake Lab = a magnifier over a cross;
// Score Recovery = a score chart whose line drops, then climbs back past where it started; DU Compass = a compass, its north needle
// in the accent; Ask Mobi = a speech bubble with Mobi's two visor eyes; Key cards = two fanned cards with a turn arrow.
// Data only, so the strip (HeroBeatStrip.jsx) draws it and the tests can check the grid. A part is a path in ink; with
// `accent` it is the accent ('stroke' or 'fill'); with `cut`, the icon's knockout (a gap of GLYPH_GAP around another
// part) is cut out of it, so a part behind reads as behind without a background-coloured fill.
export const GLYPH_GRID = 24;
export const GLYPH_STROKE = 1.75;
export const GLYPH_GAP = 1.25;

export const FEATURE_GLYPHS = {
  // Unlimited mocks: the front sheet, the sheet behind it (up and right), and the infinity mark on the front sheet.
  papers: {
    parts: [
      { d: 'M9 5.75V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2h-.5' },
      { d: 'M5 6.5h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z' },
      { d: 'M9.5 14c-1.05-1.45-1.95-2.15-2.9-2.15a2.15 2.15 0 0 0 0 4.3c.95 0 1.85-.7 2.9-2.15s1.95-2.15 2.9-2.15a2.15 2.15 0 0 1 0 4.3c-.95 0-1.85-.7-2.9-2.15Z', accent: 'stroke' },
    ],
  },
  // Mistake Lab: the lens and its handle, and the cross it finds.
  mistakes: {
    parts: [
      { d: 'M10.5 3.75a6.75 6.75 0 1 1 0 13.5a6.75 6.75 0 0 1 0-13.5Z' },
      { d: 'M15.4 15.4L20.5 20.5' },
      { d: 'M8.5 8.75l4 4M12.5 8.75l-4 4', accent: 'stroke' },
    ],
  },
  // Score Recovery: a score chart's corner; the marks drop, then climb back past where they started.
  revise: {
    parts: [
      { d: 'M3.5 3.5v14a3 3 0 0 0 3 3h14' },
      { d: 'M7.5 8l3.5 4.5 2.75-2.75 2 2' },
      { d: 'M15.75 11.75L20.5 7M17.25 7h3.25v3.25', accent: 'stroke' },
    ],
  },
  // DU Compass: the dial, the needle's south half in ink and its north half in the accent.
  compass: {
    parts: [
      { d: 'M12 2.75a9.25 9.25 0 1 1 0 18.5a9.25 9.25 0 0 1 0-18.5Z' },
      { d: 'M8.1 15.9l1.85-5.95 4.1 4.1Z' },
      { d: 'M15.9 8.1l-1.85 5.95-4.1-4.1Z', accent: 'fill' },
    ],
  },
  // Ask Mobi: a speech bubble, and Mobi's two visor eyes in it.
  mobi: {
    parts: [
      { d: 'M7 4h10a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4h-5.5L7 20.5V17a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z' },
      { d: 'M9.75 9.6v1.8M14.25 9.6v1.8', accent: 'stroke', width: 2.6 },
    ],
  },
  // Key cards: the card behind, fanned left; the card in front; and the arrow that turns it over.
  keycards: {
    cut: 'M12.5 10h5.5a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-5.5a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2Z',
    parts: [
      { d: 'M6.5 7.5h5.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z', transform: 'rotate(-12 9.25 13.5)', cut: true },
      { d: 'M12.5 10h5.5a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-5.5a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2Z' },
      { d: 'M10.25 4A7.5 7.5 0 0 1 19.3 5.2M19 2.72L19.3 5.2L16.82 4.89', accent: 'stroke' },
    ],
  },
};

/** The glyph for a strip feature's icon key (heroTaps.mjs heroFeatures: papers, mistakes, revise, compass, mobi, keycards). */
export function featureGlyph(key) {
  return FEATURE_GLYPHS[key] || null;
}
