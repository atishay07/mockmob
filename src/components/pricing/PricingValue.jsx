"use client";

import '@/app/marketing.css'; // the .mm keys it draws (speed.md item 8): only where they are drawn
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { planValue, usualWay } from '@/lib/payments/receipt.mjs';
import { BrandIcon } from '@/components/brand/BrandIcon';
import { PRICING_VALUE as C, SUBJECT_STEPS, VALUE_START, paceFigures, paceStep, paceSteps, valueTiles } from './pricingValueCopy.mjs';
import './pricing-value.css';

// The /pricing page's value section (round 6, owner 7 Nov 2026: "keep a more detailed value indicator than the homepage one ...
// if someone is coming to a pricing page, they should not leave in any case"), between "Free or Pro" and the side-by-side table.
// Top to bottom: the heading and its lede; two solid cards, each led by its own control so the figure it changes sits right under
// it (side by side from 960 px): the receipt (CUET subjects, 1 to 5, 5 first; the usual way for that many subjects, its total
// rolling to its new value, MockMob Pro's price, two bars drawn to scale, and the punch line "₹X the usual way. ₹99 a month
// here.") and the pace (full mocks a week as four plain keys, 1 a day first; what Pro comes to a mock, a question and a day at
// that pace, with the maths beside them); then what else the same price holds (desk objects, names and lines the site already
// ships); then Get Pro and Start free, and the typical-prices footnote.
// Every figure comes from receipt.mjs (usualWay, planValue) through pricingValueCopy.mjs; nothing here works out money.
// Controls are native buttons with aria-pressed, 44 px and up, with the page's focus ring; a polite live line says the new
// figures. The total rolls in 280 ms ease-out, the bars glide in 280 ms; at once under reduced motion (the device's setting or
// the student's own switch, :root[data-motion='reduced']).
// `offer` is the plain offer (pricingValueCopy.mjs plainTerms); `from` the day the page was built (ISO), the one-time days' first
// count, recounted from the reader's own day once on screen; `keyCards` and `mob` say whether those are live; `actions` false
// for a student already on Pro.

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
const rupeesOf = (whole) => `₹${Number(whole).toLocaleString('en-IN')}`;
const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** Rolls a whole number to a new target (one frame loop, ease-out), from the figure on screen. */
function useRoll(target, duration = 280) {
  const [shown, setShown] = useState(target);
  const at = useRef(target);
  useEffect(() => {
    const start = at.current;
    if (start === target) return undefined;
    let frame = 0;
    if (reduced()) {
      frame = requestAnimationFrame(() => { at.current = target; setShown(target); });
      return () => cancelAnimationFrame(frame);
    }
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const next = t < 1 ? Math.round(start + (target - start) * (1 - Math.pow(1 - t, 3))) : target;
      at.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return shown;
}

/** A tile's desk object: a BrandIcon at 32 px, or Ask Mobi's brass desk bell (as in the feature tour). */
function TileIcon({ name }) {
  if (name === 'bell') {
    // eslint-disable-next-line @next/next/no-img-element -- a 10 KB pre-sized webp, no optimizer round trip for a 32 px mark
    return <span className="pro-val__obj" aria-hidden="true"><img src="/brand/mascot/ask-deskbell.webp" width={32} height={29} alt="" decoding="async" loading="lazy" draggable={false} /></span>;
  }
  return <BrandIcon name={name} size={32} className="pro-val__obj" />;
}

export function PricingValue({ offer, keyCards = false, mob = false, recovery = false, from = null, freeHref = '/signup', proHref = '#plans', actions = true }) {
  const id = useId();
  const [subjects, setSubjects] = useState(VALUE_START.subjects);
  const [pace, setPace] = useState(VALUE_START.pace);
  const [day, setDay] = useState(() => (from ? new Date(from) : null));
  const [said, setSaid] = useState('');
  const once = offer?.purchasable !== 'monthly';
  // A one-time offer pays for the days left to its end, so its figures are recounted from the reader's own day once on screen.
  useEffect(() => {
    if (!once) return undefined;
    const frame = requestAnimationFrame(() => setDay(new Date()));
    return () => cancelAnimationFrame(frame);
  }, [once]);

  const u = usualWay(offer, subjects);
  const total = useRoll(u ? u.totalPaise / 100 : 0);
  if (!u) return null;
  const steps = paceSteps(offer, { from: day });
  const at = steps.includes(pace) ? pace : (steps[0] ?? null);
  const v = at ? planValue(offer, { from: day, pace: at }) : null;
  const figures = paceFigures(v);
  const punch = C.punch(u);
  const tiles = valueTiles({ keyCards, mob, recovery });

  const pickSubjects = (count) => {
    setSubjects(count);
    const next = usualWay(offer, count);
    if (next) setSaid(C.liveSubjects(next));
  };
  const pickPace = (next) => {
    setPace(next);
    const plan = planValue(offer, { from: day, pace: next });
    if (plan) setSaid(C.livePace(plan));
  };

  return (
    <section className="pro-sec pro-val" id="value" aria-labelledby="pro-val-h" data-commerce="">
      <div className="pro-wrap">
        <header className="pro-val__head">
          <h2 className="pro-h2" id="pro-val-h">{C.title}</h2>
          <p className="pro-val__lede">{C.lede(u, { until: offer?.oneTime?.expires })}</p>
        </header>

        <div className={`pro-val__grid${v ? '' : ' pro-val__grid--one'}`}>
          {/* The receipt: the subject count, the usual way, Pro's price, the bars and the punch line. */}
          <div className="pro-val__card pro-val__receipt">
            <div className="pro-val__ask">
              <p className="pro-val__q" id={`${id}-subjects`}>{C.askSubjects}</p>
              <div className="pro-val__steps" role="group" aria-labelledby={`${id}-subjects`}>
                {SUBJECT_STEPS.map((count) => (
                  <button key={count} type="button" className="pro-val__step" aria-pressed={count === u.subjects} aria-label={cap(C.subjects(count))}
                    onClick={() => pickSubjects(count)}>{count}</button>
                ))}
              </div>
            </div>

            <div className="pro-val__way">
              <p className="pro-val__label">{C.usualHead}</p>
              <ul className="pro-val__lines">
                {u.lines.map((line) => (
                  <li key={line.key} className="pro-val__line">
                    <BrandIcon name={C.lines[line.key].icon} size={32} className="pro-val__obj" />
                    <span className="pro-val__what"><b>{C.lines[line.key].name}</b><span>{C.each(line)}</span></span>
                    <span className="pro-val__sum">{rupeesOf(line.totalPaise / 100)}</span>
                  </li>
                ))}
              </ul>
              <p className="pro-val__total">
                <span>{C.totalLabel(u)}</span>
                <b><span aria-hidden="true">{rupeesOf(total)}</span><span className="pro-val__sr">{u.total}</span></b>
              </p>
            </div>

            <div className="pro-val__pro">
              <p className="pro-val__pro-head"><b>{C.proName}</b><span>{C.proPrice(u)}</span></p>
              <p className="pro-val__pro-line">{C.proLine({ keyCards })}</p>
            </div>

            <div className="pro-val__bars" aria-hidden="true">
              <span className="pro-val__bar"><i>{C.barUsual}</i><span className="pro-val__fill pro-val__fill--usual" style={{ '--w': 1 }} /></span>
              <span className="pro-val__bar"><i>{C.barPro}</i><span className="pro-val__fill pro-val__fill--pro" style={{ '--w': u.share }} /></span>
            </div>

            <p className="pro-val__punch">
              <span aria-hidden="true">{rupeesOf(total)} {punch.rest}</span><span className="pro-val__sr">{punch.usual}</span>{' '}
              <b>{punch.pro}</b>
            </p>
          </div>

          {/* The pace: full mocks a week, and what Pro comes to at it. */}
          {v ? (
            <div className="pro-val__card pro-val__pace">
              <div className="pro-val__ask">
                <p className="pro-val__q" id={`${id}-pace`}>{C.askPace}</p>
                <div className="pro-val__steps pro-val__steps--pace" role="group" aria-labelledby={`${id}-pace`} style={{ '--n': steps.length }}>
                  {steps.map((p) => {
                    const s = paceStep(p);
                    return (
                      <button key={p} type="button" className="pro-val__step pro-val__step--pace" aria-pressed={p === at} aria-label={s.aria} onClick={() => pickPace(p)}>
                        <b>{s.label}</b><span>{s.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pro-val__at">
                <p className="pro-val__label">{C.paceHead}</p>
                <ul className="pro-val__figs">
                  {figures.map((f) => (
                    <li key={f.key} className="pro-val__fig">
                      <span className="pro-val__fig-pre">{f.pre}</span>
                      <span className="pro-val__fig-row"><b className="pro-val__fig-num">{f.value}</b><span className="pro-val__fig-unit">{f.unit}</span></span>
                    </li>
                  ))}
                </ul>
                <p className="pro-val__maths">{C.paceMaths(v)}</p>
              </div>

              <p className="pro-val__series">{C.seriesLine}</p>
            </div>
          ) : null}
        </div>

        {/* What else the same price holds. */}
        <div className="pro-val__also">
          <h3 className="pro-val__also-h" id={`${id}-also`}>{C.alsoHead(u)}</h3>
          <ul className="pro-val__tiles" data-count={tiles.length} aria-labelledby={`${id}-also`}>
            {tiles.map((tile) => (
              <li key={tile.key} className="pro-val__tile">
                <TileIcon name={tile.icon} />
                <div className="pro-val__tile-copy">
                  <h4>{tile.name}</h4>
                  <p>{tile.line}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {actions ? (
          <div className="pro-val__go">
            <a className="mm-btn mm-btn--primary" href={proHref}>{C.getPro}</a>
            <Link className="mm-btn mm-btn--secondary" href={freeHref}>{C.startFree}</Link>
          </div>
        ) : null}
        <p className="pro-val__note">{C.footnote()}</p>
        <p className="pro-val__sr" aria-live="polite">{said}</p>
      </div>
    </section>
  );
}

export default PricingValue;
