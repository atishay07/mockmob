"use client";

// ScrollStory: a landing section that holds still while the reader's gesture walks it through its steps.
//
//   <ScrollStory steps={4} className="lc" beat="78svh" label="Mistake Lab, step by step" Content={Stage} {...stageProps} />
//   function Stage({ step, pinned, reduced, live, goTo, steps, ...stageProps }) { ... }
//
// The stage is position: sticky inside a taller track, so the browser does the holding. Each step has a
// resting place in the held scroll (the first at the start of the hold, the last at its end, the rest
// evenly between) and owns the band around it (one invisible "beat" per step).
//
// ONE GESTURE, ONE STEP (LK69, L-027/L-028, 4 Nov 2026). Inside a hold a swipe, a wheel burst or a key press moves
// exactly one step, chosen from the gesture's net travel and never its speed; flings are stopped at a story's edges
// (entering) and left free (leaving); a native scroll that ends inside a hold settles on the nearest rest. All of
// that is storyController.mjs, one controller for every story on the page. It never glides the page: a step commits
// instantly (the stage is sticky, so moving the page to the rest is invisible) and the stage's content moves with
// a 180-240 ms CSS transform (scroll-story.css). The reader's scrolling is the browser's everywhere else: the
// controller's non-passive listeners exist only while a story is within one screen of the viewport (LK47, "no glide").
//
// Step-driven visuals. A step change writes data-step and --ss-step on the root straight away, so progress fills and
// any CSS keyed to the step change at once and cannot be left half done; React catches up in a transition, so the
// stage's own render never lands inside the gesture's frame. The IntersectionObserver on the beats still picks the
// step for a scroll the controller does not own (scrollbar, Home/End, find-in-page): the beat crossing the middle of
// the window wins, and a story entered from above opens on step one, from below on its last.
//
// Elements marked data-ss-fit are scaled once per resize to fit their parent (all measured first, then all written),
// and the band left under elements marked data-ss-end is measured as --ss-slack (centring, exit gap).
// Every step's content stays in the DOM in reading order; focusing into a step brings it on stage, and the
// scrollbar, find-in-page and screen readers still move through the story by position.
// Reduced motion keeps the hold with calm, instant swaps (lock 120 ms, no lean). Without IntersectionObserver the
// steps stack.
//
// Props beyond the stage's: `hold` is a media query; the story is held only while it matches (the statement is a
// phone story and a plain scrub on desktop). `holdCalm` skips the hold under reduced motion. `quiet` keeps the
// phone dock up while the story is on (the dock is told by data-live).
import { startTransition, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import '@/app/scroll-story.css';
import * as bus from './scrollBus.mjs';
import * as controller from './storyController.mjs';
import { drawnAncestor, undrawn } from './undrawn';

const reducedNow = () => {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.dataset.motion === 'reduced') return true;
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

// Scale marked screens to their room. Every measurement is read first, then every write is made, pass by pass:
// a story with four fitted scenes costs three layouts, not twelve (LK69 lag: the old per-node loop forced one
// layout per read, 118 to 158 ms at 4x CPU).
function fitAll(stage) {
  const nodes = [...stage.querySelectorAll('[data-ss-fit]')];
  if (!nodes.length) return;
  for (const node of nodes) node.style.removeProperty('--ss-fit');
  const live = [];
  for (const node of nodes) {
    const room = node.parentElement;
    if (!room) continue;
    // Room: from the node's own top to the parent's content bottom (the node scales from its top
    // left and is laid out 1/fit wider, so it keeps the full width and rewraps a little shorter).
    const box = room.getBoundingClientRect();
    const padBottom = parseFloat(getComputedStyle(room).paddingBottom) || 0;
    const space = box.top + room.clientTop + room.clientHeight - padBottom - node.getBoundingClientRect().top;
    // The smallest scale: --ss-fit-min from CSS (per layout) wins over data-ss-fit, then 0.6.
    const min = parseFloat(getComputedStyle(node).getPropertyValue('--ss-fit-min')) || Number(node.dataset.ssFit) || 0.6;
    const height = node.offsetHeight;
    if (!(space > 0) || height <= space + 1) continue;
    live.push({ node, space, min, fit: Math.max(min, space / height), done: false });
  }
  for (let pass = 0; pass < 3 && live.some((item) => !item.done); pass += 1) {
    for (const item of live) if (!item.done) item.node.style.setProperty('--ss-fit', item.fit.toFixed(3));
    const drawn = live.map((item) => (item.done ? 0 : item.node.offsetHeight * item.fit));
    live.forEach((item, i) => {
      if (item.done) return;
      if (Math.abs(drawn[i] - item.space) < 4 || item.fit === item.min) { item.done = true; return; }
      item.fit = Math.max(item.min, Math.min(1, (item.fit * item.space) / drawn[i]));
    });
  }
  for (const item of live) {
    if (item.node.offsetHeight * item.fit > item.space + 1 && item.fit > item.min) item.node.style.setProperty('--ss-fit', Math.max(item.min, item.space / item.node.offsetHeight).toFixed(3));
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

export default function ScrollStory({ steps, className = '', beat, label, onStep, Content, hold, holdCalm = false, quiet = false, ...rest }) {
  const id = useId();
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const trackRef = useRef(null);
  const beatsRef = useRef([]);
  const crossing = useRef(new Set());
  const [pinned, setPinned] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [step, setStep] = useState(0);
  const [live, setLive] = useState(false);
  // The step as the controller sees it, written the moment a step is decided (React's own state catches up in a
  // transition, so it is never the one to ask inside a gesture).
  const stepRef = useRef(0);
  const handleRef = useRef(null);
  const onStepRef = useRef(onStep);
  useEffect(() => { onStepRef.current = onStep; }, [onStep]);

  const applyStep = useCallback((n) => {
    const next = Math.max(0, Math.min(steps - 1, n));
    if (stepRef.current === next) return;
    stepRef.current = next;
    const root = rootRef.current;
    if (root) { root.dataset.step = String(next); root.style.setProperty('--ss-step', String(next)); }
    startTransition(() => setStep(next));
  }, [steps]);

  useEffect(() => {
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const heldQuery = hold ? window.matchMedia(hold) : null;
    const sync = () => {
      const calmNow = reducedNow();
      setReduced(calmNow);
      setPinned(typeof IntersectionObserver !== 'undefined' && (!heldQuery || heldQuery.matches) && !(holdCalm && calmNow));
    };
    sync();
    calm.addEventListener?.('change', sync);
    heldQuery?.addEventListener?.('change', sync);
    const watch = typeof MutationObserver !== 'undefined' ? new MutationObserver(sync) : null;
    watch?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    return () => { calm.removeEventListener?.('change', sync); heldQuery?.removeEventListener?.('change', sync); watch?.disconnect(); };
  }, [hold, holdCalm]);

  // The controller's handle for this story: the gesture, clamp and settle rules live in storyController.mjs.
  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!pinned || !root || !track || !stage || steps < 2) return undefined;
    const handle = { id, root, track, stage, steps, step: () => stepRef.current, show: applyStep, reduced: reducedNow };
    handleRef.current = handle;
    const off = controller.register(handle);
    return () => { off(); handleRef.current = null; bus.hold(id, false); };
  }, [pinned, steps, applyStep, id]);

  // The beat crossing the middle of the window owns the step for any scroll the controller does not own. With no
  // beat crossing, the side the reader comes from does: the beats cover the whole track, so the track then lies wholly
  // on one side of the middle. Still below it, the story waits on its first step; already above it, on its last. So a
  // story entered from above always opens on step one and one entered from below on its last, even after a jump (a
  // nav link, a fling, the top button) that no beat saw. A second observer, a window three screens tall, settles this
  // before the stage shows and tells the controller the story is near (gestures are owned only then); while it is
  // near, the shared scroll read re-checks once a frame when no beat is crossing (arithmetic on cached geometry).
  useEffect(() => {
    if (!pinned) return undefined;
    const held = crossing.current;
    const track = trackRef.current;
    let unsubscribe = null;
    const sideOf = (y, vh) => {
      const handle = handleRef.current;
      if (handle?.ok) return handle.top + handle.height / 2 > y + vh / 2 ? 0 : steps - 1;
      // A section not drawn yet is far off screen: its reserved box gives the side without laying it out.
      const box = drawnAncestor(track).getBoundingClientRect();
      return box.top + box.bottom > vh ? 0 : steps - 1;
    };
    const fromSide = (y = window.scrollY, vh = window.innerHeight) => {
      if (held.size > 0 || !track) return;
      applyStep(sideOf(y, vh));
    };
    const listen = (on) => {
      if (on && !unsubscribe) unsubscribe = bus.subscribe(({ y, vh }) => fromSide(y, vh));
      else if (!on && unsubscribe) { unsubscribe(); unsubscribe = null; }
    };
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const i = Number(entry.target.dataset.beat);
        if (entry.isIntersecting) { held.add(i); applyStep(i); } else held.delete(i);
      }
      setLive(held.size > 0);
      bus.hold(id, held.size > 0);
      fromSide();
    }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
    beatsRef.current.slice(0, steps).forEach((node) => node && io.observe(node));
    const near = track ? new IntersectionObserver((entries) => {
      const on = entries[entries.length - 1].isIntersecting;
      listen(on);
      if (handleRef.current) controller.near(handleRef.current, on);
      fromSide();
    }, { rootMargin: '100% 0px 100% 0px', threshold: 0 }) : null;
    if (track) near.observe(track);
    return () => {
      io.disconnect();
      near?.disconnect();
      listen(false);
      if (handleRef.current) controller.near(handleRef.current, false);
      held.clear();
      bus.hold(id, false);
    };
  }, [pinned, steps, applyStep, id]);

  useEffect(() => { onStepRef.current?.(step); }, [step]);

  // Scale marked screens to their room, once per size change (never per scroll frame): a width change, or a height
  // change big enough to matter (a rotated phone, a resized window), not the few px a browser bar moves.
  useEffect(() => {
    const stage = stageRef.current;
    const root = rootRef.current;
    if (!pinned || !stage || !root || typeof ResizeObserver === 'undefined') return undefined;
    let frame = 0;
    let last = { w: -1, h: -1 };
    // Not while the section is undrawn (content-visibility): the observer below runs it once it is drawn.
    const run = (force = false) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (undrawn(stage)) return;
        const w = stage.clientWidth;
        const h = stage.clientHeight;
        if (!force && Math.abs(w - last.w) < 1 && Math.abs(h - last.h) < 16) return;
        last = { w, h };
        fitAll(stage);
        measureSlack(root, stage);
      });
    };
    const observer = new ResizeObserver(() => run());
    observer.observe(stage);
    stage.querySelectorAll('[data-ss-fit]').forEach((node) => node.parentElement && observer.observe(node.parentElement));
    // A fitted node changes its own width when it is scaled, so only unscaled end markers are watched.
    stage.querySelectorAll('[data-ss-end]:not([data-ss-fit])').forEach((node) => observer.observe(node));
    document.fonts?.ready.then(() => run(true)).catch(() => {});
    run(true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      stage.querySelectorAll('[data-ss-fit]').forEach((node) => node.style.removeProperty('--ss-fit'));
      root.style.removeProperty('--ss-slack');
    };
  }, [pinned]);

  // Brings step i on stage: instant, never a glide (the stage is sticky, so the page's move to the step's
  // resting place is invisible and the content settles over 240 ms). `instant` is accepted and ignored.
  const goTo = useCallback((i) => {
    const n = Math.max(0, Math.min(steps - 1, i));
    if (pinned && handleRef.current) { controller.goTo(handleRef.current, n); return; }
    applyStep(n);
  }, [pinned, steps, applyStep]);

  // Focus moving into a step that is off stage brings that step on (keyboard reading order).
  const onFocus = useCallback((event) => {
    const host = event.target.closest?.('[data-ss-step]');
    if (!host) return;
    const i = Number(host.dataset.ssStep);
    if (Number.isFinite(i) && i !== stepRef.current) goTo(i);
  }, [goTo]);

  const api = useMemo(() => ({ step, pinned, reduced, live, goTo, steps }), [step, pinned, reduced, live, goTo, steps]);

  return (
    <div
      ref={rootRef}
      className={`ss ${className}`.trim()}
      data-pinned={pinned ? 'true' : 'false'}
      data-reduced={reduced ? 'true' : 'false'}
      data-live={live && !quiet ? 'true' : 'false'}
      data-step={step}
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
