'use client';

// A box whose looping motion stops while it is off screen (21 Nov 2026 speed pass, owner LK353: "it should easily work on even a
// cheap Rs 15,000 Chromebook"). The college strip's two marquees ran for the whole visit, and every running animation keeps the
// browser restyling and re-layering the page on each frame it draws, so while a slow phone scrolled the rest of the page they
// cost it frames it could not spare. The box carries data-offscreen while no part of it is on screen and the sheet pauses its
// loops under that attribute (college-strip.css); nobody can see a loop that is off screen, so nothing changes to the eye.
// The server's HTML is the same box without the attribute; without IntersectionObserver the loops simply run.
import { useEffect, useRef } from 'react';

export function PauseOffscreen({ className, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      if (entry.isIntersecting) delete node.dataset.offscreen;
      else node.dataset.offscreen = 'true';
    }, { threshold: 0 });
    io.observe(node);
    return () => { io.disconnect(); delete node.dataset.offscreen; };
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}

export default PauseOffscreen;
