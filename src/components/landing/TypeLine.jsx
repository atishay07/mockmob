"use client";

import { useEffect, useRef, useState } from 'react';

// The hero's typed line: "Down to the chapter." The phrase is set like text in an editor. After a beat it is
// selected (the site's own volt selection), replaced, and the next phrase is typed in behind a thin caret. It
// runs a set number of rounds and comes to rest on the last phrase with the caret gone, so nothing on the hero
// loops for ever; if the hero leaves the screen and comes back, it runs one more round.
//
// - The first phrase is in the server HTML, so the line reads complete at first paint and without script.
// - It waits for the page to be interactive, and pauses (mid-phrase if need be) while the line is off screen or
//   the tab is hidden.
// - Reduced motion (the system setting or the site's own switch) shows the first phrase, still, with no caret.
// - Screen readers get one stable sentence (label); the typed text is hidden from them.
// - Every phrase shares one grid cell with an invisible copy of the longest, so the line's width never changes.

const TYPE_MS = 52;
const HOLD_MS = 2300;
const SELECT_MS = 190;
const SELECTED_MS = 260;
const GAP_MS = 140;

// A slightly human rhythm: the first letter and the letter after a space take a little longer.
const keyDelay = (text, i) => TYPE_MS + (i === 0 ? 70 : text[i - 1] === ' ' ? 34 : (i * 7) % 3 === 0 ? 14 : 0);

export function TypeLine({ lead, phrases, label, rounds = 2, className = '' }) {
  const [view, setView] = useState({ index: 0, typed: phrases[0].length, phase: 'still' });
  const root = useRef(null);
  const longest = phrases.reduce((a, b) => (b.length > a.length ? b : a), '');
  const key = phrases.join('|');

  useEffect(() => {
    const node = root.current;
    const words = key.split('|');
    if (!node || words.length < 2) return undefined;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const calm = () => motionQuery.matches || document.documentElement.dataset.motion === 'reduced';

    let timer = 0;
    let next = null; // the step waiting to run while paused
    let visible = false;
    let wasAway = false; // left the screen after coming to rest
    let changesLeft = (words.length * rounds) - 1; // the server phrase counts as the first
    let state = { index: 0, typed: words[0].length, phase: 'still' };
    const show = (patch) => { state = { ...state, ...patch }; setView(state); };
    const live = () => visible && !document.hidden && !calm();

    const schedule = (step, ms) => {
      window.clearTimeout(timer);
      next = step;
      if (live()) timer = window.setTimeout(() => { next = null; step(); }, ms);
    };

    const hold = () => { show({ phase: 'hold' }); schedule(select, HOLD_MS); };
    const select = () => {
      if (changesLeft <= 0) { show({ phase: 'rest' }); next = null; return; }
      show({ phase: 'select' });
      schedule(clear, SELECT_MS + SELECTED_MS);
    };
    const clear = () => {
      changesLeft -= 1;
      show({ index: (state.index + 1) % words.length, typed: 0, phase: 'type' });
      schedule(type, GAP_MS);
    };
    const type = () => {
      const text = words[state.index];
      if (state.typed >= text.length) { hold(); return; }
      show({ typed: state.typed + 1 });
      schedule(type, keyDelay(text, state.typed));
    };

    const settleStill = () => { window.clearTimeout(timer); next = null; show({ typed: words[state.index].length, phase: 'still' }); };
    const sync = () => {
      if (calm()) { if (state.phase !== 'still' && state.phase !== 'rest') settleStill(); return; }
      if (!live()) { window.clearTimeout(timer); return; }
      // Resume where it paused; a hold that was cut short starts again, so the phrase is read in full.
      if (next) { schedule(next, next === select ? HOLD_MS - 600 : 420); return; }
      if (state.phase === 'still') { show({ phase: 'hold' }); schedule(select, HOLD_MS - 600); return; }
      // Back on screen after it came to rest: one more round, ending where it rested.
      if (state.phase === 'rest' && wasAway) { wasAway = false; changesLeft = words.length; schedule(select, 900); }
    };

    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible && state.phase === 'rest') wasAway = true;
      sync();
    }, { threshold: 0.6 });
    if (observer) observer.observe(node); else visible = true;

    const reducedSwitch = new MutationObserver(sync);
    reducedSwitch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    motionQuery.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    if (!observer) sync();
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
      reducedSwitch.disconnect();
      motionQuery.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [key, rounds]); // key, not the array: a new array with the same words must not restart the line

  const text = phrases[view.index].slice(0, view.typed);
  return (
    <p ref={root} className={`lp-type ${className}`} data-phase={view.phase}>
      <span className="lp-type__lead">{lead}</span>{' '}
      <span className="lp-sr">{label}</span>
      <span className="lp-type__slot" aria-hidden="true">
        <span className="lp-type__size">{longest}</span>
        <span className="lp-type__live"><span className="lp-type__text">{text}</span><i className="lp-type__caret" /></span>
      </span>
    </p>
  );
}
