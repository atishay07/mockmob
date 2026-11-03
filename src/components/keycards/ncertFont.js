// The reading face for NCERT's exact words. A card's quote is the book's own language (D202: "that language is what fetches
// them marks"), so it is set like a book: Literata, a serif drawn for long reading on screens, at a comfortable size and
// measure. Everything else on the Key cards screens stays in the app's own faces; the serif only ever means "this is the
// book, word for word". Loaded on the Key cards screens only, never preloaded, so it costs the rest of the app nothing.
import localFont from 'next/font/local';

// Self-hosted (the Fontsource variable latin wght file, v5.3.0, OFL, src/app/fonts/Literata-OFL.txt), so a build never
// fetches Google Fonts.
export const ncertFont = localFont({
  src: '../../app/fonts/Literata-Variable.woff2',
  variable: '--font-ncert',
  display: 'swap',
  weight: '200 900',
  preload: false,
  fallback: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
});
