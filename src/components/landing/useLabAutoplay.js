'use client';

// The Mistake Lab plays itself (LabCinema look="next" only; owner LK364, 21 Nov 2026: "rather than that, the scrolling can
// also be made automatic, and the entire thing can be going on automatically unless someone decides to do it manually, scroll
// by scroll ... unless someone is not touching the screen, it should be an automatic animation").
//
// A pass: the story becomes live (a step's beat is under the middle of the window, so the stage is held). The gesture that
// brought it there may still be running; its input in that first moment (and while it goes on, up to 700 ms after its last
// event) is the entry, not a takeover. Then each scene's cursor script runs (LabNextScreens), its finished screen holds
// 1.2 s, and the story moves to the next scene through the story's own goTo (storyController: the page goes to that step's
// resting place, the step rail, the words and the screen change exactly as for the reader's own scroll). After the fifth scene
// it stops; the reader scrolls on.
// Takeover: any real touch, wheel, key or press after the entry (isTrusted) hands the rest of this pass to the reader, at
// once (a pending move is cancelled; nothing is moving the page between moves, so nothing fights a flick). A tap on the step
// rail is a choice of scene, not a takeover: the story goes there and plays on from it. A tap inside a screen is a takeover
// (CursorDemo tells us). Never under reduced motion or while the tab is hidden. A new pass starts when the Lab comes back.
// No layout read, no frame loop: timers and the browser's own input events only.
import { useCallback, useEffect, useRef } from 'react';

const HOLD_MS = 1200;
const ENTRY_QUIET_MS = 700;

export function useLabAutoplay({ enabled, live, step, steps, goTo }) {
  const taken = useRef(false);
  const entryUntil = useRef(0);
  const timer = useRef(0);
  const stepRef = useRef(step);
  const liveRef = useRef(live);
  const goRef = useRef(goTo);
  useEffect(() => { stepRef.current = step; liveRef.current = live; goRef.current = goTo; }, [step, live, goTo]);

  const cancel = useCallback(() => { window.clearTimeout(timer.current); timer.current = 0; }, []);

  // A pass begins when the story comes live and ends when it leaves.
  useEffect(() => {
    if (!enabled || !live) return undefined;
    taken.current = false;
    entryUntil.current = performance.now() + ENTRY_QUIET_MS;
    const onInput = (event) => {
      if (!event.isTrusted) return;
      // The step rail is the reader picking a scene: pick() below decides what that means.
      if (event.target?.closest?.('.lc__rail')) return;
      const now = performance.now();
      if (now < entryUntil.current) { entryUntil.current = now + ENTRY_QUIET_MS; return; }
      taken.current = true;
      cancel();
    };
    const onVisibility = () => { if (document.hidden) cancel(); };
    const opts = { capture: true, passive: true };
    const kinds = ['touchstart', 'wheel', 'keydown', 'pointerdown'];
    for (const kind of kinds) window.addEventListener(kind, onInput, opts);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      for (const kind of kinds) window.removeEventListener(kind, onInput, opts);
      document.removeEventListener('visibilitychange', onVisibility);
      cancel();
      taken.current = false;
    };
  }, [enabled, live, cancel]);

  /** A scene's cursor script finished: hold its finished screen, then move on (never past the last scene). */
  const done = useCallback((i) => {
    if (!enabled || taken.current || document.hidden || !liveRef.current || i !== stepRef.current || i >= steps - 1) return;
    cancel();
    const advance = () => {
      timer.current = 0;
      if (taken.current || document.hidden || !liveRef.current || stepRef.current !== i) return;
      // Still inside the entry gesture: wait for it to end before moving.
      const wait = entryUntil.current - performance.now();
      if (wait > 0) { timer.current = window.setTimeout(advance, wait + 50); return; }
      goRef.current(i + 1);
    };
    timer.current = window.setTimeout(advance, HOLD_MS);
  }, [enabled, steps, cancel]);

  /** The reader took over inside a screen (CursorDemo's own takeover). */
  const take = useCallback(() => { taken.current = true; cancel(); }, [cancel]);

  /** The reader picked a scene on the rail: play on from it. */
  const pick = useCallback(() => { taken.current = false; entryUntil.current = 0; cancel(); }, [cancel]);

  return { done, take, pick };
}
