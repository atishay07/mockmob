"use client";

import { useEffect, useRef, useState } from 'react';

// The hero's turning line: "Down to the chapter." After a beat the phrase turns: the old one leaves upward and the
// next rises into its place (translateY 0.55em to 0 with opacity, 320 ms, ease-out), the two overlapping for a
// moment, so the slot is never empty and the line always reads as a sentence. No caret, no selection fill, no
// typing. It turns a set number of rounds and comes to rest on the last phrase, so nothing on the hero moves for
// ever; if the hero leaves the screen and comes back, it runs one more round and rests where it rested.
//
// - The first phrase is in the server HTML, so the line reads complete at first paint and without script.
// - It pauses while the line is off screen or the tab is hidden, and resumes with a full hold.
// - Reduced motion (the system setting or the site's own switch) shows the first phrase, still.
// - Screen readers get one stable sentence (label); the turning words are hidden from them.
// - Every phrase shares one grid cell with an invisible copy of the longest, so the line's width never changes.

const HOLD_MS = 2300;
const LEAVE_MS = 380; // the old phrase's exit, plus the overlap with the new one's entry

export function TypeLine({ lead, phrases, label, rounds = 2, className = '' }) {
  const [view, setView] = useState({ index: 0, prev: -1, turn: 0, phase: 'still' });
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
    let clearPrev = 0;
    let visible = false;
    let wasAway = false; // left the screen after coming to rest
    let changesLeft = (words.length * rounds) - 1; // the server phrase counts as the first
    let state = { index: 0, prev: -1, turn: 0, phase: 'still' };
    const show = (patch) => { state = { ...state, ...patch }; setView(state); };
    const live = () => visible && !document.hidden && !calm();

    const turn = () => {
      timer = 0;
      if (!live()) return;
      if (changesLeft <= 0) { show({ phase: 'rest' }); return; }
      changesLeft -= 1;
      show({ prev: state.index, index: (state.index + 1) % words.length, turn: state.turn + 1, phase: 'turn' });
      window.clearTimeout(clearPrev);
      clearPrev = window.setTimeout(() => show({ prev: -1 }), LEAVE_MS + 40);
      timer = window.setTimeout(turn, HOLD_MS);
    };
    const pause = () => { window.clearTimeout(timer); timer = 0; };

    const sync = () => {
      if (calm()) {
        pause();
        if (state.phase !== 'still' && state.phase !== 'rest') show({ prev: -1, phase: 'rest' });
        return;
      }
      if (!live()) { pause(); return; }
      if (timer) return;
      // Back on screen after it came to rest: one more round, ending where it rested.
      if (state.phase === 'rest') {
        if (!wasAway) return;
        wasAway = false;
        changesLeft = words.length;
        show({ phase: 'turn' });
      }
      timer = window.setTimeout(turn, HOLD_MS - 600);
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
      pause();
      window.clearTimeout(clearPrev);
      observer?.disconnect();
      reducedSwitch.disconnect();
      motionQuery.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [key, rounds]); // key, not the array: a new array with the same words must not restart the line

  return (
    <p ref={root} className={`lp-type ${className}`} data-phase={view.phase}>
      <span className="lp-type__lead">{lead}</span>{' '}
      <span className="lp-sr">{label}</span>
      <span className="lp-type__slot" aria-hidden="true">
        <span className="lp-type__size">{longest}</span>
        {view.prev >= 0 ? <span key={`out-${view.turn}`} className="lp-type__word" data-turn="out">{phrases[view.prev]}</span> : null}
        <span key={`in-${view.turn}`} className="lp-type__word" data-turn={view.turn > 0 ? 'in' : undefined}>{phrases[view.index]}</span>
      </span>
    </p>
  );
}
