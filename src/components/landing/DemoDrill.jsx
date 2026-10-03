"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icons';
import { Mascot } from '@/components/brand/Mascot';
import { pipReact } from '@/components/brand/pipEvents';

// Five original sample questions, playable with no signup. Not authenticated PYQs. This is the
// onboarding: the drill opens already on question 1 so the first thing a
// visitor can do on a phone is answer something, not read about answering.
const DRILL = [
  {
    subject: 'English',
    q: 'Choose the option nearest in meaning to CANDID:',
    options: ['Hidden', 'Frank', 'Careful', 'Sweet'],
    correct: 1,
    why: 'Candid means frank or honest. Frank is the closest synonym among these options.',
    chapter: 'Vocabulary · Synonyms',
  },
  {
    subject: 'Accountancy',
    q: 'Assets are ₹80,000 and liabilities are ₹30,000. What is the owner’s equity?',
    options: ['₹30,000', '₹50,000', '₹80,000', '₹1,10,000'],
    correct: 1,
    why: 'Equity = assets − liabilities = ₹80,000 − ₹30,000 = ₹50,000.',
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
    why: 'Commercial banks accept public deposits. The RBI does not.',
    chapter: 'Money and Banking',
  },
  {
    subject: 'Accountancy',
    q: 'Goodwill brought in by an incoming partner is shared by old partners in:',
    options: ['New ratio', 'Old ratio', 'Sacrificing ratio', 'Equal ratio'],
    correct: 2,
    why: 'Old partners are compensated for their sacrifice, so it is split in the sacrificing ratio.',
    chapter: 'Partnership · Admission of a Partner',
  },
  {
    subject: 'Business Studies',
    q: 'Comparing actual performance with a planned standard is part of which management function?',
    options: ['Staffing', 'Controlling', 'Organising', 'Directing'],
    correct: 1,
    why: 'Controlling compares actual performance with standards so deviations can be identified and corrected.',
    chapter: 'Controlling',
  },
];

const KEYS = ['A', 'B', 'C', 'D'];

export function DemoDrill() {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [missed, setMissed] = useState([]);
  const footRef = useRef(null);
  const optionsRef = useRef(null);
  const resultRef = useRef(null);
  // Answering disables the options and "Next" unmounts once used, so keyboard and
  // screen-reader focus would fall back to the page body. Hand it forward instead.
  const focusNext = useRef(null);

  const question = DRILL[index];
  const answered = picked !== null;

  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === 'next') footRef.current?.querySelector('.mm-btn')?.focus({ preventScroll: true });
    else if (target === 'options') optionsRef.current?.querySelector('button')?.focus({ preventScroll: true });
    else if (target === 'result') resultRef.current?.focus({ preventScroll: true });
  }, [answered, index, done]);

  // Answering grows the panel by the reason plus the forward key, which on a
  // 360x800 phone pushes that key under the sticky action bar. Bring it back
  // into reach once the reveal sequence has played.
  useEffect(() => {
    if (!answered) return undefined;
    const node = footRef.current;
    if (!node) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = window.setTimeout(() => {
      node.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    }, 320);
    return () => window.clearTimeout(id);
  }, [answered, index]);

  function pick(optionIndex, event) {
    if (answered) return;
    focusNext.current = 'next';
    setPicked(optionIndex);
    if (event.detail > 0) pipReact('hero', optionIndex === question.correct ? 'celebrate' : 'encourage');
    if (optionIndex === question.correct) {
      setScore((s) => s + 1);
    } else {
      setMissed((list) => [...list, question.chapter]);
    }
  }

  function next(event) {
    if (index + 1 >= DRILL.length) {
      focusNext.current = 'result';
      setDone(true);
      if (event.detail > 0) pipReact('hero', 'celebrate');
      return;
    }
    focusNext.current = 'options';
    setIndex((i) => i + 1);
    setPicked(null);
  }

  function restart() {
    setIndex(0);
    setPicked(null);
    setScore(0);
    setMissed([]);
    setDone(false);
  }

  if (done) {
    return (
      <div className="mm-screen mm-drill" aria-live="polite">
        <div className="mm-screen__bar">
          <span className="mm-screen__live" aria-hidden="true" />
          Drill complete
          <span className="mm-drill__timer mm-measure">5 / 5</span>
        </div>
        <div className="mm-screen__body mm-drill__result" ref={resultRef} tabIndex={-1} aria-label={`Drill complete. You scored ${score} out of 5.`}>
          <div className="pip-drill-result"><Mascot pose="celebrating" /></div>
          <p className="mm-drill__score mm-measure">
            {score}
            <span>/5</span>
          </p>
          <p className="mm-drill__verdict">
            {score >= 4
              ? 'Sharp. A full mock is 50 of these in 60 minutes.'
              : 'That is the point — now you know where to start.'}
          </p>

          {missed.length > 0 ? (
            <div className="mm-drill__readout">
              <p className="mm-drill__readout-head">In a real mock, Radar would flag:</p>
              <ul>
                {missed.map((chapter, i) => (
                  <li key={`${chapter}-${i}`}>
                    <Icon name="target" style={{ width: '15px', height: '15px' }} aria-hidden="true" />
                    {chapter}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mm-drill__readout">
              <p className="mm-drill__readout-head">Nothing to flag from these five.</p>
              <p className="mm-drill__readout-note">
                A full mock runs 50 questions so it can find the chapters five cannot.
              </p>
            </div>
          )}

          <div className="mm-drill__actions">
            <Link href="/signup" className="mm-btn mm-btn--onnight">
              Open the practice Arena
              <Icon name="arrow" className="mm-btn__icon" aria-hidden="true" />
            </Link>
            <button type="button" className="mm-drill__replay" onClick={restart}>
              Replay the drill
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mm-screen mm-drill">
      <div className="mm-screen__bar">
        <span className="mm-screen__live" aria-hidden="true" />
        {question.subject}
        <span className="mm-drill__progress" aria-label={`Question ${index + 1} of ${DRILL.length}`}>
          {DRILL.map((item, i) => (
            <span
              key={item.q}
              className="mm-drill__pip"
              data-state={i < index ? 'past' : i === index ? 'now' : 'next'}
            />
          ))}
        </span>
      </div>

      <div className="mm-screen__body">
        <p className="mm-drill__q">{question.q}</p>

        <div className="mm-drill__options" role="group" aria-label="Answer options" ref={optionsRef}>
          {DRILL[index].options.map((option, optionIndex) => {
            const isCorrect = optionIndex === question.correct;
            const isPicked = picked === optionIndex;
            let state = 'idle';
            if (answered && isCorrect) state = 'correct';
            else if (isPicked) state = 'wrong';
            else if (answered) state = 'muted';

            return (
              <button
                key={option}
                type="button"
                className="mm-drill__option"
                data-state={state}
                onClick={(event) => pick(optionIndex, event)}
                disabled={answered}
              >
                <span className="mm-drill__key" aria-hidden="true">
                  {KEYS[optionIndex]}
                </span>
                <span className="mm-drill__label">{option}</span>
                {answered && isCorrect ? (
                  <Icon name="check" className="mm-drill__verdict-icon" aria-hidden="true" />
                ) : null}
                {answered && isPicked && !isCorrect ? (
                  <Icon name="x" className="mm-drill__verdict-icon" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mm-drill__foot" aria-live="polite" ref={footRef}>
          {answered ? (
            <>
              <p className="mm-drill__why pip-drill-reaction">
                {picked === question.correct && <Mascot pose="celebrating" />}
                <span>
                <strong data-ok={picked === question.correct ? 'true' : 'false'}>
                  {picked === question.correct ? 'Correct.' : 'Not quite.'}
                </strong>{' '}
                {question.why}
                </span>
              </p>
              <button type="button" className="mm-btn mm-btn--onnight" onClick={next}>
                {index + 1 >= DRILL.length ? 'See your readout' : 'Next question'}
                <Icon name="arrow" className="mm-btn__icon" aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <p className="mm-drill__hint">
                Tap an answer. Five sample questions, no signup.
              </p>
              <div className="mm-drill__ghost" aria-hidden="true">
                <span>Why it is right appears here</span>
                <i />
                <i />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
