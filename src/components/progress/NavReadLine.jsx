'use client';

// The home page's reading line (owner, 16 Nov 2026): a 2 px ink hairline along the bottom edge of the sticky site bar that
// fills from the left as the reader goes down the page (none at the top, full at the end). Drawn by CSS where the browser
// has scroll-driven animations (nav-read.css, animation-timeline: scroll(root)), so it costs the main thread nothing; where
// it has not, one passive, frame-throttled scroll listener sets one transform. It follows the finger, so it stays under
// Reduce motion. Decorative (aria-hidden). Placed by NavBar.jsx on "/" only.

import { useEffect, useRef } from 'react';
import './nav-read.css';

export default function NavReadLine() {
  const ref = useRef(null);
  useEffect(() => {
    const line = ref.current?.firstElementChild;
    if (!line) return undefined;
    try {
      if (typeof CSS !== 'undefined' && CSS.supports('animation-timeline: scroll()')) return undefined;
    } catch { /* an old browser: draw it by hand */ }
    let frame = 0;
    const draw = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      line.style.transform = `scaleX(${p.toFixed(4)})`;
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
  return (
    <span ref={ref} className="mm-nav__read" aria-hidden="true">
      <span className="mm-nav__read-line" />
    </span>
  );
}
