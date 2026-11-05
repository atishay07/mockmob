"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { DEFAULT_PACE, rupees } from '@/lib/payments/value.mjs';
import { VALUE_COPY, paceWords } from './homeCopy.mjs';

// What a Full mock comes to at the student's own pace (R3-D8, owner LK110; R4-H7, owner LK131, 5 Nov 2026 11:40 pm: "even the
// lowest bar makes the students think that they are doing too low right now ... 5 or 7 a week at least", and "a cool catch").
// A segmented control (native radios, so arrows, Tab and screen readers work as they expect) picks Full mocks a week, 5 / 7 /
// 14 / 21, each with what it means under the number (1 per paper, 1 a day, 2 a day, 3 a day: 5 is one a week in each of five
// CUET papers, said plainly). The read-out: "about ₹X a mock" rounded UP, the catch ("Under 7 paise a question": a Full mock is
// 50 questions), the month as an answer sheet (one ring per Full mock the top pace gives in a 30-day month, filled to this pace),
// what the pace comes to, and the sum. Every figure was worked out on the server from the live offer (src/lib/payments/value.mjs
// perMockTable); nothing here is typed. The figure moves to its new value in 300 ms (ease-out) and the rings fill in reading
// order; a screen reader hears the final figure and the catch once, and reduced motion changes everything at once.

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
/** The most rings the sheet draws (21 a week for a 30-day month is 90); a longer one-time period draws no sheet. */
const SHEET_MAX = 90;

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

/** The month as an answer sheet: `total` rings, the first `filled` marked. Decoration: the count line says the same in words. */
function MonthSheet({ total, filled }) {
  return (
    <div className="lp-sheet" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => <i key={i} data-on={i < filled ? '' : undefined} style={{ '--i': i }} />)}
    </div>
  );
}

export function PlanValue({ table }) {
  const id = useId();
  const first = table.find((row) => row.pace === DEFAULT_PACE) ?? table[0];
  const [pace, setPace] = useState(first.pace);
  const row = table.find((r) => r.pace === pace) ?? first;
  const shown = useTween(row.aboutPaise);
  const top = table[table.length - 1];
  const sheet = row.kind === 'monthly' && Number.isInteger(top.mocks) && top.mocks <= SHEET_MAX ? top.mocks : 0;

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
                <b>
                  <svg className="lp-seg__tick" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M2.6 6.3l2.2 2.2 4.6-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {r.pace}
                </b>
                <small>{paceWords(r.pace).short}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="lp-value__read" aria-live="polite">
        <p className="lp-value__out">{VALUE_COPY.about} <b aria-hidden="true">{rupees(shown)}</b><span className="lp-sr">{row.about}</span> {VALUE_COPY.result}</p>
        {row.perQuestion ? <p className="lp-value__catch">{VALUE_COPY.question(row)}</p> : null}
      </div>
      {sheet ? <MonthSheet total={sheet} filled={Math.floor(row.mocks)} /> : null}
      <p className="lp-value__count">{VALUE_COPY.count(row)}</p>
      <p className="lp-value__math">{VALUE_COPY.math(row)}</p>
    </div>
  );
}

export default PlanValue;
