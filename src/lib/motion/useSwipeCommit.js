'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { DRAG, follow, releaseVelocity } from './dragPolicy';
import { durations, springs } from './tokens.g.js';
import { isMotionReduced } from './draw';
import { swipeReleaseFrames } from './swipeRelease.js';

/**
 * Swipe to commit, with vertical scrolling left alone. The gesture only counts as a swipe when
 * the finger travels sideways more than 2.2 times as far as it travels up or down, and commits past
 * `threshold` pixels or on a fling of 700 px/s toward a side that commits (the app's drag policy).
 * A side that does not commit gives a little (0.35), so the row says "not this way". Spread `bind`:
 *
 *   const { bind } = useSwipeCommit({ onCommit: (dir) => remove(dir) });
 *   <li {...bind}>...</li>
 *
 * The element follows the finger through the CSS variable --mk-swipe-x (no React re-render per
 * move; see .mk-swipe in motion-kit.css) and carries data-swipe="drag | fling | commit | settle": it springs
 * home on the app's smooth spring, or keeps the finger's speed and carries on off the row on the lift spring
 * (swipeRelease.js, the app's M24) before onCommit fires; the caller then folds the gap (fold.js).
 * Reduced motion commits at once.
 * It only adds a gesture: every action it triggers also needs a button for keyboard users.
 * For a drag that carries the finger's speed into its settle, use useDragCommit.
 */
export function useSwipeCommit({ onCommit, threshold = 72, ratio = DRAG.claimRatio, lock = 8, disabled = false, directions = 'both' } = {}) {
  const callback = useRef(onCommit);
  const gesture = useRef(null);
  const timer = useRef(0);
  const flight = useRef(null);
  const away = useRef(null);
  useEffect(() => { callback.current = onCommit; }, [onCommit]);
  useEffect(() => () => { window.clearTimeout(timer.current); flight.current?.cancel(); }, []);

  const reset = useCallback((node, state) => {
    if (!node) return;
    flight.current?.cancel();
    flight.current = null;
    node.style.setProperty('--mk-swipe-x', '0px');
    if (state) node.dataset.swipe = state; else delete node.dataset.swipe;
  }, []);

  const onPointerDown = useCallback((event) => {
    if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const width = event.currentTarget.getBoundingClientRect?.().width || 0;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, swiping: false, dx: 0, width, samples: [{ t: event.timeStamp, x: event.clientX }] };
  }, [disabled]);

  const onPointerMove = useCallback((event) => {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    g.samples.push({ t: event.timeStamp, x: event.clientX });
    if (g.samples.length > 40) g.samples.shift();
    if (!g.swiping) {
      if (Math.abs(dy) > lock && Math.abs(dx) <= ratio * Math.abs(dy)) { gesture.current = null; return; }
      if (Math.abs(dx) > lock && Math.abs(dx) > ratio * Math.abs(dy)) {
        g.swiping = true;
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Capture is a nicety. */ }
        event.currentTarget.dataset.swipe = 'drag';
      } else return;
    }
    g.dx = follow(dx, {
      left: directions !== 'right',
      right: directions !== 'left',
      maxTravel: (g.width || 1) * DRAG.maxTravelShare,
    });
    event.currentTarget.style.setProperty('--mk-swipe-x', `${g.dx}px`);
  }, [directions, lock, ratio]);

  const finish = useCallback((event, cancelled) => {
    const g = gesture.current;
    gesture.current = null;
    const node = event.currentTarget;
    if (!g || !g.swiping) return;
    try { node.releasePointerCapture(g.id); } catch { /* Already released. */ }
    const velocity = cancelled ? 0 : releaseVelocity(g.samples, event.timeStamp);
    const allowed = (sign) => (sign > 0 ? directions !== 'left' : directions !== 'right');
    const fling = Math.abs(velocity) >= DRAG.commitVelocity && (g.dx === 0 || Math.sign(velocity) === Math.sign(g.dx)) && allowed(Math.sign(velocity));
    const far = Math.abs(g.dx) >= threshold && allowed(Math.sign(g.dx)) && !(Math.abs(velocity) >= DRAG.commitVelocity && Math.sign(velocity) !== Math.sign(g.dx));
    if (!cancelled && (fling || far)) {
      const dir = (fling ? Math.sign(velocity) : Math.sign(g.dx)) > 0 ? 'right' : 'left';
      const done = () => { callback.current?.(dir); reset(node, null); };
      if (isMotionReduced()) { done(); return; }
      if (typeof node.animate === 'function') {
        // The row keeps the finger's speed and carries on off the edge on the lift spring: no hang, no drop.
        // It stays away while the caller folds the gap; if the caller keeps the row (the removal failed and
        // the swipe is enabled again), it comes back (see the effect below).
        const { frames, duration } = swipeReleaseFrames({ dx: g.dx, velocity, width: g.width, dir });
        node.dataset.swipe = 'fling';
        flight.current = node.animate(frames.map((f) => ({ transform: `translate3d(${f.x}px, 0, 0)`, opacity: f.opacity })), { duration, easing: 'linear', fill: 'forwards' });
        away.current = node;
        timer.current = window.setTimeout(() => callback.current?.(dir), duration);
        return;
      }
      node.dataset.swipe = 'commit';
      node.style.setProperty('--mk-swipe-x', dir === 'right' ? '140%' : '-140%');
      timer.current = window.setTimeout(done, durations.ui);
    } else {
      reset(node, 'settle');
      timer.current = window.setTimeout(() => reset(node, null), springs.smooth.settleMs);
    }
  }, [directions, reset, threshold]);

  // A row that flew away but is still here once the swipe is allowed again (the removal did not go
  // through): bring it back, so it is never left invisible.
  useEffect(() => {
    if (disabled || !away.current) return;
    const node = away.current;
    away.current = null;
    if (node.isConnected) reset(node, null);
  }, [disabled, reset]);

  const bind = useMemo(() => ({
    className: 'mk-swipe',
    style: { touchAction: 'pan-y' },
    onPointerDown,
    onPointerMove,
    onPointerUp: (event) => finish(event, false),
    onPointerCancel: (event) => finish(event, true),
  }), [finish, onPointerDown, onPointerMove]);

  return { bind };
}
