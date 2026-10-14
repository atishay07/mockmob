'use client';

// Mobi reacting. One component the whole site shares:
//   <MobiReact act="correct" size={72} label="Correct." onDone={() => ...} />
//
// Mobi is the existing Mascot art, moved with CSS transforms (a body that squashes and hops, a lean
// that sways) with small SVG marks drawn around him (a tick inking itself, thought dots, sparkles,
// confetti, z's). No new raster. Every act answers something the student did or shows a state; it
// never loops for show. Never render him inside the timed NTA exam.
//
// Acts: hello cheer celebrate correct encourage proud read think loading oops point nudge sleepy
//       rest nod tilt wave (and idle: stand at ease).
//   Once acts play and then call onDone: hello wave cheer celebrate correct encourage proud oops nudge nod tilt
//   Held acts keep their stance until the act changes: read think loading point sleepy rest idle
// Settings: Reduce motion holds the pose (the mark that carries information stays, drawn finished).
//   Celebrations: Quiet turns cheer, celebrate and proud into a small nod; Off plays nothing.
// `still` holds the pose without motion, whatever the settings. `label` makes him an image for
// screen readers; leave it out and he is decorative (say the same thing in text beside him).
// To replay the same act, change the component's key.

import { useEffect, useRef } from 'react';
import { Mascot } from './Mascot';
import { MobiMarks } from './MobiMarks';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { MOBI_ACTS, SPEC, resolveAct } from './mobiActs';
import { useInView } from '@/lib/motion/useInView';
import assets from '@/../public/brand/mascot/manifest.json';

export { MOBI_ACTS, resolveAct };

export default function MobiReact({ act = 'idle', size = 96, still = false, label, onDone, facing = 'right', className = '' }) {
  const prefs = useMobiPrefs();
  const resolved = resolveAct(act, { celebrations: prefs.celebrations, reduced: prefs.reduced, still });
  const spec = SPEC[resolved.act];
  const asset = assets[spec.pose] || assets.attentive;
  const ratio = asset.width / asset.height;
  // He only moves while he is on screen, so a screenful of Mobis costs nothing off screen.
  const [seenRef, onScreen] = useInView({ once: false, initial: true, threshold: 0.05 });
  const live = resolved.live && onScreen;
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);

  // A once act reports when it has finished (straight away when nothing moves).
  const once = !spec.held;
  const wait = resolved.live ? spec.ms : 0;
  useEffect(() => {
    if (!once) return undefined;
    const timer = window.setTimeout(() => doneRef.current?.(act), wait);
    return () => window.clearTimeout(timer);
  }, [once, wait, act, resolved.act]);

  return (
    <span
      ref={seenRef}
      className={`mobi-react ${className}`.trim()}
      data-act={resolved.act}
      data-live={live ? 'true' : 'false'}
      data-facing={facing}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      style={{ '--mobi-size': `${size}px`, '--mobi-ar': ratio.toFixed(4), '--mr-dir': facing === 'left' ? -1 : 1 }}
    >
      <span className="mobi-react__shadow" />
      <span className="mobi-react__breath">
        <span className="mobi-react__body" key={`body-${resolved.act}`}>
          <span className="mobi-react__lean" key={`lean-${resolved.act}`}>
            <span className="pip-pose-in" key={spec.pose}><Mascot pose={spec.pose} facing={facing} eager /></span>
          </span>
        </span>
      </span>
      <MobiMarks act={resolved.act} />
    </span>
  );
}
