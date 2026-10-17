'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import MobiReact from '@/components/brand/MobiReact';
import { MobileDock } from '@/components/MobileDock';
import { useVisitor } from './useWayIn';

// The landing's phone action bar follows one rule: it rises once the hero is behind the reader (the hero's own
// buttons, .lp-cta, and the five-question sample, #try-practice, have both scrolled away) and then stays up, through
// every held story and the DU form, until the close band's actions take over (CloseActions, landing-close.css).
// The held stories keep a dock-high band free at the foot of their stage for it (scroll-story.css), so it never
// covers a scene, and the bar's Start free replaces the top bar's for that whole stretch: the primary key sits in
// one place and does not jump between the top and the bottom as sections pass. It only steps aside for the reader's
// own actions: the menu open, or a reel playing in place (CreatorReels). A short hold (SETTLE_MS) before it rises
// keeps a scroll that stops at the hero's edge from flicking it up and down. Focus inside the bar always shows it.
// Without IntersectionObserver it simply shows. The state is written straight to data attributes, so scrolling never
// re-renders anything.
const NAV = 64;
const DOCK = 96;
const DEMO_MIN_PX = 96;
const SETTLE_MS = 160;

export function HeroDockGate({ children }) {
  const gate = useRef(null);

  useEffect(() => {
    const node = gate.current;
    if (!node) return undefined;
    const cta = document.querySelector('.lp-hero .lp-cta');
    const demo = document.getElementById('try-practice');
    const show = (on) => { node.dataset.shown = on ? 'true' : 'false'; };
    if (typeof IntersectionObserver === 'undefined' || (!cta && !demo)) { show(true); return undefined; }
    const state = { cta: Boolean(cta), demo: Boolean(demo) };
    let rise = 0;
    const update = () => {
      window.clearTimeout(rise);
      const up = !state.cta && !state.demo;
      // Down at once (the hero's own keys are back on screen); up after a short settle.
      if (!up) show(false);
      else if (node.dataset.shown !== 'true') rise = window.setTimeout(() => show(true), SETTLE_MS);
    };
    const ctaWatch = new IntersectionObserver((entries) => {
      state.cta = entries[entries.length - 1].isIntersecting;
      update();
    }, { rootMargin: `-${NAV}px 0px -${DOCK}px 0px`, threshold: 0 });
    // The demo counts as on screen while a real part of it shows (it reaches DEMO_MIN_PX into the band between
    // the nav and the bar), not a sliver at an edge.
    const demoWatch = new IntersectionObserver((entries) => {
      state.demo = entries[entries.length - 1].isIntersecting;
      update();
    }, { rootMargin: `-${NAV + DEMO_MIN_PX}px 0px -${DOCK + DEMO_MIN_PX}px 0px`, threshold: 0 });
    if (cta) ctaWatch.observe(cta);
    if (demo) demoWatch.observe(demo);
    return () => { window.clearTimeout(rise); ctaWatch.disconnect(); demoWatch.disconnect(); };
  }, []);

  return <div ref={gate} className="lp-dockgate" data-shown="false">{children}</div>;
}

/**
 * The top bar's Start free steps back to the quiet key while an in-page volt key holds the screen: the hero's own
 * keys, the sample's own next step once a subject is picked (#try-practice[data-drill]), the pricing plans, and the
 * close band. One
 * volt key on screen at a time; the top bar's key is the fallback, not a second voice. Written to
 * data-volt-held on the landing root, so scrolling never re-renders anything.
 */
function useNavKeyYields() {
  useEffect(() => {
    const root = document.querySelector('.mm.lp');
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;
    const holders = [document.querySelector('.lp-hero .lp-cta'), document.getElementById('try-practice'), document.querySelector('.lp-plans'), document.querySelector('.lp-close__act')].filter(Boolean);
    const seen = new Set();
    const write = () => {
      const held = [...seen].some((el) => el.id !== 'try-practice' || el.dataset.drill);
      if (held) root.dataset.voltHeld = 'true'; else delete root.dataset.voltHeld;
    };
    const watch = new IntersectionObserver((entries) => {
      for (const entry of entries) { if (entry.isIntersecting) seen.add(entry.target); else seen.delete(entry.target); }
      write();
    }, { rootMargin: `-${NAV}px 0px 0px 0px`, threshold: 0 });
    holders.forEach((el) => watch.observe(el));
    // The sample starts or ends while on screen: its data-drill changes without any scroll.
    const drill = holders.find((el) => el.id === 'try-practice');
    const flip = drill ? new MutationObserver(write) : null;
    if (drill) flip.observe(drill, { attributes: true, attributeFilter: ['data-drill'] });
    return () => { watch.disconnect(); flip?.disconnect(); delete root.dataset.voltHeld; };
  }, []);
}

// What Mobi does in the dock as each section takes the screen: a once act, or a held one with how long he holds
// it before he stands at ease again. Sections not listed get a nod.
const SECTION_ACTS = {
  'lp-statement': ['nod'],
  'inside-the-lab': ['tilt'],
  'your-prep': ['nod'],
  'score-recovery-lab': ['read', 1600],
  compass: ['point', 1400],
  'du-eligibility': ['point', 1400],
  'exam-experience': ['tilt'],
  'on-instagram': ['wave'],
  'wall-of-love': ['cheer'],
  pricing: ['nod'],
  faq: ['think', 1600],
};
const MIN_GAP_MS = 900;

function sectionKey(section) {
  if (section.id) return section.id;
  if (section.classList.contains('lp-statement')) return 'lp-statement';
  if (section.classList.contains('lp-sec--band')) return 'faq';
  return '';
}

/**
 * Mobi in the phone dock's left slot, beside a short label with the dock's keys under it. He hops in when the dock rises (a wave the first
 * time), plays a small act as each new section takes the screen, and leaves the slot while one of his seats
 * (.pip-seat[data-pip-station]) is on screen, so the page never shows two of him; he hops back when it has gone.
 * MobiReact keeps him still under Reduce motion and Celebrations off.
 */
export function DockMobi({ label, state, children }) {
  const [mobi, setMobi] = useState({ act: 'idle', n: 0 });
  const [away, setAway] = useState(false);
  const holdTimer = useRef(0);
  const lastAt = useRef(0);
  const play = useCallback((act, hold = 0, force = false) => {
    const now = Date.now();
    if (!force && now - lastAt.current < MIN_GAP_MS) return;
    lastAt.current = now;
    window.clearTimeout(holdTimer.current);
    setMobi((m) => ({ act, n: m.n + 1 }));
    if (hold > 0) holdTimer.current = window.setTimeout(() => setMobi((m) => ({ act: 'idle', n: m.n })), hold);
  }, []);

  useEffect(() => {
    const root = document.querySelector('.mm.lp');
    const gate = document.querySelector('.lp-dockgate');
    if (!root || !gate || typeof IntersectionObserver === 'undefined') return undefined;
    const narrow = matchMedia('(max-width: 899px)');
    const s = { visible: false, greeted: false, away: false, section: '' };
    const docked = () => gate.dataset.shown === 'true';
    const arrive = () => {
      if (!narrow.matches) return;
      if (!s.greeted) { s.greeted = true; play('hello', 0, true); } else play('appear', 0, true);
    };
    const sync = () => {
      const visible = docked();
      if (visible && !s.visible && !s.away) arrive();
      s.visible = visible;
    };
    // The dock rises and falls by data-shown (HeroDockGate).
    const watch = new MutationObserver(sync);
    watch.observe(gate, { attributes: true, attributeFilter: ['data-shown'] });

    // The section across the middle of the window is the one on screen.
    const sections = [...root.querySelectorAll('main > section')];
    const middle = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const key = sectionKey(entry.target);
        if (!key || key === s.section) continue;
        s.section = key;
        if (!s.visible || s.away || !narrow.matches) continue;
        const [act, hold] = SECTION_ACTS[key] || ['nod'];
        play(act, hold || 0);
      }
    }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
    sections.forEach((section) => middle.observe(section));

    // His seats on screen (phones show them in the flow) send him out of the dock.
    const seen = new Set();
    const seats = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.target.offsetHeight > 0) seen.add(entry.target); else seen.delete(entry.target);
      }
      const nowAway = seen.size > 0;
      if (nowAway === s.away) return;
      s.away = nowAway;
      setAway(nowAway);
      if (!nowAway && s.visible) play('appear', 0, true);
    }, { rootMargin: `-${NAV}px 0px -${DOCK}px 0px`, threshold: 0 });
    root.querySelectorAll('.pip-seat[data-pip-station]').forEach((seat) => seats.observe(seat));

    sync();
    return () => { watch.disconnect(); middle.disconnect(); seats.disconnect(); window.clearTimeout(holdTimer.current); };
  }, [play]);

  // The visitor's state changed while the dock was up (they answered, or signed in): Mobi notices.
  const lastState = useRef(state);
  useEffect(() => {
    if (lastState.current === state) return;
    lastState.current = state;
    play(state === 'new' ? 'nod' : 'cheer', 0, true);
  }, [state, play]);

  return (
    <span className="lp-dockmobi" data-away={away ? 'true' : 'false'}>
      <span className="lp-dockmobi__seat">
        {/* The dock waits off screen at first, so its first pose loads lazily, after the hero's own images
            (eager would preload it in the page head at high priority, ahead of the headline's font). */}
        <MobiReact key={mobi.n} act={mobi.act} size={50} eagerFirst={mobi.n > 0} />
      </span>
      <span className="lp-dockmobi__line">
        {label ? <b className="lp-dockmobi__label" key={`l-${state}`}>{label}</b> : null}
        <span className="lp-dockkeys" key={`k-${state}`}>{children}</span>
      </span>
    </span>
  );
}

/**
 * The band the held stories keep free for the dock (scroll-story.css) is the dock's own height on its floor plus
 * 12 px of air, measured, so a dock with a label line ("Welcome back") gets the room it needs too.
 */
function useDockRoom() {
  useEffect(() => {
    const root = document.querySelector('.mm.lp');
    const dock = document.querySelector('.lp-dockgate .mm-dock');
    if (!root || !dock || typeof ResizeObserver === 'undefined') return undefined;
    const write = () => {
      const floor = parseFloat(getComputedStyle(dock).bottom) || 0;
      if (dock.offsetHeight > 0) root.style.setProperty('--lp-dock-room', `${Math.ceil(dock.offsetHeight + floor + 12)}px`);
    };
    const watch = new ResizeObserver(write);
    watch.observe(dock);
    write();
    return () => { watch.disconnect(); root.style.removeProperty('--lp-dock-room'); };
  }, []);
}

/**
 * The phone dock is ONE real key whose label follows the visitor (owner, L-008/L-009: one real key, its label
 * following state). No state adds a second key or a small linked line:
 *   new visitor, or some questions answered   [Start free]
 *   finished the sample                       [Sign up]
 *   signed in                  "Welcome back" [Go to practice]
 * Only a returning member gets a label line. Nothing the sample records is saved to an account (the record keeps a
 * count, a subject and a chapter, never the answers), so no state promises that answers are kept. The sample's state
 * arrives live (useSampleState.js), so the key changes without a reload.
 */
export function LandingDock() {
  const { kind, signupHref, homeHref, homeText, sample } = useVisitor();
  useNavKeyYields();
  useDockRoom();
  const label = kind === 'member' ? 'Welcome back' : '';
  const startText = kind === 'sampled' && sample.done ? 'Sign up' : 'Start free';
  return (
    <HeroDockGate>
      <MobileDock>
        <DockMobi label={label} state={kind}>
          {kind === 'member' ? (
            <Link href={homeHref} className="mm-btn mm-btn--primary">{homeText}</Link>
          ) : (
            <Link href={signupHref} className="mm-btn mm-btn--primary">{startText}</Link>
          )}
        </DockMobi>
      </MobileDock>
    </HeroDockGate>
  );
}

export default HeroDockGate;
