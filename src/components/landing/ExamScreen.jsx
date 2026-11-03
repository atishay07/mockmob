"use client";

// The home page's exam section (LK72, 4 Nov 2026): a picture of the runner a student really gets, not an NTA clone.
// Its anatomy is TestPageClient.jsx's (src/app/(app)/test): the saved note, the header with Question n of m, the answered
// count and the timer, the chapter and difficulty chips, the stem, four options with letter chips, Mark and Clear, the
// strike-out (press and hold an option), Previous / Palette / Next, and the review panel with its word-labelled counters,
// chip grid and Submit. It follows the page theme (Night and Day), like the runner does. "NTA style" is a switch inside the
// frame that keeps the answers and the timer and reskins the same screen to NTA's own words and palette, so the rehearsal
// still exists. Every word comes from homeCopy.mjs (EXAM): NTA's vocabulary lives only in EXAM.nta and is drawn only in
// that mode, and every MockMob-mode string is held against the runner's source by examPreviewParity.test.mjs.
// The questions are five real Accountancy items; the other ten chips stand as they would mid-paper. Nothing is submitted
// anywhere: Submit test only reads the review back.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Clock3, Flag, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { MascotSeat } from '@/components/brand/Mascot';
import { pipReact } from '@/components/brand/pipEvents';
import { Reveal } from './Reveal';
import { EXAM, EXAM_HEAD } from './homeCopy.mjs';
import '@/app/exam-screen.css';

const LETTERS = 'ABCD';
const LONG_PRESS_MS = 460;
const REST = { a: 'answered', n: 'visited', x: 'notvisited' };
const LIVE = EXAM.questions.length;
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export function ExamScreen() {
  const { user } = useAuth();
  const [mode, setMode] = useState('mockmob');
  const [index, setIndex] = useState(EXAM.start.index);
  const [answers, setAnswers] = useState(EXAM.start.answers);
  const [marked, setMarked] = useState(EXAM.start.marked);
  const [visited, setVisited] = useState(() => Object.fromEntries(EXAM.start.visited.map((i) => [i, true])));
  const [struck, setStruck] = useState(EXAM.start.struck);
  const [noteOn, setNoteOn] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [readBack, setReadBack] = useState(false);
  // The clock starts when the visitor first acts and runs only while the frame is on screen and the tab is visible.
  // Reduced motion keeps it still.
  const [clock, setClock] = useState(EXAM.startSeconds);
  const [started, setStarted] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const frameRef = useRef(null);
  const paletteButton = useRef(null);
  const closeButton = useRef(null);
  const press = useRef(null);
  const suppressClick = useRef(false);
  const nta = mode === 'nta';
  const words = EXAM.mockmob;

  useEffect(() => {
    const node = frameRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!started || !onScreen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') setClock((s) => Math.max(0, s - 1)); }, 1000);
    return () => window.clearInterval(id);
  }, [started, onScreen]);
  useEffect(() => {
    if (!sheet) return undefined;
    closeButton.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') { setSheet(false); paletteButton.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheet]);

  const question = EXAM.questions[index];
  // Chip state for every one of the 15 questions: the first five are live, the rest stand as they would mid-paper.
  const stateOf = (i) => {
    if (i >= LIVE) return REST[EXAM.restStates[i - LIVE]];
    if (marked[i]) return answers[i] !== undefined ? 'marked-answered' : 'marked';
    if (answers[i] !== undefined) return 'answered';
    return visited[i] ? 'visited' : 'notvisited';
  };
  const states = useMemo(() => Array.from({ length: EXAM.total }, (_, i) => stateOf(i)), [answers, marked, visited]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = (...which) => states.filter((s) => which.includes(s)).length;
  const answered = count('answered', 'marked-answered');
  const counts = { answered, marked: count('marked', 'marked-answered'), pending: count('visited', 'marked'), notvisited: count('notvisited') };
  const timerText = mmss(clock);

  const touch = () => { setStarted(true); setReadBack(false); };
  const go = (i) => { touch(); setIndex(i); setVisited((v) => ({ ...v, [i]: true })); setSheet(false); };
  const choose = (option) => {
    touch(); setNoteOn(false);
    setStruck((s) => (s[index]?.includes(option) ? { ...s, [index]: s[index].filter((o) => o !== option) } : s)); // picking a crossed-out option brings it back
    setAnswers((a) => ({ ...a, [index]: option }));
    pipReact('demo', 'nod');
  };
  const toggleStrike = (option) => { touch(); setNoteOn(false); setStruck((s) => { const now = s[index] || []; return { ...s, [index]: now.includes(option) ? now.filter((o) => o !== option) : [...now, option] }; }); };
  const clearAnswer = () => { touch(); setAnswers((a) => { const copy = { ...a }; delete copy[index]; return copy; }); };
  const toggleMark = () => { touch(); setMarked((m) => ({ ...m, [index]: !m[index] })); };
  const next = () => { if (index < LIVE - 1) go(index + 1); };
  const prev = () => { if (index > 0) go(index - 1); };
  const markAndNext = () => { setMarked((m) => ({ ...m, [index]: true })); next(); };

  const startPress = (event, option) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    cancelPress();
    press.current = { option, x: event.clientX, y: event.clientY, timer: window.setTimeout(() => { suppressClick.current = true; press.current = null; toggleStrike(option); }, LONG_PRESS_MS) };
  };
  function cancelPress() { if (press.current) { window.clearTimeout(press.current.timer); press.current = null; } }
  const movePress = (event) => { const p = press.current; if (p && Math.hypot(event.clientX - p.x, event.clientY - p.y) > 8) cancelPress(); };
  const optionClick = (option) => { if (suppressClick.current) { suppressClick.current = false; return; } choose(option); };
  const optionKey = (event, option) => { if (event.shiftKey && event.key >= '1' && event.key <= '4' && Number(event.key) - 1 === option) { event.preventDefault(); toggleStrike(option); } };

  const reset = () => { setAnswers(EXAM.start.answers); setMarked(EXAM.start.marked); setVisited(Object.fromEntries(EXAM.start.visited.map((i) => [i, true]))); setStruck(EXAM.start.struck); setIndex(EXAM.start.index); setNoteOn(true); setStarted(false); setClock(EXAM.startSeconds); setReadBack(false); };

  const chipWord = words.chip[states[index]];
  const isStruck = (option) => (struck[index] || []).includes(option);

  const chipGrid = (
    <div className="xs-grid" role="group" aria-label={nta ? EXAM.nta.paletteTitle : words.paletteTitle}>
      {states.map((state, i) => (i < LIVE
        ? <button key={i} type="button" className="xs-chip" data-state={state} aria-current={index === i ? 'step' : undefined} aria-label={`Question ${i + 1}, ${state.replace('-', ' and ')}`} onClick={() => go(i)}>{i + 1}</button>
        : <span key={i} className="xs-chip" data-state={state} aria-hidden="true">{i + 1}</span>))}
    </div>
  );
  const legend = nta ? EXAM.nta.legend : words.legend;
  const panel = (
    <>
      <div className="xs-counters">{words.counters.map(([key, label]) => (
        <div key={key} data-k={key}><strong>{counts[key]}</strong><span>{label}</span></div>
      ))}</div>
      {chipGrid}
      <ul className="xs-legend">{legend.map(([state, label]) => <li key={state}><i data-state={state} aria-hidden="true" />{label}</li>)}</ul>
      <button type="button" className="xs-submit" onClick={() => setReadBack((v) => !v)} aria-expanded={readBack}>{words.submit}</button>
      <p className="xs-readback" role="status">{readBack ? `${words.counters[0][1]} ${counts.answered}, ${words.chip.visited} ${counts.pending}, ${words.counters[1][1]} ${counts.marked}.` : ''}</p>
    </>
  );

  return (
    <section className="lp-sec xs" id="exam-experience" aria-labelledby="exam-title">
      <div className="mm-wrap">
        <div className="xs-layout">
        <Reveal className="lp-head lp-head--left xs-head"><h2 className="lp-h2" id="exam-title">{EXAM_HEAD.h2}</h2></Reveal>
        <Reveal className="lp-head lp-head--left xs-sub"><p className="lp-sub">{EXAM_HEAD.sub}</p></Reveal>
        {/* He holds the answer sheet beside the heading and never inside the paper: no distractions in an exam. */}
        <MascotSeat station="demo" pose="reading" label="Try both screens." className="pip-seat--demo xs-seat" />

        <div className="xs-frame" data-interface={mode} ref={frameRef}>
          <div className="xs-toolbar">
            <p className="xs-saved" role="status">{EXAM.saved}</p>
            <div className="xs-switch" role="group" aria-label={words.switchLabel}>
              <button type="button" aria-pressed={!nta} onClick={() => setMode('mockmob')}>{words.interface}</button>
              <button type="button" aria-pressed={nta} onClick={() => setMode('nta')}>{EXAM.nta.interface}<small>Pro</small></button>
            </div>
          </div>

          <header className="xs-header">
            <div className="xs-title">
              <button type="button" className="xs-exit" aria-label={words.exit} onClick={reset}><X size={18} aria-hidden="true" /></button>
              <div><span>{EXAM.attempt}</span><strong>{EXAM.subject}</strong></div>
            </div>
            <div className="xs-timer" role="timer" aria-label={`${words.timer}: ${Math.floor(clock / 60)} minutes ${clock % 60} seconds`} data-running={started && onScreen}>
              <Clock3 size={15} aria-hidden="true" /><span>{timerText}</span>
            </div>
            <div className="xs-progress">
              <div><span>{words.questionOf(index + 1, EXAM.total)}</span><span>{words.answered(answered)}</span></div>
              <i aria-hidden="true"><b style={{ '--p': answered / EXAM.total }} /></i>
            </div>
          </header>

          <div className="xs-body">
            <div className="xs-paper">
              <div className="xs-tags"><span>{question.chapter}</span><span>{question.difficulty}</span></div>
              <div className="xs-qhead">
                <div><h3>{words.heading(index + 1)}</h3><span className="xs-state" data-state={states[index]}>{chipWord}</span></div>
                <div className="xs-actions">
                  <button type="button" className="xs-text" onClick={toggleMark} aria-pressed={Boolean(marked[index])}><Flag size={15} aria-hidden="true" />{marked[index] ? words.unmark : words.mark}</button>
                  <button type="button" className="xs-text" onClick={clearAnswer}>{nta ? EXAM.nta.clearResponse : words.clear}</button>
                </div>
              </div>
              <p className="xs-stem" aria-live="polite">{question.text}</p>
              <div className="xs-options" role="group" aria-label={`Options for question ${index + 1}`}>
                {question.options.map((text, option) => {
                  const selected = answers[index] === option;
                  return (
                    <button key={`${index}-${option}`} type="button" className="xs-option" aria-pressed={selected} data-struck={isStruck(option) || undefined}
                      onPointerDown={(event) => startPress(event, option)} onPointerMove={movePress} onPointerUp={cancelPress} onPointerCancel={cancelPress} onPointerLeave={cancelPress}
                      onContextMenu={(event) => { event.preventDefault(); toggleStrike(option); }} onKeyDown={(event) => optionKey(event, option)} onClick={() => optionClick(option)}>
                      <span className="xs-letter" aria-hidden="true">{LETTERS[option]}</span>
                      <span className="xs-opt-text">{text}</span>
                      {isStruck(option) ? <span className="lp-sr">, crossed out</span> : null}
                    </button>
                  );
                })}
              </div>
              {noteOn ? <p className="xs-note">{words.strikeNote}</p> : null}
              <div className="xs-nav">
                {nta ? <button type="button" className="xs-btn xs-btn--review" onClick={markAndNext}>{EXAM.nta.markNext}</button> : null}
                <button type="button" className="xs-btn" disabled={index === 0} onClick={prev}>{words.previous}</button>
                <button type="button" className="xs-btn xs-btn--next" disabled={index === LIVE - 1} onClick={next}>{nta ? EXAM.nta.save : words.next}</button>
              </div>
            </div>

            <aside className="xs-review" aria-label={words.review}>
              <span className="xs-kicker">{nta ? EXAM.nta.paletteTitle : words.review}</span>
              {panel}
            </aside>
          </div>

          <div className="xs-mobile">
            <button type="button" disabled={index === 0} onClick={prev}>{nta ? EXAM.nta.back : words.prevShort}</button>
            <button type="button" ref={paletteButton} onClick={() => setSheet(true)} aria-label={`${words.palette}, ${answered} of ${EXAM.total} answered`}>{nta ? EXAM.nta.palette(answered, EXAM.total) : words.palette}</button>
            {nta ? <button type="button" className="xs-m-review" onClick={markAndNext}>{EXAM.nta.markNext}</button> : null}
            <button type="button" className="xs-m-next" disabled={index === LIVE - 1} onClick={next}>{nta ? EXAM.nta.save : words.next}</button>
          </div>

          {sheet ? (
            <div className="xs-sheet" role="dialog" aria-label={words.paletteTitle}>
              <div className="xs-sheet__head">
                <strong>{answered}/{EXAM.total} {words.chip.answered.toLowerCase()}</strong>
                <button ref={closeButton} type="button" className="xs-exit" aria-label={words.closePalette} onClick={() => { setSheet(false); paletteButton.current?.focus(); }}><X size={18} aria-hidden="true" /></button>
              </div>
              {panel}
            </div>
          ) : null}
        </div>

        <p className="xs-gate"><b>{EXAM.gateTitle}.</b> {EXAM.gate} <span>{EXAM.warnings}.</span>{' '}
          <Link href={user?.isPremium ? `/dashboard?mode=nta&interface=${mode}` : '/pricing'} className="lp-link">{user?.isPremium ? EXAM.ctaPro : EXAM.ctaFree}</Link></p>
        </div>
      </div>
    </section>
  );
}
