"use client";
// The lead below the fold on a phone (owner, 15 Oct: "something in the UI should be leading them below, maybe a down
// arrow", W-044). Release 10 (taste pass, owner D89): the cue is a 44 px glass circle with a down chevron, anchored to the
// right just above the dock. It says "Your week and road" for its first 2.4 s, then folds to the circle (240 ms). It never
// sits on the lead card's words or keys: while any of them is under the circle, the circle steps away, and once the
// week is on screen it fades for good until the student scrolls back up. A tap brings the week into view. On a wide screen
// the week and the road sit beside the move, so the cue is not drawn.
import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { coversCue } from '@/lib/today/cue.mjs';

const reduced = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced'; } catch { return false; }
};

// What the circle must never cover: the lead card's words and keys (its reason, price, value line and lengths, its key, its two
// choices and its footer row). While any of them is under it, the card is cut off by the dock, which already says there is more.
const KEEP_CLEAR = '.tm .tm__key, .tm .tm__or, .tm .tm__more, .tm .tm__why, .tm .tm__price, .tm .tm__value, .tm .tm__lengths[data-open], .tm .tm__note';

/**
 * `ready`: the move has landed; until then the cue holds back, so it never lands before the card (W-042).
 */
export default function TodayCue({ target = 'week', ready = true }) {
  const [seen, setSeen] = useState(false);
  const [covered, setCovered] = useState(false);
  const [wide, setWide] = useState(true);

  // Seen: the week's top is on screen, or it has been scrolled past.
  useEffect(() => {
    const el = document.getElementById(target);
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const watch = new IntersectionObserver(([entry]) => {
      setSeen(entry.isIntersecting || entry.boundingClientRect.top < 0);
    }, { threshold: 0, rootMargin: '0px 0px -96px 0px' });
    watch.observe(el);
    return () => watch.disconnect();
  }, [target]);

  // Covered: the card's key or footer is under the circle. Measured on scroll and resize, once a frame at most.
  useEffect(() => {
    if (!ready) return undefined;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const size = { height: window.innerHeight, width: document.documentElement.clientWidth || window.innerWidth };
      setCovered([...document.querySelectorAll(KEEP_CLEAR)].some((el) => coversCue(el.getBoundingClientRect(), size)));
    };
    const ask = () => { if (!frame) frame = window.requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', ask);
    return () => { window.removeEventListener('scroll', ask); window.removeEventListener('resize', ask); if (frame) window.cancelAnimationFrame(frame); };
  }, [ready]);

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

  const hidden = seen || covered || !ready;
  return (
    <div className="tcue" data-seen={seen || covered || undefined} data-wait={ready ? undefined : ''} data-wide={wide || undefined}>
      <button type="button" className="tcue__key" onClick={go} tabIndex={hidden ? -1 : 0} aria-hidden={hidden || undefined} aria-label="Your week and road, further down">
        <span className="tcue__text" aria-hidden="true"><span>Your week and road</span></span>
        <span className="tcue__chev" aria-hidden="true"><ChevronDown size={20} strokeWidth={2} /></span>
      </button>
    </div>
  );
}
