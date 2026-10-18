"use client";
// The lead below the fold on a phone (owner, 15 Oct: "something in the UI should be leading them below, maybe a down arrow", W-044).
// Release 10 (taste pass, owner D89): a 40 px glass circle with a down chevron, centred just above the dock, in the dock's own glass.
// It shows at the top of the page whenever the week starts below the fold. It says "Your week and road" for its first 2.4 s, then folds
// to the circle (240 ms). It steps away on the student's first scroll of 24 px or more (they have found that the page goes on), once
// the week is on screen, and while the card's key or its reason is under it; the card's footer cells may sit under it, since the
// circle reads over them in glass. A tap brings the week into view. On a wide screen the week and the road sit beside the move, so the
// cue is not drawn.
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CUE_SCROLLED, belowFold, coversCue } from '@/lib/today/cue.mjs';

const reduced = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced'; } catch { return false; }
};

// What the circle must never cover: the lead card's one key and its reason. Everything else on the card may pass under the glass.
const KEEP_CLEAR = '.tm .tm__key, .tm .tm__why';

/**
 * `ready`: the move has landed; until then the cue holds back, so it never lands before the card (W-042).
 */
export default function TodayCue({ target = 'week', ready = true }) {
  const [seen, setSeen] = useState(false);
  const [covered, setCovered] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [wide, setWide] = useState(true);
  const keyRef = useRef(null);

  // Seen, scrolled and covered, measured on scroll and resize, once a frame at most. Seen: the week's top is within the fold, or it
  // has been scrolled past. Scrolled: the first scroll of 24 px or more, kept for the visit.
  useEffect(() => {
    if (!ready) return undefined;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const height = window.innerHeight;
      const width = document.documentElement.clientWidth || window.innerWidth;
      const week = document.getElementById(target);
      if (week) setSeen(!belowFold(week.getBoundingClientRect().top, height));
      if (window.scrollY >= CUE_SCROLLED) setScrolled(true);
      const half = (keyRef.current?.offsetWidth || 40) / 2;
      setCovered([...document.querySelectorAll(KEEP_CLEAR)].some((el) => coversCue(el.getBoundingClientRect(), { height, width, half })));
    };
    const ask = () => { if (!frame) frame = window.requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', ask);
    // The page below can still grow as its sections land, which moves the week without a scroll.
    const grow = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(ask);
    grow?.observe(document.body);
    return () => { window.removeEventListener('scroll', ask); window.removeEventListener('resize', ask); grow?.disconnect(); if (frame) window.cancelAnimationFrame(frame); };
  }, [ready, target]);

  // The words show for the first 2.4 s after the card lands, then fold to the circle.
  useEffect(() => {
    if (!ready) return undefined;
    const t = window.setTimeout(() => setWide(false), 2400);
    return () => window.clearTimeout(t);
  }, [ready]);

  const go = () => {
    const el = document.getElementById(target);
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: reduced() ? 'instant' : 'smooth' });
    // Keyboard and screen-reader users land on the week's heading, not back at the top.
    const heading = el.querySelector('h2');
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
  };

  const away = seen || covered || scrolled;
  const hidden = away || !ready;
  return (
    <div className="tcue" data-seen={away || undefined} data-wait={ready ? undefined : ''} data-wide={wide || undefined}>
      <button ref={keyRef} type="button" className="tcue__key" onClick={go} tabIndex={hidden ? -1 : 0} aria-hidden={hidden || undefined} aria-label="Your week and road, further down">
        <span className="tcue__text" aria-hidden="true"><span>Your week and road</span></span>
        <span className="tcue__chev" aria-hidden="true"><ChevronDown size={20} strokeWidth={2} /></span>
      </button>
    </div>
  );
}
