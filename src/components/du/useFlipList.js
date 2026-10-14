"use client";

// Rows that glide to their new place when a list is filtered or re-sorted, and rise in when they
// are new. Only transform and opacity move. Put the returned ref on the list element; every
// direct child needs data-flip-id. Reduced motion changes nothing. A list of 150 rows or more is
// left alone: measuring that many is not worth a glide.
import { useLayoutEffect, useRef } from 'react';
import { isMotionReduced } from '@/lib/motion/draw';

const MAX_ROWS = 150;
const MAX_MOVERS = 40;

export function useFlipList(signature) {
  const listRef = useRef(null);
  const tops = useRef(new Map());
  const last = useRef(null);

  // No dependency list on purpose: positions are re-read after every commit, so a row that
  // moved because something above it opened is not mistaken for a re-sort later.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const rows = Array.from(list.children).filter((el) => el.dataset?.flipId);
    const now = new Map(rows.map((el) => [el.dataset.flipId, el.offsetTop]));
    const changed = last.current !== null && last.current !== signature;
    last.current = signature;
    if (changed && rows.length <= MAX_ROWS && !isMotionReduced() && typeof rows[0]?.animate === 'function') {
      let moved = 0;
      let entered = 0;
      for (const el of rows) {
        const id = el.dataset.flipId;
        const before = tops.current.get(id);
        if (before == null) {
          if (entered++ < MAX_MOVERS) el.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', delay: Math.min(entered, 8) * 22, fill: 'backwards' });
        } else {
          const dy = before - now.get(id);
          if (dy !== 0 && moved++ < MAX_MOVERS) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
        }
      }
    }
    tops.current = now;
  });

  return listRef;
}
