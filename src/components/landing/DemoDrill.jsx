"use client";

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icons';
import { pipReact } from '@/components/brand/pipEvents';
import { mobiMoment, runMood } from '@/lib/mobiMoments';
import { DEMO_SUBJECTS, acceptDemoSet, demoSetUrl, demoSubject, pickDemoSet } from '@/lib/demoSample.mjs';
import { trackFunnel } from '@/lib/funnel';
import { markDemoAnswered, sendDemoState } from './demoSignal.mjs';
import { deskEndState, deskStateAfter } from './heroTaps.mjs';
import { saveSample } from './sampleCarry.mjs';
import './demo-subject.css';

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
//
// "Not your subject?" (round 4 H3, owner LK123, 5 Nov 2026): a quiet key on the card's last line turns the card to the
// 15 CUET subjects; picking one plays five random live questions of it from /api/sample (src/lib/demoSample.mjs, the
// route's rules in src/lib/server/demoSample.js), with the same reveal, the same Mobi and the same end. The card still
// opens on its own five below (English first, no network), and a subject that cannot load says so and keeps the card
// as it was. Every set is five, so DRILL.length is the length of whichever set is playing.
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
    // No-break spaces round the operators (R8 HERO-15): the worked sum never parts at a line end.
    why: 'Equity = assets − liabilities = ₹80,000 − ₹30,000 = ₹50,000.',
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
/** A live subject that has not answered in this long is called slow and can be tapped again (R8 HERO-02, patchy 4G). */
const SLOW_MS = 8000;
/** A stem longer than this many characters is set a step smaller (round 10; the card's own five are all shorter). */
const LONG_STEM = 110;

/**
 * The end verdict, true to the score (R8 HERO-01): five of five asks for a full mock, four names its one chapter, two or
 * three is a solid start with its chapters counted, and none or one is a tough five with a place to start. Never "Good."
 * for a low score, never "exactly": five questions cannot show that much. `chapters` is how many different chapters missed.
 */
export function drillVerdict(score, chapters) {
  if (score >= 5) return 'All five. Ready for 50 of these in 60 minutes?';
  if (score === 4) return 'Sharp. One chapter to look at.';
  if (score >= 2) return `Solid start. ${chapters === 1 ? 'One chapter' : `${chapters} chapters`} to look at first.`;
  return 'Tough five. Here’s where to start.';
}

/** Where the volt key must sit to be reachable: above the phone bar when it is showing, else the window's foot. */
function reachLimit() {
  const dock = document.querySelector('.mm-dock');
  if (dock) {
    const box = dock.getBoundingClientRect();
    const look = window.getComputedStyle(dock);
    if (box.height > 0 && box.top < window.innerHeight && look.visibility !== 'hidden' && Number(look.opacity) > 0.05) return box.top;
  }
  return window.innerHeight;
}

/** The small turn-back mark on a subject that could not load (tap it again). */
function RetryMark() {
  return (
    <svg className="icon mm-drill__subject-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

export function DemoDrill({ note = null }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [missed, setMissed] = useState([]);
  // The readout's open row (R8 HERO-05): one missed question at a time shows its question, answer and reason.
  const [openMiss, setOpenMiss] = useState(null);
  // The subject sample: `live` is the picked subject's set ({ slug, name, set, questions }), null while the card plays its
  // own five; `picking` shows the subject list in the card; `loading` and `failed` are the slug being fetched or that could
  // not load; `fresh` (set once the list has been opened) lets the question ease back in, never on the first paint.
  const [live, setLive] = useState(null);
  const [picking, setPicking] = useState(false);
  const [loading, setLoading] = useState(null);
  const [failed, setFailed] = useState(null);
  // Why the failed subject failed: 'offline', 'slow' (no answer in SLOW_MS) or 'error' (R8 HERO-02, HERO-06).
  const [failure, setFailure] = useState(null);
  const [fresh, setFresh] = useState(false);
  const rootRef = useRef(null);
  const footRef = useRef(null);
  const optionsRef = useRef(null);
  const resultRef = useRef(null);
  const panelRef = useRef(null);
  const switchRef = useRef(null);
  const request = useRef(null);
  const lastSet = useRef({});
  // The bubble's line for the card as it stands, so closing the subject list puts it back (R8 HERO-03).
  const deskNow = useRef({ state: 'load', answered: 0, subject: null });
  const leadId = useId();
  // Answering disables the options and "Next" unmounts once used, so keyboard and
  // screen-reader focus would fall back to the page body. Hand it forward instead.
  const focusNext = useRef(null);

  const questions = live ? live.questions : DRILL;
  const question = questions[index];
  const answered = picked !== null;
  const answeredCount = index + (answered ? 1 : 0);

  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === 'next') footRef.current?.querySelector('.mm-btn')?.focus({ preventScroll: true });
    else if (target === 'options') optionsRef.current?.querySelector('button')?.focus({ preventScroll: true });
    else if (target === 'result') resultRef.current?.focus({ preventScroll: true });
    // A pointer pick or "Next" keeps focus in the card without drawing a ring on its volt key (R8 HERO-11).
    else if (target === 'card') rootRef.current?.focus({ preventScroll: true });
    else if (target === 'switch') switchRef.current?.focus({ preventScroll: true });
    else if (target === 'panel') {
      const list = panelRef.current;
      (list?.querySelector('[aria-pressed="true"]') || list?.querySelector('button'))?.focus({ preventScroll: true });
    }
  }, [answered, index, done, picking, live]);

  // The subject list and a new set start at the card's head: when the head is above the screen (the key that opened them
  // sits on the card's last line), bring it back at once, never with a glide (LK47, LK89).
  useEffect(() => {
    const node = rootRef.current;
    if (!node || done || !(picking || fresh)) return;
    // Counts the card's scroll-margin plus html's scroll-padding, so the sticky nav never covers its head (R8 sweep LH-01, LH-02).
    const clear = (parseFloat(getComputedStyle(node).scrollMarginTop) || 0) + (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0);
    if (node.getBoundingClientRect().top < clear) node.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [picking, fresh, live, done]);

  // A request still running when the card goes away is dropped.
  useEffect(() => () => request.current?.abort(), []);

  // Answering grows the panel by the reason plus the forward key, which on a
  // 360x800 phone pushes that key under the sticky action bar. Bring it back
  // into reach once the reveal sequence has played.
  useEffect(() => {
    if (!answered) return undefined;
    // Instant, never a programmatic glide (LK47): only when the key is out of reach, and only by what is needed.
    // 'instant', not 'auto': the page's html has scroll-behavior: smooth, which 'auto' inherits (a glide, LK89).
    // R8 HERO-10: only the key itself is brought up, to 12 px above the phone bar (or the window's foot), so Mobi's room
    // and the headline stay on screen; a key already in reach moves nothing.
    const id = window.setTimeout(() => {
      const key = footRef.current?.querySelector('.mm-btn');
      if (!key) return;
      const over = key.getBoundingClientRect().bottom - (reachLimit() - 12);
      if (over > 0) window.scrollBy({ top: Math.ceil(over), behavior: 'instant' });
    }, 320);
    return () => window.clearTimeout(id);
  }, [answered, index]);

  function tellDesk(state, count, subject = null, restore = false) {
    if (state !== 'pick') deskNow.current = { state, answered: count, subject };
    sendDemoState(state, count, undefined, { subject, restore });
  }

  function pick(optionIndex, event) {
    if (answered) return;
    // Keyboard (Enter or Space: detail 0) hands focus to "Next" with its ring; a tap keeps it in the card (R8 HERO-11).
    focusNext.current = event.detail === 0 ? 'next' : 'card';
    setPicked(optionIndex);
    markDemoAnswered();
    // The aggregate funnel (src/lib/funnel.js): the step's name only, once per page load, no id and no cookie.
    trackFunnel('sample_started');
    tellDesk(deskStateAfter({ correct: optionIndex === question.correct }), index + 1);
    if (event.detail > 0) pipReact('hero', mobiMoment(optionIndex === question.correct ? 'rightAnswer' : 'wrongAnswer'));
    if (optionIndex === question.correct) {
      setScore((s) => s + 1);
    } else {
      // Each miss keeps its question, answer and reason, so the readout can open them again (R8 HERO-05), plus its place in
      // the five and the option the student picked, so the readout names the question and sets their answer beside the
      // right one (9 Nov 2026 demo result pass). Nothing leaves the browser; the list goes on restart.
      setMissed((list) => [...list, { n: index + 1, chapter: question.chapter, q: question.q, picked: question.options[optionIndex], answer: question.options[question.correct], why: question.why }]);
    }
  }

  function next(event) {
    if (index + 1 >= DRILL.length) {
      focusNext.current = 'result';
      setOpenMiss(null);
      setDone(true);
      // The result goes with the reader to sign-up (sampleCarry.mjs): the score and the missed chapters' names, kept in
      // this browser only, so /signup opens on what these five showed and not on a stranger's greeting.
      saveSample({ score, subject: live ? live.name : null, misses: missed });
      trackFunnel('sample_done');
      // Mobi's line for the score (R8 HERO-03): the readout is what he points at, never a sign-up push.
      tellDesk(deskEndState(score, DRILL.length), DRILL.length);
      // The end of the drill is proportional, like a finished run in the app: all five right celebrates,
      // most right is a cheer, and a third or more missed gets encouragement.
      if (event.detail > 0) pipReact('hero', runMood(score, DRILL.length));
      return;
    }
    focusNext.current = event.detail === 0 ? 'options' : 'card';
    setIndex((i) => i + 1);
    setPicked(null);
  }

  function restart(event) {
    // Hand focus to the restarted card (keyboard: answer A; tap: the card) and let the head scroll back into view (R8 sweep LH-01).
    focusNext.current = event?.detail === 0 ? 'options' : 'card';
    setFresh(true);
    tellDesk('load', 0);
    setIndex(0);
    setPicked(null);
    setScore(0);
    setMissed([]);
    setOpenMiss(null);
    setDone(false);
  }

  function openSubjects() {
    focusNext.current = 'panel';
    setFailed(null);
    setFailure(null);
    setFresh(true);
    setPicking(true);
    tellDesk('pick', 0);
  }

  function closeSubjects() {
    request.current?.abort();
    request.current = null;
    setLoading(null);
    setFailed(null);
    setFailure(null);
    focusNext.current = 'switch';
    setPicking(false);
    // Back on the card, Mobi says what he said before the list opened. It is a restore, not a new answer, so he
    // plays no act for it (R8 revision).
    const { state, answered: count, subject } = deskNow.current;
    tellDesk(state, count, subject, true);
  }

  // A subject's five: the route's answer is checked whole (acceptDemoSet) before the card plays it. A failure keeps the
  // list open with one line that says so; the card underneath is untouched. Picking another subject while one loads
  // drops the first request.
  // R8 HERO-02: a request that has not answered in SLOW_MS is dropped (a plain timer, not AbortSignal.timeout, which older
  // Android WebViews lack) and the key can be tapped again; offline says so (HERO-06).
  async function chooseSubject(slug) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(slug);
    setFailed(null);
    setFailure(null);
    let slow = false;
    const timer = window.setTimeout(() => { slow = true; controller.abort(); }, SLOW_MS);
    try {
      const response = await fetch(demoSetUrl(slug, pickDemoSet(lastSet.current[slug] ?? null)), { signal: controller.signal });
      const next = acceptDemoSet(response.ok ? await response.json() : null, slug);
      window.clearTimeout(timer);
      if (request.current !== controller) return;
      if (!next) throw new Error('unavailable');
      lastSet.current[slug] = next.set;
      request.current = null;
      trackFunnel('sample_subject_chosen');
      tellDesk('live', 0, next.name);
      focusNext.current = 'options';
      setLive(next);
      setFresh(true);
      setIndex(0);
      setPicked(null);
      setScore(0);
      setMissed([]);
      setOpenMiss(null);
      setDone(false);
      setLoading(null);
      setPicking(false);
    } catch {
      window.clearTimeout(timer);
      if (request.current !== controller) return;
      request.current = null;
      setLoading(null);
      setFailed(slug);
      setFailure(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : slow ? 'slow' : 'error');
    }
  }

  function onPanelKey(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeSubjects();
    }
  }

  if (done && !picking) {
    const chapters = new Set(missed.map((miss) => miss.chapter)).size;
    return (
      <div className="lp-card mm-drill" aria-live="polite" tabIndex={-1} role="group" aria-label="Five sample questions">
        <div className="lp-card__head">
          <span className="lp-card__sub"><b>Your score</b><span>All 5 answered</span></span>
        </div>
        <div className="lp-card__body mm-drill__result" ref={resultRef} tabIndex={-1} aria-label={`Your score: ${score} out of 5.`}>
          <p className="mm-drill__score">
            {score}
            <span>/5</span>
          </p>
          <p className="mm-drill__verdict">{drillVerdict(score, chapters)}</p>

          {missed.length > 0 ? (
            <div className="mm-drill__readout">
              {/* What these five actually showed (9 Nov 2026): the misses themselves, not a forecast of a full mock's review. */}
              <p className="mm-drill__readout-head">What you missed in these five</p>
              {/* R8 HERO-05: each miss opens the question it came from, the student's answer beside the right one, the reason
                  and the one way on: the signature chain (miss, reason, chapter, next step) in miniature. No marks are
                  promised. The row leads with the question's number (two misses in one chapter stay two rows); the chapter is
                  the row's words. */}
              <ul>
                {missed.map((miss, i) => {
                  const open = openMiss === i;
                  const panelId = `${leadId}-miss-${i}`;
                  return (
                    <li key={`${miss.n}-${i}`} className="mm-drill__miss" data-open={open ? 'true' : 'false'}>
                      <button type="button" className="mm-drill__miss-row" aria-expanded={open} aria-controls={panelId} onClick={() => setOpenMiss(open ? null : i)}>
                        <span className="mm-drill__miss-n">Q{miss.n}</span>{' '}
                        <span className="mm-drill__miss-chapter">{miss.chapter}</span>
                        <Icon name="chevR" className="mm-drill__miss-chev" aria-hidden="true" />
                      </button>
                      <div className="mm-drill__miss-fold" id={panelId} inert={!open}>
                        <div className="mm-drill__miss-body">
                          <p className="mm-drill__miss-q">{miss.q}</p>
                          {/* Words carry the outcome; the marks and their colours only repeat it. */}
                          <dl className="mm-drill__miss-answers">
                            <div className="mm-drill__miss-answer" data-kind="yours">
                              <dt><Icon name="x" className="mm-drill__miss-mark" aria-hidden="true" />Your answer</dt>
                              <dd>{miss.picked}</dd>
                            </div>
                            <div className="mm-drill__miss-answer" data-kind="correct">
                              <dt><Icon name="check" className="mm-drill__miss-mark" aria-hidden="true" />Correct answer</dt>
                              <dd>{miss.answer}</dd>
                            </div>
                          </dl>
                          <p className="mm-drill__miss-why">{miss.why}</p>
                          {/* The link is the general sign-up, not a way into this chapter, so the line says the real next step. */}
                          <p className="mm-drill__miss-next"><Link href="/signup">Sign up free</Link>, then choose chapters like this one in Practice.</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
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
            {/* What a full mock adds over these five, said once above the way in (a perfect five already says it in its note). */}
            {missed.length > 0 ? <p className="mm-drill__actions-lead">A full mock gives you a broader chapter review.</p> : null}
            {/* One name for the way in on the whole page (R8 HERO-04, SEC-15): the hero's "Sign up free". */}
            <Link href="/signup" className="mm-btn mm-btn--primary">
              Sign up free
            </Link>
            <div className="mm-drill__more">
              <button type="button" className="mm-drill__replay" onClick={restart}>
                Try the five again
              </button>
              <button type="button" className="mm-drill__replay" ref={switchRef} onClick={openSubjects}>
                Try another subject
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const current = live ? demoSubject(live.slug) : null;
  const loadingName = loading ? demoSubject(loading)?.name : null;
  const failedName = failed ? demoSubject(failed)?.name : null;

  return (
    <div className="lp-card mm-drill" data-answered={answeredCount} data-mode={picking ? 'subjects' : 'drill'} tabIndex={-1} role="group" aria-label={picking ? 'Pick a subject for the sample' : 'Five sample questions'} ref={rootRef}>
      {picking ? (
        <div className="mm-drill__subjects-panel" onKeyDown={onPanelKey}>
          <div className="lp-card__head">
            <span className="lp-card__sub"><b>Pick your subject</b></span>
            <button type="button" className="mm-drill__close" onClick={closeSubjects} aria-label="Back to the question">
              <Icon name="x" aria-hidden="true" />
            </button>
          </div>
          <div className="lp-card__body">
            {/* One line under the head: what a pick gives, and while it loads or if it fails, that instead (in place, so the
                card does not grow). */}
            <p className="mm-drill__pick-lead" id={leadId} aria-live="polite" data-tone={failedName ? 'error' : null}>
              {failedName
                ? failure === 'offline'
                  ? `You’re offline. Reconnect, then tap ${failedName} again.`
                  : failure === 'slow'
                    ? `${failedName} is taking too long. Tap it to try again.`
                    : `Couldn’t load ${failedName} just now. Try again, or pick another subject.`
                : loadingName
                  ? `Loading five ${loadingName} questions.`
                  : 'Five questions from the MockMob bank, each with its answer explained.'}
            </p>
            <div className="mm-drill__subjects" role="group" aria-label="CUET subjects" aria-busy={loading ? 'true' : 'false'} ref={panelRef}>
              {DEMO_SUBJECTS.map((subject) => {
                const isCurrent = current?.slug === subject.slug;
                // The key being fetched (or that could not load) carries its own state: busy while it loads, and the line
                // above ("Loading five ...", "Couldn't load ...") as its description, so a screen reader hears it on the key.
                const isLoading = loading === subject.slug;
                const isFailed = failed === subject.slug;
                const speaks = isLoading || isFailed;
                return (
                  <button
                    key={subject.slug}
                    type="button"
                    className="mm-drill__subject"
                    aria-pressed={isCurrent ? 'true' : 'false'}
                    aria-busy={isLoading ? 'true' : undefined}
                    aria-describedby={speaks ? leadId : undefined}
                    data-state={isLoading ? 'loading' : isFailed ? 'failed' : null}
                    onClick={() => chooseSubject(subject.slug)}
                  >
                    <span>{subject.name}</span>
                    {/* The key that failed carries a red rim and a turn-back mark (R8 HERO-06); the one playing, its tick. */}
                    {isFailed ? <RetryMark /> : isCurrent && !isLoading ? <Icon name="check" className="mm-drill__subject-mark" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="lp-card__head">
            <span className="lp-card__sub"><b>{question.subject}</b><span>{index + 1} of {DRILL.length}</span></span>
            {/* Round 10: each dash keeps its answer's outcome (right or missed), so the five read as a record, not a count
                that repeats "1 of 5". The words still say it; the dashes are decoration for a screen reader. */}
            <span className="mm-drill__progress" aria-hidden="true">
              {DRILL.map((item, i) => {
                const result = i < index
                  ? (missed.some((miss) => miss.n === i + 1) ? 'wrong' : 'right')
                  : i === index && answered ? (picked === question.correct ? 'right' : 'wrong') : undefined;
                return (
                  <span
                    key={item.q}
                    className="mm-drill__pip"
                    data-state={i < index ? 'past' : i === index ? 'now' : 'next'}
                    data-result={result}
                  />
                );
              })}
            </span>
          </div>

          <div className="lp-card__body" data-fresh={fresh ? 'true' : null}>
            {/* Round 10: a long bank stem (a live subject's, often 150+ characters) is set a step smaller, so it is not
                seven lines over the options on a phone. The words are the bank's, unchanged. */}
            <p className="mm-drill__q" data-long={question.q.length > LONG_STEM ? 'true' : undefined}>{question.q}</p>

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
                    key={`${index}-${optionIndex}`}
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
                    {index + 1 >= DRILL.length ? 'See my score' : 'Next question'}
                  </button>
                </>
              ) : null}
            </div>
            </div>
            {/* The card's last line: the note (the hero's words) and the subject key, side by side where they fit. */}
            <div className="mm-drill__base">
              {note ? <p className="lp-card__note">{note}</p> : null}
              <button type="button" className="mm-drill__switch" ref={switchRef} onClick={openSubjects} aria-label="Not your subject? Pick another subject">
                Not your subject?
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
