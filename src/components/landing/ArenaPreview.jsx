"use client";

import { useEffect, useRef, useState } from 'react';

// Auto-playing product preview: a real CUET-style question types itself out,
// options land, the mob's answer split fills, the correct option locks in and
// the score ticks up. Honest by design: labelled "Arena preview", no fake
// usernames. Pauses off-screen; reduced motion shows a solved static frame.
const QUESTIONS = [
  {
    subject: 'Economics',
    chapter: 'National Income',
    q: 'If nominal GDP rises 12% and the GDP deflator rises 5%, real GDP grows by approximately:',
    options: ['5%', '7%', '12%', '17%'],
    correct: 1,
    split: [9, 68, 14, 9],
    seconds: 14,
  },
  {
    subject: 'English',
    chapter: 'Vocabulary',
    q: 'Choose the word closest in meaning to EPHEMERAL:',
    options: ['Eternal', 'Fleeting', 'Fragile', 'Elegant'],
    correct: 1,
    split: [6, 74, 15, 5],
    seconds: 9,
  },
  {
    subject: 'Accountancy',
    chapter: 'Partnership',
    q: 'On admission of a partner, general reserve appearing in the balance sheet is transferred to:',
    options: [
      'New partner’s capital a/c',
      'Old partners in old ratio',
      'All partners in new ratio',
      'Revaluation account',
    ],
    correct: 1,
    split: [8, 61, 22, 9],
    seconds: 16,
  },
];

const PHASE = { TYPING: 'typing', OPTIONS: 'options', REVEAL: 'reveal', HOLD: 'hold' };

export function ArenaPreview() {
  const [qIndex, setQIndex] = useState(0);
  // Typed text is DERIVED from the current question + charCount, so the
  // question body can never desync from its meta/options mid-transition.
  const [charCount, setCharCount] = useState(0);
  const [phase, setPhase] = useState(PHASE.TYPING);
  const [score, setScore] = useState(240);
  const [staticMode, setStaticMode] = useState(false);
  const hostRef = useRef(null);
  const timersRef = useRef([]);
  const activeRef = useRef(true);

  const question = QUESTIONS[qIndex];
  const typed = question.q.slice(0, charCount);

  function clearTimers() {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const id = window.setTimeout(() => {
        setStaticMode(true);
        setCharCount(QUESTIONS[0].q.length);
        setPhase(PHASE.REVEAL);
      }, 0);
      return () => window.clearTimeout(id);
    }

    const observer = new IntersectionObserver(([entry]) => {
      activeRef.current = entry.isIntersecting;
    }, { threshold: 0.15 });
    if (hostRef.current) observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (staticMode) return undefined;
    clearTimers();

    let i = 0;
    const length = QUESTIONS[qIndex].q.length;
    function typeNext() {
      if (!activeRef.current) {
        timersRef.current.push(window.setTimeout(typeNext, 600));
        return;
      }
      i = Math.min(i + 3, length);
      setCharCount(i);
      if (i < length) {
        timersRef.current.push(window.setTimeout(typeNext, 24));
      } else {
        setPhase(PHASE.OPTIONS);
        timersRef.current.push(window.setTimeout(() => {
          setPhase(PHASE.REVEAL);
          setScore((s) => s + 4);
          timersRef.current.push(window.setTimeout(() => {
            setQIndex((idx) => (idx + 1) % QUESTIONS.length);
          }, 2600));
        }, 1700));
      }
    }
    // Reset happens inside a scheduled tick (not synchronously in the effect
    // body) to avoid cascading renders; typing starts shortly after.
    timersRef.current.push(window.setTimeout(() => {
      setCharCount(0);
      setPhase(PHASE.TYPING);
    }, 0));
    timersRef.current.push(window.setTimeout(typeNext, 400));
    return clearTimers;
  }, [qIndex, staticMode]);

  const showOptions = phase === PHASE.OPTIONS || phase === PHASE.REVEAL;
  const revealed = phase === PHASE.REVEAL;

  return (
    <div ref={hostRef} className="arena-preview" aria-label="Preview of a MockMob arena question">
      <div className="arena-preview-top">
        <span className="arena-live-dot" aria-hidden="true" />
        <span className="arena-preview-label">Arena preview</span>
        <span className="arena-preview-meta">
          {question.subject} · {question.chapter}
        </span>
      </div>

      <div className="arena-preview-timer" aria-hidden="true">
        <span className="arena-preview-timerfill" style={{ animationDuration: revealed ? '0s' : '4.5s' }} />
      </div>

      <p className="arena-preview-q">
        {typed}
        {!revealed && !staticMode ? <span className="arena-caret" aria-hidden="true" /> : null}
      </p>

      <div className="arena-preview-options" style={{ opacity: showOptions ? 1 : 0 }}>
        {question.options.map((option, index) => {
          const isCorrect = index === question.correct;
          return (
            <div
              key={option}
              className={`arena-preview-option ${revealed && isCorrect ? 'is-correct' : ''} ${revealed && !isCorrect ? 'is-dim' : ''}`}
            >
              <span className="arena-preview-key">{String.fromCharCode(65 + index)}</span>
              <span className="arena-preview-text">{option}</span>
              <span className="arena-preview-split" aria-hidden="true">
                <span
                  className="arena-preview-splitfill"
                  style={{ width: revealed ? `${question.split[index]}%` : '0%' }}
                />
              </span>
              <span className="arena-preview-pct">{revealed ? `${question.split[index]}%` : ''}</span>
            </div>
          );
        })}
      </div>

      <div className="arena-preview-foot">
        <span>
          Mob solved in <strong>{question.seconds}s</strong>
        </span>
        <span className="arena-preview-score">
          XP <strong>{score}</strong>
        </span>
      </div>
    </div>
  );
}
