"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { HERO_PHRASES_V2, MELT, RULE, createHeroCycle, meltBlurScale, meltFrame } from './heroPhrases.mjs';

// ?hero=v3 (D119, 19 Oct 2026): last year's melt on today's headline. The owner remembers April's hero, where the
// changing word melted into the next one (commit 4b2e26da, src/components/ui/morphing-text.jsx: two stacked layers, the
// incoming one from blur(min(8 / f - 8, 100) px) and opacity f^0.4 up to sharp, the outgoing one mirroring it). This is
// that cross-morph, on today's third line, "CUET 2027. / One mock. / <phrase>", over HERO_PHRASES_V2: a 1.0 s melt, a
// 1.2 s hold, a new phrase every 2.2 s. Preview only (HeroLine.jsx); students keep the released line until he picks.
//
// - Only the motion differs from the hero: the same markup classes as the other lines, so the face, size, weight,
//   colours and line positions are today's, in Night and Day.
// - Nothing moves the page: every phrase shares one grid cell and an invisible copy of each phrase holds its size, so
//   the cell is the widest phrase's width and one line high at every width. The two melt layers sit in that same cell.
// - Nothing runs between two melts. A frame loop (requestAnimationFrame) exists only for the 1 s of a melt and is
//   cancelled the moment the line lands; will-change is set on the two layers only while they exist; a phrase at rest is
//   plain text. The cycle (createHeroCycle) is the same settle-and-pause rule as option C: it starts once the hero has
//   settled, loops while the hero is fully on screen and the tab is visible, pauses on scroll, wheel, touch, scroll keys,
//   off screen and in a hidden tab, and starts again after QUIET + READ. A melt under way finishes.
// - A screen reader and a search engine read one stable sentence ("CUET 2027. One mock. No more guessing."); the
//   melting layers are aria-hidden and nothing is announced (no aria-live). Reduce motion (the system's or MockMob's own)
//   shows that one still line, "No more guessing.".
// - Each melt asks the hero's Mobi to glance at the line (PipGuide, 'pip:glance').

const noop = () => () => {};
const useLive = () => useSyncExternalStore(noop, () => true, () => false);
const SCROLL_KEYS = new Set([' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End']);
const RULE_MELT = Object.freeze({ ...RULE, HOLD_MS: MELT.HOLD_MS });

// One layer of the melt at its own fraction; `scale` shrinks last year's px blur to today's type.
function paint(el, layer, scale) {
  if (!el) return;
  el.style.filter = layer.blur > 0.05 ? `blur(${(layer.blur * scale).toFixed(2)}px)` : 'none';
  el.style.opacity = String(layer.opacity);
}

export function HeroMelt({ phrases = HERO_PHRASES_V2 }) {
  const lineRef = useRef(null);
  const cellRef = useRef(null);
  const outRef = useRef(null);
  const inRef = useRef(null);
  const cycleRef = useRef(null);
  const startRef = useRef(0);
  // phase: 'rest' (plain text) or 'melt' (two layers crossing; the frame loop runs)
  const [view, setView] = useState({ cur: 0, prev: -1, n: 0, phase: 'rest' });
  const live = useLive();

  useEffect(() => {
    if (phrases.length < 2) return undefined;
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduced = () => media.matches || root.dataset.motion === 'reduced';
    const cycle = createHeroCycle({
      count: phrases.length,
      rule: RULE_MELT,
      landMs: () => MELT.MORPH_MS,
      onChange: ({ from, to, n }) => {
        startRef.current = performance.now();
        setView({ cur: to, prev: from, n, phase: 'melt' });
        window.dispatchEvent(new CustomEvent('pip:glance', { detail: { station: 'hero' } }));
      },
      onLand: ({ n }) => setView((v) => (v.n === n ? { ...v, prev: -1, phase: 'rest' } : v)),
      onReset: () => setView((v) => ({ cur: 0, prev: -1, n: v.n + 1, phase: 'rest' })),
    });
    cycleRef.current = cycle;

    const input = () => cycle.input();
    const key = (event) => {
      const t = event.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (SCROLL_KEYS.has(event.key)) cycle.input();
    };
    const visibility = () => cycle.setHidden(document.hidden);
    const motion = () => cycle.setReduced(reduced());

    cycle.setReduced(reduced());
    cycle.setHidden(document.hidden);
    const passive = { passive: true };
    for (const type of ['scroll', 'wheel', 'touchstart', 'touchmove']) window.addEventListener(type, input, passive);
    window.addEventListener('keydown', key);
    document.addEventListener('visibilitychange', visibility);
    media.addEventListener('change', motion);
    window.addEventListener('mm-prefs', motion);

    // Fully on screen: the whole line, not just a sliver of it.
    const observer = typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(([entry]) => cycle.setInView(entry.intersectionRatio >= 0.99), { threshold: [0, 0.5, 0.99, 1] });
    if (lineRef.current) {
      if (observer) observer.observe(lineRef.current);
      else cycle.setInView(true);
    }

    // First paint: the browser's own first-contentful-paint entry (the hero's entrance has run since then, even when
    // this chunk arrived later); two frames after mount stand in only where the browser gives no such entry.
    const fcp = () => performance.getEntriesByName?.('first-contentful-paint')?.[0]?.startTime;
    let raf = window.requestAnimationFrame(() => { raf = window.requestAnimationFrame(() => cycle.painted(fcp() ?? performance.now())); });
    let paints = null;
    try {
      paints = new PerformanceObserver((list) => list.getEntries().forEach((e) => { if (e.name === 'first-contentful-paint') cycle.painted(e.startTime); }));
      paints.observe({ type: 'paint', buffered: true });
    } catch { /* an older browser: the two frames stand */ }
    let gone = false;
    (document.fonts?.ready || Promise.resolve()).then(() => { if (!gone) cycle.fontsReady(); });

    return () => {
      gone = true;
      cycle.dispose();
      cycleRef.current = null;
      window.cancelAnimationFrame(raf);
      paints?.disconnect();
      observer?.disconnect();
      for (const type of ['scroll', 'wheel', 'touchstart', 'touchmove']) window.removeEventListener(type, input, passive);
      window.removeEventListener('keydown', key);
      document.removeEventListener('visibilitychange', visibility);
      media.removeEventListener('change', motion);
      window.removeEventListener('mm-prefs', motion);
    };
  }, [phrases]);

  const { cur, prev, n, phase } = view;

  // One melt: set both layers to where the clock says they are before the browser paints them, then run the frame loop
  // until the morph is over. The loop is the only thing that ever runs; it is cancelled when the line lands or on cleanup.
  useLayoutEffect(() => {
    if (phase !== 'melt') return undefined;
    const out = outRef.current;
    const inc = inRef.current;
    if (!out || !inc) return undefined;
    const scale = meltBlurScale(parseFloat(window.getComputedStyle(cellRef.current || inc).fontSize));
    out.style.willChange = 'opacity, filter';
    inc.style.willChange = 'opacity, filter';
    let raf = 0;
    const frame = () => {
      const { f, incoming, outgoing } = meltFrame(performance.now() - startRef.current);
      paint(inc, incoming, scale);
      paint(out, outgoing, scale);
      raf = f < 1 ? window.requestAnimationFrame(frame) : 0;
    };
    frame();
    return () => { if (raf) window.cancelAnimationFrame(raf); };
  }, [n, phase]);

  return (
    <span ref={lineRef} className="lp-title__line lp-morph lp-morph--melt">
      <span className="lp-sr">{phrases[0]}</span>
      <span ref={cellRef} className="lp-morph__cell" aria-hidden="true">
        {live ? phrases.map((p) => <span key={`size-${p}`} className="lp-morph__phrase" data-state="size">{p}</span>) : null}
        {phase === 'melt' ? (
          <>
            <span key={`o${n}`} ref={outRef} className="lp-morph__phrase" data-state="melt-out">{phrases[prev]}</span>
            <span key={`i${n}`} ref={inRef} className="lp-morph__phrase" data-state="melt-in">{phrases[cur]}</span>
          </>
        ) : (
          <span key={`p${n}`} className="lp-morph__phrase" data-state="rest">{phrases[cur]}</span>
        )}
      </span>
    </span>
  );
}
