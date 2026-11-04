"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icons';
import { pipReact } from '@/components/brand/pipEvents';
import { mobiMoment, runMood } from '@/lib/mobiMoments';
import { markDemoAnswered, sendDemoState } from './demoSignal.mjs';
import { deskStateAfter } from './heroTaps.mjs';

// Five original sample questions, playable with no signup. Not authenticated PYQs. This is the
// onboarding: the drill opens already on question 1 so the first thing a
// visitor can do on a phone is answer something, not read about answering.
//
// On the home page it is the card on Mobi's desk (1104 "Desk Light"): it follows the page's theme (no forced night
// screen), its head is the subject and "1 of 5" as two plain spans (no middle dot), the stem is set in Literata (the
// printed-paper voice) and the options carry plain letter chips. Mobi beside it answers each pick: every answer sends
// the sample's state (demoSignal.mjs sendDemoState), which is the only thing that changes his bubble and fills one
// bubble of Night's painted answer sheet. The card's own small Mobi retired (one Mobi in view, one finish). `note` is
// the line under the options (the no-signup note and the other-subjects link, L-015). The card's root takes focus
// (tabIndex -1) when a "Try 5 questions first" link brings it on screen (DemoJump.jsx), so the next Tab reaches answer A.
const DRILL = [
  {
    subject: 'English',
    q: 'Choose the option nearest in meaning to CANDID:',
    options: ['Hidden', 'Frank', 'Careful', 'Sweet'],
    correct: 1,
    why: 'Candid means frank or honest. Frank is the closest synonym among these options.',
    chapter: 'Vocabulary: synonyms',
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
    chapter: 'Money and banking',
  },
  {
    subject: 'Accountancy',
    q: 'Goodwill brought in by an incoming partner is shared by old partners in:',
    options: ['New ratio', 'Old ratio', 'Sacrificing ratio', 'Equal ratio'],
    correct: 2,
    why: 'Old partners are compensated for their sacrifice, so it is split in the sacrificing ratio.',
    chapter: 'Partnership: admission of a partner',
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

export function DemoDrill({ note = null }) {
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
  const answeredCount = index + (answered ? 1 : 0);

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
    // Instant, never a programmatic glide (LK47): only when the key is out of reach, and only by what is needed.
    // 'instant', not 'auto': the page's html has scroll-behavior: smooth, which 'auto' inherits (a glide, LK89).
    const id = window.setTimeout(() => {
      node.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }, 320);
    return () => window.clearTimeout(id);
  }, [answered, index]);

  function pick(optionIndex, event) {
    if (answered) return;
    focusNext.current = 'next';
    setPicked(optionIndex);
    markDemoAnswered();
    sendDemoState(deskStateAfter({ index, correct: optionIndex === question.correct, total: DRILL.length }), index + 1);
    if (event.detail > 0) pipReact('hero', mobiMoment(optionIndex === question.correct ? 'rightAnswer' : 'wrongAnswer'));
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
      // The end of the drill is proportional, like a finished run in the app: all five right celebrates,
      // most right is a cheer, and a third or more missed gets encouragement.
      if (event.detail > 0) pipReact('hero', runMood(score, DRILL.length));
      return;
    }
    focusNext.current = 'options';
    setIndex((i) => i + 1);
    setPicked(null);
  }

  function restart() {
    sendDemoState('load', 0);
    setIndex(0);
    setPicked(null);
    setScore(0);
    setMissed([]);
    setDone(false);
  }

  if (done) {
    return (
      <div className="lp-card mm-drill" aria-live="polite" tabIndex={-1} role="group" aria-label="Five sample questions">
        <div className="lp-card__head">
          <span className="lp-card__sub"><b>Drill complete</b><span>5 of 5</span></span>
        </div>
        <div className="lp-card__body mm-drill__result" ref={resultRef} tabIndex={-1} aria-label={`Drill complete. You scored ${score} out of 5.`}>
          <p className="mm-drill__score">
            {score}
            <span>/5</span>
          </p>
          <p className="mm-drill__verdict">
            {score >= 4
              ? 'Sharp. Ready for 50 of these in 60 minutes?'
              : 'Good. Now you know exactly where to start.'}
          </p>

          {missed.length > 0 ? (
            <div className="mm-drill__readout">
              <p className="mm-drill__readout-head">After a full mock, chapter review would flag:</p>
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
                A full mock runs 50 questions, enough to find what five cannot.
              </p>
            </div>
          )}

          <div className="mm-drill__actions">
            <Link href="/signup" className="mm-btn mm-btn--primary">
              Start practising free
            </Link>
            <button type="button" className="mm-drill__replay" onClick={restart}>
              Try the five again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lp-card mm-drill" data-answered={answeredCount} tabIndex={-1} role="group" aria-label="Five sample questions">
      <div className="lp-card__head">
        <span className="lp-card__sub"><b>{question.subject}</b><span>{index + 1} of {DRILL.length}</span></span>
        <span className="mm-drill__progress" aria-hidden="true">
          {DRILL.map((item, i) => (
            <span
              key={item.q}
              className="mm-drill__pip"
              data-state={i < index ? 'past' : i === index ? 'now' : 'next'}
            />
          ))}
        </span>
      </div>

      <div className="lp-card__body">
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

        {/* The reasoning is not drawn until an answer is chosen (LK30, LK31: no placeholder lines); then it opens,
            0fr to 1fr over 240 ms (landing.css, .mm-drill__reveal). */}
        <div className="mm-drill__reveal" data-open={answered ? 'true' : 'false'}>
        <div className="mm-drill__foot" aria-live="polite" ref={footRef}>
          {answered ? (
            <>
              {/* Mobi on the desk answers the pick (HeroMobi, from the sample's state); the card has no Mobi of its own. */}
              <p className="mm-drill__why pip-drill-reaction" data-verdict={picked === question.correct ? 'right' : 'wrong'}>
                <span>
                <strong data-ok={picked === question.correct ? 'true' : 'false'}>
                  {picked === question.correct ? 'Correct.' : 'Not quite.'}
                </strong>{' '}
                {question.why}
                </span>
              </p>
              <button type="button" className="mm-btn mm-btn--primary" onClick={next}>
                {index + 1 >= DRILL.length ? 'See your readout' : 'Next question'}
              </button>
            </>
          ) : null}
        </div>
        </div>
        {note ? <p className="lp-card__note">{note}</p> : null}
      </div>
    </div>
  );
}
