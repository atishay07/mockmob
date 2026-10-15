"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icons';
import { Mascot } from '@/components/brand/Mascot';
import { pipReact } from '@/components/brand/pipEvents';
import { mobiMoment, runMood } from '@/lib/mobiMoments';
import { SAMPLE_SUBJECTS, SAMPLE_SIZE, sampleSubject } from './sampleSubjects.mjs';
import { recordSample } from './sampleRecord.mjs';

// The landing sample, playable with no sign-up. It first asks which subjects the visitor is taking (the four
// launch papers and the General Test as chips, every other practised subject behind "More subjects"), then
// serves five original questions of the chosen subject, so nobody without the commerce combination is stuck.
// The picker is in the server HTML; the questions (sampleBank.mjs) load when the browser is idle or the moment
// a subject is picked. Every answer is written to the sample record the phone dock reads (sampleRecord.mjs).
const KEYS = ['A', 'B', 'C', 'D'];
const FEATURED = SAMPLE_SUBJECTS.filter((s) => s.featured);
const MORE = SAMPLE_SUBJECTS.filter((s) => !s.featured);

let bankLoad = null;
function loadBank() {
  if (!bankLoad) bankLoad = import('./sampleBank.mjs').catch((error) => { bankLoad = null; throw error; });
  return bankLoad;
}

export function DemoDrill() {
  const [subject, setSubject] = useState(null);
  const [set, setSet] = useState([]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [missed, setMissed] = useState([]);
  const rootRef = useRef(null);
  const footRef = useRef(null);
  const optionsRef = useRef(null);
  const resultRef = useRef(null);
  const moreRef = useRef(null);
  // Answering disables the options and "Next" unmounts once used, so keyboard and
  // screen-reader focus would fall back to the page body. Hand it forward instead.
  const focusNext = useRef(null);

  const question = set[index];
  const answered = picked !== null;
  const playing = Boolean(subject && question);

  // Fetch the questions while the visitor reads the hero, so a pick starts at once.
  useEffect(() => {
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => { loadBank().catch(() => {}); }, { timeout: 4000 })
      : window.setTimeout(() => { loadBank().catch(() => {}); }, 2500);
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(idle) : window.clearTimeout(idle));
  }, []);

  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === 'next') footRef.current?.querySelector('.mm-btn')?.focus({ preventScroll: true });
    else if (target === 'options') optionsRef.current?.querySelector('button')?.focus({ preventScroll: true });
    else if (target === 'result') resultRef.current?.focus({ preventScroll: true });
    else if (target === 'pick') rootRef.current?.querySelector('.lp-pick__chip')?.focus({ preventScroll: true });
    else if (target === 'more') moreRef.current?.querySelector('.lp-pick__chip')?.focus({ preventScroll: true });
  }, [answered, index, done, subject, more]);

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

  async function choose(id, event) {
    if (busy) return;
    setBusy(id);
    setFailed(false);
    try {
      const { dealSet } = await loadBank();
      const dealt = dealSet(id).slice(0, SAMPLE_SIZE);
      if (!dealt.length) throw new Error('empty');
      focusNext.current = 'options';
      setSet(dealt);
      setSubject(id);
      setIndex(0);
      setPicked(null);
      setScore(0);
      setMissed([]);
      setDone(false);
      if (event?.detail > 0) pipReact('hero', mobiMoment('choiceWitnessed'));
      // On a phone the card starts low on the first screen: bring the first question up to read.
      const stage = rootRef.current?.closest('.lp-stage');
      if (stage && stage.getBoundingClientRect().top > window.innerHeight * 0.45) {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        stage.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  function pick(optionIndex, event) {
    if (answered || !question) return;
    focusNext.current = 'next';
    setPicked(optionIndex);
    recordSample({ answered: index + 1, done: false, subject });
    if (event.detail > 0) pipReact('hero', mobiMoment(optionIndex === question.correct ? 'rightAnswer' : 'wrongAnswer'));
    if (optionIndex === question.correct) {
      setScore((s) => s + 1);
    } else {
      setMissed((list) => [...list, question.chapter]);
    }
  }

  function next(event) {
    if (index + 1 >= set.length) {
      focusNext.current = 'result';
      setDone(true);
      recordSample({ answered: set.length, done: true, subject });
      // The end of the drill is proportional, like a finished run in the app: all five right celebrates,
      // most right is a cheer, and a third or more missed gets encouragement.
      if (event.detail > 0) pipReact('hero', runMood(score, set.length));
      return;
    }
    focusNext.current = 'options';
    setIndex((i) => i + 1);
    setPicked(null);
  }

  function backToPicker() {
    focusNext.current = 'pick';
    setSubject(null);
    setSet([]);
    setIndex(0);
    setPicked(null);
    setScore(0);
    setMissed([]);
    setDone(false);
  }

  function toggleMore() {
    if (!more) focusNext.current = 'more';
    setMore((open) => !open);
  }

  const chip = (s, i) => (
    <button
      key={s.id}
      type="button"
      className="lp-pick__chip"
      style={{ '--i': i }}
      data-busy={busy === s.id || undefined}
      aria-busy={busy === s.id || undefined}
      onClick={(event) => choose(s.id, event)}
      onPointerEnter={() => { loadBank().catch(() => {}); }}
    >
      {s.name}
    </button>
  );

  if (!playing) {
    return (
      <div className="mm-screen mm-drill mm-drill--pick" ref={rootRef}>
        <div className="mm-screen__bar">
          <span className="mm-screen__live" aria-hidden="true" />
          Step 1 of 2
          <span className="mm-drill__timer mm-measure">{SAMPLE_SIZE} questions</span>
        </div>
        <div className="mm-screen__body">
          <p className="mm-drill__q" id="lp-pick-q">Which subjects are you taking?</p>
          <p className="lp-pick__hint">Start with one. You get five questions in that subject.</p>
          <div className="lp-pick" role="group" aria-labelledby="lp-pick-q">
            {FEATURED.map(chip)}
            <button
              type="button"
              className="lp-pick__chip lp-pick__chip--more"
              style={{ '--i': FEATURED.length }}
              aria-expanded={more}
              aria-controls="lp-pick-more"
              onClick={toggleMore}
            >
              {more ? 'Fewer subjects' : 'More subjects'}
              <span className="lp-pick__plus" aria-hidden="true" />
            </button>
          </div>
          <div className="lp-pick lp-pick--more" id="lp-pick-more" role="group" aria-label="More subjects" hidden={!more} ref={moreRef}>
            {MORE.map(chip)}
          </div>
          {failed ? (
            <p className="lp-pick__error" role="alert">The questions did not load. Check your connection and tap a subject again.</p>
          ) : null}
        </div>
      </div>
    );
  }

  const subjectName = sampleSubject(subject)?.name || 'Your subject';

  if (done) {
    return (
      <div className="mm-screen mm-drill" aria-live="polite" ref={rootRef}>
        <div className="mm-screen__bar">
          <span className="mm-screen__live" aria-hidden="true" />
          {subjectName}: done
          <span className="mm-drill__timer mm-measure">{set.length} / {set.length}</span>
        </div>
        <div className="mm-screen__body mm-drill__result" ref={resultRef} tabIndex={-1} aria-label={`Done. You scored ${score} out of ${set.length} in ${subjectName}.`}>
          <div className="pip-drill-result"><Mascot pose={runMood(score, set.length) === 'encourage' ? 'encouraging' : 'celebrating'} /></div>
          <p className="mm-drill__score mm-measure">
            {score}
            <span>/{set.length}</span>
          </p>
          <p className="mm-drill__verdict">
            {score >= 4
              ? 'Sharp. A full mock is 50 of these in 60 minutes.'
              : 'Good start. Radar shows which chapters to fix first.'}
          </p>

          {missed.length > 0 ? (
            <div className="mm-drill__readout">
              <p className="mm-drill__readout-head">After a full mock, Radar would flag:</p>
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
            <Link href="/signup" className="mm-btn mm-btn--onnight">
              Start free
              <Icon name="arrow" className="mm-btn__icon" aria-hidden="true" />
            </Link>
            <button type="button" className="mm-drill__replay" onClick={backToPicker}>
              Try another subject
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mm-screen mm-drill" ref={rootRef}>
      <div className="mm-screen__bar">
        <span className="mm-screen__live" aria-hidden="true" />
        {subjectName}
        <span className="mm-drill__progress" aria-label={`Question ${index + 1} of ${set.length}`}>
          {set.map((item, i) => (
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
          {question.options.map((option, optionIndex) => {
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
                {index + 1 >= set.length ? 'See your result' : 'Next question'}
                <Icon name="arrow" className="mm-btn__icon" aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <p className="mm-drill__hint lp-pick__row">
                <span>Tap an answer. No sign-up needed.</span>
                <button type="button" className="lp-pick__change" onClick={backToPicker}>Change subject</button>
              </p>
              <div className="mm-drill__ghost" aria-hidden="true">
                <span>The reasoning shows up here</span>
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
