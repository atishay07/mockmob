"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icons';
import { useAuth } from '@/components/AuthProvider';
import { signupPathFor } from '@/lib/auth-redirect';
import { BrandStamp } from './BrandStamp';
import { Reveal } from './Reveal';
import { BRING_MISTAKE as W, BRING_MISTAKE_PATH } from './bringMistakeCopy.mjs';
import './bring-mistake.css';

// "Bring a mistake" on the home page (16 Nov 2026). The feature is live in Ask Mobi (src/components/ai/BringMistake.jsx) and
// the landing did not show it. One object from the desk: a paper slip (the question pasted from another test, the option the
// student chose marked wrong), torn onto an ink sheet (Mobi's read, in the app's own three parts), then one of the two fresh
// checks, answerable here. Nothing is sent anywhere: the example and its key are in bringMistakeCopy.mjs (checked by its
// test), and the block says the example is ours. One volt key: sign up and paste your own (a signed-in student goes to Ask
// Mobi). The check's states are the sample card's: picked right is volt, picked wrong is outlined with the right one shown.

const LETTERS = ['A', 'B', 'C', 'D'];

export default function BringMistakeBlock() {
  const { isAuthenticated } = useAuth();
  const [pick, setPick] = useState(null);
  const answered = pick !== null;
  const right = pick === W.check.correct;

  return (
    <section className="lp-sec bmk" id="bring-a-mistake" aria-labelledby="bmk-title">
      <div className="mm-wrap bmk__grid">
        <Reveal className="lp-head lp-head--left bmk__head">
          <BrandStamp {...W.stamp} />
          <h2 className="lp-h2" id="bmk-title">{W.h2}</h2>
          <p className="lp-sub">{W.sub}</p>
        </Reveal>

        <div className="bmk__page">
          {/* The slip: what the student pasted. */}
          <div className="bmk__slip">
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
          </div>

          {/* Mobi's read, on ink. */}
          <div className="bmk__read">
            <p className="bmk__read-title">{W.read.title}</p>
            <dl className="bmk__rows">
              {W.read.rows.map(([label, line]) => (
                <div key={label}><dt>{label}</dt><dd>{line}</dd></div>
              ))}
            </dl>
          </div>

          {/* One fresh check, answerable here. */}
          <div className="bmk__check" data-answered={answered ? 'true' : 'false'}>
            <p className="bmk__label"><span>{W.check.title}</span></p>
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
              {answered ? <><strong>{right ? W.check.right : W.check.wrong}</strong> {W.check.why}</> : ' '}
            </p>
          </div>
        </div>

        <div className="bmk__foot">
          <ul className="bmk__chips">{W.chips.map((chip) => <li key={chip}>{chip}</li>)}</ul>
          <Link href={isAuthenticated ? BRING_MISTAKE_PATH : signupPathFor(BRING_MISTAKE_PATH)} className="mm-btn mm-btn--primary bmk__key">
            {isAuthenticated ? W.keyStudent : W.keyGuest}
          </Link>
          <p className="bmk__honest">{W.honest}</p>
        </div>
      </div>
    </section>
  );
}
