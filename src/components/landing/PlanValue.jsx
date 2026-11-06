"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { SUBJECT_COUNT, usualWay } from '@/lib/payments/receipt.mjs';
import { BrandIcon } from '@/components/brand/BrandIcon';
import { VALUE_COPY } from './homeCopy.mjs';
import { STRIP_OBJECT_BOX, stripObjectSrc, stripObjectSrcSet } from './stripObjects.mjs';

// What students usually pay, and what Pro costs, beside the Pro card (round 5, final pass; owner 6 Nov 2026: "compare it to how
// people usually pay ... a mock series ... and some revision key card-type books or flashcards ... We'll just be showing the ₹99
// only versus what they are paying otherwise"). One control, the student's own CUET subject count (1 to 5, large steps, native
// buttons with aria-pressed, 44 px; 5 first, owner 7 Nov 2026: "99% of students are taking 5 subjects"). The usual way for that
// many subjects (typical per-subject prices, receipt.mjs USUAL_PRICES), its total rolling to its new value (280 ms ease-out; at
// once under reduced motion), then MockMob Pro's price and everything that one price holds (owner 7 Nov 2026, "a maximalist
// approach": the features' own desk objects and names, the hero strip's objects), then two bars drawn to scale (the usual total
// full width, Pro's price its true share) and the punch line, restored (owner 7 Nov 2026: "the usual way ... a month here ...
// we should add it back in"). Every figure comes from receipt.mjs usualWay (pure, tested); nothing here works out money. A month
// of Pro is never multiplied.

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
const n = (count) => Number(count).toLocaleString('en-IN');
const rupeesOf = (whole) => `₹${n(whole)}`;
const STEPS = Object.freeze(Array.from({ length: SUBJECT_COUNT.max - SUBJECT_COUNT.min + 1 }, (_, i) => SUBJECT_COUNT.min + i));

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

// One feature's desk object: the hero strip's own cut (stripObjects.mjs, a 12:11 box, one weight and one baseline), drawn small
// (home-pricing.css .lp-usual__obj-sm), so the object that names a feature in the hero names it here too. Decorative: the name
// is printed beside it. Under 32 px BrandIcon draws a line icon instead, which the owner rejected for features (LK160).
function FeatureObject({ name }) {
  const src = stripObjectSrc(name);
  if (!src) return <span className="lp-usual__obj-sm" aria-hidden="true" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a pre-cut webp set with its own srcset; no optimizer round trip for a 32 px object
    <img className="lp-usual__obj-sm" src={src} srcSet={stripObjectSrcSet(name)} sizes="32px" width={STRIP_OBJECT_BOX.width} height={STRIP_OBJECT_BOX.height}
      alt="" decoding="async" loading="lazy" draggable={false} />
  );
}

/** A name with its count-like word marked (homeCopy VALUE_COPY.features `em`), as the plan card marks its lines. */
function Marked({ text, em }) {
  const at = em ? text.indexOf(em) : -1;
  if (at < 0) return text;
  return <>{text.slice(0, at)}<b className="lp-usual__em">{em}</b>{text.slice(at + em.length)}</>;
}

export function PlanValue({ offer, keyCards = false }) {
  const id = useId();
  const [subjects, setSubjects] = useState(SUBJECT_COUNT.start);
  const [said, setSaid] = useState('');
  const u = usualWay(offer, subjects);
  const total = useRoll(u ? u.totalPaise / 100 : 0);
  if (!u) return null;
  const punch = VALUE_COPY.punch(u);
  const pick = (count) => { setSubjects(count); const next = usualWay(offer, count); if (next) setSaid(VALUE_COPY.live(next)); };

  return (
    <div className="lp-val" role="group" aria-labelledby={`${id}-title`}>
      <h3 className="lp-val__title" id={`${id}-title`}>{VALUE_COPY.title}</h3>

      <div className="lp-usual__ask">
        <p className="lp-usual__q" id={`${id}-ask`}>{VALUE_COPY.ask}</p>
        <div className="lp-usual__steps" role="group" aria-labelledby={`${id}-ask`}>
          {STEPS.map((count) => (
            <button key={count} type="button" className="lp-usual__step" aria-pressed={count === u.subjects} aria-label={VALUE_COPY.subjects(count)}
              onClick={() => pick(count)}>{count}</button>
          ))}
        </div>
      </div>

      <div className="lp-usual__way">
        <p className="lp-usual__head">{VALUE_COPY.usualHead}</p>
        <ul className="lp-usual__lines">
          {u.lines.map((line) => (
            <li key={line.key} className="lp-usual__line">
              <BrandIcon name={VALUE_COPY.lines[line.key].icon} size={32} className="lp-usual__obj" />
              <span className="lp-usual__what"><b>{VALUE_COPY.lines[line.key].name}</b><span>{VALUE_COPY.each(line)}</span></span>
              <span className="lp-usual__sum">{rupeesOf(line.totalPaise / 100)}</span>
            </li>
          ))}
        </ul>
        <p className="lp-usual__total"><span>{VALUE_COPY.subjects(u.subjects)}</span><b><span aria-hidden="true">{rupeesOf(total)}</span><span className="lp-sr">{u.total}</span></b></p>
      </div>

      <div className="lp-usual__pro">
        <p className="lp-usual__pro-head"><b>{VALUE_COPY.proName}</b><span>{VALUE_COPY.proPrice(u)}</span></p>
        <p className="lp-usual__all" id={`${id}-all`}>{VALUE_COPY.allIn(u)}</p>
        <ul className="lp-usual__feats" aria-labelledby={`${id}-all`}>
          {VALUE_COPY.features({ keyCards }).map((feature) => (
            <li key={feature.icon} className="lp-usual__feat"><FeatureObject name={feature.icon} /><span><Marked text={feature.name} em={feature.em} /></span></li>
          ))}
        </ul>
      </div>

      <div className="lp-usual__bars" aria-hidden="true">
        <span className="lp-usual__bar"><i>{VALUE_COPY.barUsual}</i><span className="lp-usual__fill lp-usual__fill--usual" style={{ '--w': 1 }} /></span>
        <span className="lp-usual__bar"><i>{VALUE_COPY.barPro}</i><span className="lp-usual__fill lp-usual__fill--pro" style={{ '--w': u.share }} /></span>
      </div>
      <p className="lp-usual__punch"><span>{punch.usual}</span> <b>{punch.pro}</b></p>
      <p className="lp-usual__note">{VALUE_COPY.footnote()}</p>
      <p className="lp-sr" aria-live="polite">{said}</p>
    </div>
  );
}

export default PlanValue;
