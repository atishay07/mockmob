"use client";
// The lead below the fold on a phone (owner, 15 Oct: "something in the UI should be leading them below, maybe a down
// arrow", W-044). Under the lead card, one quiet row names what is further down (the week, the road and the weak
// chapters) with a down chevron. A tap brings the week into view; the row fades away once the week is on screen and
// comes back when the student scrolls up past it. While the sticky row would sit on top of the lead card's footer row
// ("More ways to practise", a tappable control) it steps aside (release 9 audit, 18 Oct) and returns once the card has
// scrolled clear of it, so it never covers a control. On a wide screen the week and the road sit beside the move, so the row is not drawn.
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const reduced = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced'; } catch { return false; }
};

/**
 * `ready`: the move has landed; until then the row holds its place unseen, so it never pushes the week down (W-042).
 */
export default function TodayCue({ target = 'week', ready = true }) {
  const [seen, setSeen] = useState(false);
  const [over, setOver] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    const el = document.getElementById(target);
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    // Seen: the week's top is on screen, or it has been scrolled past.
    const watch = new IntersectionObserver(([entry]) => {
      setSeen(entry.isIntersecting || entry.boundingClientRect.top < 0);
    }, { threshold: 0, rootMargin: '0px 0px -96px 0px' });
    watch.observe(el);
    return () => watch.disconnect();
  }, [target]);

  // Over: the pill's box meets the footer row of the card before it. Measured on scroll and resize, one frame at a time.
  useEffect(() => {
    const node = root.current;
    if (!node) return undefined;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const card = node.previousElementSibling;
      const key = node.querySelector('.tcue__key');
      const row = card ? (card.querySelector('.tm__more') || card.lastElementChild) : null;
      if (!key || !row) { setOver(false); return; }
      const a = key.getBoundingClientRect();
      const b = row.getBoundingClientRect();
      setOver(a.bottom > b.top && a.top < b.bottom && a.right > b.left && a.left < b.right);
    };
    const queue = () => { if (!frame) frame = window.requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(queue);
    if (watch && node.parentElement) watch.observe(node.parentElement);
    return () => {
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', queue);
      if (watch) watch.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ready]);

  const go = () => {
    const el = document.getElementById(target);
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: reduced() ? 'instant' : 'smooth' });
    // Keyboard and screen-reader users land on the week's heading, not back at the top.
    const heading = el.querySelector('h2');
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
  };

  const hidden = seen || over || !ready;
  return (
    <div className="tcue" ref={root} data-seen={seen || undefined} data-over={over || undefined} data-wait={ready ? undefined : ''}>
      <button type="button" className="tcue__key" onClick={go} tabIndex={hidden ? -1 : 0} aria-hidden={hidden || undefined}>
        <span className="tcue__text">Your week, the road and weak chapters</span>
        <span className="tcue__chev" aria-hidden="true"><ChevronDown size={18} strokeWidth={2} /></span>
      </button>
    </div>
  );
}
