"use client";

// The Start sheet's subject row, made to scroll with a mouse as well as a finger.
//
//   wheel     a vertical wheel over the row moves it sideways; at either end the wheel goes back to the sheet
//   drag      press and drag with the mouse, let go and it carries on with the hand's speed, then settles
//             on the nearest chip (a press that does not travel is still a plain click on the chip)
//   arrows    step about a row's width, to a chip's edge (the buttons themselves are in StartSheet.jsx)
//   keyboard  the chips are one radio group, so the arrow keys move the choice; the focused chip and the
//             chosen one are always brought clear of the edge fades
//   touch     untouched: the browser's own scrolling and scroll-snap
//
// The glide is the app's out feel: the distance left shrinks exponentially every frame, so a new wheel
// notch or a fling simply moves the target and the motion never restarts. Scroll-snap is held off while
// the row glides or is dragged, and every glide ends on a snap position, so the browser has nothing to
// correct. Reduced motion: the row jumps straight to where it is going.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const EDGE_PX = 2;
const DRAG_SLOP_PX = 5;
const WHEEL_TAU_MS = 70;
const SETTLE_TAU_MS = 110;
const FLING_TAU_MS = 130;
// A fling carries on for about this long at the hand's speed (the integral of an exponential decay).
const FLING_CARRY_MS = 260;
const WHEEL_IDLE_MS = 160;
// Room kept between a chip that must be seen and the row's edge, so it clears the fade.
const CLEAR_PX = 44;

function reducedMotion() {
  try {
    return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const maxScroll = (el) => Math.max(0, el.scrollWidth - el.clientWidth);
const padStart = (el) => {
  const cs = getComputedStyle(el);
  return parseFloat(cs.scrollPaddingLeft) || parseFloat(cs.paddingLeft) || 0;
};

/** Every place the row may rest: each chip's start against the scroll padding, plus both ends. */
function snapPoints(el) {
  const max = maxScroll(el);
  const pad = padStart(el);
  const points = [0, max];
  for (const chip of el.children) points.push(clamp(chip.offsetLeft - pad, 0, max));
  return points.sort((a, b) => a - b);
}

function nearest(points, x) {
  let best = points[0];
  for (const p of points) if (Math.abs(p - x) < Math.abs(best - x)) best = p;
  return best;
}

/** `selected` is the chosen subject id; `active` is whether the row is on screen (more than one subject). */
export function useSubjectRail(selected, active = true) {
  const railRef = useRef(null);
  const glide = useRef({ raf: 0, x: 0, target: 0, tau: SETTLE_TAU_MS, last: 0 });
  const [edges, setEdges] = useState({ overflow: false, start: true, end: true });

  const measure = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    const max = maxScroll(el);
    const x = el.scrollLeft;
    const next = { overflow: max > EDGE_PX, start: x <= EDGE_PX, end: x >= max - EDGE_PX };
    setEdges((prev) => (prev.overflow === next.overflow && prev.start === next.start && prev.end === next.end ? prev : next));
  }, []);

  const stop = useCallback(() => {
    const g = glide.current;
    if (g.raf) cancelAnimationFrame(g.raf);
    g.raf = 0;
    if (railRef.current) delete railRef.current.dataset.gliding;
  }, []);

  /** Glide toward x (clamped). Called again mid-glide, it only moves the target. */
  const glideTo = useCallback((x, tau = SETTLE_TAU_MS) => {
    const el = railRef.current;
    if (!el) return;
    const target = clamp(x, 0, maxScroll(el));
    if (reducedMotion() || typeof requestAnimationFrame !== 'function') {
      stop();
      el.scrollLeft = target;
      return;
    }
    const g = glide.current;
    g.target = target;
    g.tau = tau;
    if (g.raf) return;
    el.dataset.gliding = '';
    g.x = el.scrollLeft;
    g.last = performance.now();
    const frame = (now) => {
      const dt = Math.min(48, Math.max(1, now - g.last));
      g.last = now;
      g.x += (g.target - g.x) * (1 - Math.exp(-dt / g.tau));
      if (Math.abs(g.target - g.x) < 0.5) {
        el.scrollLeft = g.target;
        g.raf = 0;
        delete el.dataset.gliding;
        return;
      }
      el.scrollLeft = g.x;
      g.raf = requestAnimationFrame(frame);
    };
    g.raf = requestAnimationFrame(frame);
  }, [stop]);

  /** Where the row is heading: the glide's target while it moves, else where it is. */
  const heading = useCallback(() => {
    const el = railRef.current;
    if (!el) return 0;
    return glide.current.raf ? glide.current.target : el.scrollLeft;
  }, []);

  /** Bring one chip clear of the edge fades. */
  const reveal = useCallback((chip, { instant = false } = {}) => {
    const el = railRef.current;
    if (!el || !chip || !el.contains(chip)) return;
    const from = heading();
    const left = chip.offsetLeft;
    const right = left + chip.offsetWidth;
    let target = from;
    if (left - CLEAR_PX < from) target = left - CLEAR_PX;
    else if (right + CLEAR_PX > from + el.clientWidth) target = right + CLEAR_PX - el.clientWidth;
    if (Math.abs(target - from) < 1) return;
    if (instant) { stop(); el.scrollLeft = clamp(target, 0, maxScroll(el)); measure(); return; }
    glideTo(target, SETTLE_TAU_MS);
  }, [glideTo, heading, measure, stop]);

  /** One arrow press: about a row's width that way, ending on a chip's edge, and always some way. */
  const step = useCallback((dir) => {
    const el = railRef.current;
    if (!el) return;
    const from = heading();
    const points = snapPoints(el);
    let target = nearest(points, from + dir * el.clientWidth * 0.72);
    if (dir > 0 && target <= from + 1) target = points.find((p) => p > from + 1) ?? maxScroll(el);
    if (dir < 0 && target >= from - 1) target = [...points].reverse().find((p) => p < from - 1) ?? 0;
    glideTo(target, FLING_TAU_MS);
  }, [glideTo, heading]);

  // Wheel, mouse drag, edge state and focus.
  useEffect(() => {
    const el = railRef.current;
    if (!active || !el) return undefined;
    const host = el.parentElement || el;
    let idle = 0;
    let drag = null;
    let swallowClick = false;
    let measuring = 0;

    const onScroll = () => {
      if (measuring) return;
      measuring = requestAnimationFrame(() => { measuring = 0; measure(); });
    };

    const onWheel = (event) => {
      if (event.ctrlKey || drag?.moved) return;
      const max = maxScroll(el);
      if (max <= EDGE_PX) return;
      // A sideways trackpad swipe or shift + wheel already scrolls the row natively.
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientWidth : 1;
      const delta = event.deltaY * unit;
      const from = heading();
      // At an end, the wheel belongs to the sheet again.
      if ((delta < 0 && from <= EDGE_PX) || (delta > 0 && from >= max - EDGE_PX)) return;
      event.preventDefault();
      glideTo(from + delta, WHEEL_TAU_MS);
      window.clearTimeout(idle);
      idle = window.setTimeout(() => glideTo(nearest(snapPoints(el), heading()), SETTLE_TAU_MS), WHEEL_IDLE_MS);
    };

    const onDown = (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || maxScroll(el) <= EDGE_PX) return;
      stop();
      window.clearTimeout(idle);
      drag = { id: event.pointerId, x0: event.clientX, s0: el.scrollLeft, moved: false, samples: [{ x: event.clientX, t: event.timeStamp }] };
    };
    const onMove = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x0;
      if (!drag.moved) {
        if (Math.abs(dx) < DRAG_SLOP_PX) return;
        drag.moved = true;
        el.dataset.dragging = '';
        try { el.setPointerCapture(event.pointerId); } catch { /* The pointer already left. */ }
      }
      el.scrollLeft = drag.s0 - dx;
      drag.samples.push({ x: event.clientX, t: event.timeStamp });
      while (drag.samples.length > 2 && event.timeStamp - drag.samples[0].t > 90) drag.samples.shift();
    };
    const onUp = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      if (!d.moved) return;
      delete el.dataset.dragging;
      try { el.releasePointerCapture(event.pointerId); } catch { /* Already released. */ }
      swallowClick = true;
      window.setTimeout(() => { swallowClick = false; }, 0);
      const s = d.samples;
      const first = s[0];
      const last = s[s.length - 1];
      const dt = last.t - first.t;
      // A hand that stopped before letting go carries nothing.
      const still = event.timeStamp - last.t > 80;
      const velocity = dt > 0 && !still ? (last.x - first.x) / dt : 0;
      const projected = el.scrollLeft - velocity * FLING_CARRY_MS;
      glideTo(nearest(snapPoints(el), clamp(projected, 0, maxScroll(el))), FLING_TAU_MS);
    };
    // A drag that ends on a chip is not a choice of that chip.
    const onClick = (event) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    };
    const onFocus = (event) => {
      const chip = event.target instanceof Element ? event.target.closest('.st-chip') : null;
      if (chip && el.contains(chip)) reveal(chip);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    host.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('click', onClick, true);
    el.addEventListener('focusin', onFocus);
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => measure()) : null;
    resize?.observe(el);
    measure();
    return () => {
      el.removeEventListener('scroll', onScroll);
      host.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('click', onClick, true);
      el.removeEventListener('focusin', onFocus);
      resize?.disconnect();
      window.clearTimeout(idle);
      if (measuring) cancelAnimationFrame(measuring);
      stop();
    };
  }, [active, glideTo, heading, measure, reveal, stop]);

  // The chosen subject is in view: at once as the sheet opens, by a glide when the choice moves.
  const shown = useRef(false);
  useLayoutEffect(() => {
    const el = railRef.current;
    if (!active || !el || !selected) return;
    const chip = [...el.querySelectorAll('.st-chip')].find((node) => node.dataset.subject === selected);
    reveal(chip, { instant: !shown.current });
    shown.current = true;
  }, [active, selected, reveal]);

  return { railRef, edges, step };
}

export default useSubjectRail;
