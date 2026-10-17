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
// The finished screen lists each missed chapter once: 'Partnership: admission of a partner' and 'Partnership:
// new profit-sharing ratio' are one chapter with two topics, shown as the chapter with its topics in grey.
function groupMissed(list) {
  const groups = new Map();
  for (const label of list) {
    const cut = label.indexOf(': ');
    const chapter = cut > 0 ? label.slice(0, cut) : label;
    const topic = cut > 0 ? label.slice(cut + 2) : '';
    if (!groups.has(chapter)) groups.set(chapter, []);
    const topicsOf = groups.get(chapter);
    topicsOf.misses = (topicsOf.misses || 0) + 1;
    if (topic && !topicsOf.includes(topic)) topicsOf.push(topic);
  }
  return [...groups].map(([chapter, topics]) => ({
    chapter,
    misses: topics.misses,
    topics: topics.length ? `${topics[0][0].toUpperCase()}${topics[0].slice(1)}${topics.length > 1 ? `, ${topics.slice(1).join(', ')}` : ''}` : '',
  }));
}

// The one next move after five answers: the chapter with the most misses, ties going to the one missed first (the
// groups keep question order). A Quick practice is 10 questions and uses 10 practice credits; Free starts with 100.
function nextChapter(groups) {
  return groups.reduce((best, g) => (!best || g.misses > best.misses ? g : best), null)?.chapter ?? null;
}

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

  // Once a subject is picked the card holds the hero's next step: the stage says so (data-drill: playing or done),
  // and the hero's own Start free and the top bar's key step back to quiet keys (hero-depth.css, HeroDockGate).
  useEffect(() => {
    const stage = rootRef.current?.closest('.lp-stage');
    if (!stage) return undefined;
    if (playing) stage.dataset.drill = done ? 'done' : 'playing'; else delete stage.dataset.drill;
    return undefined;
  }, [playing, done]);

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

  // Mobi stands on the card's top edge at desktop. Once that edge scrolls up under the translucent bar, his feet
  // would peek out below it: he steps away (150 ms fade, hero-v3.css) while any of him is under the bar.
  useEffect(() => {
    const seat = rootRef.current?.closest('.lp-stage__card')?.querySelector(':scope > .pip-seat');
    const bar = document.querySelector('.mm-nav');
    if (!seat || !bar || typeof IntersectionObserver === 'undefined') return undefined;
    const top = Math.round(bar.getBoundingClientRect().height) + 4;
    const io = new IntersectionObserver(([entry]) => {
      const under = entry.boundingClientRect.top < top && entry.boundingClientRect.bottom > 0;
      if (under) seat.dataset.under = 'true'; else delete seat.dataset.under;
    }, { rootMargin: `-${top}px 0px 0px 0px`, threshold: [0, 0.25, 0.5, 0.75, 0.99, 1] });
    io.observe(seat);
    return () => { io.disconnect(); delete seat.dataset.under; };
  }, []);

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

  // The result replaces the fifth question, which the reader had scrolled down to answer, so the score would
  // render above the window, under the bar. Bring the card's top to just under the bar (16px clear) so the
  // score is the first thing seen: a 250ms ease-out glide, instant under reduced motion.
  useEffect(() => {
    if (!done) return undefined;
    const card = rootRef.current?.closest('.lp-stage__card') || rootRef.current;
    if (!card) return undefined;
    let glide = 0;
    const frame = window.requestAnimationFrame(() => {
      const bar = document.querySelector('.mm-nav');
      const clear = (bar ? Math.round(bar.getBoundingClientRect().bottom) : 62) + 16;
      const top = card.getBoundingClientRect().top;
      if (top >= clear && top <= window.innerHeight * 0.4) return;
      const target = Math.max(0, window.scrollY + top - clear);
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) { window.scrollTo({ top: target, behavior: 'instant' }); return; }
      const from = window.scrollY;
      const t0 = performance.now();
      const ease = (t) => 1 - (1 - t) ** 3;
      const step = (now) => {
        const t = Math.min(1, (now - t0) / 250);
        window.scrollTo({ top: from + (target - from) * ease(t), behavior: 'instant' });
        if (t < 1) glide = window.requestAnimationFrame(step);
      };
      glide = window.requestAnimationFrame(step);
    });
    return () => { window.cancelAnimationFrame(frame); window.cancelAnimationFrame(glide); };
  }, [done]);

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
      recordSample({ answered: set.length, done: true, subject, focus: nextChapter(groupMissed(missed)) });
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
          No sign-up needed
          <span className="mm-drill__timer">{SAMPLE_SIZE} questions</span>
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
    const groups = groupMissed(missed);
    const focus = nextChapter(groups);
    return (
      <div className="mm-screen mm-drill" aria-live="polite" ref={rootRef}>
        <div className="mm-screen__bar">
          {subjectName}: done
          <span className="mm-drill__timer">{set.length} / {set.length}</span>
        </div>
        <div className="mm-screen__body mm-drill__result" ref={resultRef} tabIndex={-1} aria-label={`Done. You scored ${score} out of ${set.length} in ${subjectName}.`}>
          <div className="pip-drill-result"><Mascot pose={runMood(score, set.length) === 'encourage' ? 'encouraging' : 'celebrating'} /></div>
          <p className="mm-drill__score">
            {score}
            <span>/{set.length}</span>
          </p>
          <p className="mm-drill__verdict">
            {score >= 4
              ? 'A full mock is 50 of these in 60 minutes.'
              : score >= 2
                ? `${score} of ${set.length} is a start. A full mock of 50 shows which chapters to fix first.`
                : 'Five questions are a small sample. A full mock of 50 shows which chapters to fix first.'}
          </p>

          {missed.length > 0 ? (
            <div className="mm-drill__readout">
              <p className="mm-drill__readout-head">The chapters these misses came from</p>
              <ul>
                {groups.map(({ chapter, topics }) => (
                  <li key={chapter}>
                    {chapter}
                    {topics ? <span className="mm-drill__readout-topic">{topics}</span> : null}
                  </li>
                ))}
              </ul>
              <p className="mm-drill__move"><b>Your next move:</b> 10 questions on {focus}. On Free, that set uses 10 of the 100 practice credits you start with.</p>
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
              {focus ? `Start free and practise ${focus}` : 'Start free'}
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
              </button>
            </>
          ) : (
            <>
              <p className="mm-drill__hint lp-pick__row">
                <span>Tap an answer to see why the key is right.</span>
                <button type="button" className="lp-pick__change" onClick={backToPicker}>Change subject</button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
