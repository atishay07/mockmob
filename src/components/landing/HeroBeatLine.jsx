'use client';

// The hero's second beat, variant A (R3-D3, LK100; preparoo B9): one rotating line inside the Mobi hero card (the
// desk), under a label, with a 4-segment progress. The four facts are heroBeat's (heroTaps.mjs); each is a link to its
// section, so a tap still goes where the fact lives.
//
//   Clock     3 s on each fact (the segment fills over its dwell), a 600 ms slide to the next (up and out, up and in,
//             cubic-bezier(.25, .1, .25, 1)), one pass, then it slides back to the first fact and rests (WCAG 2.2.2:
//             the movement stops by itself, and before that it pauses whenever the reader is on it).
//   Pauses    while a fine pointer is over it, while anything in it has focus, while a finger is on it, while it is
//             off screen and while the tab is hidden. It starts only once it is on screen (and the opening is done).
//   Controls  every segment is a 44 px button: it shows that fact and stops the clock for good. Tabbing to a fact's
//             link shows that fact, so a keyboard walks all four in order.
//   Reading   all four links are in the DOM in order, so a screen reader hears the four facts as a list; nothing is
//             announced as it turns. The window's height is the tallest fact's, so nothing below ever moves.
//   Reduce motion (the device's or the student's own switch): no clock, no slide; the four facts are stacked (CSS).
//
// No JavaScript: the first fact shows and the links work.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { HERO_BEAT_TIMING } from './heroTaps.mjs';

const FILL_ANIMATION = 'lp-beat-fill';

function openingRunning() {
  return typeof window !== 'undefined' && window.__mmOpening?.phase === 'run';
}

export default function HeroBeatLine({ items, label }) {
  const prefs = useMobiPrefs();
  const rootRef = useRef(null);
  // The fact shown and the one it replaced (that one slides out above; every other waits below, unseen).
  const [{ now, prev }, setView] = useState({ now: 0, prev: null });
  // 'idle' until it is on screen; 'run' through its one pass; 'done' once it rests (or a segment was picked).
  const [phase, setPhase] = useState('idle');
  const [hold, setHold] = useState({ hover: false, focus: false, touch: false, away: true, hidden: false });
  const paused = hold.hover || hold.focus || hold.touch || hold.away || hold.hidden;
  const count = items.length;

  const show = useCallback((index) => {
    setView((v) => (v.now === index ? v : { now: index, prev: v.now }));
  }, []);

  // Read inside the observer's callbacks (the observer is made once).
  const reducedRef = useRef(prefs.reduced);
  useEffect(() => { reducedRef.current = prefs.reduced; }, [prefs.reduced]);

  // On screen (60 % of it), and the tab visible: the clock may run. The first time it is seen, it starts (once the
  // opening, if it is playing, has handed over); never under Reduce motion, never with a single fact.
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    let visible = false;
    const start = () => {
      if (!visible || reducedRef.current || count < 2) return;
      setPhase((p) => (p === 'idle' ? 'run' : p));
    };
    const seen = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.6);
      setHold((h) => (h.away === !visible ? h : { ...h, away: !visible }));
      if (!visible) return;
      if (openingRunning()) window.addEventListener('mm:opening', start, { once: true });
      else start();
    }, { threshold: [0, 0.6, 1] });
    seen.observe(node);
    const onVisibility = () => setHold((h) => ({ ...h, hidden: document.visibilityState === 'hidden' }));
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      seen.disconnect();
      window.removeEventListener('mm:opening', start);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [count]);

  // Reduce motion switched on mid-pass: it rests where it is (the CSS stacks the facts).
  const state = prefs.reduced && phase === 'run' ? 'done' : phase;

  // A segment's fill ending is the clock's tick: the dwell is the animation, so pausing it pauses the clock exactly.
  const onFillEnd = (event) => {
    if (event.animationName !== FILL_ANIMATION || state !== 'run') return;
    if (now < count - 1) { show(now + 1); return; }
    show(0);
    setPhase('done');
  };

  const pick = (index) => { show(index); setPhase('done'); };

  const onFocus = (event) => {
    setHold((h) => (h.focus ? h : { ...h, focus: true }));
    const i = Number(event.target?.dataset?.i);
    if (!Number.isInteger(i)) return;
    // A browser without overflow: clip scrolls the window to the focused fact; the slide does that job instead.
    const win = event.target.closest('.lp-beatline__window');
    if (win) win.scrollTop = 0;
    show(i);
  };
  const onBlur = (event) => {
    if (rootRef.current?.contains(event.relatedTarget)) return;
    setHold((h) => ({ ...h, focus: false }));
  };
  const onPointerEnter = (event) => { if (event.pointerType === 'mouse') setHold((h) => ({ ...h, hover: true })); };
  const onPointerLeave = (event) => { if (event.pointerType === 'mouse') setHold((h) => ({ ...h, hover: false })); };
  const onPointerDown = (event) => { if (event.pointerType !== 'mouse') setHold((h) => ({ ...h, touch: true })); };
  const onPointerUp = (event) => { if (event.pointerType !== 'mouse') setHold((h) => ({ ...h, touch: false })); };

  const pos = (i) => (i === now ? 'now' : i === prev ? 'past' : 'next');
  const seg = (i) => {
    if (state === 'done') return i === now ? 'now' : 'seen';
    if (i === now) return 'now';
    return state === 'run' && i < now ? 'seen' : 'next';
  };

  return (
    <nav
      ref={rootRef}
      className="lp-beatline"
      aria-label={label}
      data-phase={state}
      data-paused={paused ? 'true' : undefined}
      style={{ '--beat-dwell': `${HERO_BEAT_TIMING.dwellMs}ms`, '--beat-slide': `${HERO_BEAT_TIMING.slideMs}ms` }}
      onFocus={onFocus}
      onBlur={onBlur}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="lp-beatline__head">
        <p className="lp-beatline__label">{label}</p>
        <div className="lp-beatline__steps">
          {items.map((item, i) => (
            <button
              key={item.href}
              type="button"
              className="lp-beatline__seg"
              data-state={seg(i)}
              aria-label={`Show ${item.title}`}
              aria-current={i === now ? 'true' : undefined}
              onClick={() => pick(i)}
            >
              <span className="lp-beatline__bar" aria-hidden="true">
                <span
                  className="lp-beatline__fill"
                  // The first fact fills at once; every later one waits for its slide to land first.
                  style={i === now && prev !== null ? { animationDelay: 'var(--beat-slide)' } : undefined}
                  onAnimationEnd={i === now ? onFillEnd : undefined}
                />
              </span>
            </button>
          ))}
        </div>
      </div>
      <ul className="lp-beatline__window">
        {items.map((item, i) => (
          <li key={item.href} className="lp-beatline__item" data-pos={pos(i)}>
            <a href={item.href} data-i={i}>
              <span className="lp-beatline__title">
                {item.title.startsWith(item.mark) ? <><em>{item.mark}</em>{item.title.slice(item.mark.length)}</> : item.title}
                <span className="sr-only">.</span>
              </span>{' '}
              <span className="lp-beatline__line">{item.line}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
