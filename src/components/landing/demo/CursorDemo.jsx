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
//       the target will be: the same single read, then one write. `settle: 'pane selector'`: after the click, that pane
//       eases back to its top (a key that brings a new question, which starts at the top of the paper).
//   { wait: 600 }                         pause
//   { run: (stage) => {} }                anything else the screen needs (rare; prefer a real click)
// When the last step has run, the cursor fades and onDone() is called. The parent decides what comes next (the frame moves to
// its next row and remounts this with a new key, which also resets the screen).
//
// Rules (the 20 Nov speed rules, AGENT-COMMON.md): no frame loop. One layout read per step (the target's box and the stage's,
// while the stage is on screen). The cursor moves by a CSS transition on transform only. Reduced motion: no cursor and no
// script; the screen is still there to use by hand. A real press or key inside the stage (isTrusted) is the reader taking
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

export default function CursorDemo({ steps, playing = false, onDone, onTakeover, touch, className = '', children }) {
  const stageRef = useRef(null);
  const cursorRef = useRef(null);
  const ringRef = useRef(null);
  const doneRef = useRef(onDone);
  const takeRef = useRef(onTakeover);
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
    stage?.addEventListener('pointerdown', take);
    stage?.addEventListener('keydown', take);
    return () => {
      window.removeEventListener('wheel', mark, opts);
      window.removeEventListener('touchmove', mark, opts);
      window.removeEventListener('keydown', mark, opts);
      window.removeEventListener('pointerdown', mark, opts);
      stage?.removeEventListener('pointerdown', take);
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

    const place = (x, y, ms) => {
      cursor.style.transitionDuration = `${Math.max(0, ms)}ms`;
      cursor.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    };
    // The pane's scroll write: eased by the browser (no frame loop here), instant under reduced motion.
    const scrollPane = (pane, top) => {
      const behavior = reducedNow() ? 'auto' : 'smooth';
      try { pane.scrollTo({ top, behavior }); } catch { pane.scrollTop = top; }
    };
    // `reveal`: how far the pane must move (px, + down) so the target shows with a margin; 0 when it already shows.
    const revealBy = (el, r, selector) => {
      const pane = selector ? el.closest(selector) : null;
      if (!pane) return { pane: null, dy: 0 };
      const p = pane.getBoundingClientRect();
      const m = 12;
      let dy = 0;
      if (r.bottom > p.bottom - m) dy = r.bottom - (p.bottom - m);
      if (r.top - dy < p.top + m) dy = r.top - (p.top + m);
      const max = pane.scrollHeight - pane.clientHeight;
      const top = Math.max(0, Math.min(max, pane.scrollTop + dy));
      return { pane, dy: top - pane.scrollTop, top };
    };
    const pointOf = (el, at = [0.5, 0.5], reveal = null) => {
      const s = stage.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const k = stage.offsetWidth ? s.width / stage.offsetWidth : 1;
      const shift = revealBy(el, r, reveal);
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

    (async () => {
      // Enter from the stage's lower right, already moving.
      const startX = stage.offsetWidth * 0.82;
      const startY = stage.offsetHeight * 0.9;
      place(startX, startY, 0);
      await sleep(30);
      if (stopped) return;
      cursor.dataset.shown = 'true';
      await sleep(190);
      for (const step of steps) {
        if (stopped) return;
        if (step.wait) { await sleep(step.wait); continue; }
        if (step.run) { step.run(stage); await sleep(step.dwell ?? 0); continue; }
        const el = step.target ? stage.querySelector(step.target) : null;
        if (!el) continue;
        stage.dataset.demoPhase = 'move';
        const [x, y] = pointOf(el, step.at, step.reveal);
        place(x, y, step.move ?? MOVE_MS);
        await sleep(step.move ?? MOVE_MS);
        if (stopped) return;
        if (step.click) {
          stage.dataset.demoPhase = 'press';
          press(x, y);
          await sleep(PRESS_MS);
          if (stopped) return;
          fire(el, step.pointer);
          if (step.settle) { const pane = stage.querySelector(step.settle); if (pane && pane.scrollTop) scrollPane(pane, 0); }
        }
        await sleep(step.dwell ?? DWELL_MS);
      }
      if (stopped) return;
      delete cursor.dataset.shown;
      await sleep(260);
      if (!stopped) doneRef.current?.();
    })();

    return () => {
      stopped = true;
      for (const id of timers) window.clearTimeout(id);
      timers.clear();
      cursor.classList.remove('is-press');
      delete cursor.dataset.shown;
      delete stage.dataset.demoPhase;
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
