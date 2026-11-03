// Mobi's seat poses, drawn once. A server component: the generated SVG (mobiPoses.generated.js, from the rigged figure the
// app paints, scripts/brand/build-mobi-poses.mjs) is written into the page's HTML a single time and never ships in a script
// chunk. Every seat (Mascot.jsx on "/") is a small <svg><use href="#mbp-think"/></svg> that points here. The wrapper is its
// own .mobi-react scope so the Night/Day palette (mobi-figure.css) and the figure's .mb-d / .mb-n theme parts reach the
// shared shapes. It is zero-sized, not display:none: browsers skip gradients that live inside a display:none <svg>.
// Place it once on the page, after the footer, so the seats' references resolve while nothing above the fold waits for it.
import { MOBI_POSES } from './mobiPoses.generated';
import './mobi-figure.css';

export function MobiPoseSprite() {
  return (
    <span className="mobi-react" aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <svg width="0" height="0" focusable="false" dangerouslySetInnerHTML={{ __html: Object.values(MOBI_POSES).join('') }} />
    </span>
  );
}
