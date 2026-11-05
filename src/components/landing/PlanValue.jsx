"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { DEFAULT_PACE, rupees } from '@/lib/payments/value.mjs';
import { VALUE_COPY } from './homeCopy.mjs';

// What a Full mock comes to at the student's own pace (R3-D8, owner LK110, 5 Nov 2026: "a toggle in which people can select,
// according to how many mocks they will do, the kind of value that they can extract out of the plan"). A segmented control
// (native radios, so arrows, Tab and screen readers work as they expect) picks Full mocks a week; the figure is "about ₹X a
// mock", rounded UP, with the maths under it. Every row of `table` was worked out on the server from the live offer
// (src/lib/payments/value.mjs perMockTable); nothing here is typed. The figure moves to its new value in 300 ms (ease-out);
// a screen reader hears the final value once, and reduced motion changes it at once.

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';

function useTween(target, duration = 300) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  const frame = useRef(0);
  useEffect(() => {
    const start = from.current;
    if (start === target) return undefined;
    if (reduced()) {
      frame.current = requestAnimationFrame(() => { from.current = target; setShown(target); });
      return () => cancelAnimationFrame(frame.current);
    }
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const value = Math.round((start + (target - start) * (1 - Math.pow(1 - t, 3))) / 10) * 10;
      from.current = value;
      setShown(value);
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else { from.current = target; setShown(target); }
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);
  return shown;
}

export function PlanValue({ table }) {
  const id = useId();
  const first = table.find((row) => row.pace === DEFAULT_PACE) ?? table[0];
  const [pace, setPace] = useState(first.pace);
  const row = table.find((r) => r.pace === pace) ?? first;
  const shown = useTween(row.aboutPaise);

  return (
    <div className="lp-value" role="group" aria-labelledby={`${id}-title`}>
      <h3 className="lp-value__title" id={`${id}-title`}>{VALUE_COPY.title}</h3>
      <fieldset className="lp-seg">
        <legend className="lp-seg__legend">{VALUE_COPY.pace}</legend>
        <div className="lp-seg__track">
          {table.map((r) => (
            <label key={r.pace} className="lp-seg__opt">
              <input type="radio" name={`${id}-pace`} value={r.pace} checked={r.pace === pace} onChange={() => setPace(r.pace)} />
              <span>
                <svg className="lp-seg__tick" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M2.6 6.3l2.2 2.2 4.6-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {r.pace}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="lp-value__read" aria-live="polite">
        <p className="lp-value__out">{VALUE_COPY.about} <b aria-hidden="true">{rupees(shown)}</b><span className="lp-sr">{row.about}</span> {VALUE_COPY.result}</p>
        <p className="lp-value__math">{VALUE_COPY.math(row)}</p>
      </div>
    </div>
  );
}

export default PlanValue;
