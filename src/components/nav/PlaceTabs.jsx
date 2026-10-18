"use client";

// The pages inside a place, as a row of tabs under the top bar on a phone (WEB-NAV-1019 option A, owner D114): Practice,
// Your papers, Learn, Explore and Saved on each of those pages; Your Mob and Your standing on the Mob's. Links, not a
// tablist: each tab is its own page with its own route, and the current one carries aria-current and the sidebar's volt bar.
//
// The sideways cue (owner G27, the same three parts as the Start sheet's subject rail):
//   peek     the side padding is steered so the tab under the right edge shows 30 to 70% of itself (placeTabsPeek.mjs)
//   nudge    the first time the row is seen on this device it slides 24 px toward the hidden tabs and settles back, once,
//            after the page has landed; a touch, wheel or scroll first cancels it. Reduced motion: no nudge.
//   edges    a fade at whichever edge has tabs past it, and a chevron over the right fade that steps the row on.
// From 1024 px the sidebar lists every page, so the row is not drawn (nav-places.css).
import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { NUDGE_BACK_MS, NUDGE_DELAY_MS, NUDGE_EASE_OUT, NUDGE_KEY, NUDGE_OUT_MS, NUDGE_PX, NUDGE_SETTLE, TAB_PAD, peekPadding, scrollToShow } from './placeTabsPeek.mjs';

const EDGE = 2;

function reducedMotion() {
  try {
    return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return true; }
}
function seen() {
  try { return window.localStorage.getItem(NUDGE_KEY) === '1'; } catch { return true; }
}
function markSeen() {
  try { window.localStorage.setItem(NUDGE_KEY, '1'); } catch { /* it plays again next time, which is harmless */ }
}

export default function PlaceTabs({ group, hrefOf, isActive, count = 0, countLabel, onNavigate }) {
  const row = useRef(null);
  const hint = useRef(null);
  const [edges, setEdges] = useState({ overflow: false, start: true, end: true });
  const tabs = group.tabs;

  const measure = useCallback(() => {
    const el = row.current;
    if (!el) return;
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const next = { overflow: max > EDGE, start: el.scrollLeft <= EDGE, end: el.scrollLeft >= max - EDGE };
    setEdges((prev) => (prev.overflow === next.overflow && prev.start === next.start && prev.end === next.end ? prev : next));
  }, []);

  // The peek, before paint and again whenever the row's width changes; then the current tab is brought into view.
  useLayoutEffect(() => {
    const el = row.current;
    if (!el) return undefined;
    let width = -1;
    const fit = () => {
      if (Math.abs(el.clientWidth - width) < 1) return;
      width = el.clientWidth;
      el.style.removeProperty('--tab-pad');
      const items = [...el.children];
      if (!items.length || !el.clientWidth) return;
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      const padStart = parseFloat(getComputedStyle(el).paddingLeft) || 0;
      const base = parseFloat(getComputedStyle(items[0]).paddingLeft) || TAB_PAD;
      const contents = items.map((node) => node.offsetWidth - 2 * base);
      const fitted = peekPadding({ contents, gap, avail: el.clientWidth - padStart, base });
      if (fitted && fitted.pad !== base) el.style.setProperty('--tab-pad', `${fitted.pad}px`);
      measure();
    };
    fit();
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    resize?.observe(el);
    return () => resize?.disconnect();
  }, [group.id, tabs.length, count, measure]);

  // The current tab is in view on arrival (Saved sits past the edge at 390 px), with no movement. The Revise count arrives a moment
  // after the page and widens "Your papers", so the row is placed again when the count lands (the peek above is refitted then too);
  // once the student has touched the row, only a change of the current tab moves it.
  const currentId = tabs.find((tab) => isActive(tab.id))?.id || null;
  const touched = useRef(false);
  const placedFor = useRef(null);
  useEffect(() => {
    const el = row.current;
    if (!el) return undefined;
    const mark = () => { touched.current = true; };
    el.addEventListener('pointerdown', mark, { passive: true });
    el.addEventListener('wheel', mark, { passive: true });
    el.addEventListener('touchstart', mark, { passive: true });
    return () => { el.removeEventListener('pointerdown', mark); el.removeEventListener('wheel', mark); el.removeEventListener('touchstart', mark); };
  }, [group.id]);
  useLayoutEffect(() => {
    const el = row.current;
    const current = el?.querySelector('[aria-current="page"]');
    if (!el || !current) return;
    if (touched.current && placedFor.current === currentId) { measure(); return; }
    placedFor.current = currentId;
    // The row is the tabs' offset parent (position: relative), so offsetLeft is in its scroll coordinates.
    el.scrollLeft = scrollToShow({ left: current.offsetLeft, width: current.offsetWidth, view: el.clientWidth, scrollWidth: el.scrollWidth });
    measure();
  }, [currentId, count, measure]);

  useEffect(() => {
    const el = row.current;
    if (!el) return undefined;
    let frame = 0;
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(); }); };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [measure]);

  // The nudge: once per device, after the page has landed, only while tabs wait past the right edge and the row is untouched.
  useEffect(() => {
    const el = row.current;
    if (!el || seen() || reducedMotion()) return undefined;
    let runs = [];
    let done = false;
    const timer = window.setTimeout(() => {
      const left = el.scrollWidth - el.clientWidth - el.scrollLeft;
      if (done || el.scrollLeft > EDGE || left <= EDGE || !el.getClientRects().length) return;
      markSeen();
      const total = NUDGE_OUT_MS + NUDGE_BACK_MS;
      const at = NUDGE_OUT_MS / total;
      const move = (node, shift) => node.animate([
        { transform: 'translate3d(0, 0, 0)', easing: NUDGE_EASE_OUT },
        { transform: `translate3d(${shift}px, 0, 0)`, offset: at, easing: NUDGE_SETTLE },
        { transform: 'translate3d(0, 0, 0)' },
      ], { duration: total, composite: 'add' });
      runs = [...el.children].map((node) => move(node, -NUDGE_PX));
      // The chevron leans the other way a little, as if it pulled the row.
      if (hint.current) runs.push(move(hint.current, Math.round(NUDGE_PX / 6)));
    }, NUDGE_DELAY_MS);
    const stop = () => { done = true; window.clearTimeout(timer); runs.forEach((run) => { try { run.cancel(); } catch { /* finished */ } }); };
    el.addEventListener('pointerdown', stop, { passive: true });
    el.addEventListener('wheel', stop, { passive: true });
    el.addEventListener('touchstart', stop, { passive: true });
    el.addEventListener('scroll', stop, { passive: true });
    return () => {
      stop();
      el.removeEventListener('pointerdown', stop);
      el.removeEventListener('wheel', stop);
      el.removeEventListener('touchstart', stop);
      el.removeEventListener('scroll', stop);
    };
  }, [group.id]);

  const step = () => {
    const el = row.current;
    if (el) el.scrollBy({ left: Math.round(el.clientWidth * 0.6), behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  return (
    <nav className="arena-tabs" aria-label={group.label} data-place={group.id}
      data-overflow={edges.overflow || undefined} data-at-start={edges.start || undefined} data-at-end={edges.end || undefined}>
      <div className="arena-tabs__row" ref={row}>
        {tabs.map((tab) => {
          const current = isActive(tab.id);
          const badge = tab.id === 'review' && count ? count : 0;
          return (
            <Link key={tab.id} href={hrefOf(tab)} className="arena-tab" aria-current={current ? 'page' : undefined}
              aria-label={badge ? countLabel?.(tab) : undefined} onClick={onNavigate}>
              <span>{tab.label}</span>
              {badge ? <i className="arena-tab__count" aria-hidden="true">{badge > 99 ? '99+' : badge}</i> : null}
            </Link>
          );
        })}
      </div>
      {/* The chevron hint: a tap moves the row on. Keyboard users tab through the tabs themselves, so it is not a stop. */}
      <button ref={hint} type="button" className="arena-tabs__hint" tabIndex={-1} aria-hidden="true" onClick={step}>
        <span className="arena-tabs__disc"><ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" /></span>
      </button>
    </nav>
  );
}
