"use client";

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { PACE } from '@/lib/payments/value.mjs';
import { CARD_PACE, mockPaces, planValue } from '@/lib/payments/receipt.mjs';
import { VALUE_COPY } from './homeCopy.mjs';

// Everything Pro's price covers at the student's own pace, beside the Pro card (round 5, second take; owner 6 Nov 2026: "the
// slider implementation that you have done is a good direction, but it's a bit weird ... Full marks, 190, mistake lab 190, all but
// key cards ... How many key cards will you practice?"; docs/design-decisions/web-r5-value.md).
// It leads with what the price comes to a day, the same at every pace, with its sum. Two questions follow in the student's own
// units, each a native range (arrows, Home/End and Page keys, a 44 px target; a screen reader hears the value in words through
// aria-valuetext): full mocks a week (5 to 21, ticks at one and two a day) and, while Key cards are live, Key cards a day (10 to
// 60, ticks every ten). The answer says that plan back over the period the price pays for, one line for each question, so no two
// lines share a number (Full mocks with the price of a mock and of a question, their questions and the Lab read and chapter
// review after every mock; the Key cards turned with their minutes a day and the bank they come from), then what else Pro holds
// without a number. Every figure comes from receipt.mjs planValue (pure, tested); nothing here is typed or works
// out money itself.
// The days left are counted from the day the page was built (`from`, so the server's figures and the first paint agree), then,
// once the block is on a reader's screen, from the reader's own day: the page is built once per release, and a frozen day would
// overstate the mocks left and understate a day's price as the term runs down.
// The counts roll to their new values in 280 ms (ease-out) from wherever they stand, so a drag reads as more, not as a flash;
// reduced motion changes them at once. The rolling digits are hidden from screen readers, which read the real figures, and one
// polite live line says the new plan once the student stops moving a slider.

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
const n = (count) => Number(count).toLocaleString('en-IN');
const dayOf = (date) => date.toISOString().slice(0, 10);
/** The ticks on each rail: whole days on the mocks rail (one and two a day), every ten on the Key cards rail. */
const MOCK_TICKS = Object.freeze([7, 14]);
const CARD_TICKS = Object.freeze([20, 30, 40, 50]);

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

/** One line of the answer: its name and count, then what one costs (in ink) and what it holds, each on its own row. */
function Line({ label, detail: [lead, rest], shown, real }) {
  return (
    <div className="lp-val__line">
      <dt>{label}</dt>
      <dd><Count shown={shown} real={real} /></dd>
      <dd className="lp-val__more">{lead ? <b>{lead}</b> : null}<span>{rest}</span></dd>
    </div>
  );
}

/** One question: its words, the answer in words, a 44 px native range over a drawn rail with its ticks, and the two ends. */
function Pace({ id, ask, words, value, min, max, step, ticks, onChange }) {
  const span = max - min;
  return (
    <div className="lp-val__pace">
      <div className="lp-val__ask">
        <label htmlFor={id}>{ask}</label>
        <span className="lp-val__say" aria-hidden="true">{words(value).short}</span>
      </div>
      <div className="lp-val__range" style={{ '--fill': span > 0 ? (value - min) / span : 1 }}>
        <span className="lp-val__track" aria-hidden="true">
          <span className="lp-val__fill" />
          {ticks.filter((t) => t > min && t < max).map((t) => <i key={t} className="lp-val__tick" style={{ '--at': (t - min) / span }} />)}
        </span>
        <input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={words(value).long}
          onChange={(event) => onChange(Number(event.target.value))} />
      </div>
      <p className="lp-val__ends" aria-hidden="true"><span>{words(min).short}</span><span>{words(max).short}</span></p>
    </div>
  );
}

export function PlanValue({ offer, from, keyCards = null, minutesPerCard = null }) {
  const id = useId();
  const [readOn, setReadOn] = useState(from);
  useEffect(() => {
    if (dayOf(new Date()) === dayOf(new Date(from))) return undefined;
    const frame = requestAnimationFrame(() => setReadOn(new Date().toISOString()));
    return () => cancelAnimationFrame(frame);
  }, [from]);
  const at = useMemo(() => new Date(readOn), [readOn]);
  const paces = useMemo(() => mockPaces(offer, { from: at }), [offer, at]);
  const [pace, setPace] = useState(PACE.start);
  const [cards, setCards] = useState(CARD_PACE.start);
  const [touched, setTouched] = useState(false);
  const [said, setSaid] = useState('');
  // Near the end of a one-time term the lowest paces fill no whole mock; the slider then starts at the first pace that does.
  const low = paces[0] ?? PACE.min;
  const high = paces.at(-1) ?? PACE.max;
  const pick = Math.min(Math.max(pace, low), high);
  const v = useMemo(() => (paces.length ? planValue(offer, { from: at, pace: pick, cards, keyCards, minutesPerCard }) : null), [paces, offer, at, pick, cards, keyCards, minutesPerCard]);
  const [mocks, turned] = useRoll(v ? [v.mocks, v.cards?.count ?? 0] : [0, 0]);
  useEffect(() => {
    if (!touched || !v) return undefined;
    const timer = setTimeout(() => setSaid(VALUE_COPY.live(v)), 700);
    return () => clearTimeout(timer);
  }, [touched, v]);
  if (!v) return null;

  const day = VALUE_COPY.day(v);
  const { lines } = VALUE_COPY;
  // A move marks the block as touched, so the live line speaks only after a student's own change, never on load.
  const move = (set) => (value) => { setTouched(true); set(value); };
  return (
    <div className="lp-val" role="group" aria-labelledby={`${id}-title`}>
      <div className="lp-val__top">
        <h3 className="lp-val__title" id={`${id}-title`}>{VALUE_COPY.title(v)}</h3>
        <p className="lp-val__day">{day.lead}<b>{day.figure}</b>{day.unit}</p>
        <p className="lp-val__sum">{VALUE_COPY.daySum(v)}</p>
      </div>

      <div className="lp-val__paces">
        <Pace id={`${id}-mocks`} ask={VALUE_COPY.mocks.ask} words={VALUE_COPY.mocks.words} value={pick} min={low} max={high} step={PACE.step}
          ticks={MOCK_TICKS} onChange={move(setPace)} />
        {v.cards ? (
          <Pace id={`${id}-cards`} ask={VALUE_COPY.cards.ask} words={VALUE_COPY.cards.words} value={v.cards.perDay} min={CARD_PACE.min}
            max={CARD_PACE.max} step={CARD_PACE.step} ticks={CARD_TICKS} onChange={move(setCards)} />
        ) : null}
      </div>

      <div className="lp-val__out">
        <p className="lp-val__plan">{VALUE_COPY.plan}</p>
        <dl className="lp-val__lines">
          <Line label={lines.mocks.label} detail={lines.mocks.detail(v)} shown={mocks} real={v.mocks} />
          {v.cards ? <Line label={lines.cards.label} detail={lines.cards.detail(v)} shown={turned} real={v.cards.count} /> : null}
        </dl>
      </div>

      <p className="lp-val__also"><b>{VALUE_COPY.also.lead}</b> {VALUE_COPY.alsoLine()} {VALUE_COPY.also.credits}</p>
      <p className="lp-sr" aria-live="polite">{said}</p>
    </div>
  );
}

export default PlanValue;
