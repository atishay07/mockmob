"use client";

import { useEffect, useRef } from 'react';

// Layered hero backdrop: hairline grid, a dot matrix aligned to the grid
// intersections, and a second volt dot layer revealed only under the pointer.
// The static layers are pure CSS. The pointer layer is a progressive
// enhancement: it runs only for a fine pointer with motion allowed, updates two
// CSS variables on one rAF, and never touches layout.
export function HeroBackdrop() {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    const host = node?.parentElement;
    if (!node || !host) return undefined;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || calm) return undefined;

    let frame = 0;
    let x = 0;
    let y = 0;

    function paint() {
      frame = 0;
      node.style.setProperty('--mx', `${x}px`);
      node.style.setProperty('--my', `${y}px`);
    }
    function onMove(event) {
      const rect = host.getBoundingClientRect();
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
      node.dataset.live = 'true';
      if (!frame) frame = requestAnimationFrame(paint);
    }
    function onLeave() {
      node.dataset.live = 'false';
    }

    host.addEventListener('pointermove', onMove, { passive: true });
    host.addEventListener('pointerleave', onLeave);
    return () => {
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className="lp-bg" aria-hidden="true" data-live="false">
      <div className="lp-bg__aurora" />
      <div className="lp-bg__grid" />
      <div className="lp-bg__dots" />
      <div className="lp-bg__spot" />
      <div className="lp-bg__fade" />
    </div>
  );
}
