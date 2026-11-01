// The home hero's headline (R3 ruling H1, 1 Nov 2026): one static sentence, "CUET 2027. One mock. Know what to fix."
// Pure, so node --test can hold the words (heroLines.test.mjs) and page.js renders them.
//
// It used to cycle its third line (typed, melted, traced). The owner ruled it static: Mobi's taps carry the
// reactions (heroTaps.mjs), not the headline. So there is no typing, no caret, no cycling line and no highlight
// here, and nothing in the hero's motion touches the h1 but the one entrance rise (hero-scene.css).
//
// "Know what to fix." is true: chapter review names the chapter to fix first, and the free SWOT gives the sets to do
// next (data/mock_swot.js). The first line keeps the accent colour (.lp-title__brand).

export const HERO_LINES = Object.freeze(['CUET 2027.', 'One mock.', 'Know what to fix.']);
/** What a screen reader and a search engine read: the headline as one sentence. */
export const HERO_SENTENCE = HERO_LINES.join(' ');
