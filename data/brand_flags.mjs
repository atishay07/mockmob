// Brand switches for the website. The owner approved both at the Gate A brand look (15 Oct 2026), so they
// ship on; the switch stays so either can be rolled back in one line without touching a page.
//
//   displayFont  'bricolage' (the app's display face: headings, numbers, moments) | 'gabarito' (before)
//   subjectArt   true (the app's photo-real, lamp-lit subject objects, data/subject_art.mjs) | false (line icons)
//
// The logo is not a switch: logo B is the only mark (owner, 15 Oct: "remove that bolt mark and all the old
// logo"). It lives in src/components/Logo.jsx.

export const BRAND_FLAGS = Object.freeze({
  displayFont: 'bricolage',
  subjectArt: true,
});

export const BRAND_FLAG_OPTIONS = Object.freeze({
  displayFont: Object.freeze(['bricolage', 'gabarito']),
  subjectArt: Object.freeze([true, false]),
});

/**
 * The flags in force, with optional overrides (an object of flag values). Unknown names and values are
 * ignored, so a bad override can never break a page.
 */
export function brandFlags(overrides = null) {
  const out = { ...BRAND_FLAGS };
  if (overrides && typeof overrides === 'object') {
    for (const [key, value] of Object.entries(overrides)) {
      if (BRAND_FLAG_OPTIONS[key]?.includes(value)) out[key] = value;
    }
  }
  return Object.freeze(out);
}
