"use client";

// How many DU programmes the subjects open: a ring that fills to the real fraction (and moves from
// the old fraction when it changes), a count that rolls from value to value, a small +12 or -4
// chip for what just changed, and Mobi reacting to the direction. Every number is the live result
// of the eligibility rules; nothing here predicts anything.
//   more    Mobi nods (correct)         fewer   he encourages
//   none    he thinks (held)            first programme after none: he says hello
import { useEffect, useState } from 'react';
import MobiReact from '@/components/brand/MobiReact';
import { useCountUp } from '@/lib/motion/useCountUp';

/** A count that rolls; screen readers always get the real number, never the ones in between. */
export function RollingCount({ value, duration = 600 }) {
  const rolled = useCountUp(value, { duration });
  return <><span aria-hidden="true">{rolled}</span><span className="du-sr">{value}</span></>;
}

const R = 26;

export default function EligibleMeter({ eligible, total }) {
  const rolled = useCountUp(eligible, { duration: 600 });
  const fraction = total > 0 ? Math.min(1, Math.max(0, eligible / total)) : 0;
  // The ring draws in from empty on first show, then moves from wherever it was.
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDrawn(fraction));
    return () => window.cancelAnimationFrame(frame);
  }, [fraction]);

  // What changed since the last result, worked out while rendering (no effect needed).
  const [prev, setPrev] = useState(eligible);
  const [stamp, setStamp] = useState(0);
  const [delta, setDelta] = useState(0);
  const [playing, setPlaying] = useState(eligible > 0 ? 'hello' : null);
  if (eligible !== prev) {
    const change = eligible - prev;
    setPrev(eligible);
    setDelta(change);
    setStamp((n) => n + 1);
    setPlaying(change > 0 ? (prev === 0 ? 'hello' : 'correct') : eligible === 0 ? null : 'encourage');
  }
  useEffect(() => {
    if (!delta) return undefined;
    const timer = window.setTimeout(() => setDelta(0), 2600);
    return () => window.clearTimeout(timer);
  }, [delta, stamp]);

  const act = playing || (eligible === 0 ? 'think' : 'idle');
  return (
    <div className="du-meter">
      <div className="du-meter__ring" aria-hidden="true">
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <circle className="du-meter__track" cx="32" cy="32" r={R} />
          <circle className="du-meter__arc" cx="32" cy="32" r={R} pathLength="1" style={{ strokeDashoffset: 1 - drawn }} transform="rotate(-90 32 32)" />
        </svg>
        <b>{rolled}</b>
        {delta !== 0 ? <span key={stamp} className="du-delta" data-dir={delta > 0 ? 'up' : 'down'} aria-hidden="true">{delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}</span> : null}
      </div>
      <MobiReact key={stamp} act={act} size={52} onDone={() => setPlaying(null)} />
    </div>
  );
}
