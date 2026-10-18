"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { HERO_PHRASES, MORPH, changeSpanMs, mayMorph, nextPhrase, phraseWords } from './heroPhrases.mjs';

// The headline's third line, changing by letter (L-016): the old phrase's letters rise and fade one after
// another while the new phrase's letters rise in from below. Transform and opacity only, no blur, no glow; the
// motion lives in hero-motion.css and this component only says which phrase is in, which is out.
//
// - The words never move the page: every phrase shares one grid cell, and once the page is live an invisible copy
//   of every phrase sits in that cell too, so its height is the tallest phrase's even if a narrow window wraps one.
// - A phrase at rest is plain text; only a phrase on its way in or out is split into letters, and it goes back to
//   plain text once its last letter lands. So the served line is real, kerned text, and a late web font can only
//   reflow text, never move a letter box (CLS stays 0).
// - A screen reader and a search engine read one static sentence ("No more guessing."); the letters are hidden from
//   them and nothing is announced as the line changes.
// - Still under Reduce motion (the system's or MockMob's own), paused while the hero is off screen or the tab is
//   hidden. Each change asks the hero's Mobi to glance at the line (PipGuide, 'pip:glance').

// False on the server and while hydrating, true after: the sizing copies join only on a live page, so the served
// headline carries its sentence once.
const noop = () => () => {};
const useLive = () => useSyncExternalStore(noop, () => true, () => false);

function Phrase({ text, state, onDone }) {
  if (state === 'rest' || state === 'size') return <span className="lp-morph__phrase" data-state={state}>{text}</span>;
  // Only the last letter's end counts: by then every letter has finished.
  const ended = (event) => {
    if (event.target === event.currentTarget.lastElementChild?.lastElementChild) onDone?.(event.animationName);
  };
  return (
    <span className="lp-morph__phrase" data-state={state} onAnimationEnd={ended}>
      {phraseWords(text).map((word, w) => (
        <Fragment key={w}>
          {w > 0 ? ' ' : null}
          <span className="lp-morph__word">
            {word.map(({ ch, i }) => <span key={i} className="lp-morph__l" style={{ '--i': i }}>{ch}</span>)}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

export function HeroMorph({ phrases = HERO_PHRASES }) {
  const ref = useRef(null);
  const [view, setView] = useState({ cur: 0, prev: -1, n: 0, landed: true });
  const live = useLive();

  useEffect(() => {
    if (phrases.length < 2) return undefined;
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let inView = true;
    let timer = 0;
    let tidy = 0;
    let index = 0;
    let n = 0;
    const reduced = () => media.matches || root.dataset.motion === 'reduced';
    const allowed = () => mayMorph({ reduced: reduced(), hidden: document.hidden, inView, count: phrases.length });
    const stop = () => { window.clearTimeout(timer); timer = 0; };
    const schedule = (ms) => { stop(); if (allowed()) timer = window.setTimeout(step, ms); };

    function step() {
      timer = 0;
      const from = index;
      index = nextPhrase(index, phrases.length);
      n += 1;
      const mine = n;
      setView({ cur: index, prev: from, n: mine, landed: false });
      window.dispatchEvent(new CustomEvent('pip:glance', { detail: { station: 'hero' } }));
      const span = changeSpanMs(phrases[from], phrases[index]);
      // The last letters' animationend settles the line; this only covers a browser that never fires it.
      window.clearTimeout(tidy);
      tidy = window.setTimeout(() => setView((v) => (v.n === mine ? { ...v, prev: -1, landed: true } : v)), span + 2000);
      schedule(span + MORPH.HOLD_MS);
    }

    function sync() {
      if (reduced()) {
        stop();
        window.clearTimeout(tidy);
        if (index !== 0) { index = 0; n += 1; setView({ cur: 0, prev: -1, n, landed: true }); }
        return;
      }
      if (!allowed()) stop();
      else if (!timer) schedule(MORPH.HOLD_MS);
    }

    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); });
    if (ref.current) observer?.observe(ref.current);
    media.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('mm-prefs', sync);
    schedule(MORPH.FIRST_MS);
    return () => {
      stop();
      window.clearTimeout(tidy);
      observer?.disconnect();
      media.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('mm-prefs', sync);
    };
  }, [phrases]);

  const { n } = view;
  const gone = (name) => { if (name === 'lp-morph-out') setView((v) => (v.n === n ? { ...v, prev: -1 } : v)); };
  const landed = (name) => { if (name === 'lp-morph-in') setView((v) => (v.n === n ? { ...v, landed: true } : v)); };

  return (
    <span ref={ref} className="lp-title__line lp-morph">
      <span className="lp-sr">{phrases[0]}</span>
      <span className="lp-morph__cell" aria-hidden="true">
        {live ? phrases.map((p) => <Phrase key={`size-${p}`} text={p} state="size" />) : null}
        {view.prev >= 0 ? <Phrase key={`p${n - 1}`} text={phrases[view.prev]} state="out" onDone={gone} /> : null}
        <Phrase key={`p${n}`} text={phrases[view.cur]} state={view.landed ? 'rest' : 'in'} onDone={landed} />
      </span>
    </span>
  );
}
