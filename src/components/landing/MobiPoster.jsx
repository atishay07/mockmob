// Mobi's first frame for the home hero, drawn on the server from a generated static SVG (no image bytes, no rig code):
// HeroMobi shows it until MobiReact loads on idle and paints the same frame (scripts/brand/build-mobi-poster.mjs).
// A server component, so the SVG string never ships in a script chunk. Colours come from mobi-figure.css (page.js).
// `id` keeps each copy's gradient and clip ids apart: the page holds two (the phone room's and the desktop host's),
// and a url(#id) that resolves into the hidden copy would paint nothing.
import { MOBI_POSTER_SVG } from './mobiPoster.generated.js';

export function MobiPoster({ id = 'a' }) {
  const html = MOBI_POSTER_SVG.split('mbposter-').join(`mbposter-${id}-`);
  return <span className="mobi-react__look" dangerouslySetInnerHTML={{ __html: html }} />;
}
