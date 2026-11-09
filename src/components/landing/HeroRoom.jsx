'use client';

// The desk's room (1104 "Desk Light"; LK67): the Play app's own painted room behind Mobi, at every width. Phones and
// desktop get the same desk (the room, Mobi in its lamp pool, his bubble, the sample card attached to its foot);
// only the arrangement around it differs. hero-scene.css sizes it (.lp-desk__room).
//
//   Night  the welcome room's band file (scene-welcome-band-night, y 0.20 to 0.95 of the 1296 x 1620 painting),
//          drawn the room's full width and placed so the pinned answer sheet's top row sits 4 px under the room's top
//          edge at any room height (the sheet is the room's mechanic, so it must stay in view).
//   Day    the app's Day room (scene-empty-allclear-day), overscanned to 118 % of the room's width so its feathered
//          edges never show inside the frame.
//
// Both pictures are in the markup with loading="lazy": the other theme's is display: none, which a browser never
// fetches, so a page loads one file (an eager one would fetch both; the theme is the reader's, decided in the browser).
// The shown one is in the first screen at every width and is the page's largest paint, so it asks for high priority.
// It is visible from the server's HTML: a painting that arrives before the page's script has run shows at once (the
// largest paint at 1440 waited for hydration before, 3.4 to 3.8 s at 4x CPU, ship gate 4 Nov); one still loading
// when the script runs is hidden and fades in over 200 ms once decoded. Width, height and the box's own size are set,
// so nothing shifts. Decoration only (alt="", aria-hidden): Mobi, his line and the card carry the meaning.
//
// Night's pinned answer sheet answers the sample, not taps: each answer fills the next of its six empty bubbles in
// volt (data/scene-anchors.json welcome.sheetBubbles, measured from the master), 120 ms after the answer, so the
// room's mechanic means something (decision 13). The Day sheet is already full ("all clear"), so it has no overlay.
// The room breathes once (SceneLife, one 8 s breath) and rests.

import { useEffect, useRef, useState } from 'react';
import anchors from '@/components/scenes/anchors';
import { sceneArt, sceneSrc, sceneSrcSet } from '@/components/scenes/sceneModel.mjs';
import SceneLife from '@/components/scenes/SceneLife';
import { useSceneTheme } from '@/components/scenes/SceneImage';
import { DEMO_STATE_EVENT } from './demoSignal.mjs';

const NIGHT = sceneArt('welcomeBand');
const DAY = sceneArt('allClear', { night: false });
const BUBBLES = anchors.welcome.sheetBubbles;
const PAINT = anchors.welcome.file;
/** Milliseconds after an answer before its bubble fills. */
export const SHEET_FILL_DELAY_MS = 120;

function Picture({ art, sizes, className }) {
  const ref = useRef(null);
  // null: as the server drew it (shown); false: still loading when the script ran (hidden); true: fading in.
  const [ready, setReady] = useState(null);
  useEffect(() => {
    const img = ref.current;
    if (!img || (img.complete && img.naturalWidth)) return undefined;
    setReady(false);
    const done = () => setReady(true);
    img.addEventListener('load', done, { once: true });
    return () => img.removeEventListener('load', done);
  }, []);
  return (
    <picture>
      <source type="image/avif" srcSet={sceneSrcSet(art, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={sceneSrcSet(art, 'webp')} sizes={sizes} />
      <img ref={ref} className={`lp-room__file ${className}`} src={sceneSrc(art, art.widths[0], 'webp')} width={art.width} height={art.height} alt="" loading="lazy" fetchPriority="high" decoding="async" draggable={false} data-ready={ready === null ? undefined : String(ready)} />
    </picture>
  );
}

export function HeroRoom() {
  const theme = useSceneTheme();
  const [filled, setFilled] = useState(0);
  useEffect(() => {
    let timer = 0;
    const onState = (event) => {
      const answered = Number(event.detail?.answered) || 0;
      if (!answered) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setFilled((n) => Math.max(n, Math.min(BUBBLES.centers.length, answered))), SHEET_FILL_DELAY_MS);
    };
    window.addEventListener(DEMO_STATE_EVENT, onState);
    return () => { window.removeEventListener(DEMO_STATE_EVENT, onState); window.clearTimeout(timer); };
  }, []);

  return (
    <div className="lp-room lp-desk__room" aria-hidden="true">
      <div className="lp-room__paint lp-room__paint--night">
        <Picture art={NIGHT} sizes="(max-width: 760px) calc(100vw - 32px), 520px" className="lp-room__file--night" />
        <svg className="lp-room__sheet" viewBox={`0 0 ${PAINT.width} ${PAINT.height}`} preserveAspectRatio="none" focusable="false">
          {BUBBLES.centers.map(([x, y], i) => (
            <circle key={i} className="lp-room__dot" data-on={i < filled ? 'true' : undefined} cx={(x * PAINT.width).toFixed(1)} cy={(y * PAINT.height).toFixed(1)} r={(BUBBLES.r * PAINT.width).toFixed(1)} />
          ))}
        </svg>
        {theme === 'night' ? <SceneLife scene="welcome" night breaths={1} /> : null}
      </div>
      <div className="lp-room__paint lp-room__paint--day">
        {/* 760px: from 1024 px the room stands beside the card and the Day painting is drawn 140 % of its 540 px (r10-sample.css). */}
        <Picture art={DAY} sizes="(max-width: 760px) 118vw, 760px" className="lp-room__file--day" />
        {theme === 'day' ? <SceneLife scene="allClear" night={false} breaths={1} /> : null}
      </div>
    </div>
  );
}
