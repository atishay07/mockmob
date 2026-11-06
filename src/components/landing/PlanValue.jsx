"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { DEFAULT_PACE, PACE, paceWords, rupees } from '@/lib/payments/value.mjs';
import { VALUE_COPY } from './homeCopy.mjs';

// Everything Pro's price covers at the student's own pace, as a receipt under one slider (round 5, owner 6 Nov 2026: "There
// should be a slider for how many things a student can do, like if someone is attempting 1 mock, then repairs, then key cards
// and other stuff ... making it so appealing that the cost is so low that someone thinks, 'How is this even possible?'").
// The slider is a native range (arrows, Home/End and Page keys, a 44 px target, a screen reader hears the pace in words through
// aria-valuetext): Full mocks a week, 5 to 21, each value said plainly ("5 full mocks a week", "1 full mock a day"). The receipt
// counts what that pace comes to over the period the price pays for (Full mocks with their questions and the price of one,
// a Mistake Lab read and a chapter review for each, the Key cards Pro opens while Key cards are live), lists what Pro includes
// beyond the counts without a number, and ends on one full mock's price with all of it included and a question's ("Under 1
// paisa a question."). Unlike things (a mock, its own Lab read, a bank of cards) are never added into one count.
// Every figure was worked out on the server from the live offer (src/lib/payments/receipt.mjs receiptTable); nothing here is
// typed or computed from money. The counts roll to their new values in 280 ms (ease-out) from wherever they stand, so a drag
// reads as more, not as a flash; reduced motion changes them at once. The rolling digits are hidden from screen readers, which
// read the real figures, and one polite live line says the new total once the pace changes.

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
const n = (count) => Number(count).toLocaleString('en-IN');

/** Rolls whole numbers to new targets together (one frame loop, ease-out), starting from the figures on screen. */
function useRoll(targets, duration = 280) {
  const key = targets.join(' ');
  const [shown, setShown] = useState(targets);
  const at = useRef(targets);
  useEffect(() => {
    const goal = key.split(' ').map(Number);
    const start = at.current;
    if (start.length === goal.length && goal.every((value, i) => value === start[i])) return undefined;
    let frame = 0;
    if (reduced() || start.length !== goal.length) {
      frame = requestAnimationFrame(() => { at.current = goal; setShown(goal); });
      return () => cancelAnimationFrame(frame);
    }
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = t < 1 ? goal.map((value, i) => Math.round(start[i] + (value - start[i]) * eased)) : goal;
      at.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [key, duration]);
  return shown;
}

/** A count: the rolling digits for the eye, the real figure for a screen reader. */
function Count({ shown, real }) {
  return <><span aria-hidden="true">{n(shown)}</span><span className="lp-sr">{n(real)}</span></>;
}

export function PlanValue({ rows }) {
  const id = useId();
  const min = rows[0].pace;
  const max = rows[rows.length - 1].pace;
  const [pace, setPace] = useState(rows.some((r) => r.pace === DEFAULT_PACE) ? DEFAULT_PACE : min);
  const row = rows.find((r) => r.pace === pace) ?? rows[0];
  // The per-mock price rolls in 10-paise steps (it is always rounded up to 10 paise).
  const [mocks, questions, tenPaise] = useRoll([row.mocks, row.questions, row.perMock.aboutPaise / 10]);
  const mockWords = VALUE_COPY.lines.mocks.detail;
  const words = paceWords(pace);

  return (
    <div className="lp-rcpt" role="group" aria-labelledby={`${id}-title`}>
      <h3 className="lp-rcpt__title" id={`${id}-title`}>{VALUE_COPY.title(row)}</h3>
      <p className="lp-rcpt__lead">{VALUE_COPY.lead}</p>

      <div className="lp-rcpt__pace">
        <label className="lp-rcpt__ask" htmlFor={`${id}-pace`}>{VALUE_COPY.ask}</label>
        <p className="lp-rcpt__say" aria-hidden="true">{words.long}</p>
        <div className="lp-rcpt__range" style={{ '--fill': max > min ? (pace - min) / (max - min) : 1 }}>
          <span className="lp-rcpt__track" aria-hidden="true"><span className="lp-rcpt__fill" /></span>
          <input id={`${id}-pace`} type="range" min={min} max={max} step={PACE.step} value={pace} aria-valuetext={words.long}
            onChange={(event) => setPace(Number(event.target.value))} />
        </div>
        <p className="lp-rcpt__ends" aria-hidden="true"><span>{paceWords(min).short}</span><span>{paceWords(max).short}</span></p>
      </div>

      <div className="lp-rcpt__paper">
        <p className="lp-rcpt__head"><span>{VALUE_COPY.head(row)}</span><b>{row.price}</b></p>
        <dl className="lp-rcpt__lines">
          {row.lines.map((line) => {
            const copy = VALUE_COPY.lines[line.key];
            const rolls = line.key !== 'cards';
            return (
              <div key={line.key} className="lp-rcpt__line">
                <dt>
                  {copy.label}
                  {line.key === 'mocks' ? (
                    <small><span aria-hidden="true">{mockWords({ questions, about: rupees(tenPaise * 10) })}</span><span className="lp-sr">{mockWords({ questions: row.questions, about: row.perMock.about })}</span></small>
                  ) : <small>{copy.detail(line)}</small>}
                </dt>
                <dd>{rolls ? <Count shown={mocks} real={line.count} /> : n(line.count)}</dd>
              </div>
            );
          })}
          {VALUE_COPY.included.map((item, i) => (
            <div key={item.label} className="lp-rcpt__line lp-rcpt__line--inc" data-first={i === 0 ? '' : undefined}>
              <dt>{item.label}{item.detail ? <small>{item.detail}</small> : null}</dt>
              <dd>{VALUE_COPY.includedWord}</dd>
            </div>
          ))}
        </dl>
        <p className="lp-rcpt__total"><span>{VALUE_COPY.total}</span><b><span aria-hidden="true">{rupees(tenPaise * 10)}</span><span className="lp-sr">{row.perMock.about}</span></b></p>
        <p className="lp-rcpt__sum"><span aria-hidden="true">{VALUE_COPY.sum({ price: row.price, mocks })}</span><span className="lp-sr">{VALUE_COPY.sum(row)}</span></p>
        <p className="lp-rcpt__each"><b>{VALUE_COPY.each(row)}</b>{VALUE_COPY.eachTail}</p>
      </div>
      <p className="lp-sr" aria-live="polite">{VALUE_COPY.live(row)}</p>
    </div>
  );
}

export default PlanValue;
