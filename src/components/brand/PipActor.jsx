'use client';
import { Mascot } from '@/components/brand/Mascot';
import assets from '@/../public/brand/mascot/manifest.json';

// Eye boxes measured from the delivered WebPs (left, top, width, height in % of the art).
// Only the open-eyed poses blink; the lid is drawn in the visor colour over the baked eye,
// so the raster itself is never stretched.
const EYES = {
  greeting: [[35.6, 33.4, 7.6, 11.2], [59.6, 35.2, 8, 11.4]],
  pointing: [[30, 33.4, 7.4, 11], [50.6, 31.8, 6.8, 10.9]],
  encouraging: [[32.1, 33.1, 9, 12.3], [59.4, 31.3, 9.9, 11.4]],
};

export const PIP_POSES = ['greeting', 'attentive', 'thinking', 'pointing', 'celebrating', 'idle', 'encouraging'];
export const pipAspect = (pose) => (assets[pose] || assets.greeting).width / (assets[pose] || assets.greeting).height;

/** Pip as a decorative actor. `blink` re-keys the lids so the CSS blink plays once. */
export function PipActor({ pose = 'greeting', facing = 'right', blink = 0, motion = '', className = '', style }) {
  const eyes = EYES[pose];
  return (
    <span className={`pip-actor ${className}`} data-pose={pose} data-facing={facing} data-motion={motion || undefined} style={{ '--pip-ar': pipAspect(pose), ...style }} aria-hidden="true">
      <span className="pip-art-direction">
        <span className="pip-pose-in" key={pose}><Mascot pose={pose} eager /></span>
        {eyes && blink > 0 ? <span key={`${pose}-${blink}`} className="pip-lids">{eyes.map(([left, top, width, height]) => <i key={left} style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }} />)}</span> : null}
      </span>
    </span>
  );
}
