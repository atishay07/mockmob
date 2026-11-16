"use client";

import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icons';
import { useAuth } from '@/components/AuthProvider';
import { signupPathFor } from '@/lib/auth-redirect';
import { BrandStamp } from './BrandStamp';
import { Reveal } from './Reveal';
import { BRING_MISTAKE as W, BRING_MISTAKE_PATH, bringMistakeWords } from './bringMistakeCopy.mjs';
import './bring-mistake.css';

// "Bring a mistake" on the home page. The feature is live in Ask Mobi (src/components/ai/BringMistake.jsx).
// Second build, 16 Nov 2026 evening. The owner on the first one, seen on his phone and his desktop: "this section is broken
// both on desktop and mobile as the overall placement is very weird". It stood about 1,700 px tall on a phone (the slip, the
// read and the check stacked, then chips, a key and a note) and on desktop a tall page hung beside a head whose lines did not
// share an edge. Now it is one card the reader walks through, in the three steps the feature really has:
//   1  Your question   the question as brought, the option chosen marked
//   2  Mobi's read     what it tests, why the answer is what it is, the likely slip (the app's own three parts), on ink
//   3  Check           one fresh question on the same idea, answerable here
// The steps are tabs: the reader moves, never a timer. The card keeps one height, so nothing under it shifts. Nothing is sent
// anywhere: the example and its key are in bringMistakeCopy.mjs (checked by its test), and the block says the example is
// ours. One volt key: sign up and bring your own (a signed-in student goes to Ask Mobi).
// `photo` is the app's own switch (data/mistake_photo.mjs): the words promise a photo only while Mobi reads photos.

const LETTERS = ['A', 'B', 'C', 'D'];

export default function BringMistakeBlock({ photo = false, photoCredits = 2 }) {
  const { isAuthenticated } = useAuth();
  const id = useId();
  const tabs = useRef([]);
  const [step, setStep] = useState(0);
  const [pick, setPick] = useState(null);
  const answered = pick !== null;
  const right = pick === W.check.correct;
  const words = bringMistakeWords({ photo, photoCredits });

  const go = (n) => setStep(Math.max(0, Math.min(W.steps.length - 1, n)));
  const onKey = (event) => {
    const move = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!move) return;
    event.preventDefault();
    const next = (step + move + W.steps.length) % W.steps.length;
    go(next);
    tabs.current[next]?.focus();
  };

  return (
    <section className="lp-sec bmk" id="bring-a-mistake" aria-labelledby="bmk-title">
      <div className="mm-wrap bmk__grid">
        <div className="bmk__say">
          <Reveal className="bmk__head">
            <BrandStamp {...W.stamp} />
            <h2 className="lp-h2" id="bmk-title">{W.h2}</h2>
            <p className="lp-sub">{words.sub}</p>
          </Reveal>
          <div className="bmk__foot">
            <Link href={isAuthenticated ? BRING_MISTAKE_PATH : signupPathFor(BRING_MISTAKE_PATH)} className="mm-btn mm-btn--primary bmk__key">
              {isAuthenticated ? W.keyStudent : W.keyGuest}
            </Link>
            <p className="bmk__price">{words.price}</p>
          </div>
        </div>

        <div className="bmk__demo">
          <div className="bmk__steps" role="tablist" aria-label="How it works, on an example" onKeyDown={onKey}>
            {W.steps.map((name, i) => (
              <button key={name} type="button" role="tab" id={`${id}-tab-${i}`} aria-controls={`${id}-panel`} aria-selected={step === i} tabIndex={step === i ? 0 : -1}
                className="bmk__step" data-on={step === i ? 'true' : 'false'} data-done={i < step ? 'true' : undefined} ref={(node) => { tabs.current[i] = node; }} onClick={() => go(i)}>
                <span className="bmk__n" aria-hidden="true">{i + 1}</span>
                <span>{name}</span>
              </button>
            ))}
          </div>

          <div className="bmk__card" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${step}`} data-step={step}>
            {step === 0 ? (
              <div className="bmk__pane" key="slip">
                <p className="bmk__label"><span>{W.slip.label}</span><span>{W.slip.subject}</span></p>
                <p className="bmk__q">{W.slip.q}</p>
                <ol className="bmk__given">
                  {W.slip.options.map((option, i) => (
                    <li key={option} data-chosen={i === W.slip.chosen ? 'true' : undefined}>
                      <span className="bmk__letter" aria-hidden="true">{LETTERS[i]}</span>
                      <span>{option}</span>
                      {i === W.slip.chosen ? <span className="bmk__chose"><Icon name="x" className="bmk__chose-icon" />{W.slip.chosenLabel} {LETTERS[i]}</span> : null}
                    </li>
                  ))}
                </ol>
                <button type="button" className="bmk__next" onClick={() => go(1)}>{W.next[0]}</button>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="bmk__pane bmk__pane--ink" key="read">
                <dl className="bmk__rows">
                  {W.read.rows.map(([label, line]) => (
                    <div key={label}><dt>{label}</dt><dd>{line}</dd></div>
                  ))}
                </dl>
                <button type="button" className="bmk__next" onClick={() => go(2)}>{W.next[1]}</button>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="bmk__pane" key="check" data-answered={answered ? 'true' : 'false'}>
                <p className="bmk__label"><span>{W.check.title}</span><span>{W.slip.subject}</span></p>
                <p className="bmk__q">{W.check.q}</p>
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
                <p className="bmk__why" aria-live="polite">
                  {answered ? <><strong>{right ? W.check.right : W.check.wrong}</strong> {W.check.why}</> : W.check.hint}
                </p>
                <p className="bmk__after">{W.check.after}</p>
              </div>
            ) : null}
          </div>
          <p className="bmk__honest">{W.honest}</p>
        </div>
      </div>
    </section>
  );
}
