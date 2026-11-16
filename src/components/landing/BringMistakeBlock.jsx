"use client";

import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera } from 'lucide-react';
import { Icon } from '@/components/ui/Icons';
import { useAuth } from '@/components/AuthProvider';
import { signupPathFor } from '@/lib/auth-redirect';
import { BrandStamp } from './BrandStamp';
import { MascotSeat } from '@/components/brand/Mascot';
import { Reveal } from './Reveal';
import { BRING_MISTAKE as W, BRING_MISTAKE_PATH, bringMistakeWords } from './bringMistakeCopy.mjs';
import './bring-mistake.css';

// "Bring a mistake" on the home page. The feature is live in Ask Mobi (src/components/ai/BringMistake.jsx).
// Third build, 16 Nov 2026 night. The owner kept the one-card walk-through ("doing a good job") and asked for readable,
// concrete words: what exactly the student brings, and what MockMob gives back that any other answer does not. So:
//   the sub     where the question comes from (a coaching sheet, a school paper, a book) and how it gets in
//   the value   "What you leave with": the CUET chapter, the slip, 2 checks, 10 more from the bank (the app's own counts)
//   the card    the feature's four steps, as tabs the reader moves through (never a timer):
//     1  Question   the question as brought, the option chosen marked, and what Mobi needs
//     2  Read       the chapter from MockMob's CUET list, what it tests, the working lined up, the likely slip (on ink)
//     3  Check      one fresh question on the same idea, answerable here
//     4  Practise   the practice set the app's answer ends on: 10 from MockMob's bank, on that chapter
// All four steps are drawn in one grid cell and only the chosen one shows, so the card is as tall as its tallest step at
// every width and never changes height between steps. Nothing is sent anywhere: the example and its key are in
// bringMistakeCopy.mjs (checked by its test), and the block says the example is ours. One volt key: sign up and bring your
// own (a signed-in student goes to Ask Mobi).
// `photo` is the app's own switch (data/mistake_photo.mjs): the words promise a photo only while Mobi reads photos. The
// two prices are the app's too (page.js passes them), so the price line can never drift from what a student is charged.

const LETTERS = ['A', 'B', 'C', 'D'];
// A ratio ("3 : 2") and a number with the word after it ("2 credits", "10 come") never break across two lines.
const keep = (text) => String(text).replace(/(\d) : (?=\d)/g, '$1\u00A0:\u00A0').replace(/(\d) (?=[a-z])/g, '$1\u00A0');

function Step({ id, i, step, children, ink = false, ...rest }) {
  const on = step === i;
  return (
    <div className={`bmk__pane${ink ? ' bmk__pane--ink' : ''}`} id={`${id}-panel-${i}`} role="tabpanel" aria-labelledby={`${id}-tab-${i}`}
      data-on={on ? 'true' : 'false'} aria-hidden={on ? undefined : 'true'} inert={!on} {...rest}>
      {children}
    </div>
  );
}

export default function BringMistakeBlock({ photo = false, credits = 1, photoCredits = 2 }) {
  const { isAuthenticated } = useAuth();
  const id = useId();
  const tabs = useRef([]);
  const [step, setStep] = useState(0);
  const [pick, setPick] = useState(null);
  const answered = pick !== null;
  const right = pick === W.check.correct;
  const words = bringMistakeWords({ photo, credits, photoCredits });
  const last = W.steps.length - 1;

  const go = (n) => setStep(Math.max(0, Math.min(last, n)));
  const onKey = (event) => {
    const move = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const jump = event.key === 'Home' ? 0 : event.key === 'End' ? last : null;
    if (!move && jump === null) return;
    event.preventDefault();
    const next = jump ?? (step + move + W.steps.length) % W.steps.length;
    go(next);
    tabs.current[next]?.focus();
  };

  return (
    <section className="lp-sec bmk" id="bring-a-mistake" aria-labelledby="bmk-title">
      <div className="mm-wrap bmk__grid">
        <div className="bmk__say">
          {/* 17 Nov 2026: Mobi with the phone camera at the head's right (the photo is how most students will bring it). */}
          <div className="lp-guide-head bmk__guide"><Reveal className="bmk__head">
            <BrandStamp {...W.stamp} />
            <h2 className="lp-h2" id="bmk-title">{W.h2}</h2>
            <p className="lp-sub">{words.sub}</p>
          </Reveal><MascotSeat station="photo" pose="camera" label="Show me the page." /></div>
          <div className="bmk__value">
            <p className="bmk__value-label" id={`${id}-value`}>{W.value.label}</p>
            <ul className="bmk__gets" aria-labelledby={`${id}-value`}>
              {W.value.items.map((item) => (
                <li key={item.lead}>
                  <span className="bmk__get-lead">{item.figure ? <><span className="bmk__fig">{item.figure}</span> </> : null}{item.lead}</span>
                  <span className="bmk__get-line">{item.line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bmk__foot">
            <Link href={isAuthenticated ? BRING_MISTAKE_PATH : signupPathFor(BRING_MISTAKE_PATH)} className="mm-btn mm-btn--primary bmk__key">
              {isAuthenticated ? W.keyStudent : W.keyGuest}
            </Link>
            <p className="bmk__price">{keep(words.price)}</p>
          </div>
        </div>

        <div className="bmk__demo">
          <div className="bmk__card" data-step={step}>
            <div className="bmk__steps" role="tablist" aria-label="How it works, on an example" onKeyDown={onKey}>
              {W.steps.map((name, i) => (
                <button key={name} type="button" role="tab" id={`${id}-tab-${i}`} aria-controls={`${id}-panel-${i}`} aria-selected={step === i} tabIndex={step === i ? 0 : -1}
                  className="bmk__step" data-on={step === i ? 'true' : 'false'} ref={(node) => { tabs.current[i] = node; }} onClick={() => go(i)}>
                  {name}
                </button>
              ))}
            </div>

            <div className="bmk__panes">
              <Step id={id} i={0} step={step}>
                <p className="bmk__label"><span>{W.slip.label}</span><span>{W.slip.subject}</span></p>
                <p className="bmk__q">{keep(W.slip.q)}</p>
                <ol className="bmk__given">
                  {W.slip.options.map((option, i) => (
                    <li key={option} data-chosen={i === W.slip.chosen ? 'true' : undefined}>
                      <span className="bmk__letter" aria-hidden="true">{LETTERS[i]}</span>
                      <span>{option}</span>
                      {i === W.slip.chosen ? <span className="bmk__chose"><Icon name="x" className="bmk__chose-icon" />{W.slip.chosenLabel} {LETTERS[i]}</span> : null}
                    </li>
                  ))}
                </ol>
                <div className="bmk__needs">
                  <p className="bmk__needs-line">{W.slip.needs}</p>
                  {photo ? <p className="bmk__photo"><Camera aria-hidden="true" className="bmk__camera" size={18} strokeWidth={2.2} />{W.slip.photo}</p> : null}
                </div>
                <button type="button" className="bmk__next" onClick={() => go(1)}>{W.next[0]}</button>
              </Step>

              <Step id={id} i={1} step={step} ink>
                <p className="bmk__label"><span>{W.read.chapterLabel}</span><span>{W.slip.subject}</span></p>
                <p className="bmk__chapter">{W.read.chapter}</p>
                <dl className="bmk__rows">
                  <div><dt>{W.read.tests[0]}</dt><dd>{keep(W.read.tests[1])}</dd></div>
                  <div>
                    <dt>{keep(W.read.why.label)}</dt>
                    <dd>
                      <span className="bmk__work">
                        {W.read.why.lines.map(([who, working, share]) => (
                          <span className="bmk__work-line" key={who}>
                            <span className="bmk__work-who">{who}</span>
                            <span>{working}</span>
                            <span className="bmk__work-eq" aria-hidden="true">=</span>
                            <span className="bmk__work-share"><span className="sr-only">equals </span>{share}</span>
                          </span>
                        ))}
                      </span>
                    </dd>
                  </div>
                  <div><dt>{W.read.slip[0]}</dt><dd>{keep(W.read.slip[1])}</dd></div>
                </dl>
                <button type="button" className="bmk__next" onClick={() => go(2)}>{W.next[1]}</button>
              </Step>

              <Step id={id} i={2} step={step} data-answered={answered ? 'true' : 'false'}>
                <p className="bmk__label"><span>{W.check.title}</span><span>{W.slip.subject}</span></p>
                <p className="bmk__q">{keep(W.check.q)}</p>
                <div className="bmk__options" role="group" aria-label="Answer options">
                  {W.check.options.map((option, i) => {
                    const state = !answered ? 'idle' : i === W.check.correct ? 'correct' : i === pick ? 'wrong' : 'muted';
                    return (
                      <button key={option} type="button" className="bmk__option" data-state={state} disabled={answered} aria-pressed={pick === i || undefined} onClick={() => setPick(i)}>
                        <span className="bmk__letter" aria-hidden="true">{LETTERS[i]}</span>
                        <span>{option}</span>
                        {answered && i === W.check.correct ? <Icon name="check" className="bmk__mark" /> : null}
                        {answered && i === pick && !right ? <Icon name="x" className="bmk__mark" /> : null}
                      </button>
                    );
                  })}
                </div>
                <div className="bmk__why-box">
                  <p className="bmk__why" aria-live="polite">
                    {answered ? <><strong>{right ? W.check.right : W.check.wrong}</strong> {keep(W.check.why)}</> : W.check.hint}
                  </p>
                  <p className="bmk__why bmk__why--sizer" aria-hidden="true"><strong>{W.check.wrong}</strong> {keep(W.check.why)}</p>
                </div>
                <div className="bmk__close">
                  <p className="bmk__after">{keep(W.check.after)}</p>
                  <button type="button" className="bmk__next" onClick={() => go(3)}>{W.next[2]}</button>
                </div>
              </Step>

              <Step id={id} i={3} step={step}>
                <p className="bmk__label"><span>{W.practice.title}</span><span>{W.slip.subject}</span></p>
                <div className="bmk__set">
                  <span className="bmk__set-n">{W.practice.count}</span>
                  <span className="bmk__set-what">{W.practice.what}</span>
                  <span className="bmk__set-from">{W.practice.from}</span>
                  {/* The set's answer row, one bubble a question, none filled: the brand's own answer sheet. */}
                  <span className="bmk__bubbles" aria-hidden="true">{Array.from({ length: W.practice.count }, (_, i) => <i key={i} />)}</span>
                </div>
                <p className="bmk__set-why">{keep(W.practice.why)}</p>
              </Step>
            </div>
          </div>
          <p className="bmk__honest">{W.honest}</p>
        </div>
      </div>
    </section>
  );
}
