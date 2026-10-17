"use client";

import { useEffect, useRef } from 'react';

// How fast the page is moving: one passive scroll listener shared by every Reveal (no frame loop), in px per ms
// between the last two scroll events, and zero once the page has been still for PACE_STILL_MS.
const PACE_FAST = 2.5; // a fling or a hard wheel; reading scrolls stay well under this
const PACE_STILL_MS = 120;
const SNAP_MS = 700;
const pace = { y: 0, t: -Infinity, v: 0, users: 0 };
const onPace = (event) => {
  const t = event.timeStamp > 0 ? event.timeStamp : performance.now();
  const y = window.scrollY;
  const dt = t - pace.t;
  pace.v = dt > 0 && dt < 250 ? Math.abs(y - pace.y) / dt : 0;
  pace.y = y;
  pace.t = t;
};
function watchPace(on) {
  pace.users += on ? 1 : -1;
  if (on && pace.users === 1) {
    pace.y = window.scrollY;
    window.addEventListener('scroll', onPace, { passive: true });
  } else if (!on && pace.users === 0) window.removeEventListener('scroll', onPace);
}
const paceNow = () => (performance.now() - pace.t > PACE_STILL_MS ? 0 : pace.v);

// Scroll choreography without an animation library. All motion lives in CSS, keyed off data-in, and only
// ever animates opacity and transform so nothing reflows. The server HTML carries no data-in, so the content is
// visible before any script runs (and without JavaScript). After mount a Reveal is armed (data-in="false",
// hidden) only if it is still wholly below the window, and flips to "true" once it enters; one already on screen
// (or above it) is marked "true" at once, so it never blinks out and back in.
// Reached at speed (a fling, a hard wheel, a jump) or from above, it also gets
// data-snap for a moment: the same entrance, short and without its stagger, so
// the page never settles on half-faded content that is still arriving.
// Reduced motion shows everything immediately.
export function Reveal({ as: Tag = 'div', className = '', delay = 0, threshold = 0.12, children, ...rest }) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    // Reduced motion is handled in CSS (everything is visible, nothing transitions). Without
    // IntersectionObserver, or when the content is already on screen or above it, show it outright.
    const below = node.getBoundingClientRect().top >= window.innerHeight;
    if (!below || window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined') {
      node.dataset.in = 'true';
      return undefined;
    }
    node.dataset.in = 'false';
    let snapTimer = 0;
    let pacing = true;
    watchPace(true);
    const stopPace = () => { if (pacing) { pacing = false; watchPace(false); } };
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.find((item) => item.isIntersecting);
        if (!entry) return;
        const fromAbove = entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0);
        if (fromAbove || paceNow() > PACE_FAST) {
          node.dataset.snap = 'true';
          snapTimer = window.setTimeout(() => { delete node.dataset.snap; }, SNAP_MS);
        }
        node.dataset.in = 'true';
        observer.disconnect();
        stopPace();
      },
      { threshold, rootMargin: '0px 0px -5% 0px' }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      stopPace();
      window.clearTimeout(snapTimer);
      delete node.dataset.snap;
    };
  }, [threshold]);

  return (
    <Tag
      ref={ref}
      className={`rv ${className}`}
      style={{ '--d': `${delay}ms` }}
      onFocusCapture={(event) => { event.currentTarget.dataset.in = 'true'; }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
