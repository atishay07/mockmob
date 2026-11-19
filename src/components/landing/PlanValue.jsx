"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SUBJECT_COUNT, usualWay } from '@/lib/payments/receipt.mjs';
import Doodle from '@/components/doodle/Doodle';
import { BrandIcon } from '@/components/brand/BrandIcon';
import { PLAN_HOME, VALUE_COPY } from './homeCopy.mjs';
import { STRIP_OBJECT_BOX, stripObjectSrc, stripObjectSrcSet } from './stripObjects.mjs';
import { Unfold } from './Unfold';

// The body of the home page's one Pro card (round 2 of 18 Nov 2026, lane home-b: "one card a student reads in one look: the
// price, what it buys as six objects, and the comparison as one line"). It sits inside the shared PlanCard, under the card's
// own name, price and term lines, and draws, in this order on a phone:
//   1. everything the one price holds as six desk objects with their names, a 3 x 2 grid (the hero strip's own cuts, 64 px);
//   2. the subject picker (1 to 5, one segmented row of native buttons with aria-pressed, 44 px; 5 first, owner 7 Nov 2026:
//      "99% of students are taking 5 subjects") and directly under it the punch line, the existing sentence (VALUE_COPY.punch)
//      whose usual total rolls to its new value (280 ms ease-out; at once under reduced motion) and re-inks its highlighter
//      on every change (Doodle inkKey, as CompassLadder and the old receipt total did);
//   3. `go`, the volt Get Pro key and the way to /pricing (HomePricing passes it);
//   4. two disclosures, closed on a phone and open from 900 px (Unfold): `everything` (the plan's grouped, ticked lines,
//      PlanCounts, as they were) and how the usual price is worked out (the old card's title, the usual-way receipt with its
//      two lines and total, MockMob Pro's own price, the two bars drawn to scale and the footnote, as they were);
//   5. `free`, the Free option as one quiet line with its key.
// From 900 px the card is two columns (r19-home-b.css): 1 to 3 and 5 on the left under the price, the two opened disclosures
// on the right. `compare` is false while the new offer is on sale (the value grid and the comparison count Full mocks as
// unlimited, Pro's promise only on the current offer, HomePricing.jsx), and usualWay is null while the offer gives no figure:
// then only `go`, the plan's lines and `free` are drawn. Every figure comes from receipt.mjs usualWay (pure, tested); nothing
// here works out money. A month of Pro is never multiplied.

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

// One feature's desk object: the hero strip's own cut (stripObjects.mjs, a 12:11 box, one weight and one baseline), drawn at
// 64 px (r19-home-b.css .lp-usual__obj-sm), so the object that names a feature in the hero names it here too. Decorative: the
// name is printed under it. Under 32 px BrandIcon draws a line icon instead, which the owner rejected for features (LK160).
function FeatureObject({ name }) {
  const src = stripObjectSrc(name);
  if (!src) return <span className="lp-usual__obj-sm" aria-hidden="true" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a pre-cut webp set with its own srcset; no optimizer round trip for a 64 px object
    <img className="lp-usual__obj-sm" src={src} srcSet={stripObjectSrcSet(name)} sizes="64px" width={STRIP_OBJECT_BOX.width} height={STRIP_OBJECT_BOX.height}
      alt="" decoding="async" loading="lazy" draggable={false} />
  );
}

/** A name with its count-like word marked (homeCopy VALUE_COPY.features `em`), as the plan card marks its lines. */
function Marked({ text, em }) {
  const at = em ? text.indexOf(em) : -1;
  if (at < 0) return text;
  return <>{text.slice(0, at)}<b className="lp-usual__em">{em}</b>{text.slice(at + em.length)}</>;
}

export function PlanValue({ offer, keyCards = false, compare = true, go = null, everything = null, free = null }) {
  const id = useId();
  const [subjects, setSubjects] = useState(SUBJECT_COUNT.start);
  const [showMath, setShowMath] = useState(false);
  const [said, setSaid] = useState('');
  const u = compare ? usualWay(offer, subjects) : null;
  const total = useRoll(u ? u.totalPaise / 100 : 0);
  const pick = (count) => { setSubjects(count); const next = usualWay(offer, count); if (next) setSaid(VALUE_COPY.live(next)); };
  const punch = u ? VALUE_COPY.punch(u) : null;
  // The punch line's first words are the usual total (VALUE_COPY.punch); that figure rolls and carries the highlighter. A
  // screen reader hears the sentence once, whole; the rolling copy is for the eye.
  const rest = punch && punch.usual.startsWith(u.total) ? punch.usual.slice(u.total.length) : null;

  // How the usual price adds up: the itemised sum and the two bars. Shown under the figure on a phone (a key opens it) and
  // beside the card from 900 px.
  const receipt = () => (u ? (
    <>
            <p className="lp-val__title">{VALUE_COPY.title}</p>
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
            <p className="lp-usual__pro-head"><b>{VALUE_COPY.proName}</b><span>{VALUE_COPY.proPrice(u)}</span></p>
            <div className="lp-usual__bars" aria-hidden="true">
              <span className="lp-usual__bar"><i>{VALUE_COPY.barUsual}</i><span className="lp-usual__fill lp-usual__fill--usual" style={{ '--w': 1 }} /></span>
              <span className="lp-usual__bar"><i>{VALUE_COPY.barPro}</i><span className="lp-usual__fill lp-usual__fill--pro" style={{ '--w': u.share }} /></span>
            </div>
            <p className="lp-usual__note">{VALUE_COPY.footnote()}</p>
    </>
  ) : null);

  return (
    <>
      <div className="lp-plan__main">
        {u ? (
          <>
            <p className="lp-usual__all" id={`${id}-all`}>{VALUE_COPY.allIn(u)}</p>
            <ul className="lp-usual__feats" aria-labelledby={`${id}-all`}>
              {VALUE_COPY.features({ keyCards }).map((feature) => (
                <li key={feature.icon} className="lp-usual__feat"><FeatureObject name={feature.icon} /><span><Marked text={feature.name} em={feature.em} /></span></li>
              ))}
            </ul>

            <div className="lp-plan__vs" role="group" aria-label={VALUE_COPY.title}>
              <p className="lp-usual__q" id={`${id}-ask`}>{VALUE_COPY.ask}</p>
              <div className="lp-usual__steps" role="group" aria-labelledby={`${id}-ask`}>
                {STEPS.map((count) => (
                  <button key={count} type="button" className="lp-usual__step" aria-pressed={count === u.subjects} aria-label={VALUE_COPY.subjects(count)}
                    onClick={() => pick(count)}>{count}</button>
                ))}
              </div>
              <p className="lp-usual__punch">
                {rest == null ? <span>{punch.usual}</span> : (
                  <span>
                    <span className="lp-sr">{punch.usual}</span>
                    <span aria-hidden="true"><Doodle mark="highlight" inkKey={subjects}>{rupeesOf(total)}</Doodle>{rest}</span>
                  </span>
                )} <b>{punch.pro}</b>
              </p>
              {/* Owner LK325 (18 Nov 2026): "you are just writing three thousand seven hundred fifty usual way ... that is hidden
                  under a dropbox, so it will be confusion of how it adds up". On a phone the sum now opens right under the
                  figure, from a key that names it; from 900 px it stands open beside the card, as before. */}
              <button type="button" className="lp-usual__math" aria-expanded={showMath} aria-controls={`${id}-math`} onClick={() => setShowMath(!showMath)}>
                <span>{VALUE_COPY.addsUp(u.total)}</span><ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" />
              </button>
              <div id={`${id}-math`} hidden={!showMath} className="lp-usual__receipt">{receipt()}</div>
            </div>
          </>
        ) : null}
        {go}
      </div>

      <div className="lp-plan__detail">
        <Unfold from={900} className="lp-fold--plan" summary={PLAN_HOME.everything} head={<h4 className="lp-fold__title">{PLAN_HOME.everything}</h4>}>
          {everything}
        </Unfold>
        {u ? (
          <Unfold from={900} className="lp-fold--usual" summary={PLAN_HOME.workedOut} head={<h4 className="lp-fold__title">{PLAN_HOME.workedOut}</h4>}>
            {receipt()}
          </Unfold>
        ) : null}
      </div>

      {free}
      <p className="lp-sr" aria-live="polite">{said}</p>
    </>
  );
}

export default PlanValue;
