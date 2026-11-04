"use client";

// The home page's exam section (LK72 4 Nov; D6, LK91, LK92 5 Nov 2026): one exam screen on a desktop monitor, with a
// MockMob / NTA style switch beside it that keeps the answers and the timer.
// - The monitor (ExamDevice.jsx) holds a browser window whose address bar shows where the screen really lives
//   (mockmob.in/test, with interface=nta in NTA style, the address the runner reads). The screen is laid out at 880 x 550
//   design pixels and scales with the monitor as a whole, so a phone sees the same desktop screen, smaller.
// - MockMob is our own screen, the runner's anatomy (src/app/(app)/test/TestPageClient.jsx): the saved note, the header
//   with Question n of m, the answered count and the timer, the chapter and difficulty chips, the stem, four options with
//   letter chips, Mark and Clear, the strike-out (press and hold an option), Previous and Next, and the review panel with
//   its word-labelled counters, chip grid and Submit. It follows the page theme (Night and Day), like the runner does.
// - NTA style is NTA's CBT screen as its guidelines describe it (CUET (UG) 2025 Information Bulletin, Appendix V): the
//   candidate's profile image, the Remaining Time and the Question Paper icon top right, the section on the top bar,
//   numbered radio options, NTA's three keys (EXAM.nta: mark-and-next, clear, save-and-next), the Question Palette on the right
//   with the section summary (a count in each of NTA's five symbols) above it, and the > arrow at its left that folds it
//   away. Clicking the chosen option again clears it, as the guidelines say. No strike-out: NTA has none.
// Every word comes from homeCopy.mjs (EXAM): NTA's words live only in EXAM.nta and are drawn only by NtaScreen, which
// renders only in NTA style; every MockMob-mode string is held against the runner's source by examPreviewParity.test.mjs.
// The questions are five real Accountancy items; the other ten chips stand as they would mid-paper. Nothing is submitted
// anywhere: Submit only reads the counts back.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ChevronLeft, ChevronRight, Clock3, FileText, Flag, Lock, RotateCw, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { MascotSeat } from '@/components/brand/Mascot';
import { pipReact } from '@/components/brand/pipEvents';
import { Reveal } from './Reveal';
import { ExamDevice } from './ExamDevice';
import { EXAM, EXAM_HEAD } from './homeCopy.mjs';
import '@/app/exam-screen.css';

const LETTERS = 'ABCD';
const LONG_PRESS_MS = 460;
const REST = { a: 'answered', n: 'visited', x: 'notvisited' };
const LIVE = EXAM.questions.length;
const two = (n) => String(n).padStart(2, '0');
const mmss = (s) => `${two(Math.floor(s / 60))}:${two(s % 60)}`;
const hhmmss = (s) => `${two(Math.floor(s / 3600))}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}`;

export function ExamScreen() {
  const { user } = useAuth();
  const [mode, setMode] = useState('mockmob');
  const [index, setIndex] = useState(EXAM.start.index);
  const [answers, setAnswers] = useState(EXAM.start.answers);
  const [marked, setMarked] = useState(EXAM.start.marked);
  const [visited, setVisited] = useState(() => Object.fromEntries(EXAM.start.visited.map((i) => [i, true])));
  const [struck, setStruck] = useState(EXAM.start.struck);
  const [noteOn, setNoteOn] = useState(true);
  const [readBack, setReadBack] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  // The clock starts when the visitor first acts and runs only while the screen is on screen and the tab is visible.
  // Reduced motion keeps it still.
  const [clock, setClock] = useState(EXAM.startSeconds);
  const [started, setStarted] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const frameRef = useRef(null);
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

  const touch = () => { setStarted(true); setReadBack(false); };
  const go = (i) => { touch(); setIndex(i); setVisited((v) => ({ ...v, [i]: true })); };
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
  const markAndNext = () => { touch(); setMarked((m) => ({ ...m, [index]: true })); next(); };
  // NTA style: the key pressed decides the status, so the save key leaves the question unmarked (as the runner's NTA style does).
  const saveAndNext = () => { touch(); setMarked((m) => ({ ...m, [index]: false })); next(); };

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
  const address = nta ? EXAM.address.nta : EXAM.address.mockmob;

  // The 15 chips, one grid for both interfaces: MockMob draws them as outlined chips, NTA style in NTA's own symbols.
  const chipGrid = (names) => (
    <div className="xs-grid" role="group" aria-label={nta ? names.paletteTitle : words.paletteTitle}>
      {states.map((state, i) => (i < LIVE
        ? <button key={i} type="button" className="xs-chip" data-state={state} aria-current={index === i ? 'step' : undefined} aria-label={`Question ${i + 1}, ${names.stateName(state)}`} onClick={() => go(i)}>{i + 1}</button>
        : <span key={i} className="xs-chip" data-state={state} aria-hidden="true">{i + 1}</span>))}
    </div>
  );
  const mockmobNames = { paletteTitle: words.paletteTitle, stateName: (state) => state.replace('-', ' and ') };

  return (
    <section className="lp-sec xs" id="exam-experience" aria-labelledby="exam-title">
      <div className="mm-wrap">
        <div className="xs-layout">
        <Reveal className="lp-head lp-head--left xs-head"><h2 className="lp-h2" id="exam-title">{EXAM_HEAD.h2}</h2></Reveal>
        <Reveal className="lp-head lp-head--left xs-sub"><p className="lp-sub">{EXAM_HEAD.sub}</p></Reveal>
        {/* He holds the answer sheet beside the heading and never inside the paper: no distractions in an exam. */}
        <MascotSeat station="demo" pose="reading" label="Try both screens." className="pip-seat--demo xs-seat" />

        {/* The switch is the visitor's, not the exam's: it sits beside the monitor at full size at every width. */}
        <div className="xs-switch" role="group" aria-label={words.switchLabel}>
          <button type="button" aria-pressed={!nta} onClick={() => setMode('mockmob')}>{words.interface}</button>
          <button type="button" aria-pressed={nta} onClick={() => setMode('nta')}>{EXAM.nta.interface}<small>Pro</small></button>
        </div>

        <ExamDevice>
          <div className="xs-frame" data-interface={mode} ref={frameRef}>
            <div className="xs-browser" aria-hidden="true">
              <span className="xs-browser__nav"><ChevronLeft /><ChevronRight /><RotateCw /></span>
              <span className="xs-url"><Lock /><span><b>{EXAM.address.host}</b>{address}</span></span>
            </div>

            {nta ? (
              <NtaScreen key="nta" index={index} question={question} answers={answers} states={states} clock={clock} started={started} onScreen={onScreen}
                paletteOpen={paletteOpen} setPaletteOpen={setPaletteOpen} readBack={readBack} setReadBack={setReadBack}
                choose={choose} clearAnswer={clearAnswer} markAndNext={markAndNext} saveAndNext={saveAndNext} chipGrid={chipGrid} />
            ) : (
              <div key="mockmob" className="xs-app">
                <p className="xs-saved" role="status">{EXAM.saved}</p>
                <header className="xs-header">
                  <div className="xs-title">
                    <button type="button" className="xs-exit" aria-label={words.exit} onClick={reset}><X aria-hidden="true" /></button>
                    <div><span>{EXAM.attempt}</span><strong>{EXAM.subject}</strong></div>
                  </div>
                  <div className="xs-progress">
                    <div><span>{words.questionOf(index + 1, EXAM.total)}</span><span>{words.answered(answered)}</span></div>
                    <i aria-hidden="true"><b style={{ '--p': answered / EXAM.total }} /></i>
                  </div>
                  <div className="xs-timer" role="timer" aria-label={`${words.timer}: ${Math.floor(clock / 60)} minutes ${clock % 60} seconds`} data-running={started && onScreen}>
                    <Clock3 aria-hidden="true" /><span>{mmss(clock)}</span>
                  </div>
                </header>

                <div className="xs-body">
                  <div className="xs-paper">
                    <div className="xs-tags"><span>{question.chapter}</span><span>{question.difficulty}</span></div>
                    <div className="xs-qhead">
                      <div><h3>{words.heading(index + 1)}</h3><span className="xs-state" data-state={states[index]}>{chipWord}</span></div>
                      <div className="xs-actions">
                        <button type="button" className="xs-text" onClick={toggleMark} aria-pressed={Boolean(marked[index])}><Flag aria-hidden="true" />{marked[index] ? words.unmark : words.mark}</button>
                        <button type="button" className="xs-text" onClick={clearAnswer}>{words.clear}</button>
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
                      <button type="button" className="xs-btn" disabled={index === 0} onClick={prev}>{words.previous}</button>
                      <button type="button" className="xs-btn xs-btn--next" disabled={index === LIVE - 1} onClick={next}>{words.next}</button>
                    </div>
                  </div>

                  <aside className="xs-review" aria-label={words.review}>
                    <span className="xs-panel-title">{words.review}</span>
                    <div className="xs-counters">{words.counters.map(([key, label]) => (
                      <div key={key} data-k={key}><strong>{counts[key]}</strong><span>{label}</span></div>
                    ))}</div>
                    {chipGrid(mockmobNames)}
                    <ul className="xs-legend">{words.legend.map(([state, label]) => <li key={state}><i data-state={state} aria-hidden="true" />{label}</li>)}</ul>
                    <button type="button" className="xs-submit" onClick={() => setReadBack((v) => !v)} aria-expanded={readBack}>{words.submit}</button>
                    <p className="xs-readback" role="status">{readBack ? `${words.counters[0][1]} ${counts.answered}, ${words.chip.visited} ${counts.pending}, ${words.counters[1][1]} ${counts.marked}.` : ''}</p>
                  </aside>
                </div>
              </div>
            )}
          </div>
        </ExamDevice>

        <p className="xs-gate"><b>{EXAM.gateTitle}.</b> {EXAM.gate} <span>{EXAM.warnings}.</span>{' '}
          <Link href={user?.isPremium ? `/dashboard?mode=nta&interface=${mode}` : '/pricing'} className="lp-link">{user?.isPremium ? EXAM.ctaPro : EXAM.ctaFree}</Link></p>
        </div>
      </div>
    </section>
  );
}

// NTA style: drawn only while the visitor has picked it (the one place EXAM.nta's screen words are read).
function NtaScreen({ index, question, answers, states, clock, started, onScreen, paletteOpen, setPaletteOpen, readBack, setReadBack, choose, clearAnswer, markAndNext, saveAndNext, chipGrid }) {
  const t = EXAM.nta;
  const name = Object.fromEntries(t.legend);
  const tally = Object.fromEntries(t.legend.map(([state]) => [state, states.filter((s) => s === state).length]));
  // NTA: clicking the chosen option again clears it ("click on the button of the chosen option again").
  const pick = (option) => (answers[index] === option ? clearAnswer() : choose(option));
  return (
    <div className="xs-nta">
      <header className="xs-n-head">
        <strong className="xs-n-exam">{t.exam}</strong>
        <div className="xs-n-tools">
          <span className="xs-n-paper"><FileText aria-hidden="true" />{t.questionPaper}</span>
          <dl className="xs-n-cand">
            <div><dt>{t.candidate}</dt><dd>{t.you}</dd></div>
            <div><dt>{t.subjectName}</dt><dd>{EXAM.subject}</dd></div>
            <div><dt>{t.remaining}</dt><dd><span className="xs-n-time" role="timer" aria-label={`${t.remaining}: ${Math.floor(clock / 60)} minutes ${clock % 60} seconds`} data-running={started && onScreen}>{hhmmss(clock)}</span></dd></div>
          </dl>
          <i className="xs-n-photo" aria-hidden="true" />
        </div>
      </header>
      <div className="xs-n-sections"><span className="xs-n-tab" aria-current="true">{EXAM.subject}</span></div>

      <div className="xs-n-body" data-palette={paletteOpen ? 'open' : 'closed'}>
        <div className="xs-n-main">
          <div className="xs-n-qhead">
            <h3>{t.question(index + 1)}</h3>
            <span className="xs-n-down" aria-hidden="true"><ArrowDown /></span>
          </div>
          <div className="xs-n-qbody">
            <p className="xs-n-stem" aria-live="polite">{question.text}</p>
            <div className="xs-n-options" role="group" aria-label={`Options for question ${index + 1}`}>
              {question.options.map((text, option) => (
                <button key={`${index}-${option}`} type="button" className="xs-n-option" aria-pressed={answers[index] === option} onClick={() => pick(option)}>
                  <span className="xs-n-radio" aria-hidden="true" />
                  <span className="xs-n-num">{option + 1}.</span>
                  <span>{text}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="xs-n-keys">
            <button type="button" className="xs-n-key" onClick={markAndNext}>{t.markNext}</button>
            <button type="button" className="xs-n-key" onClick={clearAnswer}>{t.clearResponse}</button>
            <button type="button" className="xs-n-key xs-n-key--save" onClick={saveAndNext}>{t.save}</button>
          </div>
        </div>

        <button type="button" className="xs-n-fold" aria-expanded={paletteOpen} aria-label={paletteOpen ? t.hidePalette : t.showPalette} onClick={() => setPaletteOpen((v) => !v)}>
          {paletteOpen ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
        </button>
        {paletteOpen ? (
          <aside className="xs-n-palette" aria-label={t.paletteTitle}>
            <ul className="xs-n-legend">{t.legend.map(([state, label]) => (
              <li key={state} data-state={state}><span className="xs-n-sym" data-state={state}>{tally[state]}</span>{label}</li>
            ))}</ul>
            <p className="xs-n-section">{EXAM.subject}</p>
            <p className="xs-n-title">{t.paletteTitle}</p>
            {chipGrid({ paletteTitle: t.paletteTitle, stateName: (state) => name[state] })}
            <button type="button" className="xs-n-submit" onClick={() => setReadBack((v) => !v)} aria-expanded={readBack}>{t.submit}</button>
            <p className="xs-readback" role="status">{readBack ? `${t.legend.map(([state, label]) => `${label.replace(/ \(.*\)$/, '')} ${tally[state]}`).join(', ')}.` : ''}</p>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
