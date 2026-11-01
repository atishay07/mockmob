'use client';
// The study stage's pager (BUILD-1101 B1, A1 3.7): one item per item-area height in a track moved with translate3d, never
// native scroll-snap. Touch follows the finger 1:1 and moves one item past 18% or at 0.35 px/ms; one wheel gesture moves one
// item; an item's own scroller owns a gesture that starts where it can still move (the edge rule). Keys belong to the screen
// (pagerModel.keyAction), which calls `go`. The rules are pure in pagerModel.mjs.
//
//   const { height, moving } = usePager({ rootRef, viewRef, trackRef, index, count, go, enabled })
//     rootRef   the element that takes wheel and touch (the whole stage, so the margins work too)
//     viewRef   the item area (its height is one page; it gets --area in px)
//     trackRef  the track (height 100% of the view; pages at top: calc(p * 100%))
//     index     the page shown; count the number of pages; go(i) asks the screen to show page i
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PAGER, wheelState, wheelStep, rubber, releaseVelocity, releaseTarget, touchLock, scrollerThatCanMove } from './pagerModel.mjs';

const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const styleOf = (el) => { try { return getComputedStyle(el); } catch { return null; } };

export function usePager({ rootRef, viewRef, trackRef, index, count, go, enabled = true }) {
  const [height, setHeight] = useState(0);
  const live = useRef({ index, count, go, enabled, height: 0 });
  const moving = useRef(false);
  const timer = useRef(0);
  const shown = useRef(null);

  useEffect(() => { live.current = { ...live.current, index, count, go, enabled }; }, [index, count, go, enabled]);

  const place = useCallback((i, dy, animate) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = animate ? `transform ${PAGER.ms}ms ${PAGER.ease}` : 'none';
    // Each page is the view less the peek (R2 ruling 7: the next item's top always shows above the action bar).
    track.style.transform = `translate3d(0, calc(${-i} * (100% - var(--st-peek, 0px)) + ${Math.round(dy)}px), 0)`;
  }, [trackRef]);

  // The page changes: the track moves in 320 ms (reduced motion: at once, with a 120 ms cross-fade).
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) { shown.current = null; return; }
    const first = shown.current === null;
    const changed = shown.current !== index;
    shown.current = index;
    if (first || !changed) { place(index, 0, false); return; }
    if (reduced()) {
      place(index, 0, false);
      try { track.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 120, easing: 'linear' }); } catch { /* no WAAPI */ }
      return;
    }
    moving.current = true;
    place(index, 0, true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { moving.current = false; }, PAGER.ms);
  }, [index, place, trackRef, enabled]);
  useEffect(() => () => clearTimeout(timer.current), []);

  // The item area's height: one page, and the 18% the release rule measures against.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const h = Math.round(entry.contentRect.height);
      live.current.height = h;
      view.style.setProperty('--area', `${h}px`);
      setHeight(h);
    });
    ro.observe(view);
    return () => ro.disconnect();
  }, [viewRef, enabled]);

  // Wheel and touch on the whole stage.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let wheel = wheelState();
    let touch = null;
    const ignored = (el) => Boolean(el?.closest?.('[data-pager-ignore]'));

    const onWheel = (e) => {
      const L = live.current;
      if (!L.enabled || ignored(e.target)) return;
      const dir = Math.sign(e.deltaY);
      const inner = dir ? scrollerThatCanMove(e.target, dir, root, styleOf) : null;
      const r = wheelStep(wheel, { dy: e.deltaY, dx: e.deltaX, mode: e.deltaMode, t: e.timeStamp, ctrl: e.ctrlKey, page: L.height, inner: Boolean(inner), moving: moving.current });
      wheel = r.state;
      if (r.prevent && e.cancelable) e.preventDefault();
      if (r.move) {
        const next = Math.max(0, Math.min(L.count - 1, L.index + r.move));
        if (next !== L.index) L.go(next);
      }
    };

    const onStart = (e) => {
      const L = live.current;
      if (!L.enabled || e.touches.length !== 1 || ignored(e.target)) { touch = null; return; }
      const p = e.touches[0];
      touch = { x0: p.clientX, y0: p.clientY, dy: 0, mode: null, target: e.target, samples: [{ t: e.timeStamp, y: p.clientY }] };
    };
    const onMove = (e) => {
      if (!touch) return;
      const L = live.current;
      const p = e.touches[0];
      const dx = p.clientX - touch.x0;
      const dy = p.clientY - touch.y0;
      if (!touch.mode) {
        const lock = touchLock(dx, dy);
        if (lock === 'tap') return;
        if (lock === 'side') touch.mode = 'side';
        else touch.mode = scrollerThatCanMove(touch.target, dy < 0 ? 1 : -1, root, styleOf) ? 'native' : 'pager';
      }
      if (touch.mode !== 'pager') return;
      if (e.cancelable) e.preventDefault();
      touch.dy = dy;
      touch.samples.push({ t: e.timeStamp, y: p.clientY });
      if (touch.samples.length > 12) touch.samples.shift();
      place(L.index, rubber(dy, L.index, L.count), false);
    };
    const onEnd = () => {
      if (!touch) return;
      const t = touch;
      touch = null;
      if (t.mode !== 'pager') return;
      const L = live.current;
      const target = releaseTarget({ dy: t.dy, v: releaseVelocity(t.samples), height: L.height || window.innerHeight, index: L.index, count: L.count });
      if (target !== L.index) L.go(target);
      else place(L.index, 0, !reduced());
    };

    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchmove', onMove, { passive: false });
    root.addEventListener('touchend', onEnd, { passive: true });
    root.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchmove', onMove);
      root.removeEventListener('touchend', onEnd);
      root.removeEventListener('touchcancel', onEnd);
    };
  }, [rootRef, place, enabled]);

  return { height, moving };
}
