'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import MobiReact from '@/components/brand/MobiReact';

// The landing's phone action bar waits its turn. On the first screen the hero's own buttons and the demo
// question already offer "try a question", so the bar stays down until the hero buttons (.lp-cta) have
// scrolled away, and steps aside again while the demo (#try-practice) holds the screen. While the DU
// teaser's chips hold the screen, its own live count bar is the action at the bottom, so the dock yields
// (data-yield='elig') and that bar takes its slot (hero-depth.css). It rises on the app's out curve and
// leaves on the leave curve (hero-depth.css). Focus inside the bar always shows it. Without
// IntersectionObserver it simply shows. The state is written straight to data attributes, so scrolling never
// re-renders anything.
const NAV = 64;
const DOCK = 96;
const DEMO_MIN_PX = 96;
const ELIG_MIN_PX = 120;

export function HeroDockGate({ children }) {
  const gate = useRef(null);

  useEffect(() => {
    const node = gate.current;
    if (!node) return undefined;
    const cta = document.querySelector('.lp-hero .lp-cta');
    const demo = document.getElementById('try-practice');
    const elig = document.querySelector('#du-eligibility .du-teaser__pick');
    const show = (on) => { node.dataset.shown = on ? 'true' : 'false'; };
    if (typeof IntersectionObserver === 'undefined' || (!cta && !demo)) { show(true); return undefined; }
    const state = { cta: Boolean(cta), demo: Boolean(demo), elig: false };
    const update = () => {
      show(!state.cta && !state.demo && !state.elig);
      if (state.elig && !state.cta && !state.demo) node.dataset.yield = 'elig';
      else delete node.dataset.yield;
    };
    const band = `-${NAV}px 0px -${DOCK}px 0px`;
    const ctaWatch = new IntersectionObserver((entries) => {
      state.cta = entries[entries.length - 1].isIntersecting;
      update();
    }, { rootMargin: band, threshold: 0 });
    // The demo counts as on screen while a real part of it shows (it reaches DEMO_MIN_PX into the band between
    // the nav and the bar), not a sliver at an edge.
    const demoWatch = new IntersectionObserver((entries) => {
      state.demo = entries[entries.length - 1].isIntersecting;
      update();
    }, { rootMargin: `-${NAV + DEMO_MIN_PX}px 0px -${DOCK + DEMO_MIN_PX}px 0px`, threshold: 0 });
    // The teaser's chips (the box its live bar sticks in) count once a real part of them is above the dock.
    const eligWatch = new IntersectionObserver((entries) => {
      state.elig = entries[entries.length - 1].isIntersecting;
      update();
    }, { rootMargin: `-${NAV}px 0px -${DOCK + ELIG_MIN_PX}px 0px`, threshold: 0 });
    if (cta) ctaWatch.observe(cta);
    if (demo) demoWatch.observe(demo);
    if (elig) eligWatch.observe(elig);
    return () => { ctaWatch.disconnect(); demoWatch.disconnect(); eligWatch.disconnect(); delete node.dataset.yield; };
  }, []);

  return <div ref={gate} className="lp-dockgate" data-shown="false">{children}</div>;
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
 * Mobi in the phone dock's left slot, beside a short line. He hops in when the dock rises (a wave the first
 * time), plays a small act as each new section takes the screen, and leaves the slot while one of his seats
 * (.pip-seat[data-pip-station]) is on screen, so the page never shows two of him; he hops back when it has gone.
 * MobiReact keeps him still under Reduce motion and Celebrations off.
 */
export function DockMobi({ line }) {
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
    const docked = () => gate.dataset.shown === 'true' && !root.querySelector('.ss[data-live="true"]');
    const arrive = () => {
      if (!narrow.matches) return;
      if (!s.greeted) { s.greeted = true; play('hello', 0, true); } else play('appear', 0, true);
    };
    const sync = () => {
      const visible = docked();
      if (visible && !s.visible && !s.away) arrive();
      s.visible = visible;
    };
    // The dock rises and falls by data-shown (HeroDockGate) and by a held story going live (data-live).
    const watch = new MutationObserver(sync);
    watch.observe(root, { subtree: true, attributes: true, attributeFilter: ['data-shown', 'data-live'] });

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

  return (
    <span className="lp-dockmobi" data-away={away ? 'true' : 'false'}>
      <span className="lp-dockmobi__seat">
        <MobiReact key={mobi.n} act={mobi.act} size={50} />
      </span>
      <span className="lp-dockmobi__line">{line}</span>
    </span>
  );
}

export default HeroDockGate;
