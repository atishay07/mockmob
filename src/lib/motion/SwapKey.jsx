'use client';

// SwapKey: the default for any keyed content swap on the web (a tab's body, a filter's list, a
// loaded state replacing its skeleton), the same rule as the app's MmOverlapSwitcher. When
// `swapKey` changes, the new content fades in over the old, and the old holds until the new one is
// half there, so there is never a blank or dim frame between them. The old layer keeps its last
// content, ignores the pointer and is hidden from screen readers while it leaves.
//
//   <SwapKey swapKey={tab}>{body}</SwapKey>                       fade (default)
//   <SwapKey swapKey={id} variant="rise">{card}</SwapKey>         new content rises into place
//   <SwapKey swapKey={step} variant="axis" dir={back ? -1 : 1}>   a step forward or back
//
// A swap that starts mid-swap holds what is showing and starts again from there. Reduced motion:
// a 120 ms fade, nothing travels. Styles: .mk-swap in motion-kit.css.

import { useLayoutEffect, useRef, useState } from 'react';
import { isMotionReduced } from './draw';
import { arrivalAt, incomingKeyframes, outgoingKeyframes, swapSpec } from './swap';

const MAX_LEAVING = 2;

/**
 * The layers to draw for a keyed swap: [{ id, key, node, spec }], oldest first; the last one is
 * the current content. Keeps the current layer's content fresh, so a layer leaves showing exactly
 * what it last showed.
 */
export function useSwapKey(swapKey, children, { variant = 'fade', dir = 1, travel } = {}) {
  const [layers, setLayers] = useState(() => [{ id: 0, key: swapKey, node: children, variant, dir, travel, first: true }]);
  const current = layers[layers.length - 1];
  if (current.key !== swapKey) {
    // Storing what the previous render showed (React's pattern for derived state): the current
    // layer starts leaving and the new content arrives on top.
    setLayers([...layers.slice(-MAX_LEAVING), { id: current.id + 1, key: swapKey, node: children, variant, dir, travel, first: false }]);
  } else if (current.node !== children) {
    setLayers(layers.map((layer) => (layer === current ? { ...layer, node: children } : layer)));
  }
  const drop = (id) => setLayers((list) => (list[list.length - 1].id === id ? list.filter((layer) => layer.id >= id) : list));
  return { layers, current, drop };
}

export function SwapKey({ swapKey, variant = 'fade', dir = 1, travel, animateFirst = false, as: Tag = 'div', className, children, ...rest }) {
  const { layers, current, drop } = useSwapKey(swapKey, children, { variant, dir, travel });
  const box = useRef(null);
  const runs = useRef(new Map()); // layer id -> { start, spec, animations }

  useLayoutEffect(() => {
    const root = box.current;
    if (!root) return undefined;
    const reduced = isMotionReduced();
    const find = (id) => root.querySelector(`:scope > [data-swap-id="${id}"]`);
    const incoming = find(current.id);
    const animate = typeof incoming?.animate === 'function';
    const spec = swapSpec(current.variant, { dir: current.dir, travel: current.travel, reduced });

    if (current.first && !animateFirst) return undefined;
    if (!animate) { if (!current.first) drop(current.id); return undefined; }

    // The layer that was showing holds where it is and becomes the leaving one.
    const prevId = current.id - 1;
    const leaving = current.first ? null : find(prevId);
    if (leaving) {
      const before = runs.current.get(prevId);
      let held = { opacity: 1, x: 0, y: 0, scale: 1 };
      if (before) {
        const running = before.animations.some((a) => a.playState === 'running');
        if (running) held = arrivalAt(before.spec, performance.now() - before.start);
        before.animations.forEach((a) => a.cancel());
        runs.current.delete(prevId);
      }
      const { keyframes, durationMs } = outgoingKeyframes(spec, held);
      const out = leaving.animate(keyframes, { duration: durationMs, easing: 'linear', fill: 'forwards' });
      runs.current.set(`out-${prevId}`, { animations: [out] });
    }

    const { keyframes, durationMs } = incomingKeyframes(spec);
    const arrive = incoming.animate(keyframes, { duration: durationMs, easing: 'linear', fill: 'backwards' });
    runs.current.set(current.id, { start: performance.now(), spec, animations: [arrive] });
    arrive.finished
      .then(() => {
        runs.current.delete(current.id);
        for (const key of [...runs.current.keys()]) if (String(key).startsWith('out-')) runs.current.delete(key);
        drop(current.id);
      })
      .catch(() => { /* Cancelled by a newer swap, which takes over. */ });
    return undefined;
    // Each swap runs once, when its layer arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id]);

  // Nothing keeps running after the swap leaves the page.
  useLayoutEffect(() => {
    const map = runs.current;
    return () => {
      for (const run of map.values()) run.animations?.forEach((a) => a.cancel());
      map.clear();
    };
  }, []);

  return (
    <Tag ref={box} className={className ? `mk-swap ${className}` : 'mk-swap'} {...rest}>
      {layers.map((layer) => {
        const out = layer !== current;
        return (
          <div
            key={layer.id}
            data-swap-id={layer.id}
            data-swap-layer={out ? 'out' : 'in'}
            aria-hidden={out || undefined}
            inert={out || undefined}
          >
            {layer.node}
          </div>
        );
      })}
    </Tag>
  );
}

