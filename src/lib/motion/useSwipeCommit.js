'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';

/**
 * Swipe to commit, with vertical scrolling left alone. The gesture only counts as a swipe when
 * the finger travels sideways more than 2.2 times as far as it travels up or down, and only
 * commits past `threshold` pixels. Spread `bind` on the element:
 *
 *   const { bind } = useSwipeCommit({ onCommit: (dir) => remove(dir) });
 *   <li {...bind}>...</li>
 *
 * The element follows the finger through the CSS variable --mk-swipe-x (no React re-render per
 * move; see .mk-swipe in motion-kit.css) and carries data-swipe="drag | commit | settle".
 * It only adds a gesture: every action it triggers also needs a button for keyboard users.
 */
export function useSwipeCommit({ onCommit, threshold = 72, ratio = 2.2, lock = 8, disabled = false, directions = 'both' } = {}) {
  const callback = useRef(onCommit);
  const gesture = useRef(null);
  const timer = useRef(0);
  useEffect(() => { callback.current = onCommit; }, [onCommit]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const reset = useCallback((node, state) => {
    if (!node) return;
    node.style.setProperty('--mk-swipe-x', '0px');
    if (state) node.dataset.swipe = state; else delete node.dataset.swipe;
  }, []);

  const onPointerDown = useCallback((event) => {
    if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, swiping: false, dx: 0 };
  }, [disabled]);

  const onPointerMove = useCallback((event) => {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    if (!g.swiping) {
      if (Math.abs(dy) > lock && Math.abs(dx) <= ratio * Math.abs(dy)) { gesture.current = null; return; }
      if (Math.abs(dx) > lock && Math.abs(dx) > ratio * Math.abs(dy)) {
        g.swiping = true;
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Capture is a nicety. */ }
        event.currentTarget.dataset.swipe = 'drag';
      } else return;
    }
    g.dx = (directions === 'left' && dx > 0) || (directions === 'right' && dx < 0) ? 0 : dx;
    event.currentTarget.style.setProperty('--mk-swipe-x', `${g.dx}px`);
  }, [directions, lock, ratio]);

  const finish = useCallback((event, cancelled) => {
    const g = gesture.current;
    gesture.current = null;
    const node = event.currentTarget;
    if (!g || !g.swiping) return;
    try { node.releasePointerCapture(g.id); } catch { /* Already released. */ }
    if (!cancelled && Math.abs(g.dx) >= threshold) {
      const dir = g.dx > 0 ? 'right' : 'left';
      node.dataset.swipe = 'commit';
      node.style.setProperty('--mk-swipe-x', dir === 'right' ? '140%' : '-140%');
      timer.current = window.setTimeout(() => { callback.current?.(dir); reset(node, null); }, 180);
    } else {
      reset(node, 'settle');
      timer.current = window.setTimeout(() => reset(node, null), 320);
    }
  }, [reset, threshold]);

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
