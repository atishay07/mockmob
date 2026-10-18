"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { HERO_PHRASES_V2, TYPE, caretKeyframes, createHeroCycle, phraseWords, typingSchedule } from './heroPhrases.mjs';

// The headline's third line, option C, "select and type" (G30; D112 C-pick 3; HERO-MOTION-1019.md). Behind a flag
// until the owner has seen it live (D115, HeroLine.jsx).
//
// One change: the old line is selected from its end back to its start, held a beat, then replaced by the new line
// typed at a natural rhythm behind a solid brand-colour caret; the caret blinks twice after the last letter and leaves.
// The letters, the selection and the replace are CSS keyframes (hero-motion.css, timed by --t from typingSchedule);
// only the caret is a Web Animation, because it rides measured letter edges (measured again on resize and font swap).
//
// When it changes (createHeroCycle, heroPhrases.mjs): only once the first screen has settled (fonts ready, the hero's
// entrance done, 1.2 s with no scroll, the line fully on screen, the tab visible), 1.8 s after that, then each line
// holds 3 s. Any scroll pauses the cycle; a change already under way finishes. One lap through the set, back to "No
// more guessing.", and it rests there for good. Reduce motion (the system's or MockMob's own): that one line, still.
//
// - Nothing moves the page: every phrase shares one grid cell, and once the page is live an invisible copy of every
//   phrase sits in that cell too, so its size is the largest phrase's. The selection and the caret are positioned
//   absolutely, and a phrase at rest is plain, kerned text (CLS stays 0).
// - A screen reader and a search engine read one stable sentence ("No more guessing."); the moving letters are
//   hidden from them and nothing is announced (no aria-live).
// - Each change asks the hero's Mobi to glance at the line (PipGuide, 'pip:glance').

const noop = () => () => {};
const useLive = () => useSyncExternalStore(noop, () => true, () => false);
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const SCROLL_KEYS = new Set([' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End']);

function Typed({ text, onLanded }) {
  const { times } = typingSchedule(text);
  const last = Array.from(text).length - 1;
  // Only the last letter's end counts: by then every letter has landed.
  const ended = (event) => {
    if (event.animationName === 'lp-type-letter' && event.target.dataset?.last === 'true') onLanded();
  };
  return (
    <span className="lp-morph__phrase" data-state="type" onAnimationEnd={ended}>
      {phraseWords(text).map((word, w) => {
        const space = word[0].i - 1;
        return (
          <Fragment key={w}>
            {w > 0 ? <span className="lp-morph__ch" style={{ '--t': `${times[space]}ms` }}>{' '}</span> : null}
            <span className="lp-morph__word">
              {word.map(({ ch, i }) => (
                <span key={i} className="lp-morph__ch" data-last={i === last ? 'true' : undefined} style={{ '--t': `${times[i]}ms` }}>{ch}</span>
              ))}
            </span>
          </Fragment>
        );
      })}
    </span>
  );
}

export function HeroType({ phrases = HERO_PHRASES_V2 }) {
  const lineRef = useRef(null);
  const cellRef = useRef(null);
  const wrapRef = useRef(null);
  const caretRef = useRef(null);
  const cycleRef = useRef(null);
  const animsRef = useRef(null);
  // phase: 'rest' (plain text), 'type' (selecting and typing), 'tail' (landed; the caret blinks and leaves)
  const [view, setView] = useState({ cur: 0, prev: -1, n: 0, phase: 'rest' });
  const live = useLive();

  useEffect(() => {
    if (phrases.length < 2) return undefined;
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduced = () => media.matches || root.dataset.motion === 'reduced';
    const cycle = createHeroCycle({
      count: phrases.length,
      onChange: ({ from, to, n }) => {
        setView({ cur: to, prev: from, n, phase: 'type' });
        window.dispatchEvent(new CustomEvent('pip:glance', { detail: { station: 'hero' } }));
      },
      onLand: ({ n }) => setView((v) => (v.n === n ? { ...v, prev: -1, phase: 'tail' } : v)),
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

    // First paint: the later of two frames after mount and the browser's own first-contentful-paint entry.
    let raf = window.requestAnimationFrame(() => { raf = window.requestAnimationFrame(() => cycle.painted(performance.now())); });
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

  // One change: measure the letters once they are laid out (still invisible), then start the caret on the same frame
  // as the CSS letters. Measured again on resize and once the fonts settle, keeping its place in time.
  useIsoLayoutEffect(() => {
    if (phase !== 'type') return undefined;
    const cell = cellRef.current;
    const wrap = wrapRef.current;
    const caret = caretRef.current;
    if (!cell || !wrap || !caret || typeof caret.animate !== 'function') return undefined;
    const schedule = typingSchedule(phrases[cur]);
    const measure = () => {
      const base = cell.getBoundingClientRect();
      const out = cell.querySelector('.lp-morph__phrase[data-state="select"]');
      const outW = out ? out.getBoundingClientRect().width : 0;
      const chars = [...cell.querySelectorAll('.lp-morph__phrase[data-state="type"] .lp-morph__ch')];
      const top = chars.length ? chars[0].getBoundingClientRect().top : 0;
      const edges = chars.map((c) => { const r = c.getBoundingClientRect(); return { x: r.right - base.left, y: r.top - top }; });
      return { outW, edges };
    };
    const { outW, edges } = measure();
    const ride = (w) => [{ transform: `translateX(${w}px)` }, { transform: 'translateX(0)' }];
    const wrapAnim = wrap.animate(ride(outW), { duration: TYPE.SELECT_MS, easing: TYPE.SELECT_EASE, fill: 'both' });
    const { keyframes, duration } = caretKeyframes(schedule, edges);
    const caretAnim = caret.animate(keyframes, { duration, easing: 'linear', fill: 'both' });
    animsRef.current = { wrapAnim, caretAnim };
    const mine = n;
    caretAnim.finished.then(() => setView((v) => (v.n === mine && v.phase === 'tail' ? { ...v, phase: 'rest' } : v)), () => {});

    // While typing, the letters give the edges; once landed (plain text again), the line's own right edge does.
    const remeasure = () => {
      if (caretAnim.playState === 'finished' || caretAnim.playState === 'idle') return;
      const m = measure();
      if (m.edges.length === 0) {
        const rest = cell.querySelector('.lp-morph__phrase[data-state="rest"]');
        if (!rest) return;
        const x = rest.getBoundingClientRect().right - cell.getBoundingClientRect().left;
        m.edges = schedule.times.map(() => ({ x, y: 0 }));
      }
      wrapAnim.effect?.setKeyframes?.(ride(m.outW));
      caretAnim.effect?.setKeyframes?.(caretKeyframes(schedule, m.edges).keyframes);
    };
    window.addEventListener('resize', remeasure);
    let gone = false;
    document.fonts?.ready?.then(() => { if (!gone) remeasure(); });

    // The landing comes from the last letter's animationend. A browser that never ends it (no CSS animations) lands
    // after LAND_FALLBACK_MS, but never while a letter is still running or held paused.
    let fallback = 0;
    const check = () => {
      if (gone) return;
      const lastLetter = cell.querySelector('.lp-morph__phrase[data-state="type"] .lp-morph__ch[data-last="true"]');
      if (!lastLetter) return; // already landed
      const pending = lastLetter.getAnimations?.().some((a) => a.playState === 'running' || a.playState === 'paused');
      if (pending) { fallback = window.setTimeout(check, 500); return; }
      cycleRef.current?.landed();
    };
    fallback = window.setTimeout(check, schedule.land + TYPE.LAND_FALLBACK_MS);
    return () => {
      gone = true;
      window.clearTimeout(fallback);
      window.removeEventListener('resize', remeasure);
    };
  }, [n]);

  // Reduce motion or a reset mid-change: the caret's animations go with it.
  useEffect(() => {
    if (phase === 'rest' && animsRef.current) {
      animsRef.current.wrapAnim.cancel();
      animsRef.current.caretAnim.cancel();
      animsRef.current = null;
    }
  }, [phase]);

  const landed = () => cycleRef.current?.landed();

  return (
    <span ref={lineRef} className="lp-title__line lp-morph lp-morph--type">
      <span className="lp-sr">{phrases[0]}</span>
      <span ref={cellRef} className="lp-morph__cell" aria-hidden="true">
        {live ? phrases.map((p) => <span key={`size-${p}`} className="lp-morph__phrase" data-state="size">{p}</span>) : null}
        {phase === 'type' && prev >= 0 ? (
          <span key={`o${n}`} className="lp-morph__phrase" data-state="select"><span className="lp-morph__sel" />{phrases[prev]}</span>
        ) : null}
        {phase === 'type'
          ? <Typed key={`p${n}`} text={phrases[cur]} onLanded={landed} />
          : <span key={`p${n}`} className="lp-morph__phrase" data-state="rest">{phrases[cur]}</span>}
        {phase !== 'rest' ? (
          <span key={`c${n}`} ref={wrapRef} className="lp-morph__caretwrap"><span ref={caretRef} className="lp-morph__caret" /></span>
        ) : null}
      </span>
    </span>
  );
}
