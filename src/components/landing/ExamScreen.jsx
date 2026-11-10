"use client";

// The home page's exam section (LK72 4 Nov; D6, LK91, LK92 5 Nov; R4-H6, LK129, R5 6 Nov 2026): one exam screen on a desktop
// monitor at every width, with a MockMob / NTA style switch beside it that keeps the answers and the timer.
// - The monitor (ExamDevice.jsx) holds a browser window whose address bar shows where the screen really lives
//   (mockmob.in/test, with interface=nta in NTA style, the address the runner reads). The screen is laid out at 880 x 550
//   design pixels and scales with the monitor as a whole, so a phone sees the same desktop screen, smaller: the round-2
//   picture the owner liked (LK129 reverted R3-D6's phone-native screen inside a drawn phone).
// - Phones (below 761 px) get one more key under the monitor, "Try it full screen": the same state in a full-screen view.
//   R5 (owner, 6 Nov 2026: "this full-screen mode on mobile: it should detect that it's mobile, and it should not make it
//   horizontal"; it replaces R4-H6's monitor screen drawn sideways): the view is the runner as it really is on a phone,
//   upright and in real pixels, never turned and never locked to landscape. MockMob is the runner below 1024 px
//   (TestPageClient.jsx): the saved note, the header (the attempt and subject, the timer, Question n of m and the answered
//   count under them), the chips, the question with Mark and Clear, the options, and its phone bar (Prev, Palette, Next),
//   whose Palette key raises its palette sheet (the counts, the 15 chips, the legend, Submit test). NTA style is the runner's
//   NTA style on a phone (nta-classic.css): the exam, the Question Paper icon and the Remaining Time on top, the section bar,
//   the question with NTA's circle arrows and radios, its five keys and its Question Palette sheet (PhoneNta). A bar above
//   the screen carries the close key and the same switch. Where the browser allows it (Android Chrome) the page also goes
//   full screen, upright. Escape, the close key, the back gesture (the view keeps one history entry of its own) or leaving the
//   browser's full screen closes it, and the focus goes back to the key. Turned sideways while open, the same screen uses the
//   width (exam-screen.css); nothing asks the student to turn the phone.
// - MockMob is our own screen, the runner's anatomy (src/app/(app)/test/TestPageClient.jsx): the saved note, the header
//   with Question n of m, the answered count and the timer, the chapter and difficulty chips, the stem, four options with
//   letter chips, Mark and Clear, the strike-out (press and hold an option), Previous and Next, and the review panel with
//   its word-labelled counters, chip grid and Submit. It follows the page theme (Night and Day), like the runner does.
// - NTA style is NTA's CBT screen as its guidelines describe it (CUET (UG) 2025 Information Bulletin, Appendix V): the
//   candidate's profile image, the Remaining Time and the Question Paper icon top right, the section on the top bar,
//   numbered radio options, NTA's three keys (EXAM.nta: mark-and-next, clear, save-and-next), the Question Palette on the right
//   with the section summary (a count in each of NTA's five symbols) above it, and the > arrow at its left that folds it
//   away. Clicking the chosen option again clears it, as the guidelines say. No strike-out: NTA has none.
// Every word comes from homeCopy.mjs (EXAM): NTA's words live only in EXAM.nta and are drawn only by NtaScreen and PhoneNta,
// which render only in NTA style; every MockMob-mode string is held against the runner's source by examPreviewParity.test.mjs.
// The questions are five real Accountancy items; the other ten chips stand as they would mid-paper. Nothing is submitted
// anywhere: Submit only reads the counts back. The screen is drawn in one place at a time: in the monitor, or in the view.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Clock3, FileText, Flag, Lock, Maximize2, RotateCw, ShieldCheck, X } from 'lucide-react';
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
const stillMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';

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
  // The full-screen view (phones; R4-H6, R5): open or not, the key that opened it (the focus goes back to it), and what it took
  // from the browser: its own full screen (a coarse pointer, where allowed) and one history entry, so the back gesture closes it.
  const [full, setFull] = useState(false);
  // R8 SEC-11: on a phone the monitor is a picture of the real screen (owner LK129), its keys 13-17 px. They are inert there
  // and a tap anywhere on the picture opens the same state full screen, where every key is full size. The visible
  // "Try it full screen" key below stays the way in for the keyboard and screen readers.
  const [pictureOnly, setPictureOnly] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px)');
    const sync = () => setPictureOnly(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  const fullOpener = useRef(null);
  const fullClose = useRef(null);
  const fullBox = useRef(null);
  const fullStage = useRef(null);
  const fullWas = useRef(false);
  const fullRequested = useRef(false);
  const ownsFullscreen = useRef(false);
  const ownsEntry = useRef(false);
  const fullAnchor = useRef(null);
  // The view's palette sheet, the runner's phone sheet: raised by the palette key in its bar, the focus to its close key and back.
  const [sheet, setSheet] = useState(false);
  const sheetBox = useRef(null);
  const sheetOpener = useRef(null);
  const sheetClose = useRef(null);
  const sheetWas = useRef(false);
  // The clock starts when the visitor first acts and runs only while the screen is on screen and the tab is visible.
  // Reduced motion keeps it still.
  const [clock, setClock] = useState(EXAM.startSeconds);
  const [started, setStarted] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const deviceRef = useRef(null);
  const press = useRef(null);
  const suppressClick = useRef(false);
  const pressStruck = useRef(false); // the long press crossed an option out: the context menu after it must not undo that
  const nta = mode === 'nta';
  const words = EXAM.mockmob;

  // The monitor is on screen (the view opens from beside it; the clock also runs while the view is open).
  useEffect(() => {
    const node = deviceRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!started || !(onScreen || full) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') setClock((s) => Math.max(0, s - 1)); }, 1000);
    return () => window.clearInterval(id);
  }, [started, onScreen, full]);
  // Where the key sat on screen when the view opened. Closing puts it back there (inside the window), so the student lands on
  // the exam section again even when the phone was turned while the view was open and the page reflowed under it.
  const keepPlace = useCallback(() => {
    const key = fullOpener.current;
    const top = fullAnchor.current;
    if (!key || top == null) return;
    const box = key.getBoundingClientRect();
    const shift = box.top - Math.max(16, Math.min(top, window.innerHeight - box.height - 16));
    if (Math.abs(shift) > 1) window.scrollBy({ top: shift, behavior: 'instant' });
  }, []);
  // The view lives on the page root (a fixed layer inside a section with content-visibility would be clipped to it); the
  // page under it does not scroll; the focus goes to its close key and comes back to the key that opened it.
  useLayoutEffect(() => {
    if (full) {
      const dialog = fullBox.current;
      dialog.showModal();
      const root = document.documentElement;
      const was = root.style.overflow;
      root.style.overflow = 'hidden';
      fullClose.current?.focus({ preventScroll: true });
      fullWas.current = true;
      // On a phone (a coarse pointer), where the browser allows it (Android Chrome), the view's stage goes full screen, upright
      // as the student holds it: no orientation lock and nothing turned (R5). The stage, not the page: a page made full screen
      // after the view opened is drawn over it (the top layer keeps the later one on top); and not the <dialog>, which the
      // Fullscreen API refuses.
      const stage = fullStage.current;
      if (fullRequested.current && stage && !document.fullscreenElement && stage.requestFullscreen && window.matchMedia('(pointer: coarse)').matches) {
        stage.requestFullscreen({ navigationUI: 'hide' }).then(() => {
          if (!fullRequested.current) return document.exitFullscreen?.();
          ownsFullscreen.current = true;
          return undefined;
        }).catch(() => {});
      }
      return () => { dialog.close(); root.style.overflow = was; };
    }
    if (fullWas.current) { fullWas.current = false; keepPlace(); fullOpener.current?.focus({ preventScroll: true }); }
    return undefined;
  }, [full, keepPlace]);
  // Closing gives back what the view took: the browser's full screen, and its history entry (unless the back gesture already
  // took it, or the router has since written over it: then it stays, a harmless step back to the same page).
  const closeFull = useCallback(() => {
    fullRequested.current = false;
    setFull(false);
    setSheet(false);
    if (ownsFullscreen.current) {
      ownsFullscreen.current = false;
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
    if (ownsEntry.current) {
      ownsEntry.current = false;
      if (window.history.state?.xsFull) {
        // The step back restores the scroll the browser kept for the page's entry; the key's place wins after it.
        window.addEventListener('popstate', () => requestAnimationFrame(keepPlace), { once: true });
        window.history.back();
      }
    }
  }, [keepPlace]);
  // The back gesture (the browser's back: iOS's swipe, Android's back where no full screen or dialog takes it first) and
  // leaving the browser's own full screen (Android's back gesture there) close the view too.
  useEffect(() => {
    if (!full) return undefined;
    const back = () => { if (!ownsEntry.current) return; ownsEntry.current = false; closeFull(); requestAnimationFrame(keepPlace); };
    const left = () => { if (!ownsFullscreen.current || document.fullscreenElement) return; ownsFullscreen.current = false; closeFull(); };
    window.addEventListener('popstate', back);
    document.addEventListener('fullscreenchange', left);
    return () => { window.removeEventListener('popstate', back); document.removeEventListener('fullscreenchange', left); };
  }, [full, closeFull, keepPlace]);
  const openFull = () => {
    if (full) return;
    fullRequested.current = true;
    fullAnchor.current = fullOpener.current ? fullOpener.current.getBoundingClientRect().top : null;
    setFull(true);
    // One history entry of the view's own (the router's state copied into it, so Next.js treats a step back or forward over it
    // as the same page): the back gesture closes the view instead of leaving the page.
    try {
      window.history.pushState({ ...(window.history.state || {}), xsFull: true }, '');
      ownsEntry.current = true;
    } catch { ownsEntry.current = false; }
  };
  // The palette sheet is a modal <dialog> over the view: the view behind it is inert; Escape, its close key, a chip or a press on
  // the dimmed screen lowers it (the phone's back gesture too, where the browser treats it as a close request).
  useLayoutEffect(() => {
    const el = sheetBox.current;
    if (sheet && el) {
      if (!el.open) { try { el.showModal(); } catch { el.setAttribute('open', ''); } }
      sheetClose.current?.focus({ preventScroll: true });
      sheetWas.current = true;
      const onCancel = (event) => { event.preventDefault(); setSheet(false); };
      const onClose = () => setSheet(false);
      el.addEventListener('cancel', onCancel);
      el.addEventListener('close', onClose);
      return () => { el.removeEventListener('cancel', onCancel); el.removeEventListener('close', onClose); if (el.open) el.close(); };
    }
    if (sheetWas.current) { sheetWas.current = false; sheetOpener.current?.focus({ preventScroll: true }); }
    return undefined;
  }, [sheet]);
  // A press on the dimmed screen around the sheet lands on the <dialog> itself, outside its box.
  const sheetScrim = (event) => {
    if (event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) setSheet(false);
  };

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
  // Pending is the runner's (TestPageClient.jsx pendingCount = questions - answered, R8 SEC-12): every question still to answer,
  // so Answered and Pending always add up to the paper. It was the visited-but-unanswered count, the state the legend and the
  // chips call "Not answered": one state with two names, and four tiles that summed to 16 on a 15-question paper.
  const counts = { answered, marked: count('marked', 'marked-answered'), pending: EXAM.total - answered, notvisited: count('notvisited') };

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
    pressStruck.current = false;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    cancelPress();
    press.current = { option, x: event.clientX, y: event.clientY, timer: window.setTimeout(() => { suppressClick.current = true; pressStruck.current = true; press.current = null; toggleStrike(option); }, LONG_PRESS_MS) };
  };
  function cancelPress() { if (press.current) { window.clearTimeout(press.current.timer); press.current = null; } }
  const movePress = (event) => { const p = press.current; if (p && Math.hypot(event.clientX - p.x, event.clientY - p.y) > 8) cancelPress(); };
  // A phone's long press also opens the context menu: the press has already crossed the option out (the runner guards it too).
  const strikeFromMenu = (event, option) => { event.preventDefault(); if (pressStruck.current) { pressStruck.current = false; return; } cancelPress(); toggleStrike(option); };
  const optionClick = (option) => { if (suppressClick.current) { suppressClick.current = false; return; } choose(option); };
  const optionKey = (event, option) => { if (event.shiftKey && event.key >= '1' && event.key <= '4' && Number(event.key) - 1 === option) { event.preventDefault(); toggleStrike(option); } };

  const reset = () => { setAnswers(EXAM.start.answers); setMarked(EXAM.start.marked); setVisited(Object.fromEntries(EXAM.start.visited.map((i) => [i, true]))); setStruck(EXAM.start.struck); setIndex(EXAM.start.index); setNoteOn(true); setStarted(false); setClock(EXAM.startSeconds); setReadBack(false); };

  const chipWord = words.chip[states[index]];
  const isStruck = (option) => (struck[index] || []).includes(option);
  const address = nta ? EXAM.address.nta : EXAM.address.mockmob;

  // The 15 chips, one grid for both interfaces: MockMob draws them as outlined chips, NTA style in NTA's own symbols. In the
  // view's palette sheet a pick also lowers the sheet, as the runner's does.
  const chipGrid = (names) => (
    <div className="xs-grid" role="group" aria-label={nta ? names.paletteTitle : words.paletteTitle}>
      {states.map((state, i) => (i < LIVE
        ? <button key={i} type="button" className="xs-chip" data-state={state} aria-current={index === i ? 'step' : undefined} aria-label={`Question ${i + 1}, ${names.stateName(state)}`} onClick={() => { go(i); setSheet(false); }}>{i + 1}</button>
        : <span key={i} className="xs-chip" data-state={state} aria-hidden="true">{i + 1}</span>))}
    </div>
  );
  const mockmobNames = { paletteTitle: words.paletteTitle, stateName: (state) => state.replace('-', ' and ') };
  // The four options with the runner's press-and-hold strike-out.
  const optionButtons = question.options.map((text, option) => {
    const selected = answers[index] === option;
    return (
      <button key={`${index}-${option}`} type="button" className="xs-option" aria-pressed={selected} data-struck={isStruck(option) || undefined}
        onPointerDown={(event) => startPress(event, option)} onPointerMove={movePress} onPointerUp={cancelPress} onPointerCancel={cancelPress} onPointerLeave={cancelPress}
        onContextMenu={(event) => strikeFromMenu(event, option)} onKeyDown={(event) => optionKey(event, option)} onClick={() => optionClick(option)}>
        <span className="xs-letter" aria-hidden="true">{LETTERS[option]}</span>
        <span className="xs-opt-text">{text}</span>
        {isStruck(option) ? <span className="lp-sr">, crossed out</span> : null}
      </button>
    );
  });
  // MockMob's parts, drawn by the monitor's screen or by the full-screen view (one at a time): where you are, the clock, the
  // question, and the review (counts, chips, legend, Submit).
  const progress = (
    <div className="xs-progress">
      <div><span>{words.questionOf(index + 1, EXAM.total)}</span><span>{words.answered(answered)}</span></div>
      <i aria-hidden="true"><b style={{ '--p': answered / EXAM.total }} /></i>
    </div>
  );
  const timer = (
    <div className="xs-timer" role="timer" aria-label={`${words.timer}: ${Math.floor(clock / 60)} minutes ${clock % 60} seconds`} data-running={started && (onScreen || full)}>
      <Clock3 aria-hidden="true" /><span>{mmss(clock)}</span>
    </div>
  );
  const paper = (
    <>
      <div className="xs-tags"><span>{question.chapter}</span><span>{question.difficulty}</span></div>
      <div className="xs-qhead">
        <div><h3>{words.heading(index + 1)}</h3><span className="xs-state" data-state={states[index]}>{chipWord}</span></div>
        <div className="xs-actions">
          <button type="button" className="xs-text" onClick={toggleMark} aria-pressed={Boolean(marked[index])}><Flag aria-hidden="true" />{marked[index] ? words.unmark : words.mark}</button>
          <button type="button" className="xs-text" onClick={clearAnswer}>{words.clear}</button>
        </div>
      </div>
      <p className="xs-stem" aria-live="polite">{question.text}</p>
      <div className="xs-options" role="group" aria-label={`Options for question ${index + 1}`}>{optionButtons}</div>
      {noteOn ? <p className="xs-note">{words.strikeNote}</p> : null}
    </>
  );
  const review = (
    <>
      <div className="xs-counters">{words.counters.map(([key, label]) => (
        <div key={key} data-k={key}><strong>{counts[key]}</strong><span>{label}</span></div>
      ))}</div>
      {chipGrid(mockmobNames)}
      <ul className="xs-legend">{words.legend.map(([state, label]) => <li key={state}><i data-state={state} aria-hidden="true" />{label}</li>)}</ul>
      <button type="button" className="xs-submit" onClick={() => setReadBack((v) => !v)} aria-expanded={readBack}>{words.submit}</button>
      <p className="xs-readback" role="status">{readBack ? `${words.counters[0][1]} ${counts.answered}, ${words.counters[2][1]} ${counts.pending}, ${words.counters[1][1]} ${counts.marked}.` : ''}</p>
    </>
  );
  // The monitor's screen: drawn in the monitor while the view is shut (never both: one timer, one set of live regions).
  const frame = (
    <div className="xs-frame" data-interface={mode} inert={pictureOnly || undefined}>
      <div className="xs-browser" aria-hidden="true">
        <span className="xs-browser__nav"><ChevronLeft /><ChevronRight /><RotateCw /></span>
        <span className="xs-url"><Lock /><span><b>{EXAM.address.host}</b>{address}</span></span>
      </div>

      {nta ? (
        <NtaScreen key="nta" index={index} question={question} answers={answers} states={states} clock={clock} started={started} onScreen={onScreen || full}
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
            {progress}
            {timer}
          </header>

          <div className="xs-body">
            <div className="xs-paper">
              {paper}
              <div className="xs-nav">
                <button type="button" className="xs-btn" disabled={index === 0} onClick={prev}>{words.previous}</button>
                <button type="button" className="xs-btn xs-btn--next" disabled={index === LIVE - 1} onClick={next}>{words.next}</button>
              </div>
            </div>

            <aside className="xs-review" aria-label={words.review}>
              <span className="xs-panel-title">{words.review}</span>
              {review}
            </aside>
          </div>
        </div>
      )}
    </div>
  );
  // The full-screen view's screen (R5): the same state as the runner draws it on a phone, upright, in real pixels. MockMob: the
  // runner's phone header (its close is the view's own key, in the bar above), the paper, the phone bar and the palette sheet;
  // NTA style: PhoneNta. The sheet sits inside the screen, so it takes the screen's skin.
  const phone = (
    <div className="xs-frame xs-phone" data-interface={mode}>
      {nta ? (
        <PhoneNta key="nta" index={index} question={question} answers={answers} states={states} answered={answered} clock={clock} started={started} onScreen={onScreen || full}
          readBack={readBack} setReadBack={setReadBack} choose={choose} clearAnswer={clearAnswer} markAndNext={markAndNext} saveAndNext={saveAndNext} prev={prev}
          chipGrid={chipGrid} sheet={sheet} setSheet={setSheet} sheetBox={sheetBox} sheetOpener={sheetOpener} sheetClose={sheetClose} sheetScrim={sheetScrim} />
      ) : (
        <div key="mockmob" className="xs-app xs-ph">
          <p className="xs-saved" role="status">{EXAM.saved}</p>
          <header className="xs-ph-head">
            <div className="xs-title"><div><span>{EXAM.attempt}</span><strong>{EXAM.subject}</strong></div></div>
            {progress}
            {timer}
          </header>
          <div className="xs-ph-paper">{paper}</div>
          <div className="xs-ph-bar">
            <button type="button" className="xs-btn" disabled={index === 0} onClick={prev}><ChevronLeft aria-hidden="true" />{words.prev}</button>
            <button ref={sheetOpener} type="button" className="xs-btn" aria-haspopup="dialog" aria-expanded={sheet} aria-label={words.paletteKey(answered, EXAM.total)} onClick={() => setSheet(true)}>{words.palette}</button>
            <button type="button" className="xs-btn xs-btn--next" disabled={index === LIVE - 1} onClick={next}>{words.next}<ChevronRight aria-hidden="true" /></button>
          </div>
          <dialog ref={sheetBox} className="xs-ph-sheet" aria-label={words.paletteSheet} onClick={sheetScrim}>
            <div className="xs-ph-sheet__head">
              <div><span>{words.paletteTitle}</span><strong>{words.answeredOf(answered, EXAM.total)}</strong></div>
              <button ref={sheetClose} type="button" className="xs-ph-sheet__close" aria-label={words.closePalette} onClick={() => setSheet(false)}><X aria-hidden="true" /></button>
            </div>
            {review}
          </dialog>
        </div>
      )}
    </div>
  );
  const switchKeys = (
    <>
      <button type="button" aria-pressed={!nta} onClick={() => setMode('mockmob')}>{words.interface}</button>
      <button type="button" aria-pressed={nta} onClick={() => setMode('nta')}>{EXAM.nta.interface}<small>Pro</small></button>
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

        {/* The switch is the visitor's, not the exam's: it sits beside the monitor at full size at every width. */}
        <div className="xs-switch" role="group" aria-label={words.switchLabel}>{switchKeys}</div>

        <ExamDevice ref={deviceRef}>
          {full ? <div className="xs-frame xs-frame--away" aria-hidden="true" /> : frame}
          {pictureOnly && !full ? <button type="button" className="xs-tap" tabIndex={-1} aria-hidden="true" onClick={openFull} /> : null}
        </ExamDevice>

        {/* R10: NTA mode's own gate (ExamIntegrityGuard's words), set as a small card: a mark, the words (with the
            warning rule in one plain sentence; R11 dropped the "Warnings 0/3" pill, which did nothing) and the way to it. */}
        <div className="xs-gate">
          <span className="xs-gate__mark" aria-hidden="true"><ShieldCheck /></span>
          <p className="xs-gate__text"><b>{EXAM.gateTitle}.</b> {EXAM.gate} {EXAM.warningRule}</p>
          <p className="xs-gate__foot">
            <Link href={user?.isPremium ? `/dashboard?mode=nta&interface=${mode}` : '/pricing'} className="lp-link">{user?.isPremium ? EXAM.ctaPro : EXAM.ctaFree}</Link></p>
        </div>
        {/* Phones only (exam-screen.css): the readable way into the same screen. */}
        <button ref={fullOpener} type="button" className="mm-btn mm-btn--secondary xs-full-open" aria-haspopup="dialog" aria-expanded={full} onClick={openFull}>
          <Maximize2 aria-hidden="true" />{EXAM.full.open}
        </button>
        </div>
      </div>
      {/* Only ever open after a tap, so the document is there to host it. React bubbles a nested dialog's cancel (the palette
          sheet's Escape) up to this one's onCancel, so only the view's own closes the view. */}
      {full ? createPortal(
        <dialog className="xs-full" aria-label={EXAM.full.title} onCancel={(event) => { if (event.target !== event.currentTarget) return; event.preventDefault(); closeFull(); }} ref={fullBox}>
          <div ref={fullStage} className="xs-full__stage">
            <div className="xs-full__bar">
              <button ref={fullClose} type="button" className="xs-full__close" aria-label={EXAM.full.close} onClick={closeFull}><X aria-hidden="true" /></button>
              <div className="xs-switch" role="group" aria-label={words.switchLabel}>{switchKeys}</div>
            </div>
            {phone}
          </div>
        </dialog>, document.querySelector('.mm.lp') || document.body) : null}
    </section>
  );
}

// NTA style: drawn only while the visitor has picked it (the one place EXAM.nta's screen words are read, with PhoneNta).
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

// NTA style in the full-screen view (R5): drawn only while the visitor has picked NTA style. The runner's NTA style on a phone
// (nta-classic.css below 1024 px): the exam's name, the Question Paper icon and the Remaining Time on top (the candidate's name,
// subject and photo fold away), the section bar, the question with NTA's grey circle arrows (down to its end, up to its top)
// and numbered radios, and its five keys one tap away: Previous, the clear key and the palette key, then the mark key and the
// save key (EXAM.nta's words). The palette key raises NTA's palette sheet: the section summary with a count in each symbol,
// the section, the palette and Submit.
function PhoneNta({ index, question, answers, states, answered, clock, started, onScreen, readBack, setReadBack, choose, clearAnswer, markAndNext, saveAndNext, prev, chipGrid, sheet, setSheet, sheetBox, sheetOpener, sheetClose, sheetScrim }) {
  const t = EXAM.nta;
  const name = Object.fromEntries(t.legend);
  const tally = Object.fromEntries(t.legend.map(([state]) => [state, states.filter((s) => s === state).length]));
  const pick = (option) => (answers[index] === option ? clearAnswer() : choose(option));
  const pane = useRef(null);
  const scrollPane = (toEnd) => { const el = pane.current; if (el) el.scrollTo({ top: toEnd ? el.scrollHeight : 0, behavior: stillMotion() ? 'auto' : 'smooth' }); };
  return (
    <div className="xs-nta xs-ph-nta">
      <header className="xs-n-head">
        <strong className="xs-n-exam">{t.exam}</strong>
        <div className="xs-n-tools">
          <span className="xs-n-paper"><FileText aria-hidden="true" />{t.questionPaper}</span>
          <div className="xs-ph-time"><span>{t.remaining}</span><span className="xs-n-time" role="timer" aria-label={`${t.remaining}: ${Math.floor(clock / 60)} minutes ${clock % 60} seconds`} data-running={started && onScreen}>{hhmmss(clock)}</span></div>
        </div>
      </header>
      <div className="xs-n-sections"><span className="xs-n-tab" aria-current="true">{EXAM.subject}</span></div>

      <div className="xs-ph-pane" ref={pane}>
        <div className="xs-n-qhead">
          <h3>{t.question(index + 1)}</h3>
          <button type="button" className="xs-ph-arrow" aria-label={t.toEnd} onClick={() => scrollPane(true)}><ArrowDown aria-hidden="true" /></button>
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
        <div className="xs-ph-end">
          <button type="button" className="xs-ph-arrow" aria-label={t.toTop} onClick={() => scrollPane(false)}><ArrowUp aria-hidden="true" /></button>
        </div>
      </div>

      <div className="xs-ph-keys">
        <button type="button" className="xs-n-key" disabled={index === 0} onClick={prev}>{EXAM.mockmob.previous}</button>
        <button type="button" className="xs-n-key" disabled={answers[index] === undefined} onClick={clearAnswer}>{t.clearResponse}</button>
        <button ref={sheetOpener} type="button" className="xs-n-key" aria-haspopup="dialog" aria-expanded={sheet} aria-label={EXAM.mockmob.paletteKey(answered, EXAM.total)} onClick={() => setSheet(true)}>{t.paletteTitle}</button>
        <button type="button" className="xs-n-key xs-n-key--review" onClick={markAndNext}>{t.markNext}</button>
        <button type="button" className="xs-n-key xs-n-key--save" onClick={saveAndNext}>{t.save}</button>
      </div>

      <dialog ref={sheetBox} className="xs-ph-sheet" aria-label={t.paletteTitle} onClick={sheetScrim}>
        <div className="xs-ph-sheet__head">
          <strong>{t.paletteTitle}</strong>
          <button ref={sheetClose} type="button" className="xs-ph-sheet__close" aria-label={EXAM.mockmob.closePalette} onClick={() => setSheet(false)}><X aria-hidden="true" /></button>
        </div>
        <ul className="xs-n-legend">{t.legend.map(([state, label]) => (
          <li key={state} data-state={state}><span className="xs-n-sym" data-state={state}>{tally[state]}</span>{label}</li>
        ))}</ul>
        <p className="xs-n-section">{EXAM.subject}</p>
        {chipGrid({ paletteTitle: t.paletteTitle, stateName: (state) => name[state] })}
        <button type="button" className="xs-n-submit" onClick={() => setReadBack((v) => !v)} aria-expanded={readBack}>{t.submit}</button>
        <p className="xs-readback" role="status">{readBack ? `${t.legend.map(([state, label]) => `${label.replace(/ \(.*\)$/, '')} ${tally[state]}`).join(', ')}.` : ''}</p>
      </dialog>
    </div>
  );
}
