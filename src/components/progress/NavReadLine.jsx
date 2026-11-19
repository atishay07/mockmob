'use client';

// The home page's reading line (owner, 16 Nov 2026): a hairline along the bottom edge of the sticky site bar that fills
// from the left as the reader goes down the page (none at the top, full at the end). Drawn by CSS where the browser has
// scroll-driven animations (nav-read.css, animation-timeline: scroll(root)), so it costs the main thread nothing; where it
// has not, one passive, frame-throttled scroll listener sets two transforms. It follows the finger, so it stays under
// Reduce motion. Decorative (aria-hidden). Placed by NavBar.jsx on "/" only.
//
// 19 Nov 2026 (owner LK340: inside the Mistake Lab the page's line and the story's own rule sat 40 px apart, "the
// self-slider, I think, is green and the top one is black but this color difference is not visible to me ... making the
// main scroller on the top some sort of unique animation so that it's visible"). On a wide window the page's line now
// carries a rider: Mobi, as he stands in the wordmark, sits on the head of the line and travels the bar with the reader,
// leaning the way the page is going and standing up when it stops. A phone has had him on its bottom bar since R3; this
// is the same idea for the window that has the band instead. The story's rule under the band stays a plain rule, so the
// two are told apart by what they are, not by a shade. No drawing tool (LK317): he is the brand's own mark.
import { useEffect, useRef } from 'react';
import { LOGO_B_MOBI } from '@/components/brand/logoB';
import * as bus from '@/components/landing/scrollBus.mjs';
import './nav-read.css';

const MOBI = LOGO_B_MOBI.small;
const MOBI_BOX = '3392 -552 608 610';
/** How long after the last moved frame he stands up again, ms. */
export const RIDER_SETTLE_MS = 170;

export default function NavReadLine() {
  const ref = useRef(null);

  // The fallback where the browser has no scroll-driven animations: the line and the rider by hand.
  useEffect(() => {
    const root = ref.current;
    const line = root?.querySelector('.mm-nav__read-line');
    const run = root?.querySelector('.mm-nav__read-run');
    if (!line || !run) return undefined;
    try {
      if (typeof CSS !== 'undefined' && CSS.supports('animation-timeline: scroll()')) return undefined;
    } catch { /* an old browser: draw it by hand */ }
    let frame = 0;
    const draw = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      line.style.transform = `scaleX(${p.toFixed(4)})`;
      run.style.transform = `translateX(${((p - 1) * 100).toFixed(3)}%)`;
      run.style.opacity = p > 0.012 ? '1' : '0';
    };
    const ask = () => { if (!frame) frame = window.requestAnimationFrame(draw); };
    draw();
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', ask, { passive: true });
    return () => {
      window.removeEventListener('scroll', ask);
      window.removeEventListener('resize', ask);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  // The rider leans the way the page is going (one attribute, written only when the direction changes or the page
  // stops; the lean itself is a CSS transition). From the page's one shared scroll read. Not under Reduce motion.
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    let calm = null;
    try { calm = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch { return undefined; }
    let last = window.scrollY; let way = ''; let timer = 0;
    const settle = () => { way = ''; root.removeAttribute('data-way'); };
    const off = bus.subscribe(({ y }) => {
      const moved = y - last; last = y;
      if (!moved || calm.matches || document.documentElement.getAttribute('data-motion') === 'reduced') return;
      const now = moved > 0 ? 'down' : 'up';
      if (now !== way) { way = now; root.setAttribute('data-way', now); }
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, RIDER_SETTLE_MS);
    });
    return () => { off(); window.clearTimeout(timer); root.removeAttribute('data-way'); };
  }, []);

  return (
    <span ref={ref} className="mm-nav__read" aria-hidden="true">
      <span className="mm-nav__read-clip"><span className="mm-nav__read-line" /></span>
      <span className="mm-nav__read-run">
        <svg className="mm-nav__read-mobi" viewBox={MOBI_BOX} width="20" height="20" focusable="false">
          <path className="mm-nav__read-body" d={MOBI.body} />
          <path className="mm-nav__read-visor" d={MOBI.visor} />
          <path className="mm-nav__read-eyes" d={MOBI.eyes} />
        </svg>
      </span>
    </span>
  );
}
