'use client';

// The desktop pointer's companion (19 Nov 2026, owner LK333: on desktop "you can easily go way more all out than on mobile
// when adding even the cursor animations, animating cursors, scrolls, and clicks").
//
// A fine pointer that hovers (a mouse, a trackpad) gets a soft ring that trails the arrow, opens over anything that can be
// pressed, and sends one ring out from a click. The arrow itself stays: the ring is an addition, never a replacement, so
// nothing about pointing gets harder. A touch screen, a pen, and a reader who asked for less motion get nothing at all.
//
// Cost: nothing while the pointer rests. One passive pointermove listener records where the arrow is; one animation frame
// loop eases the ring there and stops when it has arrived. Only transform and opacity change (the compositor's work), and
// what is under the arrow is read from the event's own target, never by asking the page to lay itself out.
import { useEffect, useRef } from 'react';

const QUERY = '(hover: hover) and (pointer: fine)';
const PRESSABLE = 'a, button, [role="button"], summary, label, input, select, textarea, [data-press]';
const EASE = 0.22;

export default function DesktopCursor() {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof window === 'undefined') return undefined;
    let fine = null; let calm = null;
    try { fine = window.matchMedia(QUERY); calm = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch { return undefined; }
    let x = 0; let y = 0; let tx = 0; let ty = 0; let frame = 0; let shown = false; let pulse = 0;
    const allowed = () => fine.matches && !calm.matches;
    const place = () => { node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`; };
    const step = () => {
      frame = 0;
      x += (tx - x) * EASE; y += (ty - y) * EASE;
      if (Math.abs(tx - x) < 0.1 && Math.abs(ty - y) < 0.1) { x = tx; y = ty; place(); return; }
      place();
      frame = window.requestAnimationFrame(step);
    };
    const hide = () => { if (shown) { shown = false; node.removeAttribute('data-on'); } };
    const onMove = (event) => {
      if (event.pointerType !== 'mouse' || !allowed()) { hide(); return; }
      tx = event.clientX; ty = event.clientY;
      if (!shown) { shown = true; x = tx; y = ty; place(); }
      const over = event.target instanceof Element && event.target.closest(PRESSABLE) ? 'key' : 'page';
      if (node.getAttribute('data-on') !== over) node.setAttribute('data-on', over);
      if (!frame) frame = window.requestAnimationFrame(step);
    };
    const onDown = (event) => {
      if (event.pointerType !== 'mouse' || !shown) return;
      node.removeAttribute('data-wave');
      window.clearTimeout(pulse);
      // The next frame, so the attribute's removal and return are two style states and the ring runs again.
      window.requestAnimationFrame(() => { node.setAttribute('data-wave', ''); pulse = window.setTimeout(() => node.removeAttribute('data-wave'), 520); });
    };
    const onLeave = () => hide();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(pulse);
    };
  }, []);

  return (
    <div ref={ref} className="lp-cursor" aria-hidden="true">
      <span className="lp-cursor__ring" />
      <span className="lp-cursor__wave" />
    </div>
  );
}
