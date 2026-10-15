"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icons';
import { mobiAct } from '@/components/brand/pipEvents';
import { mobiMoment, runMood } from '@/lib/mobiMoments';
import { buildSampleHandoff, writeSampleHandoff } from '@/../data/sample_handoff.mjs';
import { listWords } from './words';

// The landing's 5 sample questions, playable with no sign-up (web IA plan 3, steps 1 and 2). The
// sample opens on question 1, so the first thing a visitor can do is answer. When the fifth answer
// is in, the result shows in place and the answers are stored for the new account
// (data/sample_handoff.mjs); onboarding posts them once to /api/me/sample-import.
//
// SERVER CONTRACT: src/lib/server/sampleImport.js scores these by position (q1..q5) and option
// letter. Keep the order, the options and `correct` exactly; change them only together with
// SAMPLE_QUESTIONS there and a new SAMPLE_VERSION. Chapter names and reasons are copy only.
export const DRILL = [
  {
    subject: 'English',
    q: 'Choose the option nearest in meaning to CANDID:',
    options: ['Hidden', 'Frank', 'Careful', 'Sweet'],
    correct: 1,
    why: 'Candid means frank or honest. Frank is the closest synonym among these options.',
    chapter: 'Synonyms',
  },
  {
    subject: 'Accountancy',
    q: 'Assets are ₹80,000 and liabilities are ₹30,000. What is the owner’s equity?',
    options: ['₹30,000', '₹50,000', '₹80,000', '₹1,10,000'],
    correct: 1,
    why: 'Equity is assets minus liabilities: ₹80,000 minus ₹30,000 is ₹50,000.',
    chapter: 'Accounting equation',
  },
  {
    subject: 'Economics',
    q: 'Which of these is NOT a function of the Reserve Bank of India?',
    options: [
      'Banker to the government',
      'Issuing currency',
      'Accepting public deposits',
      'Controlling credit',
    ],
    correct: 2,
    why: 'Commercial banks accept deposits from the public. The RBI does not.',
    chapter: 'Money and banking',
  },
  {
    subject: 'Accountancy',
    q: 'Goodwill brought in by an incoming partner is shared by old partners in:',
    options: ['New ratio', 'Old ratio', 'Sacrificing ratio', 'Equal ratio'],
    correct: 2,
    why: 'The old partners are paid for what they give up, so it is split in the sacrificing ratio.',
    chapter: 'Partnership',
  },
  {
    subject: 'Business Studies',
    q: 'Comparing actual performance with a planned standard is part of which management function?',
    options: ['Staffing', 'Controlling', 'Organising', 'Directing'],
    correct: 1,
    why: 'Controlling compares actual performance with standards so gaps can be found and corrected.',
    chapter: 'Controlling',
  },
];

const KEYS = ['A', 'B', 'C', 'D'];
export const SAMPLE_SIGNUP_HREF = '/signup?from=sample';
// The sample spans several subjects; the import stores it under one name.
const SAMPLE_SUBJECT = 'CUET sample';

/** The result line: "You lost marks in Partnership and Money and banking." */
export function lostLine(picks) {
  const missed = [...new Set(DRILL.filter((item, i) => picks[i] !== item.correct).map((item) => item.chapter))];
  if (!missed.length) return 'All 5 right. A full mock asks 50 like these in 60 minutes.';
  return `You lost marks in ${listWords(missed)}.`;
}

function storeHandoff(picks) {
  const answers = picks.map((option, i) => ({ sampleQuestionId: `q${i + 1}`, optionKey: KEYS[option] }));
  const handoff = buildSampleHandoff({ answers, subject: SAMPLE_SUBJECT });
  try {
    return writeSampleHandoff(window.sessionStorage, handoff);
  } catch {
    return false;
  }
}

export function DemoDrill() {
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState([]);
  const [done, setDone] = useState(false);
  const [saved, setSaved] = useState(false);
  const footRef = useRef(null);
  const optionsRef = useRef(null);
  const resultRef = useRef(null);
  // Answering disables the options and "Next" unmounts once used, so keyboard and screen-reader
  // focus would fall back to the page body. Hand it forward instead.
  const focusNext = useRef(null);

  const question = DRILL[index];
  const picked = picks[index] ?? null;
  const answered = picked !== null;
  const score = picks.filter((option, i) => option === DRILL[i].correct).length;

  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === 'next') footRef.current?.querySelector('.mm-btn')?.focus({ preventScroll: true });
    else if (target === 'options') optionsRef.current?.querySelector('button')?.focus({ preventScroll: true });
    else if (target === 'result') resultRef.current?.focus({ preventScroll: true });
  }, [answered, index, done]);

  // Answering grows the panel by the reason and the forward key, which on a 360 px phone can push
  // that key under the sticky dock. Bring it back into reach once the reveal has played.
  useEffect(() => {
    if (!answered || done) return undefined;
    const node = footRef.current;
    if (!node) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = window.setTimeout(() => node.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }), 260);
    return () => window.clearTimeout(id);
  }, [answered, index, done]);

  function pick(optionIndex) {
    if (answered) return;
    focusNext.current = 'next';
    setPicks((list) => { const next = [...list]; next[index] = optionIndex; return next; });
    mobiAct('sample', mobiMoment(optionIndex === question.correct ? 'rightAnswer' : 'wrongAnswer'));
  }

  function next() {
    if (index + 1 >= DRILL.length) {
      focusNext.current = 'result';
      setSaved(storeHandoff(picks));
      setDone(true);
      // The ending is proportional, as in the app: all five right celebrates, most right cheers,
      // and a third or more missed gets encouragement.
      mobiAct('sample', runMood(score, DRILL.length));
      return;
    }
    focusNext.current = 'options';
    setIndex((i) => i + 1);
  }

  function restart() {
    focusNext.current = 'options';
    setIndex(0);
    setPicks([]);
    setDone(false);
    setSaved(false);
    mobiAct('sample', 'nod');
  }

  if (done) {
    return (
      <div className="mm-screen mm-drill" data-done="true">
        <div className="mm-screen__bar">
          <span className="mm-screen__live" aria-hidden="true" />
          Your sample result
        </div>
        <div className="mm-screen__body mm-drill__result" ref={resultRef} tabIndex={-1} aria-live="polite">
          <p className="mm-drill__score mm-measure"><b>{score} of 5</b></p>
          <p className="mm-drill__verdict">{lostLine(picks)}</p>
          <ol className="mm-drill__answers" aria-label="Answer by answer">
            {DRILL.map((item, i) => {
              const right = picks[i] === item.correct;
              return (
                <li key={item.q} data-right={right ? 'true' : 'false'}>
                  <Icon name={right ? 'check' : 'x'} className="mm-drill__mark" aria-hidden="true" />
                  <span>
                    <b>{item.chapter}</b>
                    <span className="mm-drill__sub">{right ? `Right. ${item.subject}.` : `Wrong. ${item.why}`}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mm-drill__actions">
            <Link href={SAMPLE_SIGNUP_HREF} className="mm-btn mm-btn--onnight">Save this and start free</Link>
            <button type="button" className="mm-drill__replay" onClick={restart}>Try again</button>
          </div>
          {saved ? <p className="mm-drill__saved">Your 5 answers carry into your new account.</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mm-screen mm-drill">
      <div className="mm-screen__bar">
        <span className="mm-screen__live" aria-hidden="true" />
        {question.subject}
        <span className="mm-drill__progress" role="img" aria-label={`Question ${index + 1} of ${DRILL.length}`}>
          {DRILL.map((item, i) => (
            <span key={item.q} className="mm-drill__pip" data-state={i < index ? 'past' : i === index ? 'now' : 'next'} />
          ))}
        </span>
      </div>

      <div className="mm-screen__body">
        <p className="mm-drill__q">{question.q}</p>

        <div className="mm-drill__options" role="group" aria-label="Answer options" ref={optionsRef}>
          {question.options.map((option, optionIndex) => {
            const isCorrect = optionIndex === question.correct;
            const isPicked = picked === optionIndex;
            let state = 'idle';
            if (answered && isCorrect) state = 'correct';
            else if (isPicked) state = 'wrong';
            else if (answered) state = 'muted';
            return (
              <button key={option} type="button" className="mm-drill__option" data-state={state} onClick={() => pick(optionIndex)} disabled={answered}>
                <span className="mm-drill__key" aria-hidden="true">{KEYS[optionIndex]}</span>
                <span className="mm-drill__label">{option}</span>
                {answered && isCorrect ? <Icon name="check" className="mm-drill__verdict-icon" aria-hidden="true" /> : null}
                {answered && isPicked && !isCorrect ? <Icon name="x" className="mm-drill__verdict-icon" aria-hidden="true" /> : null}
                {answered && (isCorrect || isPicked) ? <span className="lp-sr">{isCorrect ? ' (right answer)' : ' (your answer)'}</span> : null}
              </button>
            );
          })}
        </div>

        <div className="mm-drill__foot" aria-live="polite" ref={footRef}>
          {answered ? (
            <>
              <p className="mm-drill__why">
                <strong data-ok={picked === question.correct ? 'true' : 'false'}>{picked === question.correct ? 'Correct.' : 'Not quite.'}</strong>{' '}
                {question.why}
              </p>
              <button type="button" className="mm-btn mm-btn--onnight" onClick={next}>
                {index + 1 >= DRILL.length ? 'See your result' : 'Next question'}
              </button>
            </>
          ) : (
            <p className="mm-drill__hint">Tap an answer. Why it is right shows here.</p>
          )}
        </div>
      </div>
    </div>
  );
}
