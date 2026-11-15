import localFont from 'next/font/local';

// The home page's question voice: Literata 600 for every question stem (sample, tour screens, Lab mock screens, exam screen).
// Declared here, not in the root layout, so next/font preloads the 52 KB variable file on "/" only (4 Nov, decision 16: Literata
// preloaded on / only). Everything else on the page keeps Bricolage and Hanken; Geist Mono is not used on the home page.
// The face is exposed as --font-literata on .mm.lp, and landing.css maps it to --font-stem.
const literata = localFont({
  src: '../../app/fonts/Literata-Variable.woff2',
  display: 'swap',
  weight: '200 900',
  preload: true,
  adjustFontFallback: 'Times New Roman',
  fallback: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
});

export function HomeFonts() {
  return <style>{`.mm.lp{--font-literata:${literata.style.fontFamily}}`}</style>;
}

export default HomeFonts;
