'use client';

// The Mistake Lab plays itself (LabCinema look="next" only; owner LK364, 21 Nov 2026: "the entire thing can be going on
// automatically unless someone decides to do it manually, scroll by scroll ... unless someone is not touching the screen, it
// should be an automatic animation"; LK365, the same evening: "when one animation ends ... It should happen as soon as one
// animation ends, but it is taking a lot more time").
//
// A pass: the story is live (a step's beat is under the middle of the window). Each scene's cursor script runs
// (LabNextScreens); the moment it ends (done) the story moves to the next scene through the story's own goTo
// (storyController: the page goes to that step's resting place, and the step's cards and words change at once,
// lab-next.css). The last scene rests.
// Not touching means playing: a touch, a wheel, a key or a scroll of the page pauses the autoplay only while the reader is
// acting. It never moves the page while a finger is down or within QUIET_MS of the reader's last input or scroll; once the
// page has been still that long it carries on from the scene on screen (a scene whose script has run moves to the next; a
// scene still playing moves on when its script ends). A tap inside a screen is the reader using it (CursorDemo stops its
// cursor and tells us): the scene counts as seen and the autoplay carries on TAP_QUIET_MS after their last tap. A tap on the
// step rail picks a scene: it plays from there. Scrolling by hand between scenes works at any moment, both ways (the
// controller's own gesture rules; this file only waits). Never under reduced motion or while the tab is hidden. A new pass
// starts each time the Lab comes back.
// No frame loop and no layout read per event: one timer and the browser's own input events (passive), timestamps only. The
// one read is `where` (LabCinema: is the page inside the held stretch, just short of it, or out?), asked once at the moment
// of a move.
import { useCallback, useEffect, useRef } from 'react';

/** Still and untouched this long, the Lab carries on. */
export const QUIET_MS = 2000;
/** After the reader's last tap inside a screen. */
export const TAP_QUIET_MS = 4000;
/** The page's own move (goTo) shows up as scroll events for a moment: those are not the reader's. */
const SELF_MOVE_MS = 400;
/** A step put back this soon after the autoplay's move was not the reader's choice to stay: see the step effect. */
const BOUNCE_MS = 700;
/** The story's own fling window (storyController FLING_MS, 3 s) and a little more. */
const FLING_GUARD_MS = 3200;
/**
 * Entering by wheel (critic round, 21 Nov 2026 evening): a mouse wheel's scroll is the browser's own (storyController), so a
 * normal flick into the Lab from above (9 notches, 900 px) ran on past Chapters into Time before its first scene had played.
 * A wheel that brings the Lab on from above and runs on one scene within ENTRY_MS of the pass starting is taken as the
 * arrival: once the wheel has rested WHEEL_REST_MS, the Lab goes back to its first scene, as a phone's first fling lands there.
 */
const ENTRY_MS = 1600;
const WHEEL_REST_MS = 200;
/**
 * While such an arrival may still be put back (the wheel turning, or until ARRIVING_TAIL_MS after its last notch: the
 * browser's smooth scroll runs on that long), `arriving(true)`: the Lab delays its cards' slide a little (lab-next.css
 * data-lnx-arriving), so a scene the wheel passes for a moment never starts to rise only to drop back.
 */
const ARRIVING_TAIL_MS = 450;

export function useLabAutoplay({ enabled, live, step, steps, goTo, where, arriving }) {
  const finished = useRef(new Set()); // scenes whose script has run (or that the reader has used) in this pass
  const quietUntil = useRef(0);
  const fingers = useRef(0);
  const selfUntil = useRef(0);
  const timer = useRef(0);
  const stepRef = useRef(step);
  const liveRef = useRef(live);
  const goRef = useRef(goTo);
  const whereRef = useRef(where);
  const released = useRef(-Infinity); // when the reader's last finger left the glass
  const onRef = useRef(false);
  const moved = useRef({ to: -1, t: -Infinity }); // the autoplay's last move
  const halted = useRef(false);
  const entry = useRef(null); // { at, fromAbove, used }: how this pass began
  const lastWheel = useRef(-Infinity);
  const landTimer = useRef(0);
  const arriveTimer = useRef(0);
  const arrivingRef = useRef(arriving);
  useEffect(() => { liveRef.current = live; goRef.current = goTo; whereRef.current = where; arrivingRef.current = arriving; }, [live, goTo, where, arriving]);

  const cancel = useCallback(() => { window.clearTimeout(timer.current); timer.current = 0; }, []);

  // Move on if the scene on screen has played and the reader is not acting; otherwise wait (and look again when they stop).
  // A named function, so the waits below can call it again (it is its own retry).
  const check = useCallback(function look() {
    cancel();
    if (!onRef.current || halted.current || !liveRef.current || document.hidden) return;
    const i = stepRef.current;
    if (!finished.current.has(i) || i >= steps - 1) return;
    if (fingers.current > 0) return; // touchend looks again
    const wait = quietUntil.current - performance.now();
    if (wait > 0) { timer.current = window.setTimeout(look, wait + 20); return; }
    // Where is the page? 'out': the reader has scrolled well up past the first scene's resting place (or on past the last):
    // never pull them back in; the next input looks again. 'near': the Lab is in view but the page stopped a little short of
    // the held stretch; the move takes it in, so it waits until the reader's last swipe is FLING_GUARD_MS old (the story
    // reads a crossing that soon after a swipe as that swipe's momentum and lands it back on the first scene).
    const place = whereRef.current ? whereRef.current() : 'in';
    if (place === 'out') return;
    if (place === 'near') {
      const guard = released.current + FLING_GUARD_MS - performance.now();
      if (guard > 0) { timer.current = window.setTimeout(look, guard + 20); return; }
    }
    selfUntil.current = performance.now() + SELF_MOVE_MS;
    moved.current = { to: i + 1, t: performance.now() };
    stepRef.current = i + 1;
    goRef.current(i + 1);
  }, [cancel, steps]);

  // A step change (the autoplay's, the reader's swipe, the rail): the scene that arrives plays from the top (its screen
  // remounts, LabNextScreens), so it has not finished yet.
  // If the story puts the step straight back (the reader has scrolled up past the first scene's resting place, so the page
  // is above the hold and the story shows its first step again), the reader is leaving the Lab: the autoplay stops for
  // this pass rather than pull them back in.
  useEffect(() => {
    if (step === moved.current.to - 1 && performance.now() - moved.current.t < BOUNCE_MS) { halted.current = true; cancel(); }
    stepRef.current = step;
    finished.current.delete(step);
    // The arrival's wheel ran on one scene (see ENTRY_MS): back to the first scene once the wheel rests.
    const e = entry.current;
    const t = performance.now();
    if (step === 1 && e && e.fromAbove && !e.used && onRef.current && !halted.current && moved.current.to !== 1
      && t - e.at < ENTRY_MS && t - lastWheel.current < 400 && !finished.current.has(0)) {
      e.used = true;
      const land = () => {
        const rest = lastWheel.current + WHEEL_REST_MS - performance.now();
        if (rest > 0) { landTimer.current = window.setTimeout(land, rest + 10); return; }
        landTimer.current = 0;
        if (!onRef.current || halted.current || stepRef.current !== 1) return;
        selfUntil.current = performance.now() + SELF_MOVE_MS;
        stepRef.current = 0;
        goRef.current(0);
        window.clearTimeout(arriveTimer.current);
        arriveTimer.current = window.setTimeout(() => arrivingRef.current?.(false), 120);
      };
      window.clearTimeout(landTimer.current);
      landTimer.current = window.setTimeout(land, WHEEL_REST_MS);
    }
  }, [step, cancel]);

  // The wheel's last turn, watched whenever the autoplay may run (the arrival's wheel starts before the pass does).
  useEffect(() => {
    if (!enabled) return undefined;
    const mark = (event) => { if (event.isTrusted) lastWheel.current = performance.now(); };
    window.addEventListener('wheel', mark, { capture: true, passive: true });
    return () => window.removeEventListener('wheel', mark, { capture: true, passive: true });
  }, [enabled]);

  // A pass begins when the story comes live and ends when it leaves.
  useEffect(() => {
    onRef.current = enabled && live;
    if (!enabled || !live) return undefined;
    finished.current.clear();
    fingers.current = 0;
    halted.current = false;
    entry.current = { at: performance.now(), fromAbove: stepRef.current === 0, used: false };
    // An arrival from above by wheel: hold the cards' slide back a little until the wheel has rested (ARRIVING_TAIL_MS).
    const settleArrival = () => {
      const t = performance.now();
      const tail = lastWheel.current + ARRIVING_TAIL_MS - t;
      if (tail > 0 && t - entry.current.at < ENTRY_MS && !landTimer.current) { arriveTimer.current = window.setTimeout(settleArrival, tail + 10); return; }
      if (!landTimer.current) arrivingRef.current?.(false); else arriveTimer.current = window.setTimeout(settleArrival, 60);
    };
    if (entry.current.fromAbove && performance.now() - lastWheel.current < ARRIVING_TAIL_MS) { arrivingRef.current?.(true); settleArrival(); }
    const hush = (ms) => { quietUntil.current = Math.max(quietUntil.current, performance.now() + ms); };
    const onTouch = (event) => {
      if (!event.isTrusted) return;
      fingers.current = event.touches ? event.touches.length : 0;
      if (event.type === 'touchend' || event.type === 'touchcancel') released.current = performance.now();
      hush(QUIET_MS);
      if (fingers.current > 0) cancel(); else check();
    };
    // A pending move looks at quietUntil again when its timer fires, so input only pushes the time on.
    const later = () => { if (!timer.current && finished.current.has(stepRef.current)) timer.current = window.setTimeout(check, QUIET_MS + 20); };
    const onInput = (event) => {
      if (!event.isTrusted) return;
      if (event.type !== 'wheel' && landTimer.current) { window.clearTimeout(landTimer.current); landTimer.current = 0; } // a key or a press: their choice
      hush(QUIET_MS);
      later();
    };
    const onScroll = () => { if (performance.now() >= selfUntil.current) { hush(QUIET_MS); later(); } };
    const onVisibility = () => { if (document.hidden) cancel(); else check(); };
    const opts = { capture: true, passive: true };
    const touches = ['touchstart', 'touchmove', 'touchend', 'touchcancel'];
    const inputs = ['wheel', 'keydown', 'pointerdown'];
    for (const kind of touches) window.addEventListener(kind, onTouch, opts);
    for (const kind of inputs) window.addEventListener(kind, onInput, opts);
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      onRef.current = false;
      for (const kind of touches) window.removeEventListener(kind, onTouch, opts);
      for (const kind of inputs) window.removeEventListener(kind, onInput, opts);
      window.removeEventListener('scroll', onScroll, { passive: true });
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearTimeout(landTimer.current);
      landTimer.current = 0;
      window.clearTimeout(arriveTimer.current);
      arrivingRef.current?.(false);
      cancel();
    };
  }, [enabled, live, cancel, check]);

  /** Scene i's cursor script has ended: on to the next scene now, unless the reader is acting. */
  const done = useCallback((i) => {
    if (i !== stepRef.current) return;
    finished.current.add(i);
    check();
  }, [check]);

  /** The reader tapped inside scene i's screen: it counts as seen; carry on TAP_QUIET_MS after their last tap. */
  const take = useCallback((i) => {
    quietUntil.current = Math.max(quietUntil.current, performance.now() + TAP_QUIET_MS);
    if (i === stepRef.current) finished.current.add(i);
    check();
  }, [check]);

  /** The reader picked a scene on the rail: it plays from the top and the autoplay carries on from it. */
  const pick = useCallback(() => { cancel(); }, [cancel]);

  return { done, take, pick };
}
