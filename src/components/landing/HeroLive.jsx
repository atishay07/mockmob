"use client";

import { useEffect, useRef, useState } from 'react';
import { practisedCounts } from './liveCount.mjs';

// The hero's live line: the real number of questions students can practise and the CUET subjects they cover,
// from /api/stats (the stored daily counts), counted over the subjects MockMob offers for practice only
// (liveCount.mjs; the stored bank holds many more subjects than the 15 a student can pick). The pulsing dot only
// ever sits beside a true number: until the counts answer, the line holds its place empty (so nothing below it
// moves), and if they never answer it stays empty. The figure counts up once on arrival; reduced motion shows it
// at once.

export function HeroLive() {
  const [stats, setStats] = useState(null);
  // null shows the true figure; a number is a frame of the count-up on the way to it.
  const [shown, setShown] = useState(null);
  const frame = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const countUp = (target) => {
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
      if (calm) return;
      const start = performance.now();
      const duration = 900;
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        setShown(t < 1 ? Math.round(target * (1 - Math.pow(1 - t, 3))) : null);
        if (t < 1) frame.current = requestAnimationFrame(tick);
      };
      setShown(0);
      frame.current = requestAnimationFrame(tick);
    };
    fetch('/api/stats', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || data.state === 'unavailable') return;
        const counted = practisedCounts(data.subjectCounts);
        if (!counted) return;
        setStats(counted);
        countUp(counted.questions);
      })
      .catch(() => { /* no figure, no dot: the line stays empty */ });
    return () => { controller.abort(); cancelAnimationFrame(frame.current); };
  }, []);

  return (
    <p className="lp-live" data-ready={stats ? 'true' : 'false'}>
      {stats ? (
        <>
          <span className="lp-live__dot" aria-hidden="true" />
          <span className="lp-live__text">
            <b className="mm-measure">
              {/* The final figure's width is held from the first frame, so the words after it never slide. */}
              <span className="lp-live__num" aria-hidden="true" style={{ minWidth: `${stats.questions.toLocaleString('en-IN').length}ch` }}>{(shown ?? stats.questions).toLocaleString('en-IN')}</span>
              <span className="lp-sr">{stats.questions.toLocaleString('en-IN')}</span>
            </b>{' '}
            questions across {stats.subjects} CUET subjects
          </span>
        </>
      ) : null}
    </p>
  );
}
