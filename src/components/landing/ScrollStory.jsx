"use client";

// ScrollStory: a landing section that holds still while the reader's scroll walks it through its steps.
//
//   <ScrollStory steps={4} className="lc" beat="78svh" label="Mistake Lab, step by step" Content={Stage} {...stageProps} />
//   function Stage({ step, pinned, reduced, live, goTo, steps, ...stageProps }) { ... }
//
// The stage is position: sticky inside a taller track, so the browser does the holding: no scroll
// jacking, no wheel or touch handlers, and a fast fling simply carries on past the section. Each step
// owns an equal share of the held scroll (one invisible "beat" per step); an IntersectionObserver on
// the beats picks the step whose beat crosses the middle of the window, so nothing runs per frame.
// The track is also a named view timeline (--ss-track), which consumers use for compositor-only
// progress fills (see scroll-story.css). Elements marked data-ss-fit are scaled once per resize to
// fit their parent, so short phones and landscape keep the hold instead of clipping the screen.
// Every step's content stays in the DOM in reading order; focusing into a step brings it on stage.
// Reduced motion keeps the hold with calm, instant swaps. Without IntersectionObserver the steps stack.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@/app/scroll-story.css';

const reducedNow = () => {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.dataset.motion === 'reduced') return true;
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

function fitAll(stage) {
  for (const node of stage.querySelectorAll('[data-ss-fit]')) {
    const room = node.parentElement;
    if (!room) continue;
    node.style.removeProperty('--ss-fit');
    // Room: from the node's own top to the parent's content bottom (the node scales from its top
    // left and is laid out 1/fit wider, so it keeps the full width and rewraps a little shorter).
    const box = room.getBoundingClientRect();
    const padBottom = parseFloat(getComputedStyle(room).paddingBottom) || 0;
    const space = box.top + room.clientTop + room.clientHeight - padBottom - node.getBoundingClientRect().top;
    // The smallest scale: --ss-fit-min from CSS (per layout) wins over data-ss-fit, then 0.6.
    const min = parseFloat(getComputedStyle(node).getPropertyValue('--ss-fit-min')) || Number(node.dataset.ssFit) || 0.6;
    if (!(space > 0) || node.offsetHeight <= space + 1) continue;
    let fit = Math.max(min, space / node.offsetHeight);
    for (let pass = 0; pass < 3; pass += 1) {
      node.style.setProperty('--ss-fit', fit.toFixed(3));
      const drawn = node.offsetHeight * fit;
      if (Math.abs(drawn - space) < 4 || fit === min) break;
      fit = Math.max(min, Math.min(1, (fit * space) / drawn));
    }
    if (node.offsetHeight * fit > space + 1 && fit > min) node.style.setProperty('--ss-fit', Math.max(min, space / node.offsetHeight).toFixed(3));
  }
}

export default function ScrollStory({ steps, className = '', beat, label, onStep, Content, ...rest }) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const beatsRef = useRef([]);
  const crossing = useRef(new Set());
  const [pinned, setPinned] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [step, setStep] = useState(0);
  const [live, setLive] = useState(false);
  const onStepRef = useRef(onStep);
  useEffect(() => { onStepRef.current = onStep; }, [onStep]);

  useEffect(() => {
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      setReduced(reducedNow());
      setPinned(typeof IntersectionObserver !== 'undefined');
    };
    sync();
    calm.addEventListener?.('change', sync);
    const watch = typeof MutationObserver !== 'undefined' ? new MutationObserver(sync) : null;
    watch?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    return () => { calm.removeEventListener?.('change', sync); watch?.disconnect(); };
  }, []);

  // The beat crossing the middle of the window owns the step.
  useEffect(() => {
    if (!pinned) return undefined;
    const held = crossing.current;
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const i = Number(entry.target.dataset.beat);
        if (entry.isIntersecting) { held.add(i); setStep(i); } else held.delete(i);
      }
      setLive(held.size > 0);
    }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
    beatsRef.current.slice(0, steps).forEach((node) => node && io.observe(node));
    return () => { io.disconnect(); held.clear(); };
  }, [pinned, steps]);

  useEffect(() => { onStepRef.current?.(step); }, [step]);

  // Scale marked screens to their room once per resize (never per scroll frame).
  useEffect(() => {
    const stage = stageRef.current;
    if (!pinned || !stage || typeof ResizeObserver === 'undefined') return undefined;
    let frame = 0;
    const run = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => fitAll(stage)); };
    const observer = new ResizeObserver(run);
    observer.observe(stage);
    stage.querySelectorAll('[data-ss-fit]').forEach((node) => node.parentElement && observer.observe(node.parentElement));
    document.fonts?.ready.then(run).catch(() => {});
    run();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      stage.querySelectorAll('[data-ss-fit]').forEach((node) => node.style.removeProperty('--ss-fit'));
    };
  }, [pinned]);

  // Brings step i on stage by scrolling to the middle of its beat. Keyboard and reduced motion jump.
  const goTo = useCallback((i, { instant = false } = {}) => {
    const n = Math.max(0, Math.min(steps - 1, i));
    const node = beatsRef.current[n];
    setStep(n);
    if (!pinned || !node) return;
    // The start of the step's share of the hold, so its progress fill starts empty.
    const rect = node.getBoundingClientRect();
    const top = Math.round(window.scrollY + rect.top + (n === 0 ? 0 : 4 - window.innerHeight / 2));
    if (Math.abs(top - window.scrollY) < 2) return;
    window.scrollTo({ top, behavior: instant || reducedNow() ? 'auto' : 'smooth' });
  }, [pinned, steps]);

  // Focus moving into a step that is off stage brings that step on (keyboard reading order).
  const onFocus = useCallback((event) => {
    const host = event.target.closest?.('[data-ss-step]');
    if (!host) return;
    const i = Number(host.dataset.ssStep);
    if (Number.isFinite(i) && i !== step) goTo(i, { instant: true });
  }, [goTo, step]);

  const api = useMemo(() => ({ step, pinned, reduced, live, goTo, steps }), [step, pinned, reduced, live, goTo, steps]);

  return (
    <div
      ref={rootRef}
      className={`ss ${className}`.trim()}
      data-pinned={pinned ? 'true' : 'false'}
      data-reduced={reduced ? 'true' : 'false'}
      data-live={live ? 'true' : 'false'}
      style={{ '--ss-steps': steps, '--ss-step': step, ...(beat ? { '--ss-beat': beat } : null) }}
    >
      <div className="ss__track">
        <div className="ss__stage" ref={stageRef} onFocus={onFocus} role={label ? 'group' : undefined} aria-label={label}>
          <Content {...rest} {...api} />
        </div>
        {Array.from({ length: steps }, (_, i) => (
          <span key={i} className="ss__beat" data-beat={i} data-edge={i === 0 ? 'first' : i === steps - 1 ? 'last' : undefined} style={{ '--i': i }} ref={(node) => { beatsRef.current[i] = node; }} aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}
