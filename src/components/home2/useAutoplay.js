'use client';

// The two self-advancing frames' clock and holds (rules: autoplay.mjs). One IntersectionObserver for "on screen", the page's
// visibility event for "tab visible", the system setting and html[data-motion] for "reduced". The line that fills on the active
// row IS the clock: a CSS transform animation, paused by data-play, whose end calls advance(). The only timer is the 8 s hold
// after a tap.
import { useCallback, useEffect, useRef, useState } from 'react';
import { TOUCH_HOLD_MS, autoplayRuns, holdKind, keyStep, motionReduced, nextIndex } from './autoplay.mjs';

export function useAutoplay(count) {
  const regionRef = useRef(null);
  const tabRefs = useRef([]);
  const holdTimer = useRef(0);
  const pointerType = useRef('mouse');
  const [index, setIndex] = useState(0);
  // Bumped whenever the active row's line must start again from empty (a new row, a release); it keys the line's element.
  const [cycle, setCycle] = useState(0);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  // The frame's first demo waits until the section has been on screen once (it would otherwise play far below the reader).
  const [seen, setSeen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [hold, setHold] = useState(null);

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const read = () => setReduced(motionReduced(window));
    // Read a frame later (no state is set inside the effect's own pass); "ready" follows in the same frame.
    const first = window.requestAnimationFrame(() => { read(); setReady(true); });
    query?.addEventListener?.('change', read);
    const watch = typeof MutationObserver === 'undefined' ? null : new MutationObserver(read);
    watch?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    return () => { window.cancelAnimationFrame(first); query?.removeEventListener?.('change', read); watch?.disconnect(); };
  }, []);

  useEffect(() => {
    const node = regionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') { setOnScreen(true); setSeen(true); return undefined; }
    // "On screen" means the frame is in the middle band of the window, not a sliver at its edge.
    const io = new IntersectionObserver(([entry]) => {
      setOnScreen(entry.isIntersecting);
      if (entry.isIntersecting) setSeen(true);
    }, { rootMargin: '-18% 0px -18% 0px' });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const read = () => setVisible(document.visibilityState !== 'hidden');
    read();
    document.addEventListener('visibilitychange', read);
    return () => document.removeEventListener('visibilitychange', read);
  }, []);

  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

  const release = useCallback(() => {
    window.clearTimeout(holdTimer.current);
    setHold(null);
    setCycle((c) => c + 1);
  }, []);

  const choose = useCallback((to, kind) => {
    setIndex(to);
    setCycle((c) => c + 1);
    setHold(kind);
    window.clearTimeout(holdTimer.current);
    if (kind === 'touch') holdTimer.current = window.setTimeout(release, TOUCH_HOLD_MS);
  }, [release]);

  const advance = useCallback(() => {
    setIndex((i) => nextIndex(i, count));
    setCycle((c) => c + 1);
  }, [count]);

  const playing = autoplayRuns({ ready, reduced, onScreen, visible, held: hold !== null });

  const region = {
    ref: regionRef,
    onPointerDownCapture: (event) => { pointerType.current = event.pointerType; },
    onPointerLeave: (event) => { if (event.pointerType === 'mouse' && hold === 'mouse') release(); },
    onBlur: (event) => { if (hold === 'keyboard' && !event.currentTarget.contains(event.relatedTarget)) release(); },
  };

  const tab = (i) => ({
    ref: (node) => { tabRefs.current[i] = node; },
    onClick: (event) => choose(i, holdKind(event.detail, pointerType.current)),
    onKeyDown: (event) => {
      const to = keyStep(event.key, i, count);
      if (to === null) return;
      event.preventDefault();
      choose(to, 'keyboard');
      tabRefs.current[to]?.focus();
    },
  });

  /** The line's own animationend: only its own end (not a child's) moves the frame on. */
  const lineEnd = (event) => { if (event.target === event.currentTarget && playing) advance(); };

  return { index, cycle, ready, reduced, seen, playing, hold, region, tab, lineEnd };
}
