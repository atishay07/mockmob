'use client';

// A sideways drag that follows the finger 1:1 and commits past a distance or a speed: the app's
// MmDragCommit (lib/core/motion/drag_commit.dart) on the web.
// - It takes the pointer only when the drag is clearly sideways (2.2 times its vertical travel), so
//   the page still scrolls.
// - The element moves by `translate` only, with no React render per frame.
// - Past 35 percent of its width (or commitDistance) or on a fling of 700 px/s it commits: onCommit
//   gets 'left' or 'right' at release, and the element springs away (settle: 'exit', on the lift
//   spring) or home (settle: 'back', on the smooth spring), carrying the finger's speed.
// - A side that does not commit rubber-bands at 0.35. Grabbing it mid-settle stops it where it is.
// - A cancelled pointer never commits. A drag never also clicks what it was dragged on.
// - While it moves it sets --mk-drag-progress (-1 to 1 at the threshold) for a reveal behind it, and
//   data-drag ('drag' | 'settle' | 'gone') and data-past ('true' past the threshold).
// Under reduced motion it still follows the finger (direct manipulation), and the settle jumps.
// Every action it triggers also needs a button for keyboard and screen reader users.
//
//   const { bind, reset } = useDragCommit({ onCommit: (side) => remove(side), settle: 'exit' });
//   <li {...bind}>...</li>       (bind carries ref, className 'mk-drag' and the pointer handlers)

import { useEffect, useState } from 'react';
import { isMotionReduced } from './draw';
import { DRAG, claims, commits, follow, releaseVelocity, slopFor, yields } from './dragPolicy';
import { springState } from './spring';
import { springs } from './tokens.g.js';

const CLICK_GUARD_MS = 400;

/** The drag's machinery, outside React. useDragCommit makes one per element. */
export function createDragController(initial = {}) {
  let o = { ...initial };
  const s = { node: null, x: 0, width: 1, g: null, dragging: false, raf: 0, held: false, gone: false, past: false, startTravel: 0, endedAt: -Infinity };

  const side = (name) => o[name] !== false;
  const share = () => Math.min(1, Math.max(0.01, o.follow ?? 1));
  const distance = () => o.commitDistance ?? s.width * (o.commitShare ?? DRAG.commitShare);
  const travel = () => s.x / share();
  const progress = () => {
    const d = distance();
    return d <= 0 ? 0 : Math.max(-1, Math.min(1, travel() / d));
  };
  const mark = (name, value) => {
    if (!s.node) return;
    if (value == null) delete s.node.dataset[name]; else s.node.dataset[name] = value;
  };

  function paint(x) {
    s.x = x;
    const p = progress();
    if (s.node) {
      s.node.style.translate = x ? `${Math.round(x * 100) / 100}px 0` : '';
      s.node.style.setProperty('--mk-drag-progress', String(Math.round(p * 1000) / 1000));
    }
    o.onProgress?.(p);
  }

  function stop() {
    if (s.raf) cancelAnimationFrame(s.raf);
    s.raf = 0;
  }

  function springTo(target, spring, velocity, done) {
    stop();
    if (isMotionReduced() || typeof requestAnimationFrame !== 'function') { paint(target); done?.(); return; }
    const from = s.x;
    let start = 0;
    const step = (now) => {
      if (!start) start = now;
      const { x, v } = springState(spring, from, target, velocity, (now - start) / 1000);
      if (Math.abs(x - target) < 0.05 && Math.abs(v) < 2) { s.raf = 0; paint(target); done?.(); return; }
      paint(x);
      s.raf = requestAnimationFrame(step);
    };
    s.raf = requestAnimationFrame(step);
  }

  function home(velocity = 0) {
    mark('drag', 'settle');
    mark('past', null);
    springTo(0, springs.smooth, velocity, () => { if (!s.dragging) mark('drag', null); });
  }

  function measure() {
    const w = s.node?.getBoundingClientRect().width;
    s.width = w && w > 0 ? w : 1;
  }

  function begin(event) {
    s.dragging = true;
    s.held = false;
    stop();
    s.startTravel = travel();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Capture is a nicety. */ }
    mark('drag', 'drag');
    o.onStart?.();
  }

  function update(dx) {
    const next = follow(s.startTravel + dx, { left: side('left'), right: side('right'), maxTravel: s.width * DRAG.maxTravelShare });
    paint(next * share());
    const past = Math.abs(next) >= distance() && ((next > 0 && side('right')) || (next < 0 && side('left')));
    if (past !== s.past) {
      s.past = past;
      mark('past', past ? 'true' : null);
      o.onThreshold?.(past);
    }
  }

  function end(velocity) {
    s.endedAt = performance.now();
    const at = s.x;
    const committed = commits(travel(), velocity, {
      distance: distance(),
      left: side('left'),
      right: side('right'),
      minVelocity: o.commitVelocity ?? DRAG.commitVelocity,
    });
    s.past = false;
    mark('past', null);
    const carried = velocity * share();
    if (committed && o.settle === 'exit') {
      s.gone = true;
      mark('drag', 'gone');
      springTo((committed === 'right' ? 1 : -1) * (s.width * 1.1 + 24), springs.lift, carried);
    } else {
      home(carried);
    }
    if (committed) {
      o.onCommit?.(committed);
      o.onRelease?.({ side: committed, offset: at, velocity });
    }
  }

  /** A finger landed on a settle without dragging, then let go: settle from where it is. */
  function unhold() {
    if (!s.held) return;
    s.held = false;
    home(0);
  }

  const handlers = {
    onPointerDown(event) {
      if (o.enabled === false || s.gone || !o.onCommit || s.g) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      measure();
      if (s.raf) { stop(); s.held = true; }
      s.g = { id: event.pointerId, x0: event.clientX, y0: event.clientY, type: event.pointerType, samples: [{ t: event.timeStamp, x: event.clientX }] };
    },
    onPointerMove(event) {
      const g = s.g;
      if (!g || g.id !== event.pointerId) return;
      const dx = event.clientX - g.x0;
      const dy = event.clientY - g.y0;
      g.samples.push({ t: event.timeStamp, x: event.clientX });
      if (g.samples.length > 40) g.samples.shift();
      if (!s.dragging) {
        const slop = slopFor(g.type);
        if (claims(dx, dy, { slop })) begin(event);
        else if (yields(dx, dy, { slop })) { s.g = null; unhold(); return; }
        else return;
      }
      update(dx);
    },
    onPointerUp(event) {
      const g = s.g;
      if (!g || g.id !== event.pointerId) return;
      s.g = null;
      if (!s.dragging) { unhold(); return; }
      s.dragging = false;
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* Already released. */ }
      end(releaseVelocity(g.samples, event.timeStamp));
    },
    onPointerCancel(event) {
      const g = s.g;
      if (!g || g.id !== event.pointerId) return;
      s.g = null;
      if (!s.dragging) { unhold(); return; }
      s.dragging = false;
      s.endedAt = performance.now();
      home(0);
    },
    onClickCapture(event) {
      if (performance.now() - s.endedAt < CLICK_GUARD_MS) { event.preventDefault(); event.stopPropagation(); }
    },
  };

  function attach(node) {
    if (node === s.node) return;
    stop();
    s.node = node || null;
    if (node && s.x) paint(s.x);
  }

  return {
    bind: { ref: attach, className: 'mk-drag', ...handlers },
    setOptions(next) { o = { ...next }; },
    /** Brings an exited element back to rest (an Undo). */
    reset({ animate = true } = {}) {
      s.gone = false;
      s.past = false;
      mark('past', null);
      if (!animate) { stop(); paint(0); mark('drag', null); return; }
      home(0);
    },
    get offset() { return s.x; },
    get progress() { return progress(); },
    dispose() { stop(); },
  };
}

/** See the top of this file. Options: onCommit, onRelease, onProgress, onStart, onThreshold, left, right, commitDistance, commitShare, commitVelocity, settle ('back' | 'exit'), follow, enabled. */
export function useDragCommit(options = {}) {
  const [controller] = useState(() => createDragController(options));
  useEffect(() => { controller.setOptions(options); });
  useEffect(() => () => controller.dispose(), [controller]);
  return { bind: controller.bind, reset: controller.reset, controller };
}
