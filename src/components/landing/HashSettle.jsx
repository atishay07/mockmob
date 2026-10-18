'use client';

import { useEffect } from 'react';

// Arriving on the landing at /#faq from another page (the footer's Help for guests), the router scrolls before the
// held stories and reveals above have taken their full height, so the questions slid out of view. This brings the
// target back under the nav as the page settles: at once, then again after the sections above have grown.
// Instant jumps only (no smooth scroll to fight), so reduced motion needs nothing extra.
// The student's own scroll, tap or key wins: it stops any settle still waiting.
const SETTLE_MS = [0, 350, 900, 1600];
const DEFAULT_IDS = ['faq'];
const USER_INPUT = ['wheel', 'touchstart', 'keydown', 'pointerdown'];

export function HashSettle({ ids = DEFAULT_IDS }) {
  useEffect(() => {
    const timers = [];
    const stop = () => timers.splice(0).forEach((t) => window.clearTimeout(t));
    const settle = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!ids.includes(id)) return;
      const target = document.getElementById(id);
      if (!target) return;
      stop();
      for (const ms of SETTLE_MS) {
        timers.push(window.setTimeout(() => {
          const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
          const top = Math.round(window.scrollY + target.getBoundingClientRect().top - margin);
          if (Math.abs(window.scrollY - top) > 4) window.scrollTo({ top, behavior: 'instant' });
        }, ms));
      }
    };
    settle();
    window.addEventListener('hashchange', settle);
    USER_INPUT.forEach((type) => window.addEventListener(type, stop, { passive: true }));
    return () => {
      window.removeEventListener('hashchange', settle);
      USER_INPUT.forEach((type) => window.removeEventListener(type, stop));
      stop();
    };
  }, [ids]);
  return null;
}

export default HashSettle;
