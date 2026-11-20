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
//   `zoom: 2.1` (with the `zoom` prop below): the camera. Before the move, the screen zooms in at least that much and
//       enough that the target's own text is drawn at `zoom.minPx` or more, and the cursor lands on the target as it settles.
//       `frame: 'selector, selector'` composes the shot: the region is the target and every element inside the screen that
//       matches (the stem and the options for a pick; the chosen option for a key press). The scale fits that region's width
//       (between the floor above and `zoom.max`); a region too big for the floor keeps the target in view and as much of the
//       region as fits from its top left (the question's side). A later step without `zoom` keeps the scale; a step whose
//       target is outside the screen (a switch beside it) eases back out to 1.
//   { look: 'selector, selector', move: 450, dwell: 700 }
//       a look beat: no press; the camera pans to frame what matches (the new question's stem and options) and holds.
//       Without the camera it is a pause of the same length.
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
//
// The zoom-follow camera (21 Nov 2026: a phone showed the exam screen's stem at 7 px and its options at 5.7 px). Prop
// `zoom = { el, below = 640, minPx = 12, max = 3.2 }`: `el` is a selector inside the stage for the screen to move (it must
// fill its parent, which clips it: the monitor's glass, so the monitor stays a monitor); it works only while the window is
// narrower than `below`. It is one transform on that element (origin top left: translate, then scale), eased over the step's
// move, in the same single read as the cursor (the stage's box, the target's, the screen's parent's, the framed elements'
// boxes and the target's font size: all read before anything is written). At the end of the script and whenever the script
// stops, the screen goes back to its own size.
import { useEffect, useRef, useState } from 'react';
import './cursor-demo.css';

const MOVE_MS = 620;
const DWELL_MS = 700;
const PRESS_MS = 130;

function reducedNow() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
}

export default function CursorDemo({ steps, playing = false, onDone, onTakeover, touch, zoom = null, className = '', children }) {
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
    // The camera's screen, only on a narrow window (decided once per run; no layout read).
    const cam = zoom?.el && window.innerWidth < (zoom.below ?? 640) ? stage.querySelector(zoom.el) : null;
    let view = { s: 1, x: 0, y: 0 };
    const unzoom = (ms) => {
      if (!cam) return;
      cam.style.transition = ms ? `transform ${ms}ms cubic-bezier(.3, .7, .2, 1)` : '';
      cam.style.transform = '';
      view = { s: 1, x: 0, y: 0 };
    };
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
    // The camera's shot for a region of the screen. `box` is the screen's parent (its own size), `k` the stage's outside
    // scale, `region` and `keep` are { l, t, r, b } in the screen's own px, `floor` the least scale. Returns the transform.
    const compose = (box, k, region, keep, floor) => {
      const w = box.width / k;
      const h = box.height / k;
      const rw = Math.max(1, region.r - region.l);
      const rh = Math.max(1, region.b - region.t);
      const s = Math.min(zoom.max ?? 3.2, Math.max(floor, Math.min(w / rw, h / rh) * 0.94));
      const vw = w / s;
      const vh = h / s;
      const axis = (lo, hi, keepLo, keepHi, size, full) => {
        // Fits: centre the region. Too big: start at its top or left (the question's side), then make sure the target shows.
        let start = hi - lo <= size ? (lo + hi) / 2 - size / 2 : lo - size * 0.03;
        if (keepHi > start + size) start = keepHi - size + size * 0.04;
        if (keepLo < start) start = keepLo - size * 0.04;
        return Math.min(Math.max(0, start), Math.max(0, full - size));
      };
      const left = axis(region.l, region.r, keep.l, keep.r, vw, w);
      const top = axis(region.t, region.b, keep.t, keep.b, vh, h);
      return { s, x: -left * s, y: -top * s };
    };
    const shoot = (next, ms) => {
      view = next;
      cam.style.transformOrigin = '0 0';
      cam.style.transition = `transform ${ms}ms cubic-bezier(.3, .7, .2, 1)`;
      cam.style.transform = next.s === 1 ? '' : `translate3d(${next.x.toFixed(1)}px, ${next.y.toFixed(1)}px, 0) scale(${next.s.toFixed(3)})`;
    };
    // A box on screen, in the screen's own px (undoing the zoom it is drawn with now).
    const local = (r, box, k) => ({
      l: ((r.left - box.left) / k - view.x) / view.s, t: ((r.top - box.top) / k - view.y) / view.s,
      r: ((r.right - box.left) / k - view.x) / view.s, b: ((r.bottom - box.top) / k - view.y) / view.s,
    });
    const union = (boxes) => boxes.reduce((u, b) => ({ l: Math.min(u.l, b.l), t: Math.min(u.t, b.t), r: Math.max(u.r, b.r), b: Math.max(u.b, b.b) }));

    // Where the cursor goes for this step (stage px), and, with the camera, the shot that frames it. One read: every box and
    // the font size are read before anything is written.
    const pointOf = (el, at = [0.5, 0.5], step = {}, ms = 0) => {
      const sr = stage.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const k = (stage.offsetWidth ? sr.width / stage.offsetWidth : 1) || 1;
      const px = r.left + r.width * at[0];
      const py = r.top + r.height * at[1];
      const inside = cam ? cam.contains(el) : false;
      if (!cam || (!inside && view.s === 1)) return [(px - sr.left) / k, (py - sr.top) / k];
      const box = cam.parentElement.getBoundingClientRect();
      if (!inside) {
        shoot({ s: 1, x: 0, y: 0 }, ms);
        return [(px - sr.left) / k, (py - sr.top) / k];
      }
      const font = step.zoom ? parseFloat(getComputedStyle(el).fontSize) || 0 : 0;
      const target = local(r, box, k);
      const extra = step.frame ? [...cam.querySelectorAll(step.frame)].map((n) => local(n.getBoundingClientRect(), box, k)) : [];
      const lx = ((px - box.left) / k - view.x) / view.s;
      const ly = ((py - box.top) / k - view.y) / view.s;
      const floor = step.zoom ? Math.max(step.zoom, font ? (zoom.minPx ?? 12) / font : 0) : view.s;
      const next = step.zoom || step.frame ? compose(box, k, union([target, ...extra]), target, floor) : { ...view };
      shoot(next, ms);
      return [(box.left - sr.left) / k + next.x + next.s * lx, (box.top - sr.top) / k + next.y + next.s * ly];
    };
    // A look beat: frame what matches, at the current scale or more (never below the floor the script set).
    const look = (selector, ms) => {
      if (!cam) return;
      const els = [...cam.querySelectorAll(selector)];
      if (!els.length) return;
      const box = cam.parentElement.getBoundingClientRect();
      const sr = stage.getBoundingClientRect();
      const k = (stage.offsetWidth ? sr.width / stage.offsetWidth : 1) || 1;
      const boxes = els.map((n) => local(n.getBoundingClientRect(), box, k));
      const region = union(boxes);
      shoot(compose(box, k, region, boxes[0], Math.max(view.s, 1)), ms);
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
        if (step.look) { look(step.look, step.move ?? MOVE_MS); await sleep((step.move ?? MOVE_MS) + (step.dwell ?? DWELL_MS)); continue; }
        const el = step.target ? stage.querySelector(step.target) : null;
        if (!el) continue;
        const [x, y] = pointOf(el, step.at, step, step.move ?? MOVE_MS);
        place(x, y, step.move ?? MOVE_MS);
        await sleep(step.move ?? MOVE_MS);
        if (stopped) return;
        if (step.click) {
          press(x, y);
          await sleep(PRESS_MS);
          if (stopped) return;
          fire(el, step.pointer);
        }
        await sleep(step.dwell ?? DWELL_MS);
      }
      if (stopped) return;
      delete cursor.dataset.shown;
      unzoom(420);
      await sleep(260);
      if (!stopped) doneRef.current?.();
    })();

    return () => {
      stopped = true;
      for (const id of timers) window.clearTimeout(id);
      timers.clear();
      cursor.classList.remove('is-press');
      delete cursor.dataset.shown;
      if (view.s !== 1) unzoom(0); // a run cut short; a finished run is already easing out
    };
  }, [playing, taken, steps, zoom]);

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
