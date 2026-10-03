'use client';

import { useEffect, useRef, useState } from 'react';

// Decorative miniature of the NTA-style console on the Practice "Closest to exam day" card.
// It lives inside the card's <button>, so it is phrasing content only and hidden from
// assistive tech. The clock counts down for real while the card is on screen and the tab
// is visible, and the palette blink pauses otherwise: no offscreen work on budget phones.
const PALETTE = ['a', 'a', 'v', 'a', 'm', 'n', 'a', 'v', 'n', 'a', 'a', 'n', 'v', 'n', 'n'];
const START = 58 * 60 + 12;

export default function NtaConsolePreview({ subject = 'Accountancy' }) {
  const ref = useRef(null);
  const [onScreen, setOnScreen] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [left, setLeft] = useState(START);
  const awake = onScreen && pageVisible;

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(node);
    const onVisibility = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);

  useEffect(() => {
    if (!awake || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = window.setInterval(() => setLeft((s) => (s > 0 ? s - 1 : START)), 1000);
    return () => window.clearInterval(id);
  }, [awake]);

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <span ref={ref} className="pr-nta__console" aria-hidden="true" data-awake={awake}>
      <span className="pr-nta__bar"><b>{subject}</b><u className="pr-nta__clock">{mm}:<span key={ss} className="pr-nta__sec">{ss}</span></u></span>
      <span className="pr-nta__body">
        <span className="pr-nta__q"><i /><i /><i data-short="true" /></span>
        <span className="pr-nta__palette">{PALETTE.map((state, k) => <em key={k} style={{ '--k': k }} data-s={state} />)}</span>
      </span>
    </span>
  );
}
