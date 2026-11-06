"use client";

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { PACE } from '@/lib/payments/value.mjs';
import { CARD_PACE, mockPaces, planValue } from '@/lib/payments/receipt.mjs';
import { BrandIcon } from '@/components/brand/BrandIcon';
import { stripObjectSrc, stripObjectSrcSet } from './stripObjects.mjs';
import { VALUE_COPY } from './homeCopy.mjs';

// Everything Pro's price covers at the student's own pace, beside the Pro card (round 5, third take; owner 6 Nov 2026: "a slider for
// how many things a student can do, like if someone is attempting 1 mock, then repairs, then key cards and other stuff ... So many
// features other than mocks ... which the Pro plan gives"; after the second take: "it doesn't add all the other features";
// docs/design-decisions/web-r5-value.md).
// Two questions in the student's own units, each a native range (arrows, Home/End and Page keys, a 44 px target; a screen reader
// hears the value in words through aria-valuetext): full mocks a week (5 to 21, ticks at one and two a day) and, while Key cards
// are live, Key cards a day (12 to 60, ticks every twelve). Then every Pro feature as its own line, with its own desk object and its
// own measure, never the same number twice: Full mocks (the month's count, the price of one), Mistake Lab (the answers it
// traces), Chapter review (after every mock), Mistake Repair and Ask Mobi (Pro's monthly credits), Key cards (cards turned); then
// what Pro includes without a measure (NTA exam mode, Smart practice, Compass Pro, saved questions); then the payoff: the price
// for all of it, a day and a question. Every figure comes from receipt.mjs planValue (pure, tested); nothing here is typed or
// works out money itself.
// The days left are counted from the day the page was built (`from`, so the server's figures and the first paint agree), then,
// once the block is on a reader's screen, from the reader's own day (a one-time term runs down; a month is always 30 days).
// The counts roll to their new values in 280 ms (ease-out) from wherever they stand; reduced motion changes them at once. The
// rolling digits are hidden from screen readers, which read the real figures, and one polite live line says the new plan once
// the student stops moving a slider.

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
const n = (count) => Number(count).toLocaleString('en-IN');
/** A rolling whole-rupee figure, written as the page writes rupees ("₹236"). */
const rupeesOf = (whole) => `\u20b9${n(whole)}`;
const dayOf = (date) => date.toISOString().slice(0, 10);
/** The ticks on each rail: whole days on the mocks rail (one and two a day), every twelve on the Key cards rail. */
const MOCK_TICKS = Object.freeze([7, 14]);
const CARD_TICKS = Object.freeze([24, 36, 48]);

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

/** A feature's desk object: the brand's 3D icon (BrandIcon), or Mobi himself for Mistake Repair and Ask Mobi (the hero strip's). */
function FeatureObject({ name, small = false }) {
  const size = small ? 32 : 40;
  if (name === 'mobi') {
    // eslint-disable-next-line @next/next/no-img-element -- pre-sized webp set, as the hero strip draws it
    return <span className="lp-val__obj" aria-hidden="true"><img src={stripObjectSrc('mobi')} srcSet={stripObjectSrcSet('mobi')} sizes={`${size}px`} width={size} height={Math.round(size * 11 / 12)} alt="" decoding="async" loading="lazy" /></span>;
  }
  return <BrandIcon name={name} size={size} className="lp-val__obj" />;
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

export function PlanValue({ offer, from, keyCards = null, minutesPerCard = null, mobiCredits = null, credits = null }) {
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
  const v = useMemo(() => (paces.length ? planValue(offer, { from: at, pace: pick, cards, keyCards, minutesPerCard, mobiCredits, credits: credits?.prices }) : null), [paces, offer, at, pick, cards, keyCards, minutesPerCard, mobiCredits, credits]);
  const [worthRupees, saveRupees] = useRoll(v ? [(v.worth?.worthPaise ?? 0) / 100, (v.worth?.savePaise ?? 0) / 100] : [0, 0]);
  useEffect(() => {
    if (!touched || !v) return undefined;
    const timer = setTimeout(() => setSaid(VALUE_COPY.live(v)), 700);
    return () => clearTimeout(timer);
  }, [touched, v]);
  if (!v) return null;

  const save = VALUE_COPY.save(v);
  // A move marks the block as touched, so the live line speaks only after a student's own change, never on load.
  const move = (set) => (value) => { setTouched(true); set(value); };
  return (
    <div className="lp-val" role="group" aria-labelledby={`${id}-title`}>
      <h3 className="lp-val__title" id={`${id}-title`}>{VALUE_COPY.title(v)}</h3>

      <div className="lp-val__paces">
        <Pace id={`${id}-mocks`} ask={VALUE_COPY.mocks.ask} words={VALUE_COPY.mocks.words} value={pick} min={low} max={high} step={PACE.step}
          ticks={MOCK_TICKS} onChange={move(setPace)} />
        {v.cards ? (
          <Pace id={`${id}-cards`} ask={VALUE_COPY.cards.ask} words={VALUE_COPY.cards.words} value={v.cards.perDay} min={CARD_PACE.min}
            max={CARD_PACE.max} step={CARD_PACE.step} ticks={CARD_TICKS} onChange={move(setCards)} />
        ) : null}
      </div>

      <div className="lp-val__answer">
        {v.worth ? (
          <>
            <p className="lp-val__worth"><span aria-hidden="true">{VALUE_COPY.worth({ ...v, worth: { ...v.worth, worth: rupeesOf(worthRupees) } })}</span><span className="lp-sr">{VALUE_COPY.worth(v)}</span></p>
            <p className="lp-val__pay">{VALUE_COPY.pay(v)}</p>
            {save ? (
              <p className="lp-val__save">{save.lead}<b><span aria-hidden="true">{rupeesOf(saveRupees)}</span><span className="lp-sr">{save.figure}</span></b>{save.unit}</p>
            ) : <p className="lp-val__save">{VALUE_COPY.paysFor(v)}</p>}
            {credits?.footnote ? <p className="lp-val__note">{credits.footnote}</p> : null}
          </>
        ) : (
          <>
            <p className="lp-val__pay">{VALUE_COPY.pay(v)}</p>
            <p className="lp-val__save">{VALUE_COPY.plain(v)}</p>
          </>
        )}
      </div>

      <ul className="lp-val__chips" aria-label="What Pro includes">
        {VALUE_COPY.chips(v).map((chip) => (
          <li key={chip.key} className="lp-val__chip"><FeatureObject name={chip.icon} small />{chip.label}</li>
        ))}
      </ul>
      <p className="lp-sr" aria-live="polite">{said}</p>
    </div>
  );
}

export default PlanValue;
