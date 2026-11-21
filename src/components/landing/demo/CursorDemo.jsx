'use client';

// A cursor that works a REAL product screen (owner LK363, 20 Nov 2026, after Preparoo: "they have a cursor which is updating
// the screen live while the card is going on ... show a cursor switching between MockMob style or NTA mode, doing some
// questions ... using actual screens and actual UI, because we are showing people how to use it, not just using random
// samples"). The children are the product's own interactive component (the landing's ExamScreen, Key cards, Bring a mistake,
// the Lab's screens). The cursor travels to an element of theirs and clicks it for real, so the screen changes the way it
// does for a student. Nothing is faked: a step whose element is missing is skipped.
//
// Steps, run in order while `playing`:
//   { target: 'css selector inside the stage', at: [0.5, 0.5], move: 620, click: true, dwell: 700, pointer: false }
//       travel to that point of the element (fractions of its box) in `move` ms, then (click) press and click it, then wait
//       `dwell` ms. `pointer: true` also sends pointerdown and pointerup first, for a control that listens to those.
//   `reveal: 'pane selector'`: the target sits in a pane that holds more than it shows (a phone runner's paper). Before the
//       move, the pane (never the page) eases its scrollTop just far enough to show the target, and the cursor goes to where
//       the target will be: the same single read, then one write. `snap: 'row selector'`: the rows the pane may stop at
//       (never a half-cut row at its top). `settle: 'pane selector'`: after the click, that pane
//       eases back to its top (a key that brings a new question, which starts at the top of the paper).
//   { wait: 600 }                         pause (`exact: true` on a wait or a click: never shortened to catch up, below)
//   { run: (stage) => {} }                anything else the screen needs (rare; prefer a real click)
//   `say: 'one short sentence'` on any step (owner LK365, 21 Nov 2026: "moving too fast and without much explanation"): the
//       line that explains this beat. As the step begins, onSay(text, beat) is called (beat counts the `say` steps from 0);
//       the parent shows it until the next `say`. `focus: 'selector'` on any step: that element carries `data-demo-focus`
//       (and the stage `data-demo-focusing`) from this step until the next step that names a `focus` (`focus: null` clears
//       it), so the screen's own CSS can stress the part the line is about. Attributes only: no layout is read for either.
// When the last step has run, the focus is cleared, the cursor fades and onDone() is called. The parent decides what comes next (the frame moves to
// its next row and remounts this with a new key, which also resets the screen).
//
// Rules (the 20 Nov speed rules, AGENT-COMMON.md): no frame loop. One layout read per step (the target's box and the stage's,
// while the stage is on screen). The cursor moves by a CSS transition on transform only. Reduced motion: no cursor and no
// script; the screen is still there to use by hand. A real click or key inside the stage (isTrusted) is the reader taking
// over: the script stops at once, the cursor goes, and onTakeover() is called. A step that would move the page (a control
// that focuses something) is undone, unless the reader moved the page themselves in the last half second.
// `data-demo-phase` on the stage ('move', 'press') says where the script is: inert, for the checks that photograph it.
// (21 Nov 2026: the zoom-follow camera this file carried for a while is gone; the frame shows a phone the exam as a phone
// shows it instead, ExamStage `inline`.)
import { useEffect, useRef, useState } from 'react';
import './cursor-demo.css';

const MOVE_MS = 620;
const DWELL_MS = 700;
const PRESS_MS = 130;

function reducedNow() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
}

export default function CursorDemo({ steps, playing = false, onDone, onTakeover, onSay, touch, className = '', children }) {
  const stageRef = useRef(null);
  const cursorRef = useRef(null);
  const ringRef = useRef(null);
  const doneRef = useRef(onDone);
  const takeRef = useRef(onTakeover);
  const sayRef = useRef(onSay);
  useEffect(() => { sayRef.current = onSay; }, [onSay]);
  const [taken, setTaken] = useState(false);
  // Arrow on a mouse screen, a fingertip on a touch screen (decided once, a tick after mount).
  const [tip, setTip] = useState(touch === true ? 'touch' : 'arrow');

  useEffect(() => { doneRef.current = onDone; takeRef.current = onTakeover; }, [onDone, onTakeover]);

  useEffect(() => {
    if (touch !== undefined) return undefined;
    const id = window.setTimeout(() => setTip(window.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'arrow'), 0);
    return () => window.clearTimeout(id);
  }, [touch]);

  // The reader's own input: inside the stage it takes over; anywhere, it marks "the reader moved the page".
  const lastInput = useRef(0);
  useEffect(() => {
    const mark = () => { lastInput.current = performance.now(); };
    const opts = { passive: true, capture: true };
    window.addEventListener('wheel', mark, { passive: true, capture: true });
    window.addEventListener('touchmove', mark, { passive: true, capture: true });
    window.addEventListener('keydown', mark, opts);
    window.addEventListener('pointerdown', mark, opts);
    const stage = stageRef.current;
    const take = (event) => {
      if (!event.isTrusted) return;
      setTaken(true);
      takeRef.current?.();
    };
    // A real click (or a key), not a press: a finger that only swipes the page across a stage sends pointerdown but never a
    // click, and must not stop the run (owner LK364, 21 Nov 2026: "sometimes it never starts").
    stage?.addEventListener('click', take);
    stage?.addEventListener('keydown', take);
    return () => {
      window.removeEventListener('wheel', mark, opts);
      window.removeEventListener('touchmove', mark, opts);
      window.removeEventListener('keydown', mark, opts);
      window.removeEventListener('pointerdown', mark, opts);
      stage?.removeEventListener('click', take);
      stage?.removeEventListener('keydown', take);
    };
  }, []);

  useEffect(() => {
    if (!playing || taken || !steps?.length || reducedNow()) return undefined;
    const stage = stageRef.current;
    const cursor = cursorRef.current;
    const ring = ringRef.current;
    if (!stage || !cursor) return undefined;
    let stopped = false;
    const timers = new Set();
    const sleep = (ms) => new Promise((resolve) => {
      const id = window.setTimeout(() => { timers.delete(id); resolve(); }, ms);
      timers.add(id);
    });
    // The script keeps to its own clock (critic round, 21 Nov 2026 evening: on a slow phone every timer and every re-render
    // came late, so a 15.7 s script played 18.8 s). Each pause is measured against where the script should be by now: a
    // wait that comes late is shortened by the lateness, never below half its length, a dwell never below three quarters; a
    // move always takes its full time (the cursor's own transition), and so do a beat's line (its `say` wait) and any step
    // marked `exact: true`. So the run as a whole keeps to scriptMs.
    let begun = 0;
    let planned = 0;
    const hold = (ms, floor = 0.5) => {
      planned += ms;
      const late = performance.now() - begun - (planned - ms);
      return sleep(Math.max(ms * floor, ms - Math.max(0, late)));
    };

    const place = (x, y, ms) => {
      cursor.style.transitionDuration = `${Math.max(0, ms)}ms`;
      cursor.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    };
    // The pane's scroll write: eased by the browser (no frame loop here), instant under reduced motion.
    // `data-scrolled` on the pane while it is not at its top (one-place.css draws a soft fade on that edge).
    const scrollPane = (pane, top) => {
      const behavior = reducedNow() ? 'auto' : 'smooth';
      if (top > 0) pane.dataset.scrolled = 'true'; else delete pane.dataset.scrolled;
      try { pane.scrollTo({ top, behavior }); } catch { pane.scrollTop = top; }
    };
    // `reveal`: where the pane must stand so the target shows. It never leaves a row half cut at the pane's top: the pane
    // stops at its own top, or at the top of one of `snap`'s rows (the question's head, its stem, an option), the first of
    // those that keeps the whole target in view, so as much of the question as possible stays above it.
    const revealBy = (el, r, selector, snap) => {
      const pane = selector ? el.closest(selector) : null;
      if (!pane) return { pane: null, dy: 0 };
      const p = pane.getBoundingClientRect();
      const m = 12;
      const max = pane.scrollHeight - pane.clientHeight;
      const at = (box) => box.top - p.top + pane.scrollTop; // a box's top in the pane's own content
      const need = Math.max(0, at(r) + r.height - (pane.clientHeight - m)); // the least scrollTop that shows the target's foot
      const stops = [0, ...(snap ? [...pane.querySelectorAll(snap)].map((n) => Math.round(at(n.getBoundingClientRect()) - 4)) : [])]
        .filter((t) => t >= 0 && t <= max).sort((a, b) => a - b);
      let top = stops.find((t) => t >= need && t <= at(r) - 4);
      if (top === undefined) top = Math.min(max, Math.max(0, need));
      return { pane, dy: top - pane.scrollTop, top };
    };
    const pointOf = (el, at = [0.5, 0.5], reveal = null, snap = null) => {
      const s = stage.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const k = stage.offsetWidth ? s.width / stage.offsetWidth : 1;
      const shift = revealBy(el, r, reveal, snap);
      if (shift.pane && shift.dy) scrollPane(shift.pane, shift.top);
      return [(r.left - s.left + r.width * at[0]) / (k || 1), (r.top - shift.dy - s.top + r.height * at[1]) / (k || 1)];
    };
    const fire = (el, pointer) => {
      const x = window.scrollX;
      const y = window.scrollY;
      if (pointer) {
        const opts = { bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true, button: 0 };
        el.dispatchEvent(new PointerEvent('pointerdown', opts));
        el.dispatchEvent(new PointerEvent('pointerup', opts));
      }
      el.click();
      const id = window.setTimeout(() => {
        timers.delete(id);
        const readerMoved = performance.now() - lastInput.current < 500;
        if (!readerMoved && (Math.abs(window.scrollY - y) > 2 || Math.abs(window.scrollX - x) > 2)) window.scrollTo(x, y);
      }, 0);
      timers.add(id);
    };
    const press = (x, y) => {
      cursor.classList.add('is-press');
      if (ring) {
        ring.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        ring.classList.remove('is-on');
        // Restart the ring's animation: the class comes back on the next timer tick.
        const id = window.setTimeout(() => { timers.delete(id); ring.classList.add('is-on'); }, 0);
        timers.add(id);
      }
      const id = window.setTimeout(() => { timers.delete(id); cursor.classList.remove('is-press'); }, PRESS_MS + 60);
      timers.add(id);
    };

    // `focus`: one element at a time carries data-demo-focus; the stage says a focus is on. Never while the part is out of the
    // window (critic round, 21 Nov 2026 evening: a stressed key bar under a phone's window left everything on screen dimmed,
    // with nothing lit): one read of its box as the beat begins, and a part not at least 24 px into the window is not stressed.
    let focused = null;
    const inWindow = (el) => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight - 24 && r.bottom > 24;
    };
    const focusOn = (selector) => {
      focused?.removeAttribute('data-demo-focus');
      focused = selector ? stage.querySelector(selector) : null;
      if (focused && !inWindow(focused)) focused = null;
      if (focused) { focused.setAttribute('data-demo-focus', ''); stage.dataset.demoFocusing = 'true'; } else delete stage.dataset.demoFocusing;
    };

    (async () => {
      // Enter from the stage's lower right, already moving.
      const startX = stage.offsetWidth * 0.82;
      const startY = stage.offsetHeight * 0.9;
      place(startX, startY, 0);
      begun = performance.now();
      await hold(30, 1);
      if (stopped) return;
      cursor.dataset.shown = 'true';
      await hold(190, 1);
      let beat = 0;
      for (const step of steps) {
        if (stopped) return;
        if (typeof step.say === 'string') { sayRef.current?.(step.say, beat); beat += 1; }
        if ('focus' in step) focusOn(step.focus);
        // A stressed part the screen has since removed (a rated card's keys): nothing is dimmed around nothing.
        else if (focused && !focused.isConnected) focusOn(null);
        // A beat's own line is never cut short (it is the reader's time to read, and a screen's own clock may be keyed to it),
        // nor a wait marked `exact` (one that waits for the screen's own clock to finish something).
        if (step.wait) { await hold(step.wait, typeof step.say === 'string' || step.exact ? 1 : 0.5); continue; }
        if (step.run) { step.run(stage); await hold(step.dwell ?? 0); continue; }
        const el = step.target ? stage.querySelector(step.target) : null;
        if (!el) continue;
        stage.dataset.demoPhase = 'move';
        const [x, y] = pointOf(el, step.at, step.reveal, step.snap);
        place(x, y, step.move ?? MOVE_MS);
        await hold(step.move ?? MOVE_MS, 1);
        if (stopped) return;
        if (step.click) {
          stage.dataset.demoPhase = 'press';
          press(x, y);
          await hold(PRESS_MS, 1);
          if (stopped) return;
          fire(el, step.pointer);
          if (step.settle) { const pane = stage.querySelector(step.settle); if (pane && pane.scrollTop) scrollPane(pane, 0); }
        }
        // A dwell waits for what the click started, so it gives up at most a quarter of its length.
        await hold(step.dwell ?? DWELL_MS, step.exact ? 1 : 0.75);
      }
      if (stopped) return;
      // The finished screen rests whole: no part stressed, no cursor.
      focusOn(null);
      delete cursor.dataset.shown;
      await hold(260, 1);
      if (!stopped) doneRef.current?.();
    })();

    return () => {
      stopped = true;
      for (const id of timers) window.clearTimeout(id);
      timers.clear();
      cursor.classList.remove('is-press');
      delete cursor.dataset.shown;
      delete stage.dataset.demoPhase;
      focusOn(null);
    };
  }, [playing, taken, steps]);

  return (
    <div ref={stageRef} className={`cd-stage ${className}`.trim()} data-demo-live={playing && !taken ? 'true' : undefined}>
      {children}
      <span ref={ringRef} className="cd-ring" aria-hidden="true" />
      <span ref={cursorRef} className="cd-cursor" data-tip={tip} aria-hidden="true">
        {tip === 'arrow' ? (
          <svg width="22" height="26" viewBox="0 0 22 26" focusable="false">
            <path d="M2.6 2.9 L2.6 21.2 L7.4 16.9 L10.6 24 L13.9 22.5 L10.8 15.6 L17.4 15.4 Z" fill="rgba(0,0,0,.22)" transform="translate(1.2 1.6)" />
            <path d="M1.5 1.5 L1.5 19.8 L6.3 15.5 L9.5 22.6 L12.8 21.1 L9.7 14.2 L16.3 14 Z" fill="#0c0d0a" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        ) : <span className="cd-cursor__tip" />}
      </span>
    </div>
  );
}
