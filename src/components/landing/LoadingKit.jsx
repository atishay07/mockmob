'use client';
// The home page's loading-motion kit (R3-D10, LK112): the rules live in loadingRules.mjs, the drawing in loading-kit.css.
//
//   <CountUp value={16020} />                 a true number that climbs once at 40% in view (the printed value first)
//   <CountUp value={3.3} decimals={2} />      "3.30", for a price per mock
//   <ol className="lk-stagger"> <li style={staggerStyle(i)}> ...    rows that arrive 70 ms apart
//
// No animation library, no scroll listener: one IntersectionObserver per number, removed once it has rolled, and one
// requestAnimationFrame loop while it rolls, writing the text of a span React does not own.
import { useEffect, useRef } from 'react';
import { isMotionReduced } from '@/lib/motion/draw';
import { COUNT_UP, countAt, countPlan, formatCount, staggerDelay } from './loadingRules.mjs';
import './loading-kit.css';

export function CountUp({ value, decimals = 0, locale = 'en-IN', ms = COUNT_UP.ms, share = COUNT_UP.share, className = '' }) {
  const root = useRef(null);
  const live = useRef(null);
  const printed = formatCount(value, { locale, decimals });

  useEffect(() => {
    const node = root.current;
    const out = live.current;
    if (!node || !out || typeof IntersectionObserver === 'undefined') return undefined;
    const target = Number(value);
    let raf = 0;
    let armed = false;
    const write = (n) => { out.textContent = formatCount(n, { locale, decimals }); };
    const settle = () => { delete node.dataset.lk; out.textContent = ''; };
    const roll = () => {
      node.dataset.lk = 'rolling';
      let start = 0;
      const frame = (now) => {
        if (!start) start = now;
        const elapsed = now - start;
        write(countAt(elapsed, { to: target, ms, decimals }));
        if (elapsed < ms) raf = requestAnimationFrame(frame);
        else settle();
      };
      raf = requestAnimationFrame(frame);
    };
    const watch = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      if (!armed) {
        // If the number is already 40% in view, leave it still. Otherwise arm the roll and keep the printed value until it runs.
        if (countPlan({ value: target, ratio: entry.isIntersecting ? entry.intersectionRatio : 0, reduced: isMotionReduced(), share }) === 'show') {
          watch.disconnect();
          return;
        }
        armed = true;
        return;
      }
      if (entry.isIntersecting && entry.intersectionRatio >= share) {
        watch.disconnect();
        roll();
      }
    }, { threshold: [0, share], rootMargin: `0px 0px -${COUNT_UP.below}px 0px` });
    watch.observe(node);
    return () => {
      watch.disconnect();
      cancelAnimationFrame(raf);
      settle();
    };
  }, [value, decimals, locale, ms, share]);

  return (
    <span ref={root} className={`lk-count ${className}`.trim()}>
      {/* The printed value: what a reader without script, a crawler and a screen reader get, and the width the roll keeps. */}
      <span className="lk-count__value">{printed}</span>
      <span ref={live} className="lk-count__live" aria-hidden="true" />
    </span>
  );
}

/** The style for row `i` of a .lk-stagger list. */
export const staggerStyle = (i) => ({ '--lk-delay': `${staggerDelay(i)}ms` });
