// The reading face for NCERT's exact words. A card's quote is the book's own language (D202: "that language is what fetches
// them marks"), so it is set like a book: Literata, a serif drawn for long reading on screens, at a comfortable size and
// measure. Everything else on the Key cards screens stays in the app's own faces; the serif only ever means "this is the
// book, word for word". Loaded on the Key cards screens only, never preloaded, so it costs the rest of the app nothing.
import { Literata } from 'next/font/google';

export const ncertFont = Literata({
  variable: '--font-ncert',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  fallback: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
});
