'use client';

// The phone hero's room (LK32; hero.md items 1, 7, 8, 9, 11): the Play app's own painted welcome room, not a redrawn
// SVG. Phones only (up to 760 px); hero-scene.css lays it out and wider screens never draw it.
//
//   Night  the welcome room (the app's welcome screen), as its band file scene-welcome-band-night (y 0.20 to 0.95 of
//          the 1296 x 1620 painting), drawn W wide so the floor ellipse's centre sits 28 px above the room's foot.
//   Day    the app's Day welcome room (scene-empty-allclear-day), drawn 1.5 W wide and centred, its feathered sides
//          running off the screen (the app's dayGrow 1.5).
//
// Both pictures are in the markup with loading="lazy": the other theme's is display: none, which a browser never
// fetches, so a phone loads one file. Width, height and the box's own size are set, so nothing shifts; each fades in
// over 200 ms once decoded. Decoration only (alt="", aria-hidden): Mobi and his line carry the meaning.
//
// Night's pinned answer sheet answers Mobi's taps: each tap fills the next of six empty bubbles in volt
// (data/scene-anchors.json welcome.sheetBubbles, measured from the master), 120 ms after the tap. The Day sheet is
// already full ("all clear"), so it has no overlay. The room breathes once (SceneLife, one 8 s breath) and rests.

import { useEffect, useRef, useState } from 'react';
import anchors from '@/components/scenes/anchors';
import { sceneArt, sceneSrc, sceneSrcSet } from '@/components/scenes/sceneModel.mjs';
import SceneLife from '@/components/scenes/SceneLife';
import { useSceneTheme } from '@/components/scenes/SceneImage';
import { HERO_TAP_EVENT } from './HeroMobi';

const NIGHT = sceneArt('welcomeBand');
const DAY = sceneArt('allClear', { night: false });
const BUBBLES = anchors.welcome.sheetBubbles;
const PAINT = anchors.welcome.file;

function Picture({ art, sizes, className, onReady }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const img = ref.current;
    if (!img) return undefined;
    const done = () => { setReady(true); onReady?.(); };
    if (img.complete && img.naturalWidth) { done(); return undefined; }
    img.addEventListener('load', done, { once: true });
    return () => img.removeEventListener('load', done);
  }, [onReady]);
  return (
    <picture>
      <source type="image/avif" srcSet={sceneSrcSet(art, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={sceneSrcSet(art, 'webp')} sizes={sizes} />
      <img ref={ref} className={`lp-room__file ${className}`} src={sceneSrc(art, art.widths[0], 'webp')} width={art.width} height={art.height} alt="" loading="lazy" decoding="async" draggable={false} data-ready={ready ? 'true' : 'false'} />
    </picture>
  );
}

export function HeroRoom() {
  const theme = useSceneTheme();
  const [filled, setFilled] = useState(0);
  useEffect(() => {
    let timer = 0;
    const onTap = (event) => {
      const step = event.detail?.step || 0;
      window.clearTimeout(timer);
      // 120 ms after the tap, so the fill lands on the hop's apex.
      timer = window.setTimeout(() => setFilled((n) => Math.max(n, Math.min(BUBBLES.centers.length, step))), 120);
    };
    window.addEventListener(HERO_TAP_EVENT, onTap);
    return () => { window.removeEventListener(HERO_TAP_EVENT, onTap); window.clearTimeout(timer); };
  }, []);

  return (
    <div className="lp-room" aria-hidden="true">
      <div className="lp-room__paint lp-room__paint--night">
        <Picture art={NIGHT} sizes="100vw" className="lp-room__file--night" />
        <svg className="lp-room__sheet" viewBox={`0 0 ${PAINT.width} ${PAINT.height}`} preserveAspectRatio="none" focusable="false">
          {BUBBLES.centers.map(([x, y], i) => (
            <circle key={i} className="lp-room__dot" data-on={i < filled ? 'true' : undefined} cx={(x * PAINT.width).toFixed(1)} cy={(y * PAINT.height).toFixed(1)} r={(BUBBLES.r * PAINT.width).toFixed(1)} />
          ))}
        </svg>
        {theme === 'night' ? <SceneLife scene="welcome" night breaths={1} /> : null}
      </div>
      <div className="lp-room__paint lp-room__paint--day">
        <Picture art={DAY} sizes="150vw" className="lp-room__file--day" />
        {theme === 'day' ? <SceneLife scene="allClear" night={false} breaths={1} /> : null}
      </div>
    </div>
  );
}
