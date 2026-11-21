'use client';

// The Learn row's screen for the home page's one-place frame (owner LK365, 21 Nov 2026). Played by learnStory.mjs's script
// through the demo cursor (demo/CursorDemo.jsx); every change of state is a real click on a real control here, and a reader
// can work it by hand after the demo (or under reduced motion, where no script runs).
//
// What it mirrors (the real Learn, src/components/study/*, seen at /preview/study at 390x844):
//   list    StudyLibrary.jsx: the subject's lessons, each under its chapter, with its minutes and cards
//           (LessonOverview.jsx words a lesson "A 7-minute lesson and 5 cards").
//   lesson  StudyRun.jsx in a lesson: "Lesson: <title>", "Step 5 of 9", the pips, the block's label in the accent colour,
//           its title, then StudyBlocks.jsx ReadingBlock (the worked example's body and its table).
//   recall  StudyRun.jsx in a recall run: "Recall: <card>", "Card 1 of 5", the card's label and prompt, AnswerForm's lettered
//           options and "Check answer", then ResultOptions (the right row ringed, a wrong pick crossed, "Your answer") and
//           Feedback ("Not quite" with the option's note and the explanation) and its "Next" key.
//   strip   When the cards come back: the study scheduler's real intervals (learnStory.mjs LEARN_SCHEDULE, held to
//           data/study_scheduler.mjs by data/tests/story_learn_1121.test.mjs).
//
// Phases (data-phase on the root): list -> lesson -> recall -> answered -> schedule. All layers share one fixed-size screen
// (500 px tall in a narrow container, 548 px from 640 px), so its height never changes. Below 640 px each layer slides over
// the one before it like a card laid on a stack; from 640 px the lessons stay in a left column and the layers stack on the
// right. Motion is transform and opacity only, from data-phase and the cursor's data-demo-focus (learn-story.css).
import { useState } from 'react';
import { BookOpen, Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { LEARN_CARD, LEARN_FREE, LEARN_LESSON, LEARN_LESSONS, LEARN_STRIP, LEARN_SUBJECT, lessonCount } from './learnStory.mjs';
import './learn-story.css';

const LETTERS = 'ABCD';
const RECALL = new Set(['recall', 'answered', 'schedule']);

export default function LearnStory({ lessons = 0, subjects = 0 }) {
  const [phase, setPhase] = useState('list');
  const [picked, setPicked] = useState(null);
  const lesson = LEARN_LESSONS.find((l) => l.id === LEARN_LESSON.id) || LEARN_LESSONS[0];
  const answered = phase === 'answered' || phase === 'schedule';
  const missed = answered && picked !== LEARN_CARD.right;
  const count = lessonCount(lessons, subjects);
  // The worked example's setup: its first sentence, and the rest of the lead (the whole is the block's body, word for word).
  const [setup, ...more] = LEARN_LESSON.lead.split(/(?<=\.) /);
  const rest = more.join(' ');

  const open = () => { setPicked(null); setPhase('lesson'); };
  const toList = () => { setPicked(null); setPhase('list'); };
  const lock = () => { setPicked(null); setPhase('recall'); };
  const check = () => { if (picked !== null) setPhase('answered'); };

  const lessonOn = phase !== 'list';
  const recallOn = RECALL.has(phase);
  const sheetOn = phase === 'schedule';

  return (
    <div className="st st-learn" data-phase={phase} data-missed={missed || undefined}>
      <div className="st-learn__screen">
        {/* The subject's lessons (StudyLibrary.jsx). */}
        <section className="st-learn__layer st-learn__list" aria-label={`${LEARN_SUBJECT} lessons`} inert={lessonOn ? true : undefined} data-under={lessonOn || undefined}>
          <p className="st-learn__app">Learn</p>
          <p className="st-learn__sub">Short lessons on the ideas behind your mistakes.</p>
          <p className="st-learn__subject"><BookOpen size={16} strokeWidth={2} aria-hidden="true" />{LEARN_SUBJECT}<span>{LEARN_LESSONS.length} lessons</span></p>
          <ul className="st-learn__lessons">
            {LEARN_LESSONS.map((l) => {
              const body = (<>
                <span className="st-learn__chap">{l.chapter}</span>
                <b className="st-learn__ltitle">{l.title}</b>
                <span className="st-learn__meta">{l.minutes} min lesson · {l.cards} cards</span>
              </>);
              return (
                <li key={l.id}>
                  {l.id === lesson.id
                    ? <button type="button" className="st-learn__lesson st-learn__fx" data-demo="learn-open" data-open={lessonOn || undefined} onClick={open}>{body}<ChevronRight className="st-learn__chev" size={18} aria-hidden="true" /></button>
                    : <div className="st-learn__lesson st-learn__fx">{body}</div>}
                </li>
              );
            })}
          </ul>
        </section>

        <div className="st-learn__main">
          {/* From 640 px only: the right column before a lesson is opened. */}
          <div className="st-learn__intro" aria-hidden="true">
            <BookOpen size={22} strokeWidth={1.8} />
            <p>Pick a lesson to open it here.</p>
          </div>

          {/* The lesson, on its worked example (StudyRun.jsx + StudyBlocks.jsx ReadingBlock). */}
          <section className="st-learn__layer st-learn__lessonview" aria-label={`Lesson: ${lesson.title}`} data-on={lessonOn || undefined} data-under={recallOn || undefined} inert={!lessonOn || recallOn ? true : undefined}>
            <div className="st-learn__runhead">
              <button type="button" className="st-learn__back" onClick={toList} aria-label="Back to the lessons"><ChevronLeft size={20} aria-hidden="true" /></button>
              <p className="st-learn__runtitle">Lesson: {lesson.title}</p>
            </div>
            <div className="st-learn__progress">
              <ol className="st-learn__pips" aria-hidden="true">{Array.from({ length: LEARN_LESSON.steps }, (_, i) => <li key={i} data-s={i < LEARN_LESSON.step - 1 ? 'done' : i === LEARN_LESSON.step - 1 ? 'now' : undefined} />)}</ol>
              <span className="st-learn__count">Step {LEARN_LESSON.step} of {LEARN_LESSON.steps}</span>
            </div>
            <div className="st-learn__worked st-learn__fx">
              <p className="st-learn__label">{LEARN_LESSON.label}</p>
              <h4 className="st-learn__h">{LEARN_LESSON.title}</h4>
              {/* In a narrow screen the setup's first sentence alone (the table then tells the rest, a row at a time); from 640 px
                  the block's whole body, its key line under the highlighter. */}
              <p className="st-learn__body">{setup}<span className="st-learn__more"> {rest} <mark className="st-learn__key"><span>{LEARN_LESSON.key}</span></mark> {LEARN_LESSON.tail}</span></p>
              <table className="st-learn__table">
                <thead><tr>{LEARN_LESSON.head.map((h) => <th key={h} scope="col">{h.replace(' (over 6)', '')}</th>)}</tr></thead>
                <tbody>{LEARN_LESSON.rows.map((row, r) => (
                  <tr key={row[0]} data-key={r === LEARN_LESSON.keyRow || undefined} style={{ '--r': r }}>{row.map((cell, c) => (c === 0 ? <th key={c} scope="row">{cell}</th> : <td key={c}>{cell}</td>))}</tr>
                ))}</tbody>
              </table>
            </div>
            <button type="button" className="st-learn__volt st-learn__fx" data-demo="learn-lock" onClick={lock}>Lock it in with {lesson.cards} cards</button>
          </section>

          {/* The lesson's first recall card (StudyRun.jsx recall, AnswerForm, ResultOptions, Feedback). */}
          <section className="st-learn__layer st-learn__recall" aria-label={`Recall: ${LEARN_CARD.title}`} data-on={recallOn || undefined} inert={!recallOn || sheetOn ? true : undefined}>
            <div className="st-learn__runhead st-learn__runhead--card">
              <p className="st-learn__runtitle">Recall: {LEARN_CARD.title}</p>
              <span className="st-learn__count">Card 1 of {lesson.cards}</span>
            </div>
            <ol className="st-learn__pips" aria-hidden="true">{Array.from({ length: lesson.cards }, (_, i) => <li key={i} data-s={i === 0 ? 'now' : undefined} />)}</ol>
            <div className="st-learn__card">
              <p className="st-learn__label">{LEARN_CARD.label}</p>
              <h4 className="st-learn__prompt">{LEARN_CARD.prompt}</h4>
              <ul className="st-learn__opts st-learn__fx" aria-label="Answer options">
                {LEARN_CARD.options.map((o, i) => {
                  const right = answered && i === LEARN_CARD.right;
                  const miss = answered && i === picked && i !== LEARN_CARD.right;
                  const words = right ? (i === picked ? 'Your answer' : 'Correct answer') : miss ? 'Your answer' : null;
                  return (
                    <li key={o}>
                      <button type="button" className="st-learn__opt" data-demo="learn-option" data-i={i} aria-pressed={picked === i}
                        data-state={right ? 'right' : miss ? 'miss' : picked === i ? 'picked' : undefined} disabled={answered} onClick={() => setPicked(i)}>
                        <span className="st-learn__letter" aria-hidden="true">{LETTERS[i]}</span>
                        <span className="st-learn__otext">{o}{words ? <small>{words}</small> : null}</span>
                        {right ? <Check className="st-learn__mark" size={18} strokeWidth={2.6} aria-hidden="true" /> : miss ? <X className="st-learn__mark" size={18} strokeWidth={2.6} aria-hidden="true" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="st-learn__answer st-learn__fx">
                <button type="button" className="st-learn__volt st-learn__check" data-demo="learn-check" disabled={picked === null} onClick={check} inert={answered ? true : undefined}>Check answer</button>
                <div className="st-learn__feedback" role="status" aria-live="polite" inert={answered ? undefined : true}>
                  {answered ? <>
                    <p className="st-learn__fhead">{missed ? <><X size={18} strokeWidth={2.6} aria-hidden="true" />Not quite</> : <><Check size={18} strokeWidth={2.6} aria-hidden="true" />Correct</>}</p>
                    <button type="button" className="st-learn__volt st-learn__next" data-demo="learn-next" onClick={() => setPhase('schedule')}>Next</button>
                    <p className="st-learn__fline">{missed && LEARN_CARD.notes[picked] ? `${LEARN_CARD.notes[picked]} ` : ''}{LEARN_CARD.explanation}</p>
                  </> : null}
                </div>
              </div>
            </div>
          </section>

          {/* When the cards come back: the study scheduler's real intervals (learnStory.mjs LEARN_SCHEDULE). */}
          <section className="st-learn__sheet st-learn__strip" aria-label={LEARN_STRIP.title} data-on={sheetOn || undefined} inert={sheetOn ? undefined : true}>
            <p className="st-learn__stitle">{LEARN_STRIP.title}</p>
            <div className="st-learn__lane" data-lane="missed">
              <p className="st-learn__lname"><X size={16} strokeWidth={2.6} aria-hidden="true" /><b>{missed ? LEARN_CARD.title : LEARN_CARD.other}</b></p>
              <p className="st-learn__lwhen">{LEARN_STRIP.missed}</p>
              <div className="st-learn__track" aria-hidden="true"><span className="st-learn__run"><i className="st-learn__dot" /></span></div>
            </div>
            <div className="st-learn__lane" data-lane="known">
              <p className="st-learn__lname"><Check size={16} strokeWidth={2.6} aria-hidden="true" /><b>{missed ? LEARN_CARD.other : LEARN_CARD.title}</b></p>
              <p className="st-learn__lwhen">{LEARN_STRIP.known}</p>
              <div className="st-learn__track" aria-hidden="true">
                <span className="st-learn__run st-learn__run--ghost"><i className="st-learn__dot" /></span>
                <span className="st-learn__run"><i className="st-learn__dot" /></span>
              </div>
            </div>
            <ol className="st-learn__ticks">{LEARN_STRIP.ticks.map((t) => <li key={t}>{t}</li>)}</ol>
            <div className="st-learn__foot">
              <p>{count ? <>{count}. </> : null}{LEARN_FREE}.</p>
              <button type="button" className="st-learn__again" data-demo="learn-back" onClick={toList}>Back to lessons</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
