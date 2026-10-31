"use client";

// N2, the Practice tab's two halves on a phone (docs/brain/learn-1031/NAV-2.md, preview &nav=n2; not the default).
//   Title switch  "Practice" and "Learn" side by side in display type, 28 px, in place of the page title. The active word is full ink,
//                 the other muted; a 2 px volt underline under the active word slides between them in 220 ms
//                 (cubic-bezier(0.32, 0.72, 0, 1)). Learn carries the Key cards due count after the word ("Learn 27").
//                 Reduced motion: the underline jumps (the router's own 120 ms cross-fade carries the content).
//   Doors         one row under the switch, in the place tabs' style (PlaceTabs): Practise | Your papers | Saved, or
//                 Chapters | Find | Explore. All of them fit at 390 px, so no peek cue is drawn.
//   Swipe         a sideways swipe on the page content switches halves, unless it starts on something that scrolls sideways
//                 (a subject loop, a door row) or takes input.
// Each word is a link to its half's own page, so a half is a route like every other door; the word the student taps moves the
// underline at once, before the next page has drawn.
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import PlaceTabs from './PlaceTabs';

const SWIPE_MIN = 64;

function inSideways(target, stop) {
  for (let el = target; el && el !== stop && el.nodeType === 1; el = el.parentElement) {
    if (el.matches?.('input, textarea, select, [contenteditable="true"], [role="slider"], [data-no-swipe], .arena-tabs')) return true;
    const cs = getComputedStyle(el);
    if (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2) return true;
  }
  return false;
}

export default function PracticeHalves({ half, practiceHref, learnHref, learnDue = 0, doors, hrefOf, isActive, count = 0, countLabel }) {
  const router = useRouter();
  const switchRef = useRef(null);
  // The word just tapped (or swiped to), from the half the route was on then; once the route moves, the route's half rules again.
  const [picked, setPicked] = useState(null);
  const shown = picked && picked.from === half ? picked.to : half;
  // While the half changes, the door row is its own view-transition layer (html[data-half-switch], nav-places.css): the old row leaves
  // before the new one comes, so the two rows never show through each other. Moving along one half's row keeps the plain blend.
  const pick = (to) => {
    setPicked({ to, from: half });
    try { document.documentElement.dataset.halfSwitch = ''; } catch { /* no transition layer, the plain blend */ }
  };
  useEffect(() => {
    const t = window.setTimeout(() => { delete document.documentElement.dataset.halfSwitch; }, 700);
    return () => window.clearTimeout(t);
  }, [half]);
  useEffect(() => () => { delete document.documentElement.dataset.halfSwitch; }, []);
  const [bar, setBar] = useState(null);
  // The underline moves only once it has been placed and painted, so it never slides in from the edge on arrival.
  const [live, setLive] = useState(false);
  const placed = Boolean(bar);
  useEffect(() => {
    if (!placed) return undefined;
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => setLive(true)); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [placed]);

  // The underline sits under the active word (the word only, not its count); measured before paint and on every resize.
  useLayoutEffect(() => {
    const el = switchRef.current;
    if (!el) return undefined;
    const place = () => {
      const word = el.querySelector(`:scope > [data-word="${shown}"] .arena-halves__text`);
      if (!word) return;
      const next = { x: word.offsetLeft, w: word.offsetWidth };
      setBar((prev) => (prev && prev.x === next.x && prev.w === next.w ? prev : next));
    };
    place();
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
    resize?.observe(el);
    return () => resize?.disconnect();
  }, [shown, learnDue]);

  // A sideways swipe on the content switches halves.
  useEffect(() => {
    const main = document.getElementById('app-main');
    if (!main) return undefined;
    let start = null;
    const down = (e) => {
      const t = e.touches?.[0];
      start = t && e.touches.length === 1 && !inSideways(e.target, main) ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
    };
    const up = (e) => {
      const t = e.changedTouches?.[0];
      if (!start || !t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const quick = Date.now() - start.at < 700;
      start = null;
      if (!quick || Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < 2 * Math.abs(dy)) return;
      if (dx < 0 && shown === 'practice') { pick('learn'); router.push(learnHref); }
      if (dx > 0 && shown === 'learn') { pick('practice'); router.push(practiceHref); }
    };
    const cancel = () => { start = null; };
    main.addEventListener('touchstart', down, { passive: true });
    main.addEventListener('touchend', up, { passive: true });
    main.addEventListener('touchcancel', cancel, { passive: true });
    return () => {
      main.removeEventListener('touchstart', down);
      main.removeEventListener('touchend', up);
      main.removeEventListener('touchcancel', cancel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pick only reads the current half, which is in the list
  }, [shown, half, practiceHref, learnHref, router]);

  const word = (id, label, href, extra = null, aria = undefined) => (
    <Link href={href} className="arena-halves__word" data-word={id} aria-current={shown === id ? 'true' : undefined} aria-label={aria}
      onClick={() => { if (shown !== id) pick(id); }}>
      <span className="arena-halves__text">{label}</span>
      {extra}
    </Link>
  );

  return (
    <div className="arena-halves" data-half={shown}>
      <nav className="arena-halves__switch" ref={switchRef} aria-label="Practice or Learn"
        style={bar ? { '--bar-x': `${bar.x}px`, '--bar-w': `${bar.w}px` } : undefined} data-placed={bar ? '' : undefined} data-live={live ? '' : undefined}>
        {word('practice', 'Practice', practiceHref)}
        {word('learn', 'Learn', learnHref,
          learnDue ? <span className="arena-halves__due" aria-hidden="true">{learnDue > 99 ? '99+' : learnDue}</span> : null,
          learnDue ? `Learn, ${learnDue} Key ${learnDue === 1 ? 'card' : 'cards'} due today` : undefined)}
        <span className="arena-halves__bar" aria-hidden="true" />
      </nav>
      <PlaceTabs key={`half-${half}`} group={{ id: `half-${half}`, label: half === 'learn' ? 'Learn pages' : 'Practice pages', tabs: doors }}
        hrefOf={hrefOf} isActive={isActive} count={count} countLabel={countLabel} />
    </div>
  );
}
