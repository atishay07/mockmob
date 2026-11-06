"use client";

import { useEffect, useRef, useState } from 'react';

// "Free or Pro" on /pricing, the page's last section (R4, owner LK134), on phones (round 5, owner 6 Nov 2026: "on the phone, Pro
// is below Free. That should not be the case. Free or Pro should be a slider or something like that, and Pro should be the first
// option. People can slide up to Free and do the create account thing").
// `children` are the two plan stages, Pro first: on a phone (below 760 px, pro-page.css) they are one swipeable pair, a
// horizontal scroll-snap rail with the next card peeking, under a two-option switch (Pro | Free) that says which card is in view
// and brings either one in. Pro is in view on arrival. The switch follows the swipe (the rail's scroll position, read once a
// frame: the card nearest its resting place is the one shown) and the swipe follows the switch (the rail glides to that card;
// at once under reduced motion). Its two keys are native buttons with aria-pressed and aria-controls, reached by Tab; the arrow keys move
// to the other plan as well; the focus ring is the page's own. On tablets and desktops the switch is not drawn and the cards
// keep their layout (pro-page.css places Free first beside Pro, as before); the DOM order is Pro, then Free, at every width.
// `options` name the cards in the children's order: [{ label, controls }] (controls = the card's id).

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';

/** Where card `index` of `count` rests on a rail that scrolls `max` px: the first at the start, the last at the end. */
const restOf = (index, count, max) => (count > 1 ? Math.round((max * index) / (count - 1)) : 0);

export function PlanChoice({ label, options, children }) {
  const rail = useRef(null);
  const keys = useRef([]);
  // While the rail glides to a card the switch asked for, the glide's own scroll events do not move the switch back.
  const heading = useRef(null);
  const settle = useRef(0);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const el = rail.current;
    if (!el) return undefined;
    let frame = 0;
    const read = () => {
      frame = 0;
      const count = el.children.length;
      const max = el.scrollWidth - el.clientWidth;
      if (heading.current !== null) {
        if (Math.abs(el.scrollLeft - restOf(heading.current, count, max)) > 2) return;
        heading.current = null;
      }
      // The card nearest its resting place is the one in view (none scrolls on a wide screen: the first).
      setShown(max > 0 && count > 1 ? Math.round((el.scrollLeft / max) * (count - 1)) : 0);
    };
    const onMove = () => { if (!frame) frame = requestAnimationFrame(read); };
    el.addEventListener('scroll', onMove, { passive: true });
    window.addEventListener('resize', onMove);
    return () => {
      el.removeEventListener('scroll', onMove);
      window.removeEventListener('resize', onMove);
      cancelAnimationFrame(frame);
      clearTimeout(settle.current);
    };
  }, []);

  const show = (index) => {
    setShown(index);
    const el = rail.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // The glide holds the switch for at most 900 ms (a touch that stops it mid-way hands the switch back to the scroll).
    heading.current = index;
    clearTimeout(settle.current);
    settle.current = setTimeout(() => { heading.current = null; }, 900);
    el.scrollTo({ left: restOf(index, el.children.length, max), behavior: reduced() ? 'auto' : 'smooth' });
  };
  const onKey = (event, index) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
    keys.current[next]?.focus();
    show(next);
  };

  return (
    <>
      <div className="pro-switch-row">
        <div className="pro-switch" role="group" aria-label={label} style={{ '--on': shown }}>
          {options.map((option, index) => (
            <button key={option.controls} ref={(node) => { keys.current[index] = node; }} type="button" className="pro-switch__key"
              aria-pressed={shown === index} aria-controls={option.controls} onClick={() => show(index)} onKeyDown={(event) => onKey(event, index)}>
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="pro-choice__grid" ref={rail}>{children}</div>
    </>
  );
}

export default PlanChoice;
