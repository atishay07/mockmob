"use client";

// The sideways-scroll cue for a row of choices (owner G27, 19 Oct 2026: "add some kind of leading horizontal scroll ... so
// that people know that they have to horizontally scroll. Right now there is a blur on the side, so it's kind of obvious,
// but not exactly"). Three parts, used by the Start sheet's subject rail, the Practice page's subject shelf and Review's
// subject filter:
//
//   peek    while the row overflows, its items share one width chosen so the last item in view is cut at about 60% of its
//           width (never below the widest item's own content, never wider than `max`). An item cut that way reads as
//           "there is more", where a whole item and an empty edge read as the end of the row.
//   nudge   the first time the row is seen on this device it slides 24 px toward the hidden items and settles back
//           (300 ms out on the ease-out curve, 460 ms back on the settle curve), once, after the surface has landed. A
//           touch, wheel or scroll before then cancels it. Reduced motion: no nudge at all.
//   edges   overflow / at-start / at-end, for the edge fade and the chevron hint the surface draws.
//
// The row is the scroller; its items are its element children matching `items`.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PEEK, peekWidth } from './railPeek.mjs';

export { PEEK, peekWidth };

export const NUDGE_PX = 24;
export const NUDGE_OUT_MS = 300;
export const NUDGE_BACK_MS = 460;
const EDGE_PX = 2;
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const SETTLE = 'cubic-bezier(0.22, 1, 0.36, 1)';

export function reducedMotion() {
  try {
    return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return true; }
}

const itemsOf = (el, selector) => [...el.children].filter((node) => node.matches(selector));

/** Measure the row and set (or clear) --rail-item-w and data-peek on it. Returns the width set, or null. */
export function fitPeek(el, { items, min = 'content', max = Infinity, peek = PEEK, endInset = 0 } = {}) {
  if (!el) return null;
  const list = itemsOf(el, items);
  el.style.removeProperty('--rail-item-w');
  delete el.dataset.peek;
  if (list.length < 2) return null;
  const cs = getComputedStyle(el);
  const gap = parseFloat(cs.columnGap) || 0;
  const padStart = parseFloat(cs.paddingLeft) || 0;
  const padEnd = parseFloat(cs.paddingRight) || 0;
  // Natural widths: does the row overflow at all? Layout widths (offsetWidth), so a surface mid-entrance (scaled) measures
  // the same as one at rest.
  const natural = list.map((node) => node.offsetWidth);
  const total = natural.reduce((sum, w) => sum + w, 0) + gap * (list.length - 1);
  const room = el.clientWidth - padStart - padEnd;
  if (!el.clientWidth || total <= room + EDGE_PX) return null;
  // The narrowest an item may be: its own content on the fewest lines that keep every word whole.
  let floor = typeof min === 'number' ? min : 0;
  if (min === 'content' || typeof min !== 'number') {
    for (const node of list) {
      const before = node.style.width;
      node.style.width = 'min-content';
      floor = Math.max(floor, node.offsetWidth);
      node.style.width = before;
    }
  }
  const inset = typeof endInset === 'function' ? endInset() : endInset;
  const avail = el.clientWidth - padStart - (inset || 0);
  const w = peekWidth({ avail, gap, n: list.length, min: Math.ceil(floor), max, peek });
  if (!w) return null;
  el.style.setProperty('--rail-item-w', `${w}px`);
  el.dataset.peek = '';
  return w;
}

/** Slide the row's items 24 px toward the hidden ones and back, once. Returns a cancel function. */
export function nudgeRow(el, { items, px = NUDGE_PX, also = [] } = {}) {
  if (!el || reducedMotion()) return () => {};
  const targets = [...itemsOf(el, items), ...also.filter(Boolean)];
  if (!targets.length || typeof targets[0].animate !== 'function') return () => {};
  const total = NUDGE_OUT_MS + NUDGE_BACK_MS;
  const at = NUDGE_OUT_MS / total;
  const runs = targets.map((node, i) => {
    // The chevron hint (in `also`) leans the other way a little, as if it pulled the row.
    const shift = i >= targets.length - also.filter(Boolean).length ? Math.round(px / 6) : -px;
    return node.animate([
      { transform: 'translate3d(0, 0, 0)', easing: EASE_OUT },
      { transform: `translate3d(${shift}px, 0, 0)`, offset: at, easing: SETTLE },
      { transform: 'translate3d(0, 0, 0)' },
    ], { duration: total, composite: 'add' });
  });
  return () => runs.forEach((run) => { try { run.cancel(); } catch { /* already done */ } });
}

function seen(key) {
  try { return window.localStorage.getItem(key) === '1'; } catch { return true; }
}
function markSeen(key) {
  try { window.localStorage.setItem(key, '1'); } catch { /* the nudge simply plays again next time */ }
}

/**
 * The cue as a hook. `ref` is the row (the scroller). Options:
 *   active      the row is on screen and should be measured
 *   items       selector for the row's items
 *   min, max    the item width bounds ('content' = the widest item's own content)
 *   endInset    px (or a function) kept clear at the trailing edge when measuring the peek (a mouse arrow's clear zone)
 *   nudgeKey    localStorage key: the nudge plays once per device; leave out for no nudge
 *   nudgeDelay  ms after the row is first measured, so the surface's own entrance has landed
 *   hintRef     an element (the chevron hint) that leans with the nudge
 *   count       how many items there are (a change re-measures)
 *   edges       track overflow / start / end (default true)
 */
export function useRailCue(ref, { active = true, items, min = 'content', max = Infinity, endInset = 0, nudgeKey = null, nudgeDelay = 560, hintRef = null, count = 0, edges: track = true } = {}) {
  const [edges, setEdges] = useState({ overflow: false, start: true, end: true });
  const opts = useRef({ items, min, max, endInset });
  opts.current = { items, min, max, endInset };

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el || !track) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const x = el.scrollLeft;
    const next = { overflow: maxScroll > EDGE_PX, start: x <= EDGE_PX, end: x >= maxScroll - EDGE_PX };
    setEdges((prev) => (prev.overflow === next.overflow && prev.start === next.start && prev.end === next.end ? prev : next));
  }, [ref, track]);

  // The peek: before paint, and again whenever the row's own width changes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el) return undefined;
    const fit = () => { fitPeek(el, opts.current); measure(); };
    fit();
    let width = el.clientWidth;
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
      if (Math.abs(el.clientWidth - width) < 1) return;
      width = el.clientWidth;
      fit();
    }) : null;
    resize?.observe(el);
    return () => { resize?.disconnect(); el.style.removeProperty('--rail-item-w'); delete el.dataset.peek; };
  }, [active, count, ref, measure]);

  // Edges follow the scroll.
  useEffect(() => {
    const el = ref.current;
    if (!active || !el || !track) return undefined;
    let frame = 0;
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(); }); };
    el.addEventListener('scroll', onScroll, { passive: true });
    measure();
    return () => { el.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [active, ref, track, measure]);

  // The nudge: once per device, after the surface has landed, and only while the row overflows and has not been touched.
  useEffect(() => {
    const el = ref.current;
    if (!active || !el || !nudgeKey || seen(nudgeKey) || reducedMotion()) return undefined;
    let cancel = () => {};
    let done = false;
    const stop = () => { done = true; window.clearTimeout(timer); };
    const timer = window.setTimeout(() => {
      const left = el.scrollWidth - el.clientWidth - el.scrollLeft;
      if (done || left <= EDGE_PX || !el.getClientRects().length) return;
      markSeen(nudgeKey);
      cancel = nudgeRow(el, { items: opts.current.items, also: [hintRef?.current] });
    }, nudgeDelay);
    const touched = () => { stop(); cancel(); };
    el.addEventListener('pointerdown', touched, { passive: true });
    el.addEventListener('wheel', touched, { passive: true });
    el.addEventListener('touchstart', touched, { passive: true });
    return () => {
      stop();
      cancel();
      el.removeEventListener('pointerdown', touched);
      el.removeEventListener('wheel', touched);
      el.removeEventListener('touchstart', touched);
    };
  }, [active, nudgeKey, nudgeDelay, ref, hintRef]);

  return { edges, measure };
}

export default useRailCue;
