"use client";

import { useEffect, useRef, useState } from 'react';

// Kinetic headline word. Every word sits in the same grid cell, so the cell is
// always as wide as the longest word and nothing around it can move when the
// word changes. Only opacity, blur and a small transform animate. No hover
// behaviour on purpose: an earlier scramble effect re-ran on hover and made the
// headline reflow.
export function MorphWord({ words, interval = 2800, className = '' }) {
  const [active, setActive] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (words.length < 2) return undefined;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;
    let timer;
    const sync = () => {
      window.clearInterval(timer);
      if (!motion.matches && !document.hidden && visible) timer = window.setInterval(() => setActive((i) => (i + 1) % words.length), interval);
    };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    if (ref.current) observer?.observe(ref.current);
    motion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => { window.clearInterval(timer); observer?.disconnect(); motion.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync); };
  }, [words.length, interval]);

  return (
    <span ref={ref} className={`lp-morph ${className}`}>
      <span className="lp-sr">{words[0]}</span>
      {words.map((word, i) => (
        <span key={word} className="lp-morph__word" data-active={i === active} aria-hidden="true">
          {word}
        </span>
      ))}
    </span>
  );
}
