'use client';

// A monumental number that rolls into place, digit by digit (the app's MonumentalNumber; the plan is rollPlan.js).
//
//   <RollNumber value={183} run settle onRoll={({ landsIn }) => ...} />
//
// Every digit sits in its own slot, one tabular figure wide, so nothing beside the number moves while it rolls. With
// `run`, the first show rolls each slot up from 0 and a later change rolls on from the digits shown; without it the
// number is simply there. Reduced motion (the device or the student's own switch) never rolls. The server draws the
// real value; a roll is armed before the browser paints, so the real value never flashes before it rolls.
//
// `settle` holds the roll until the page has stopped dropping frames (countUpPlan.js COUNT_UP_SETTLE: two smooth
// frames, 900 ms at most), so a number that arrives with its whole page is seen rolling. While it waits the slots are
// empty (never a static row of zeros that could read as a score); the digits appear as they start to move.
// The columns move by transform only (Web Animations, on the compositor). `onRoll({ landsIn })` is called in the same
// task the roll starts, so anything timed to the landing (stampFigure) starts on the same clock.
//
// With a `memoryKey` it remembers, as the app's does (numberMemory.js): mounting again with the value it last showed
// draws it at once; mounting with a new value rolls on from the remembered one, inked volt for a rise and dim for a
// fall while it rolls and for the numberInk token after it lands (the .mk-num colours), then settling back.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { ROLL, planRoll, travelShare } from './rollPlan.js';
import { settleStep } from './countUpPlan.js';
import { inkFor, numberDirection, recallNumber, rememberNumber } from './numberMemory.js';
import { durations } from './tokens.g.js';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function staticSlots(text) {
  return [...text].map((ch) => ({ ch }));
}

export default function RollNumber({ value, run = false, settle = false, delay = 0, ms = null, onRoll, memoryKey = null, className = '' }) {
  const { reduced } = useMobiPrefs();
  const text = String(value ?? '');
  const [plan, setPlan] = useState(null);
  const [ink, setInk] = useState(null);
  const key = memoryKey === null || memoryKey === undefined ? null : String(memoryKey);
  const root = useRef(null);
  // The value on screen and the one before it (null: nothing yet). Kept per value, so an effect that runs twice for
  // the same value (React's development double run) arms the same roll.
  const shown = useRef({ text: null, before: null });
  const callback = useRef(onRoll);
  useEffect(() => { callback.current = onRoll; });

  // Arm a roll before paint: the columns are drawn at their first digit in the same frame the value appears.
  useIsoLayoutEffect(() => {
    if (shown.current.text !== text) {
      let before = shown.current.text;
      if (before === null && key !== null) {
        const remembered = recallNumber(key);
        before = remembered === undefined || remembered === null ? null : String(remembered);
      }
      shown.current = { text, before };
      if (key !== null) rememberNumber(key, text);
    }
    const { before } = shown.current;
    if (!run || reduced || typeof window === 'undefined' || before === text) { setPlan(null); setInk(null); return; }
    const next = planRoll(text, { previous: before, delay, ...(ms ? { ms } : null) });
    setPlan(next.moves ? next : null);
    setInk(next.moves && key !== null && before !== null ? inkFor(numberDirection(before, text)) : null);
  }, [text, run, reduced, delay, key, ms]);

  // Play it: after the page settles when asked, by transform only, then drop the columns.
  useIsoLayoutEffect(() => {
    const el = root.current;
    if (!plan || !el) return undefined;
    let raf = 0;
    let timer = 0;
    let live = true;
    let animations = [];
    const go = () => {
      const columns = [...el.querySelectorAll('.mk-roll__col')];
      animations = columns.map((col) => {
        const cells = Number(col.dataset.cells);
        const slot = plan.slots[Number(col.dataset.slot)];
        if (typeof col.animate !== 'function') return null;
        const animation = col.animate(
          [{ transform: 'translate3d(0, 0, 0)' }, { transform: `translate3d(0, ${-travelShare(cells) * 100}%, 0)` }],
          { duration: slot.duration, delay: slot.delay, easing: ROLL.easing, fill: 'both' },
        );
        animation.id = 'mk-roll';
        return animation;
      }).filter(Boolean);
      callback.current?.({ landsIn: plan.landsIn });
      Promise.all(animations.map((a) => a.finished)).then(() => {
        if (!live) return;
        setPlan(null);
        timer = window.setTimeout(() => setInk(null), durations.numberInk);
      }, () => {});
    };
    if (!settle) go();
    else {
      let wait = {};
      el.dataset.waiting = '';
      const frame = (now) => {
        wait = settleStep(wait, now);
        if (!wait.ready) { raf = requestAnimationFrame(frame); return; }
        delete el.dataset.waiting;
        go();
      };
      raf = requestAnimationFrame(frame);
    }
    return () => {
      live = false;
      delete el.dataset.waiting;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      for (const a of animations) { try { a.cancel(); } catch { /* gone */ } }
    };
  }, [plan, settle]);

  const slots = plan ? plan.slots : staticSlots(text);
  return (
    <span ref={root} className={`mk-roll${key !== null ? ' mk-num' : ''}${className ? ` ${className}` : ''}`} data-rolling={plan ? '' : undefined} data-ink={ink || undefined}>
      <span className="sr-only">{text}</span>
      <span className="mk-roll__face" aria-hidden="true">
        {slots.map((slot, i) => (slot.cells && slot.cells.length > 1 ? (
          <span key={i} className="mk-roll__slot">
            <span className="mk-roll__digit">{slot.ch}</span>
            <span className="mk-roll__col" data-slot={i} data-cells={slot.cells.length}>
              {slot.cells.map((cell, k) => <span key={k}>{cell}</span>)}
            </span>
          </span>
        ) : (
          <span key={i} className="mk-roll__slot">{slot.ch}</span>
        )))}
      </span>
    </span>
  );
}
