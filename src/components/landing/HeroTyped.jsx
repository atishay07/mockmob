'use client';

// The hero headline's third line (LK74, SPEC-HOME-1104 decisions 5 and 7): it types once and rests on the approved
// "Know what to fix." (HERO_LINES[2]). page.js places it where the third run of the h1 was; no props.
//
//   - The server renders "Know what to fix." as plain text, so no-JS, crawlers and the LCP (the h1) see the sentence;
//     a screen reader reads HERO_LINES[2] from the sr-only copy and never the typing (the slot is aria-hidden).
//   - The slot is an inline grid: every phrase is stacked in it as an invisible sizer (CSS generated text, so it is
//     not in the DOM text), so its box is always the widest phrase and typing never moves anything (CLS 0).
//   - One pass, from the opening's hand-off (window 'mm:opening' phase 'done') or 600 ms after paint when there was
//     no opening: the caret comes in at the end of the resting line and it holds a moment (TYPING.lead), then
//     select-back (a wash from the line's end to its start), clear, type "Fresh every time.", hold, the same for
//     "Every mark traced.", then "Know what to fix." for good. Letters land whole, as a caret types them (5 Nov, LK87:
//     the old 60 ms per-letter fade left a gap between the caret and a letter still fading in). The caret is an ink
//     bar (never volt): solid while typing, hidden under the selection, blinking like a text field's while a phrase
//     holds, and after the final letter it blinks twice and leaves. About 9 s, never loops.
//   - Each completed phrase dispatches window 'mm:hero-typed' { index, final } (Mobi glances at the h1 and nods on
//     the final one, HeroMobi).
//   - It pauses while the h1 is off screen or the tab is hidden, and resumes where it stopped.
//   - Reduced motion (the device or the site's own switch): no timers at all, the resting line only. Only opacity and
//     transform animate (opening.css).
//
// Why it was "sometimes there, sometimes gone" (owner LK120, 5 Nov 2026; found in round 4, docs/design-decisions/
// web-r4-hero.md): the pass was skipped for anyone with a Supabase session cookie (<html data-signed-in>, written by the
// opening's gate). The owner is signed in on some browsers and not on others, so the same page typed on one visit and sat
// still on the next; measured in Chrome at 390x844 with and without the cookie (round 4 captures). A signed-in visitor now
// sees the same pass as a guest. And if the opening's hand-off event is ever missed (the layer removed, a script error),
// a fallback start (TYPING.openingFallback after the effect) types anyway, so the pass never waits for ever.

import '@/app/opening.css';
import { useEffect, useRef, useState } from 'react';
import { HERO_LINES, HERO_SLOT_PHRASES, TYPING, caretTail, typingPlan } from './heroLines.mjs';

const REST = HERO_LINES[2];

function stillOnly() {
  const html = document.documentElement;
  if (html.getAttribute('data-motion') === 'reduced') return true;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

export default function HeroTyped() {
  const slotRef = useRef(null);
  // null: the server's resting text. Otherwise { text, washing, caret: 'off' | 'in' | 'on' | 'idle' | 'end' }: 'in' fades
  // the caret in, 'on' is solid (typing), 'idle' blinks after a beat (a phrase holding), 'end' blinks twice and leaves.
  const [view, setView] = useState(null);

  useEffect(() => {
    if (stillOnly()) return undefined;
    const slot = slotRef.current;
    if (!slot) return undefined;

    // Only phrases that fit the copy column on one line are typed: the slot never shows a line cut by the screen edge
    // or running under the desk. Measured once from the sizers when typing starts (one layout read, after the web
    // fonts are in); the resting line is always the last. With the h1 sized for the widest phrase, every phrase fits.
    let phrases = [REST];
    let plan = [];
    const measure = () => {
      const column = slot.closest('h1')?.parentElement?.getBoundingClientRect().width || Infinity;
      const widths = new Map([...slot.querySelectorAll('.lp-typed__sizer')].map((el) => [el.dataset.t, el.getBoundingClientRect().width]));
      phrases = HERO_SLOT_PHRASES.filter((p) => p === REST || !(widths.get(p) > column + 1));
      plan = typingPlan(phrases);
    };
    let i = 0;
    let timer = 0;
    let due = 0; // performance.now() the next step is due at, while running
    let left = 0; // ms still to wait for the next step, while paused
    let started = false;
    let inView = true;
    let visible = document.visibilityState !== 'hidden';
    let gone = false;
    let tail = 0;
    let state = { text: REST, washing: false, caret: 'off' };
    const show = (patch) => { state = { ...state, ...patch }; setView(state); };

    const step = () => {
      timer = 0;
      const s = plan[i];
      if (!s) return;
      if (s.kind === 'caret') show({ caret: 'in' });
      else if (s.kind === 'wash') show({ washing: true });
      else if (s.kind === 'clear') show({ washing: false, text: '', caret: 'on' });
      else if (s.kind === 'letter') show({ text: phrases[s.phrase].slice(0, s.count), caret: 'on' });
      else if (s.kind === 'typed') {
        if (!s.final) show({ caret: 'idle' });
        window.dispatchEvent(new CustomEvent('mm:hero-typed', { detail: { index: HERO_SLOT_PHRASES.indexOf(phrases[s.phrase]), final: s.final } }));
      } else if (s.kind === 'end') {
        // The resting line is the server's sentence again; the caret blinks twice and leaves.
        show({ caret: 'end' });
        gone = true;
        tail = window.setTimeout(() => show({ caret: 'off' }), caretTail());
      }
      i += 1;
      if (plan[i]) schedule(plan[i].at - s.at);
    };
    const running = () => started && inView && visible && !gone;
    const schedule = (ms) => {
      if (running()) { due = performance.now() + ms; timer = window.setTimeout(step, ms); } else left = ms;
    };
    const pause = () => {
      if (!timer) return;
      window.clearTimeout(timer);
      timer = 0;
      left = Math.max(0, due - performance.now());
    };
    const resume = () => {
      if (timer || !running() || !plan[i]) return;
      due = performance.now() + left;
      timer = window.setTimeout(step, left);
    };
    const update = () => { if (running()) resume(); else pause(); };

    const io = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update(); })
      : null;
    io?.observe(slot.closest('h1') || slot);
    const onVisibility = () => { visible = document.visibilityState !== 'hidden'; update(); };
    document.addEventListener('visibilitychange', onVisibility);

    const start = (wait) => {
      if (started) return;
      started = true;
      const at = performance.now() + Math.max(0, wait);
      const go = () => {
        if (gone) return;
        measure();
        left = Math.max(0, at - performance.now());
        update();
      };
      if (document.fonts?.ready) document.fonts.ready.then(go, go);
      else go();
    };
    // Wait for the opening's hand-off when it is playing; otherwise 600 ms after paint. The fallback starts it anyway if
    // the hand-off never arrives (the longest opening is 1.6 s), so no visit ends without the pass.
    const opening = window.__mmOpening;
    const onOpening = (event) => { if (event.detail?.phase === 'done') start(0); };
    let fallback = 0;
    if (opening && opening.mode !== 'skip' && opening.phase !== 'done') {
      window.addEventListener('mm:opening', onOpening);
      fallback = window.setTimeout(() => start(0), TYPING.openingFallback);
    } else start(TYPING.startAfterPaint - performance.now());

    return () => {
      gone = true;
      pause();
      window.clearTimeout(tail);
      window.clearTimeout(fallback);
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('mm:opening', onOpening);
    };
  }, []);

  const text = view ? view.text : REST;
  return (
    <span className="lp-title__line lp-typed">
      <span className="sr-only">{REST}</span>
      <span className="lp-typed__slot" aria-hidden="true" ref={slotRef}>
        {HERO_SLOT_PHRASES.map((p) => <span key={p} className="lp-typed__sizer" data-t={p} />)}
        <span className="lp-typed__live" data-wash={view?.washing ? '' : undefined}>
          {/* One text run while it types, so the line keeps the font's kerning and every letter lands whole. */}
          {text}
          {/* A new caret node for every length, so it never moves as a laid-out box (no layout shift); only its first
              appearance fades in ('in'). */}
          {view && view.caret !== 'off' ? <span key={`c${text.length}`} className={`lp-typed__caret lp-typed__caret--${view.caret}`} /> : null}
        </span>
      </span>
    </span>
  );
}
