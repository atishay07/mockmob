// Brand switches for the website (web IA plan 7 and N7, N8). All stay off until the owner's Gate A
// look, so they can be flipped without rebuilding pages. Pages read brandFlags(); development
// previews may pass overrides (for example /preview/arena?brand=font,logo,art) to show both sides.
//
//   displayFont  'gabarito' (today) | 'bricolage' (the app's display face, D5)
//   logo         'bolt' (today) | 'b' (logo B, Mobi as the second "o", D17) | 'a' (kept switchable)
//   subjectArt   false | true (the app's 16 photo-real objects, data/subject_art.mjs)
//   heroCopy     'a' ("CUET mocks that show where your marks went.") | 'owner' (the Find, Repair,
//                Prove line; may ship only once the fresh check A.9 is live, N8)

export const BRAND_FLAGS = Object.freeze({
  displayFont: 'gabarito',
  logo: 'bolt',
  subjectArt: false,
  heroCopy: 'a',
});

export const BRAND_FLAG_OPTIONS = Object.freeze({
  displayFont: Object.freeze(['gabarito', 'bricolage']),
  logo: Object.freeze(['bolt', 'b', 'a']),
  subjectArt: Object.freeze([false, true]),
  heroCopy: Object.freeze(['a', 'owner']),
});

// The "on" side of each switch, for the Gate A preview (?brand=font,logo,art,hero).
const ON = Object.freeze({ font: ['displayFont', 'bricolage'], logo: ['logo', 'b'], art: ['subjectArt', true], hero: ['heroCopy', 'owner'] });

/**
 * The flags in force. `overrides` is an object of flag values or a comma list of on-switches
 * ('font,logo,art'). Unknown names and values are ignored, so a bad query can never break a page.
 */
export function brandFlags(overrides = null) {
  const out = { ...BRAND_FLAGS };
  if (!overrides) return Object.freeze(out);
  if (typeof overrides === 'string') {
    for (const word of overrides.split(',').map((w) => w.trim().toLowerCase())) {
      const hit = ON[word];
      if (hit) out[hit[0]] = hit[1];
    }
    return Object.freeze(out);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (BRAND_FLAG_OPTIONS[key]?.includes(value)) out[key] = value;
  }
  return Object.freeze(out);
}

/** The CSS font-family variable the display face uses (set up in src/app/layout.js by IA1). */
export function displayFontVar(flags = BRAND_FLAGS) {
  return flags.displayFont === 'bricolage' ? 'var(--font-bricolage)' : 'var(--font-gabarito)';
}

export const HERO_COPY = Object.freeze({
  a: Object.freeze({
    title: 'CUET mocks that show where your marks went.',
    lead: 'Take a timed mock in your subjects. See which chapters cost you marks, repair each mistake, then practise the weak chapter. Free to start.',
  }),
  // The owner's line. Held until the fresh check ships (Repair v3 A.9); shown beside A at Gate A only.
  owner: Object.freeze({
    title: 'Find the marks you’re losing. Repair the mistake. Prove it on fresh questions.',
    lead: 'Take a timed mock in your subjects. See which chapters cost you marks, repair each mistake, then practise the weak chapter. Free to start.',
    heldUntil: 'fresh check (Repair v3 A.9) is live',
  }),
});
