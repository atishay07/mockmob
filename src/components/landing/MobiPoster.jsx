// Mobi's first frame for the home hero, drawn on the server from a generated static SVG (no image bytes, no rig code):
// HeroMobi shows it until MobiReact loads on idle and paints the same frame (scripts/brand/build-mobi-poster.mjs).
// A server component, so the SVG string never ships in a script chunk. Colours come from mobi-figure.css (page.js).
// Since 1104 the frame is the open-eyed wave's still pose, and the page holds one copy (the desk's, at every width).
// `id` keeps a copy's gradient and clip ids apart from any other Mobi on the page.
import { MOBI_POSTER_SVG } from './mobiPoster.generated.js';

export function MobiPoster({ id = 'a' }) {
  const html = MOBI_POSTER_SVG.split('mbposter-').join(`mbposter-${id}-`);
  return <span className="mobi-react__look" dangerouslySetInnerHTML={{ __html: html }} />;
}
