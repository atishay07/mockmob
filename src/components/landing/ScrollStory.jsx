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
// fit their parent, so short phones and landscape keep the hold instead of clipping the screen, and the
// band left under elements marked data-ss-end is measured as --ss-slack (centring, exit gap).
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

// Slack: the empty band between the held content's bottom (elements marked data-ss-end) and the stage's
// bottom. Written once per resize as --ss-slack, so consumers can centre short content in the held window
// (scroll-story.css) and the page after the story follows at the normal section gap, not a stage height.
function measureSlack(root, stage) {
  root.style.removeProperty('--ss-slack');
  const ends = stage.querySelectorAll('[data-ss-end]');
  if (!ends.length) return;
  let bottom = -Infinity;
  for (const node of ends) {
    const rect = node.getBoundingClientRect();
    if (rect.height > 0) bottom = Math.max(bottom, rect.bottom);
  }
  if (!Number.isFinite(bottom)) return;
  const box = stage.getBoundingClientRect();
  const padBottom = parseFloat(getComputedStyle(stage).paddingBottom) || 0;
  const slack = Math.max(0, Math.floor(box.bottom - padBottom - bottom));
  if (slack > 0) root.style.setProperty('--ss-slack', `${slack}px`);
}

export default function ScrollStory({ steps, className = '', beat, label, onStep, Content, ...rest }) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const trackRef = useRef(null);
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

  // The beat crossing the middle of the window owns the step. With no beat crossing, the side the
  // reader comes from does: the beats cover the whole track, so the track then lies wholly on one
  // side of the middle. Still below it, the story waits on its first step; already above it, on its
  // last. So a story entered from above always opens on step one and one entered from below on its
  // last, even after a jump (a nav link, a fling, the top button) that no beat saw. A second observer,
  // a window three screens tall, settles this before the stage shows and, only while the story is that
  // near, a passive scroll listener re-checks once a frame when no beat is crossing (one rect read).
  useEffect(() => {
    if (!pinned) return undefined;
    const held = crossing.current;
    const track = trackRef.current;
    let frame = 0;
    let listening = false;
    const fromSide = () => {
      frame = 0;
      if (held.size > 0 || !track) return;
      const box = track.getBoundingClientRect();
      setStep(box.top + box.bottom > window.innerHeight ? 0 : steps - 1);
    };
    const onScroll = () => { if (!frame && held.size === 0) frame = requestAnimationFrame(fromSide); };
    const listen = (on) => {
      if (on === listening) return;
      listening = on;
      if (on) window.addEventListener('scroll', onScroll, { passive: true });
      else window.removeEventListener('scroll', onScroll);
    };
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const i = Number(entry.target.dataset.beat);
        if (entry.isIntersecting) { held.add(i); setStep(i); } else held.delete(i);
      }
      setLive(held.size > 0);
      fromSide();
    }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
    beatsRef.current.slice(0, steps).forEach((node) => node && io.observe(node));
    const near = track ? new IntersectionObserver((entries) => {
      listen(entries[entries.length - 1].isIntersecting);
      fromSide();
    }, { rootMargin: '100% 0px 100% 0px', threshold: 0 }) : null;
    if (track) near.observe(track);
    return () => { io.disconnect(); near?.disconnect(); listen(false); cancelAnimationFrame(frame); held.clear(); };
  }, [pinned, steps]);

  useEffect(() => { onStepRef.current?.(step); }, [step]);

  // Scale marked screens to their room once per resize (never per scroll frame).
  useEffect(() => {
    const stage = stageRef.current;
    const root = rootRef.current;
    if (!pinned || !stage || !root || typeof ResizeObserver === 'undefined') return undefined;
    let frame = 0;
    const run = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { fitAll(stage); measureSlack(root, stage); }); };
    const observer = new ResizeObserver(run);
    observer.observe(stage);
    stage.querySelectorAll('[data-ss-fit]').forEach((node) => node.parentElement && observer.observe(node.parentElement));
    // A fitted node changes its own width when it is scaled, so only unscaled end markers are watched.
    stage.querySelectorAll('[data-ss-end]:not([data-ss-fit])').forEach((node) => observer.observe(node));
    document.fonts?.ready.then(run).catch(() => {});
    run();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      stage.querySelectorAll('[data-ss-fit]').forEach((node) => node.style.removeProperty('--ss-fit'));
      root.style.removeProperty('--ss-slack');
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
      <div className="ss__track" ref={trackRef}>
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
