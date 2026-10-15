"use client";

import { useEffect, useRef, useState } from 'react';

// Kinetic phrase. Every phrase sits in the same grid cell, so the cell is always as wide as the longest one and
// nothing around it moves when it changes. The leaving phrase lifts away while the next one rises into place;
// only opacity and transform animate. The first phrase is in the server HTML, visible at first paint, and the
// cycle starts only once the page is interactive, on screen, in a visible tab and with motion allowed.
// Screen readers get one stable sentence (label) instead of a phrase that keeps changing.
export function MorphWord({ words, interval = 2600, className = '', label }) {
  const [{ active, prev }, setTurn] = useState({ active: 0, prev: -1 });
  const ref = useRef(null);

  useEffect(() => {
    if (words.length < 2) return undefined;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reducedByChoice = () => document.documentElement.dataset.motion === 'reduced';
    let visible = true;
    let timer;
    const step = () => setTurn(({ active: i }) => ({ active: (i + 1) % words.length, prev: i }));
    const sync = () => {
      window.clearInterval(timer);
      if (!motion.matches && !reducedByChoice() && !document.hidden && visible) timer = window.setInterval(step, interval);
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
      <span className="lp-sr">{label || words[0]}</span>
      {words.map((word, i) => (
        <span key={word} className="lp-morph__word" data-active={i === active} data-state={i === active ? 'in' : i === prev ? 'out' : 'idle'} aria-hidden="true">
          {word}
        </span>
      ))}
    </span>
  );
}
