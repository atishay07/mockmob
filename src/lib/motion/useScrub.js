'use client';

// Hold and slide across a road, a trend line, a ribbon or an answer sheet to read each point: the
// app's MmScrub (lib/core/motion/scrub.dart) on the web.
// - A mouse or pen scrubs as soon as it presses. A finger scrubs after a 500 ms hold (as the app's
//   long press), or at once when it moves clearly sideways, so a vertical scroll is never taken.
// - The arrow keys step through the points, Page keys jump a tenth, Home and End go to the ends,
//   and Escape lets go.
// - It moves nothing itself. While scrubbing, the element carries data-scrub="on" and the CSS
//   variables --mk-scrub-x (px) and --mk-scrub-t (0 to 1), so a cursor can follow the pointer with
//   no React render per move; React hears only when the point changes (`index`, onIndex), which is
//   also the moment to update the caption a screen reader hears.
// Reduced motion changes nothing here: scrubbing is direct manipulation.
//
//   const { bind, index } = useScrub({ count: points.length, onIndex: setPicked });
//   <div {...bind} tabIndex={0} role="slider" aria-valuenow={index} ...>

import { useEffect, useState } from 'react';
import { claims, slopFor, yields } from './dragPolicy';
import { scrubIndex, scrubKeyIndex, scrubX } from './scrub';

export const LONG_PRESS_MS = 500;

/** The scrub's machinery, outside React. `report(index | null)` tells React the point changed. */
export function createScrubController(initial, report) {
  let o = { ...initial };
  const s = { node: null, index: -1, active: false, g: null, timer: 0 };

  const count = () => Math.max(0, o.count ?? 0);
  const enabled = () => o.enabled !== false && count() > 0;

  function width() {
    const w = s.node?.getBoundingClientRect().width;
    return w && w > 0 ? w : 0;
  }

  function show(x, w) {
    if (!s.node) return;
    s.node.dataset.scrub = 'on';
    s.node.style.setProperty('--mk-scrub-x', `${Math.round(x * 10) / 10}px`);
    s.node.style.setProperty('--mk-scrub-t', String(w > 0 ? Math.round((x / w) * 1000) / 1000 : 0));
  }

  function setIndex(index) {
    if (index === s.index) return;
    s.index = index;
    if (index >= 0) o.onIndex?.(index);
    report(index);
  }

  function start() {
    if (s.active) return;
    s.active = true;
    o.onStart?.();
  }

  /** Moves the scrub to x px from the element's left edge. */
  function scrubTo(x) {
    const w = width();
    const at = Math.min(w, Math.max(0, x));
    show(at, w);
    setIndex(o.indexFor ? o.indexFor(at, w) : scrubIndex(at, w, count()));
  }

  function localX(event) {
    const box = s.node?.getBoundingClientRect();
    return box ? event.clientX - box.left : 0;
  }

  function clearTimer() {
    if (s.timer) window.clearTimeout(s.timer);
    s.timer = 0;
  }

  /** Lets go: the scrub ends and the reading is cleared. */
  function end() {
    clearTimer();
    s.g = null;
    if (!s.active && s.index < 0) return;
    s.active = false;
    if (s.node) {
      delete s.node.dataset.scrub;
      s.node.style.removeProperty('--mk-scrub-x');
      s.node.style.removeProperty('--mk-scrub-t');
    }
    s.index = -1;
    report(null);
    o.onEnd?.();
  }

  function capture(event) {
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Capture is a nicety. */ }
  }

  const handlers = {
    onPointerDown(event) {
      if (!enabled() || s.g || (event.pointerType === 'mouse' && event.button !== 0)) return;
      s.g = { id: event.pointerId, x0: event.clientX, y0: event.clientY, type: event.pointerType, x: localX(event) };
      if (event.pointerType !== 'touch') {
        capture(event);
        start();
        scrubTo(s.g.x);
        return;
      }
      s.timer = window.setTimeout(() => {
        s.timer = 0;
        if (!s.g) return;
        start();
        scrubTo(s.g.x);
      }, LONG_PRESS_MS);
    },
    onPointerMove(event) {
      const g = s.g;
      if (!g || g.id !== event.pointerId) return;
      g.x = localX(event);
      if (s.active) { scrubTo(g.x); return; }
      const dx = event.clientX - g.x0;
      const dy = event.clientY - g.y0;
      const slop = slopFor(g.type);
      if (claims(dx, dy, { slop })) { clearTimer(); capture(event); start(); scrubTo(g.x); }
      else if (yields(dx, dy, { slop })) { clearTimer(); s.g = null; }
    },
    onPointerUp(event) {
      if (s.g && s.g.id !== event.pointerId) return;
      end();
    },
    onPointerCancel(event) {
      if (s.g && s.g.id !== event.pointerId) return;
      end();
    },
    onKeyDown(event) {
      if (!enabled()) return;
      if (event.key === 'Escape') { if (s.index >= 0) { event.preventDefault(); end(); } return; }
      const next = scrubKeyIndex(event.key, s.index, count());
      if (next === null) return;
      event.preventDefault();
      start();
      show(scrubX(next, width(), count()), width());
      setIndex(next);
    },
    onBlur() { if (!s.g) end(); },
  };

  function attach(node) {
    if (node === s.node) return;
    if (!node) { clearTimer(); s.g = null; }
    s.node = node || null;
  }

  return {
    bind: { ref: attach, className: 'mk-scrub', ...handlers },
    setOptions(next) { o = { ...next }; },
    scrubTo,
    end,
    dispose: clearTimer,
  };
}

/** See the top of this file. Options: count, indexFor(x, width), onIndex, onStart, onEnd, enabled. Returns { bind, index, scrubbing, scrubTo, end }. */
export function useScrub(options = {}) {
  const [index, setIndex] = useState(null);
  const [controller] = useState(() => createScrubController(options, (i) => setIndex(i === null || i < 0 ? null : i)));
  useEffect(() => { controller.setOptions(options); });
  useEffect(() => () => controller.dispose(), [controller]);
  return { bind: controller.bind, index, scrubbing: index !== null, scrubTo: controller.scrubTo, end: controller.end };
}
