import localFont from 'next/font/local';

// The home page's question voice: Literata 600 for every question stem (sample, tour screens, Lab mock screens, exam screen).
// Declared here, not in the root layout, so the face exists on "/" only. Everything else on the page keeps Bricolage and Hanken;
// Geist Mono is not used on the home page. The face is exposed as --font-literata on .mm.lp, and landing.css maps it to --font-stem.
// Not preloaded (paint pass, 15 Nov 2026): no stem is on the first screen at any width (the sample card is below the hero and
// the college strip), and a preload put its 52 KB file in the head next to the stylesheets and the headline's face, delaying
// the first paint on a slow phone. The browser fetches it when a stem is first laid out, well before a reader scrolls to one.
// (Key cards set their own Literata in src/components/keycards/ncertFont.js; that one is unchanged.)
const literata = localFont({
  src: '../../app/fonts/Literata-Variable.woff2',
  display: 'swap',
  weight: '200 900',
  preload: false,
  adjustFontFallback: 'Times New Roman',
  fallback: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
});

export function HomeFonts() {
  return <style>{`.mm.lp{--font-literata:${literata.style.fontFamily}}`}</style>;
}

export default HomeFonts;
