'use client';
import { Mascot } from '@/components/brand/Mascot';
import assets from '@/../public/brand/mascot/manifest.json';

import { EYES } from './mobiEyes';

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
