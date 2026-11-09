"use client";

// ScrollStory: a landing section that holds still while the reader's gesture walks it through its steps.
//
//   <ScrollStory steps={4} className="lc" beat="78svh" label="Mistake Lab, step by step" Content={Stage} {...stageProps} />
//   function Stage({ step, seq, pinned, reduced, live, goTo, steps, ...stageProps }) { ... }
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
// Step-driven visuals. A step change writes data-step on the root straight away, and --ss-step on the few elements that
// read it (progress fills, the Lab's tab ink), so anything keyed to the step changes at once and cannot be left half
// done; React catches up in a transition, so the stage's own render never lands inside the gesture's frame. --ss-step
// is NOT written on the root: a custom property set there restyles everything under it (about 500 elements in the Lab,
// 50 ms at 4x CPU), a data attribute or a leaf's property costs a fraction of a millisecond. The IntersectionObserver
// on the beats still picks the step for a scroll the controller does not own (scrollbar, Home/End, find-in-page): the
// beat crossing the middle of the window wins, and a story entered from above opens on step one, from below on its last.
//
// Elements marked data-ss-fit are scaled once per resize to fit their parent (all measured first, then all written),
// and the band left under elements marked data-ss-end is measured as --ss-slack (centring, exit gap).
// FREE ON TOUCH (owner, 9 Nov 2026: "We don't like forcefully forcing people to scroll through the entire section. They
// can see if they want to."). A story holds only on a wide window driven by a mouse or trackpad (HELD_ON). On a phone, a
// tablet or any touch screen the page scrolls freely past every story: nothing holds, no gesture is owned, and each
// stage shows its steps as a card the reader can swipe sideways or tap through (each stage's unheld mode). The
// stylesheet repeats the query (scroll-story.css), so a phone never reserves a held height before the page hydrates.
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
import { predraw } from './storyPredraw.mjs';

// --ss-fit and --ss-slack are registered as non-inherited (ship gate, 4 Nov 2026). A plain custom property inherits, so
// writing one restyles every element under the node it is written on: --ss-fit on the Lab's four scenes cost 650
// restyled elements per pass (55 ms at 4x CPU, three passes on the first flick past the hero), --ss-slack on a story's
// root the whole story. Registered, a write restyles the node alone. Only the node reads --ss-fit
// (scroll-story.css); --ss-slack is read by the root and by the stage's children, so it is written on both.
function registerOwn() {
  if (typeof window === 'undefined' || typeof CSS === 'undefined' || typeof CSS.registerProperty !== 'function') return;
  for (const [name, syntax, initialValue] of [['--ss-fit', '<number>', '1'], ['--ss-slack', '<length>', '0px']]) {
    try { CSS.registerProperty({ name, syntax, inherits: false, initialValue }); } catch { /* registered already (hot reload) */ }
  }
}
registerOwn();

// Where a story may hold at all (FREE ON TOUCH above): a wide window whose main pointer is a mouse or trackpad.
export const HELD_ON = '(min-width: 960px) and (hover: hover) and (pointer: fine)';

// The elements that read --ss-step (it is written on each of them, never on the root).
const STEP_NODES = '.ss-fill, .lcd__tab-ink, [data-ss-var]';
const writeStep = (root, n) => { for (const node of root.querySelectorAll(STEP_NODES)) if (node.style.getPropertyValue('--ss-step') !== String(n)) node.style.setProperty('--ss-step', String(n)); };

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
function writeSlack(root, stage, value) {
  for (const node of [root, ...stage.children]) {
    if (value) node.style.setProperty('--ss-slack', value); else node.style.removeProperty('--ss-slack');
  }
}

function measureSlack(root, stage) {
  const ends = stage.querySelectorAll('[data-ss-end]');
  if (!ends.length) return;
  writeSlack(root, stage, '');
  let bottom = -Infinity;
  for (const node of ends) {
    const rect = node.getBoundingClientRect();
    if (rect.height > 0) bottom = Math.max(bottom, rect.bottom);
  }
  if (!Number.isFinite(bottom)) return;
  const box = stage.getBoundingClientRect();
  const padBottom = parseFloat(getComputedStyle(stage).paddingBottom) || 0;
  const slack = Math.max(0, Math.floor(box.bottom - padBottom - bottom));
  if (slack > 0) writeSlack(root, stage, `${slack}px`);
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
  // The step React shows, with the count of step changes that led to it (R3-D5, LK105): `seq` goes up by one on every
  // change and rides in the same transition as the step, so a stage can tell a fresh arrival from a re-render (the tour
  // hands it to the screen coming on stage as its activation epoch).
  const [shown, setShown] = useState({ step: 0, seq: 0 });
  const { step, seq } = shown;
  const [live, setLive] = useState(false);
  // The step as the controller sees it, written the moment a step is decided (React's own state catches up in a
  // transition, so it is never the one to ask inside a gesture).
  const stepRef = useRef(0);
  const seqRef = useRef(0);
  const handleRef = useRef(null);
  const onStepRef = useRef(onStep);
  useEffect(() => { onStepRef.current = onStep; }, [onStep]);

  const applyStep = useCallback((n) => {
    const next = Math.max(0, Math.min(steps - 1, n));
    if (stepRef.current === next) return;
    stepRef.current = next;
    const root = rootRef.current;
    seqRef.current += 1;
    const change = { step: next, seq: seqRef.current };
    if (root) { root.dataset.step = String(next); writeStep(root, next); }
    startTransition(() => setShown(change));
  }, [steps]);

  useEffect(() => {
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const heldQuery = hold ? window.matchMedia(hold) : null;
    const wideQuery = window.matchMedia(HELD_ON);
    const sync = () => {
      const calmNow = reducedNow();
      setReduced(calmNow);
      // The share link's test switch (TestBar.jsx) may force every screen free or held: html[data-scroll].
      const forced = document.documentElement.getAttribute('data-scroll');
      const wide = forced === 'held' ? true : forced === 'free' ? false : wideQuery.matches;
      setPinned(typeof IntersectionObserver !== 'undefined' && wide && (!heldQuery || heldQuery.matches) && !(holdCalm && calmNow));
    };
    sync();
    calm.addEventListener?.('change', sync);
    heldQuery?.addEventListener?.('change', sync);
    wideQuery.addEventListener?.('change', sync);
    const watch = typeof MutationObserver !== 'undefined' ? new MutationObserver(sync) : null;
    watch?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion', 'data-scroll'] });
    return () => { calm.removeEventListener?.('change', sync); heldQuery?.removeEventListener?.('change', sync); wideQuery.removeEventListener?.('change', sync); watch?.disconnect(); };
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
    // A declared jump passes the beats on its way without showing them. Once it has landed (the bus says so, once), the
    // beat that crosses the middle of the window owns the step: a jump up to a story's heading lands above its first
    // rest, and without this the stage would keep the last scene it had until the reader scrolled. Two frames later, so
    // the observer has reported the landing position; never on any other frame (a step the controller has just
    // committed is the controller's until the observer catches up).
    let landing = 0;
    const readLanding = () => {
      landing = 0;
      if (!bus.jumping() && held.size > 0 && !held.has(stepRef.current)) applyStep(Math.min(...held));
    };
    const fromSide = (y = window.scrollY, vh = window.innerHeight, landed = false) => {
      if (!track) return;
      if (held.size > 0) {
        if (landed && !landing) landing = window.requestAnimationFrame(() => { landing = window.requestAnimationFrame(readLanding); });
        return;
      }
      applyStep(sideOf(y, vh));
    };
    const listen = (on) => {
      if (on && !unsubscribe) unsubscribe = bus.subscribe(({ y, vh, landed }) => fromSide(y, vh, landed));
      else if (!on && unsubscribe) { unsubscribe(); unsubscribe = null; }
    };
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const i = Number(entry.target.dataset.beat);
        // A declared jump (a nav link's glide) passes the beats on its way: they do not show; the settle at its end does.
        if (entry.isIntersecting) { held.add(i); if (!bus.jumping()) applyStep(i); } else held.delete(i);
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
      window.cancelAnimationFrame(landing);
      if (handleRef.current) controller.near(handleRef.current, false);
      held.clear();
      bus.hold(id, false);
    };
  }, [pinned, steps, applyStep, id]);

  // A story whose section is not drawn yet (content-visibility) is drawn once while the page is idle, so its first
  // style and layout never land inside the reader's gesture (storyPredraw.mjs, LK81).
  useEffect(() => {
    const stage = stageRef.current;
    if (!pinned || !stage || !undrawn(stage)) return;
    const section = rootRef.current?.closest('main > *');
    if (section) predraw(section);
  }, [pinned]);

  useEffect(() => { onStepRef.current?.(step); }, [step]);
  // After every render: a fill or a tab ink that React has just mounted or re-created gets the current step.
  useEffect(() => { if (rootRef.current) writeStep(rootRef.current, stepRef.current); });

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
      writeSlack(root, stage, '');
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

  const api = useMemo(() => ({ step, seq, pinned, reduced, live, goTo, steps }), [step, seq, pinned, reduced, live, goTo, steps]);

  return (
    <div
      ref={rootRef}
      className={`ss ${className}`.trim()}
      data-pinned={pinned ? 'true' : 'false'}
      data-reduced={reduced ? 'true' : 'false'}
      data-live={live && !quiet ? 'true' : 'false'}
      data-step={step}
      style={{ '--ss-steps': steps, ...(beat ? { '--ss-beat': beat } : null) }}
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
