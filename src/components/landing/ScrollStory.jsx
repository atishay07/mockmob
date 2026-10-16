"use client";

// ScrollStory: a landing section that holds still while the reader's scroll walks it through its steps.
//
//   <ScrollStory steps={4} className="lc" beat="78svh" label="Mistake Lab, step by step" Content={Stage} {...stageProps} />
//   function Stage({ step, pinned, reduced, live, goTo, pause, steps, ...stageProps }) { ... }
//
// The stage is position: sticky inside a taller track, so the browser does the holding. Each step has a
// resting place in the held scroll (the first at the start of the hold, the last at its end, the rest
// evenly between) and owns the band around it (one invisible "beat" per step); an IntersectionObserver
// on the beats picks the step whose beat crosses the middle of the window, so nothing runs per frame.
// The page scrolls through the story natively (see "Scroll-linked" below): the step follows the scroll
// position, and a stopped page settles onto the step on stage only when its resting place is a short way
// ahead. The track is also a named view timeline (--ss-track), which
// consumers use for compositor-only progress fills (see scroll-story.css). Elements marked data-ss-fit
// are scaled once per resize to fit their parent, so short phones and landscape keep the hold instead
// of clipping the screen, and the band left under elements marked data-ss-end is measured as
// --ss-slack (centring, exit gap).
// Every step's content stays in the DOM in reading order; focusing into a step brings it on stage, and
// the scrollbar, find-in-page and screen readers still move through the story by position.
// Reduced motion keeps the hold with calm, instant swaps. Without IntersectionObserver the steps stack.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@/app/scroll-story.css';
import { drawnAncestor, settleUndrawn, undrawn } from './undrawn';

const reducedNow = () => {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.dataset.motion === 'reduced') return true;
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

// Scroll-linked. Nothing here cancels a wheel, a swipe or a scroll key: the page scrolls through a story exactly
// as it scrolls anywhere else, so a fling or a trackpad stream moves the page as far as it would move past any
// other section, and the step on stage is simply the beat crossing the middle of the window. Only once the
// scroll has stopped (SETTLE_MS without a scroll event, no finger down) does the story tidy up: when the step on
// stage rests a short way further on in the direction the reader was going (at most SNAP_REACH of the gap
// between two steps), the page eases onto that resting place. It never pulls the reader back against their
// direction, never runs under reduced motion, and any wheel, touch, key or scroll of the reader's cancels it.
// A step's tab (goTo) glides the page to that step's resting place in STEP_MS. A screen inside the stage may ask
// the story to stay on its step while the reader reads it (pause): the story then keeps that step until the
// screen lets go or the page leaves the story.
const STEP_MS = 440;
const SETTLE_MS = 160;
const SNAP_REACH = 0.35;
const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Spacebar', 'Home', 'End']);
const easeOut = (t) => 1 - (1 - t) ** 3;
const now = () => performance.now();
// A section held back by content-visibility is far off screen; reading geometry inside it would lay it out.
const skipped = (node) => {
  if (typeof node.checkVisibility !== 'function') return false;
  try { return !node.checkVisibility({ contentVisibilityAuto: true }); } catch { return false; }
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
// A page may give a story its expected slack in CSS before it is first drawn (landing.css), so the page's
// height is right from the start: the measure is taken with the slack at 0 (the centring translate moves the
// end markers) and always written, 0 included, so a measured 0 never falls back to that expectation.
function measureSlack(root, stage) {
  const ends = stage.querySelectorAll('[data-ss-end]');
  if (!ends.length) { root.style.removeProperty('--ss-slack'); return; }
  root.style.setProperty('--ss-slack', '0px');
  let bottom = -Infinity;
  for (const node of ends) {
    const rect = node.getBoundingClientRect();
    if (rect.height > 0) bottom = Math.max(bottom, rect.bottom);
  }
  if (!Number.isFinite(bottom)) return;
  const box = stage.getBoundingClientRect();
  const padBottom = parseFloat(getComputedStyle(stage).paddingBottom) || 0;
  const slack = Math.max(0, Math.floor(box.bottom - padBottom - bottom));
  root.style.setProperty('--ss-slack', `${slack}px`);
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
  const stepRef = useRef(0);
  // True while the page glides to a step this story chose: the beats it passes on the way do not show.
  const steering = useRef(false);
  // True while a screen on stage keeps its step (pause): the beats do not change it.
  const paused = useRef(false);
  const story = useRef(null);
  const onStepRef = useRef(onStep);
  useEffect(() => { onStepRef.current = onStep; }, [onStep]);
  // A held story must not move under the reader: settle the page's height before a fast scroll reaches it
  // (undrawn.js; once per page, shared by every story).
  useEffect(() => { settleUndrawn(); }, []);

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
      if (held.size > 0 || !track || steering.current || paused.current) return;
      // A section not drawn yet is far off screen: its reserved box gives the side without laying it out.
      const box = drawnAncestor(track).getBoundingClientRect();
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
        if (entry.isIntersecting) { held.add(i); if (!steering.current && !paused.current) setStep(i); } else held.delete(i);
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

  useEffect(() => { stepRef.current = step; onStepRef.current?.(step); }, [step]);

  // Scale marked screens to their room once per resize (never per scroll frame).
  useEffect(() => {
    const stage = stageRef.current;
    const root = rootRef.current;
    if (!pinned || !stage || !root || typeof ResizeObserver === 'undefined') return undefined;
    let frame = 0;
    // Not while the section is undrawn (content-visibility): the observer below runs it once it is drawn.
    const run = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { if (undrawn(stage)) return; fitAll(stage); measureSlack(root, stage); }); };
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

  // Scroll-linked (see the top of the file): the page scrolls natively; the story only settles a stopped page onto
  // the step already on stage, and glides to a step its tabs ask for. The listeners exist only while the story is
  // within a screen of the window.
  useEffect(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!pinned || !track || !stage || steps < 2) return undefined;
    let glide = 0;
    let settle = 0;
    let listening = false;
    let selfY = null; // the last scroll position this story set itself
    let lastY = window.scrollY;
    let dir = 0; // the way the reader last scrolled
    let touches = 0;

    // s: how far the page is into the track; hold: how far it can go with the stage held.
    // The stage (not the track, whose height is set exactly) is what waits while the story is undrawn.
    const locate = () => {
      if (skipped(stage)) return null;
      const box = track.getBoundingClientRect();
      return { s: -box.top, hold: Math.max(0, track.offsetHeight - stage.offsetHeight), top: window.scrollY + box.top };
    };
    const restOf = (n, at) => Math.round(at.top + (at.hold * n) / (steps - 1));
    const put = (y) => { selfY = Math.round(y); window.scrollTo({ top: y, behavior: 'instant' }); };
    const stopGlide = () => {
      if (glide) cancelAnimationFrame(glide);
      glide = 0;
      steering.current = false;
    };
    // The step for where the page is now (inside the hold), or the edge it lies beyond.
    const resync = () => {
      if (paused.current) return;
      const at = locate();
      if (!at) return;
      const gap = at.hold / (steps - 1);
      const n = at.s <= 0 ? 0 : at.s >= at.hold ? steps - 1 : Math.round(at.s / gap);
      stepRef.current = n;
      setStep(n);
    };
    // The glide is planned along the track, not the page: if a section above settles its height mid-glide
    // (scroll anchoring then shifts the page), the glide still lands exactly on the resting place.
    const glideTo = (target, at, ms) => {
      stopGlide();
      const t0 = now();
      const from = window.scrollY - at.top;
      const goal = target - at.top;
      if (ms <= 0 || Math.abs(goal - from) < 2) { put(target); return; }
      steering.current = true;
      const frame = () => {
        const t = Math.min(1, (now() - t0) / ms);
        const live = locate();
        const top = live && Math.abs(live.top - at.top) > 1 ? live.top : at.top; // real drift, not sub-pixel noise
        put(top + from + (goal - from) * easeOut(t));
        if (t < 1) glide = requestAnimationFrame(frame);
        else { glide = 0; steering.current = false; resync(); }
      };
      glide = requestAnimationFrame(frame);
    };

    const go = (n, { instant = false } = {}) => {
      const next = Math.max(0, Math.min(steps - 1, n));
      paused.current = false;
      stepRef.current = next;
      setStep(next);
      const at = locate();
      if (!at) return;
      glideTo(restOf(next, at), at, instant || reducedNow() ? 0 : STEP_MS);
    };

    // The page has stopped: settle it onto the step on stage when that step rests a little further on.
    const snap = () => {
      settle = 0;
      if (touches > 0 || steering.current || paused.current || reducedNow() || dir === 0) return;
      const at = locate();
      if (!at || at.s <= 1 || at.s >= at.hold - 1) return;
      const gap = at.hold / (steps - 1);
      const f = at.s / gap;
      const lower = Math.floor(f);
      const frac = f - lower;
      let n = -1;
      if (dir > 0 && frac >= 1 - SNAP_REACH) n = lower + 1;
      else if (dir < 0 && frac <= SNAP_REACH) n = lower;
      if (n < 0 || n > steps - 1) return;
      const target = restOf(n, at);
      const distance = Math.abs(target - window.scrollY);
      if (distance < 2) return;
      glideTo(target, at, Math.min(STEP_MS, 180 + distance * 0.6));
    };
    const later = () => { clearTimeout(settle); settle = setTimeout(snap, SETTLE_MS); };

    const onScroll = () => {
      const y = window.scrollY;
      const ours = selfY !== null && Math.abs(y - selfY) < 1.5;
      if (!ours) {
        // The reader moved the page (a scrollbar drag, a fling's tail): a glide of ours gives way at once.
        if (glide) stopGlide();
        if (Math.abs(y - lastY) >= 1) dir = y > lastY ? 1 : -1;
        selfY = null;
      }
      lastY = y;
      if (paused.current) {
        const at = locate();
        if (at && (at.s < -1 || at.s > at.hold + 1)) { paused.current = false; resync(); }
      }
      if (!ours) later();
    };
    const onInput = () => { if (glide) stopGlide(); };
    const onKey = (event) => { if (SCROLL_KEYS.has(event.key)) onInput(); };
    const onTouch = (event) => {
      touches = event.touches.length;
      if (event.type === 'touchstart') onInput();
      else if (touches === 0) later();
    };

    const listen = (on) => {
      if (on === listening) return;
      listening = on;
      const how = on ? 'addEventListener' : 'removeEventListener';
      window[how]('scroll', onScroll, { passive: true });
      window[how]('wheel', onInput, { passive: true });
      window[how]('keydown', onKey, { passive: true });
      window[how]('mousedown', onInput, { passive: true });
      for (const type of ['touchstart', 'touchend', 'touchcancel']) window[how](type, onTouch, { passive: true });
      if (on) { lastY = window.scrollY; dir = 0; } else { clearTimeout(settle); stopGlide(); touches = 0; }
    };
    const near = new IntersectionObserver((entries) => listen(entries[entries.length - 1].isIntersecting), { rootMargin: '100% 0px 100% 0px', threshold: 0 });
    near.observe(track);
    story.current = { go, resync };
    return () => {
      near.disconnect();
      listen(false);
      stopGlide();
      story.current = null;
    };
  }, [pinned, steps]);

  // A screen on stage can keep its step while it is read (the Lab's full repair): the scroll then moves the page
  // without changing the step until the screen lets go or the page leaves the story.
  const pause = useCallback((on) => {
    paused.current = !!on;
    if (!on) story.current?.resync();
  }, []);

  // Brings step i on stage: the page glides to the step's resting place (keyboard and reduced motion jump).
  const goTo = useCallback((i, { instant = false } = {}) => {
    const n = Math.max(0, Math.min(steps - 1, i));
    if (pinned && story.current) { story.current.go(n, { instant }); return; }
    setStep(n);
  }, [pinned, steps]);

  // Focus moving into a step that is off stage brings that step on (keyboard reading order).
  const onFocus = useCallback((event) => {
    const host = event.target.closest?.('[data-ss-step]');
    if (!host) return;
    const i = Number(host.dataset.ssStep);
    if (Number.isFinite(i) && i !== step) goTo(i, { instant: true });
  }, [goTo, step]);

  const api = useMemo(() => ({ step, pinned, reduced, live, goTo, pause, steps }), [step, pinned, reduced, live, goTo, pause, steps]);

  return (
    <div
      ref={rootRef}
      className={`ss ${className}`.trim()}
      data-pinned={pinned ? 'true' : 'false'}
      data-reduced={reduced ? 'true' : 'false'}
      data-live={live ? 'true' : 'false'}
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
