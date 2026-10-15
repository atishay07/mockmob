"use client";

import { useEffect, useRef, useState } from 'react';
import { Check, Clock3, Monitor, RotateCcw, Sparkles } from 'lucide-react';

// Step 1 of How it works (web IA plan 4.2): the same five questions on the MockMob screen or the
// NTA-style one. Answers and review flags stay when the visitor switches. Nothing plays by itself:
// the demo clock starts only after the visitor acts, runs only while the console is on screen and
// the tab is visible, and stays still under reduced motion.
const QUESTIONS = [
  { text: 'Choose the option nearest in meaning to CANDID:', options: ['Hidden', 'Frank', 'Careful', 'Sweet'] },
  { text: 'Choose the correctly spelt word:', options: ['Accomodate', 'Acommodate', 'Accommodate', 'Accommadate'] },
  { text: 'Choose the opposite of ABUNDANT:', options: ['Plentiful', 'Scarce', 'Ample', 'Generous'] },
  { text: 'Complete the sentence: Neither of the answers ___ correct.', options: ['are', 'were', 'is', 'have'] },
  { text: 'Choose the meaning of “a blessing in disguise”:', options: ['An unexpected benefit', 'An obvious problem', 'A secret promise', 'A hurried decision'] },
];
// The NTA screen's own words for its palette states.
const LEGEND = [['unseen', 'Not visited'], ['skipped', 'Not answered'], ['answered', 'Answered'], ['review', 'Marked for review'], ['review-answered', 'Answered & marked for review']];

export function ExamComparator() {
  const [mode, setMode] = useState('mockmob');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [review, setReview] = useState({});
  const [visited, setVisited] = useState({ 0: true });
  const [notice, setNotice] = useState('Answer one, then switch screens. Your answers stay.');
  const [clock, setClock] = useState(3600);
  const [started, setStarted] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const consoleRef = useRef(null);
  useEffect(() => {
    const node = consoleRef.current;
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
  const clockText = `${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')}`;
  const question = QUESTIONS[index];
  const classic = mode === 'nta';
  function stateFor(i) {
    if (review[i]) return answers[i] !== undefined ? 'review-answered' : 'review';
    if (answers[i] !== undefined) return 'answered';
    return visited[i] ? 'skipped' : 'unseen';
  }
  function go(i) { setStarted(true); setIndex(i); setVisited((v) => ({ ...v, [i]: true })); }
  function next(mark) {
    setReview((v) => ({ ...v, [index]: mark }));
    if (index < QUESTIONS.length - 1) go(index + 1);
    else setNotice('That was the last of the five. Use the palette to go back to any of them.');
  }
  function reset() {
    setAnswers({}); setReview({}); setVisited({ 0: true }); setIndex(0); setStarted(false); setClock(3600);
    setNotice('Preview reset. Answer one, then switch screens.');
  }
  return (
    <div className="lp-exam-panel">
      <div className="lp-exam-switch" role="group" aria-label="Screen">
        <button type="button" aria-pressed={!classic} onClick={() => setMode('mockmob')}><Sparkles size={17} aria-hidden="true" />MockMob screen</button>
        <button type="button" aria-pressed={classic} onClick={() => setMode('nta')}><Monitor size={17} aria-hidden="true" />NTA-style screen</button>
      </div>
      <div className="lp-exam" data-interface={mode} ref={consoleRef}>
        <div className="lp-exam__bar"><span><span className="lp-exam__live" />{classic ? 'NTA-style screen, English' : 'MockMob screen, English'}</span><span className="lp-exam__sample">Preview</span><span className="lp-exam__clock" data-running={started && onScreen}><Clock3 size={15} aria-hidden="true" />{clockText}</span></div>
        <div className="lp-exam__body">
          <div className="lp-exam__paper">
            <div className="lp-exam__meta"><span>English</span><span>+5 right <i /> -1 wrong</span></div>
            <div className="lp-exam__question" aria-live="polite"><p className="lp-exam__number">Question {index + 1} <span>of 5 sample questions</span></p><h3>{question.text}</h3></div>
            <fieldset className="lp-exam__options"><legend className="lp-sr">Answer for question {index + 1}</legend>
              {question.options.map((option, i) => <label key={`${index}-${i}`} data-selected={answers[index] === i}>
                <input type="radio" name={`preview-answer-${index}`} checked={answers[index] === i} onChange={() => { setStarted(true); setAnswers((a) => ({ ...a, [index]: i })); }} />
                <span className="lp-exam__letter" aria-hidden="true">{'ABCD'[i]}</span><span>{option}</span>{answers[index] === i && <Check className="lp-exam__check" size={17} aria-hidden="true" />}
              </label>)}
            </fieldset>
            <div className="lp-exam__actions">
              <button type="button" className="lp-exam__review" onClick={() => next(true)}>Mark for Review & Next</button>
              <button type="button" onClick={() => setAnswers((a) => { const copy = { ...a }; delete copy[index]; return copy; })}>Clear response</button>
              <button type="button" className="lp-exam__save" onClick={() => next(false)}>Save & Next</button>
            </div>
          </div>
          <aside className="lp-exam__palette" aria-label="Question palette">
            <div className="lp-exam__palette-heading"><h4>Question Palette</h4><span>{Object.keys(answers).length} of 5 answered</span></div>
            {/* Five live cells, 45 decorative ones, one cell geometry. The button is the hit target and
                focus ring; the inner cell carries the exam shape, so NTA's shapes never clip the ring. */}
            <div className="lp-exam__numbers">{Array.from({ length: 50 }, (_, i) => i < 5
              ? <button key={i} type="button" className="lp-exam__num" aria-current={index === i ? 'step' : undefined} aria-label={`Question ${i + 1}, ${LEGEND.find(([s]) => s === stateFor(i))[1]}`} onClick={() => go(i)}><span className="lp-exam__cell" data-state={stateFor(i)}>{i + 1}</span></button>
              : <span key={i} className="lp-exam__num lp-exam__num--rest" aria-hidden="true"><span className="lp-exam__cell" data-state="unseen">{i + 1}</span></span>)}</div>
            <p className="lp-exam__palette-note">Questions 1 to 5 work here. A full mock has 50.</p>
            <p className="lp-exam__legend-title">Legend</p><ul className="lp-exam__legend">{LEGEND.map(([state, name]) => <li key={state}><span data-state={state} aria-hidden="true">{state === 'review-answered' ? <Check size={10} /> : ''}</span>{name}</li>)}</ul>
          </aside>
        </div>
        <div className="lp-exam__foot"><p role="status">{notice}</p><button type="button" onClick={reset}><RotateCcw size={14} aria-hidden="true" />Reset preview</button></div>
      </div>
    </div>
  );
}
