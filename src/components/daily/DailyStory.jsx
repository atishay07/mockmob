'use client';

// The Daily Five's screen in the home page's demo (owner LK365, 21 Nov 2026; tmp/1121-stories/DAILY-SPEC.md "Your five").
// One sample student's five, drawn the way /daily draws them for a signed-in student: the five with why each is there
// (the head "Your five for today", the mix line and each place's reason, src/lib/dailyFiveMine.mjs), a question as /daily
// shows it (DailyFive.jsx: the bubbles, the reason above the stem, four lettered options, "Correct." and the reason, the
// Next key), then the day's end (the bubbles, the run of days stepping up by one, "What today's five did").
// The demo cursor (landing/demo/CursorDemo.jsx) works it with real clicks on the buttons below (data-demo hooks); a reader
// can work it by hand the same way, in any order. The words and the sample are dailyStoryScript.mjs's.
//
// Layout: the three screens share one grid cell, so the card's height never changes between them (no layout shift). Motion
// is CSS keyed off data-phase (daily-story.css), transform and opacity only. `rest` (reduced motion) shows the day's end.
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icons';
import { ANSWER_LETTERS as LETTERS } from '@/lib/dailyFiveAccount.mjs';
import { fedCounts, fedLines } from '@/lib/dailyFiveMine.mjs';
import { OmrFive } from './DailyTeam';
import { STORY_FED, STORY_FIVE, STORY_QUESTION, STORY_SLOTS, STORY_STREAK, STORY_WORDS } from './dailyStoryScript.mjs';
import './daily-story.css';

const GROUPS = ['missed', 'weak', 'subject'];

export default function DailyStory({ rest = false }) {
  // 'list' (the five) -> 'q' (place 1, then answered once `picked` is set) -> 'day' (after all five).
  const [phase, setPhase] = useState('list');
  const [picked, setPicked] = useState(null);
  // Reduced motion: no script plays, so the screen rests on the day's end (as the demo would leave it).
  useEffect(() => {
    if (!rest) return undefined;
    const t = window.setTimeout(() => { setPicked(STORY_QUESTION.right); setPhase('day'); }, 0);
    return () => window.clearTimeout(t);
  }, [rest]);

  const answered = picked !== null;
  const right = answered && picked === STORY_QUESTION.right;
  // Place 1 is the one answered here; places 2 to 5 are the sample's own marks (the day's end).
  const marks = STORY_FIVE.map((p, i) => (i === 0 ? (answered ? right : null) : p.mark));
  const fed = STORY_FED.map((f, i) => (i === 0 ? (right ? 'fixed' : 'mistakes') : f));
  const did = fedLines(fedCounts(fed));
  const score = marks.filter((m) => m === true).length;
  const open = () => { if (phase === 'list') setPhase('q'); };
  const pick = (i) => { if (!answered) setPicked(i); };
  const again = () => { setPicked(null); setPhase('list'); };
  const off = (p) => phase !== p || undefined;

  return (
    <div className="st st-daily dst" data-phase={phase} data-answered={answered ? (right ? 'right' : 'wrong') : undefined}>
      <div className="dst-top">
        <b className="dst-top__head">{STORY_WORDS.head}</b>
        <span className="dst-top__ex">{STORY_WORDS.example}</span>
      </div>
      <div className="dst-cell">
        {/* The five and why each is there. */}
        <div className="dst-view dst-list" inert={off('list')} aria-hidden={off('list')}>
          <p className="dst-mix">{STORY_WORDS.mix}</p>
          <div className="dst-slots">
            {GROUPS.map((kind) => (
              <div key={kind} className="dst-group" data-kind-group={kind} data-part="">
                {STORY_SLOTS.filter((s) => s.kind === kind).map((s) => (
                  <button key={s.n} type="button" className="dst-slot" data-kind={s.kind} data-demo={`daily-slot-${s.n}`} onClick={open}>
                    <span className="dst-slot__n" aria-hidden="true">{s.n}</span>
                    <span className="dst-slot__text">
                      <b>{s.label}</b>
                      <span>{s.kind === 'missed' ? `${s.subject} · ${s.chapter}` : s.kind === 'weak' ? s.subject : s.chapter}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Place 1, as /daily asks it. */}
        <div className="dst-view dst-q" inert={off('q')} aria-hidden={off('q')}>
          <div className="dst-q__bar" data-part="">
            <OmrFive marks={answered ? [right, null, null, null, null] : null} current={0} label="Question 1 of 5" />
          </div>
          {/* Why it is here and the question, one part (the demo's beat 2 holds both in focus). */}
          <div className="dst-q__ask" data-part="">
            <p className="dst-q__why"><b>{STORY_SLOTS[0].label}</b><span>{STORY_SLOTS[0].subject}</span></p>
            <p className="dst-q__stem">{STORY_QUESTION.q}</p>
          </div>
          <div className="dst-q__options" data-part="" role="group" aria-label="Answer options">
            {STORY_QUESTION.options.map((option, i) => {
              const state = !answered ? 'idle' : i === STORY_QUESTION.right ? 'correct' : i === picked ? 'wrong' : 'muted';
              return (
                <button key={option} type="button" className="dst-opt" data-state={state} data-demo={`daily-pick-${LETTERS[i]}`} onClick={() => pick(i)} aria-pressed={i === picked || undefined}>
                  {/* The letter, or the verdict in its place once answered (/daily shows the verdict at the row's end; a
                      narrow card keeps four options in two rows, so it takes the letter's square). */}
                  <span className="dst-opt__key" aria-hidden="true">{state === 'correct' ? <Icon name="check" className="dst-opt__icon" /> : state === 'wrong' ? <Icon name="x" className="dst-opt__icon" /> : LETTERS[i]}</span>
                  <span className="dst-opt__label">{option}</span>
                  {state === 'correct' ? <span className="sr-only">, right answer</span> : state === 'wrong' ? <span className="sr-only">, your pick, wrong</span> : null}
                </button>
              );
            })}
          </div>
          <div className="dst-q__foot" data-part="" aria-live="polite">
            <p className="dst-q__said">
              {answered ? <><strong>{right ? STORY_WORDS.correct : 'Not quite.'}</strong> {STORY_QUESTION.why}</> : ' '}
            </p>
            <div className="dst-q__row">
              <span className="dst-chip" data-tone={right ? 'fixed' : 'sent'}>{answered ? (right ? STORY_WORDS.fixed : 'Back in your mistakes') : ' '}</span>
              <button type="button" className="dst-next" data-demo="daily-next" onClick={() => { if (answered) setPhase('day'); }} disabled={!answered}>{STORY_WORDS.next}</button>
            </div>
          </div>
        </div>

        {/* After all five: the run of days steps up, and what the five did. */}
        <div className="dst-view dst-day" inert={off('day')} aria-hidden={off('day')}>
          <div className="dst-day__top" data-part="">
            <span className="dst-day__tag">{STORY_WORDS.after}</span>
            <span className="dst-day__score">{score}/5 today</span>
            <OmrFive marks={marks.map((m) => m === true)} label={`${score} of 5 right`} />
          </div>
          <div className="dst-day__streak" data-part="">
            <p className="dst-day__run">
              <span className="dst-day__num" aria-hidden="true"><span>{STORY_STREAK.before}</span><span>{STORY_STREAK.after}</span></span>
              <span className="sr-only">{STORY_STREAK.after} </span>
              <span className="dst-day__unit">{STORY_WORDS.dayUnit}</span>
            </p>
            <ol className="dst-day__week" aria-label={`The last seven days, all played`}>
              {STORY_STREAK.days.map((d, i) => (
                <li key={i} data-today={i === STORY_STREAK.days.length - 1 || undefined}><i aria-hidden="true" /><span>{d}</span></li>
              ))}
            </ol>
          </div>
          <div className="dst-day__did" data-part="">
            <b>{STORY_WORDS.didHead}</b>
            <ul>{did.map((line) => <li key={line}>{line}</li>)}</ul>
            <button type="button" className="dst-again" onClick={again}>Back to the five</button>
          </div>
        </div>
      </div>
    </div>
  );
}
