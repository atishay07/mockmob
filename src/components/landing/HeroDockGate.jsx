'use client';

import { useEffect, useRef } from 'react';

// The landing's phone action bar waits its turn. On the first screen the hero's own buttons and the demo
// question already offer "try a question", so the bar stays down until the hero buttons (.lp-cta) have
// scrolled away, and steps aside again while the demo (#try-practice) holds the screen. It rises on the
// app's out curve and leaves on the leave curve (hero-depth.css). Focus inside the bar always shows it.
// Without IntersectionObserver it simply shows. The state is written straight to data-shown, so scrolling
// never re-renders anything.
const NAV = 64;
const DOCK = 96;
const DEMO_MIN_PX = 96;

export function HeroDockGate({ children }) {
  const gate = useRef(null);

  useEffect(() => {
    const node = gate.current;
    if (!node) return undefined;
    const cta = document.querySelector('.lp-hero .lp-cta');
    const demo = document.getElementById('try-practice');
    const show = (on) => { node.dataset.shown = on ? 'true' : 'false'; };
    if (typeof IntersectionObserver === 'undefined' || (!cta && !demo)) { show(true); return undefined; }
    const state = { cta: Boolean(cta), demo: Boolean(demo) };
    const update = () => show(!state.cta && !state.demo);
    const band = `-${NAV}px 0px -${DOCK}px 0px`;
    const ctaWatch = new IntersectionObserver((entries) => {
      state.cta = entries[entries.length - 1].isIntersecting;
      update();
    }, { rootMargin: band, threshold: 0 });
    // The demo counts as on screen while a real part of it shows (it reaches DEMO_MIN_PX into the band between
    // the nav and the bar), not a sliver at an edge.
    const demoWatch = new IntersectionObserver((entries) => {
      state.demo = entries[entries.length - 1].isIntersecting;
      update();
    }, { rootMargin: `-${NAV + DEMO_MIN_PX}px 0px -${DOCK + DEMO_MIN_PX}px 0px`, threshold: 0 });
    if (cta) ctaWatch.observe(cta);
    if (demo) demoWatch.observe(demo);
    return () => { ctaWatch.disconnect(); demoWatch.disconnect(); };
  }, []);

  return <div ref={gate} className="lp-dockgate" data-shown="false">{children}</div>;
}

export default HeroDockGate;
