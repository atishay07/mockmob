"use client";

import { useEffect, useRef, useState } from 'react';

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

// Scroll choreography without an animation library. The wrapper flips
// data-in once it enters the viewport; all motion lives in CSS, keyed off that
// attribute, and only ever animates opacity and transform so nothing reflows.
// Reached at speed (a fling, a hard wheel, a jump) or from above, it also gets
// data-snap for a moment: the same entrance, short and without its stagger, so
// the page never settles on half-faded content that is still arriving.
// Reduced motion shows everything immediately. A <noscript> rule in the page
// keeps content visible without JavaScript.
export function Reveal({ as: Tag = 'div', className = '', delay = 0, threshold = 0.12, children, ...rest }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    // Reduced motion is handled in CSS (everything is visible, nothing
    // transitions). Without IntersectionObserver, show the content outright.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      node.dataset.in = 'true';
      return undefined;
    }
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
        setInView(true);
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
      data-in={inView ? 'true' : 'false'}
      style={{ '--d': `${delay}ms` }}
      onFocusCapture={() => setInView(true)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
