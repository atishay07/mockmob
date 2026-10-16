"use client";

// Interactive explainer for the core loop: replay -> find the leak -> one next move -> check later.
// Every number on this stage belongs to ONE sample session (the stage says so in its title bar): the
// same session as the Mistake Lab scenes above (labStory.mjs), so the replay's clock times, changes and
// marks are the scenes' own. Its words are the product's: the picks and clock times of Time and
// decisions, and the Mistake Lab's ledger of where the missed marks went.
// Held (ScrollStory): the section stays on screen while the reader's scroll walks the four steps; the
// replay's tiles still deal themselves in when step one comes on, and no timer moves the step.
// Without IntersectionObserver it falls back to the timed tour with Pause and Replay.
// Steps 1-3 describe what the product records today (answers, changes, timing, skips). Step 4
// (delayed fresh checks) is shown with its real release state, never as available.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Clock, Lock, Minus, Pause, Play, RotateCcw, X } from 'lucide-react';
import { pipReact } from '@/components/brand/pipEvents';
import { useReadableRegion } from './useReadableRegion';
import ScrollStory from './ScrollStory';
import { durations } from '@/lib/motion/tokens.g.js';
import { SESSION as STORY, MARK as MARKS, PAPER_PACE_SEC, chapterRecord, clock, marksLedger, nextMove } from './labStory.mjs';

// The story's rows in the replay's terms ('skip' for a blank), with the clock times of every change.
const SESSION = STORY.map((r) => ({
  n: r.n,
  chapter: r.chapter,
  first: r.change ? r.change.fromVerdict : r.verdict === 'blank' ? 'skip' : r.verdict,
  final: r.verdict === 'blank' ? 'skip' : r.verdict,
  sec: r.sec,
  time: clock(r.sec),
  change: r.change ? { from: r.change.from, to: r.change.to, firstAt: clock(r.change.at), at: clock(r.change.toAt), gap: clock(r.change.toAt - r.change.at) } : null,
}));
const MARK = { right: MARKS.right, wrong: MARKS.wrong, skip: MARKS.blank };
const PACE = clock(PAPER_PACE_SEC);
const LEDGER = marksLedger();
// The sample student's one next move, the same one the Lab's SWOT puts first and the tour's Ask Mobi gives.
const MOVE = nextMove();
// The Find step's closing line: where the missed marks gather, by chapter. The rows above it already say how each
// question was lost, so this line adds the chapter that the next move then takes on.
const MOVE_LOST = chapterRecord(MOVE.chapter);
// The replay opens on Q3, wrong from its first pick: the Lab above already walked through the changed answers.
const FIRST_PICK = STORY.findIndex((r) => r.verdict === 'wrong' && !r.change);
const qList = (qs) => (qs.length > 1 ? `${qs.slice(0, -1).map((n) => `Q${n}`).join(', ')} and Q${qs.at(-1)}` : `Q${qs[0]}`);
const ABOUT = {
  changed_from_right: (qs) => `${qList(qs)} ${qs.length > 1 ? 'were' : 'was'} right until you changed ${qs.length > 1 ? 'them' : 'it'}.`,
  other_wrong: (qs) => `${qList(qs)} ${qs.length > 1 ? 'were' : 'was'} wrong from the first pick.`,
  other_blank: (qs) => `${qList(qs)} ${qs.length > 1 ? 'were' : 'was'} opened and left blank.`,
};
// What the phone-width pills say; each accessible name starts with it so the spoken name holds the visible word.
const SHORT_STEP = ['Replay', 'Find', 'Plan', 'Check'];
const STEPS = [
  { key: 'replay', title: 'Replay the session', body: 'Every answer and every minute, with the marks each one cost.', ms: 4800 },
  { key: 'leak', title: 'Find where marks leaked', body: 'Every mark you missed, sorted by how it went: changed answers, wrong picks and blanks.', ms: 4800 },
  { key: 'move', title: 'Get one next move', body: 'One next step, with the record behind it.', ms: 4800 },
  { key: 'check', title: 'Check it on fresh questions', body: 'New questions, days apart, show whether the fix held.', ms: 4800 },
];
// The ten tiles deal one shared stagger step apart (the app's staggerStep), so the replay is whole within
// about half a second of its step coming on and a reader scrolling on never meets a half-dealt board.
const REVEAL_MS = durations.staggerStep;

function statusLabel(tile) {
  const end = tile.final === 'right' ? 'ended right' : tile.final === 'wrong' ? 'ended wrong' : 'left blank';
  return `Question ${tile.n}: ${end}${tile.change ? `, changed from ${tile.change.from} to ${tile.change.to}` : ''}`;
}

// The product's words for one question (Time and decisions): its picks on the paper's clock, the marks a
// change won or cost, or its time against the paper's pace.
function inspectorText(tile) {
  if (!tile) return 'Tap a question to see what happened.';
  if (tile.change) {
    const { from, to, at, firstAt, gap } = tile.change;
    const effect = tile.first === 'right' && tile.final === 'wrong' ? 'That change cost 6 marks.' : 'That change gained 6 marks.';
    return `Q${tile.n}: Picked ${from} at ${firstAt}. Changed to ${to} at ${at}, ${gap} later. ${effect}`;
  }
  if (tile.final === 'skip') return `Q${tile.n}: opened for ${tile.time} and left blank. No penalty, and no marks.`;
  const ratio = Math.round((tile.sec / PAPER_PACE_SEC) * 10) / 10;
  const pace = ratio >= 1.05 ? `${ratio} times the paper’s pace` : `inside the paper’s ${PACE} a question`;
  if (tile.final === 'wrong') return `Q${tile.n}: wrong from the first pick, never changed. ${tile.time} on this question, ${pace}.`;
  return `Q${tile.n}: right. ${tile.time} on this question, ${pace}.`;
}

// The same ten questions in a row at the foot of the leak, move and check panels, the ones that step is
// about lit, so every panel keeps its tie to the session and the stage never shows an empty lower half.
// Wide screens only (phones fit each panel to its content). Drawn from SESSION, nothing new is claimed.
const STRIP = {
  leak: { label: `The questions behind the ${LEDGER.gap} missed marks`, lit: (t) => t.final !== 'right' },
  move: { label: `The ${MOVE.chapter} questions in this paper`, lit: (t) => t.chapter === MOVE.chapter },
  check: { label: `Fresh ${MOVE.chapter} questions, on the ideas behind ${qList(SESSION.filter((t) => t.chapter === MOVE.chapter && t.final !== 'right').map((t) => t.n))}`, lit: (t) => t.chapter === MOVE.chapter && t.final !== 'right' },
};
function SessionStrip({ kind }) {
  const { label, lit } = STRIP[kind];
  return (
    <div className="ml__strip" data-kind={kind} aria-hidden="true">
      <p>{label}</p>
      <ol>
        {SESSION.map((t) => (
          <li key={t.n} data-state={t.final} data-lit={lit(t) ? 'true' : 'false'}>
            <span>{t.n}</span>
            {t.final === 'right' ? <Check size={12} /> : t.final === 'wrong' ? <X size={12} /> : <Minus size={12} />}
          </li>
        ))}
      </ol>
    </div>
  );
}

function LabStage({ recoveryState, timeline, setTimeline, pinned, goTo: storyGoTo }) {
  const rootRef = useRef(null);
  const readingRef = useRef(null);
  const progressRef = useRef(null);
  const clockRef = useRef({ token: 0, elapsed: 0 });
  const { step, token } = timeline;
  const [playing, setPlaying] = useState(true);
  const inView = useReadableRegion(readingRef);
  const [hold, setHold] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [picked, setPicked] = useState(null);
  const [pipPresent, setPipPresent] = useState(false);
  const keyboardStep = useRef(false);
  useEffect(() => {
    const sync = () => setPipPresent(document.documentElement.dataset.pipPerch === 'lab' && document.documentElement.dataset.pipPerchVisible === 'true');
    sync(); window.addEventListener('pip:presence', sync);
    return () => window.removeEventListener('pip:presence', sync);
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const running = playing && inView && !hold && !reduced;

  // The page's peak: Pip (perched beside this lab) watches the replay and jumps once when the
  // leak becomes one next move. Later loops only get a nod.
  useEffect(() => {
    rootRef.current.dataset.pipMove = String(inView && step === 2);
    if (!inView || keyboardStep.current) return;
    const key = STEPS[step].key;
    if (key === 'move') {
      pipReact('lab', 'eureka');
    } else if (key === 'leak' && pipPresent) pipReact('lab', 'nod');
  }, [step, inView, pipPresent]);

  // A single elapsed clock owns the step, question reveals and visible progress.
  // Leaving the reading region preserves elapsed time; it never catches up offscreen.
  useEffect(() => {
    if (!running) return undefined;
    const duration = STEPS[step].ms;
    const elapsed = clockRef.current.token === token ? clockRef.current.elapsed : 0;
    clockRef.current = { token, elapsed };
    const start = performance.now();
    const bar = progressRef.current;
    const animation = bar?.animate([
      { transform: `scaleX(${elapsed / duration})` }, { transform: 'scaleX(1)' },
    ], { duration: Math.max(1, duration - elapsed), fill: 'forwards', easing: 'linear' });
    let timer;
    const tick = () => {
      const time = Math.min(duration, elapsed + performance.now() - start);
      if (step === 0) {
        const count = Math.min(SESSION.length, Math.floor(time / REVEAL_MS));
        setRevealed(count);
        if (count === SESSION.length) setPicked(value => value ?? FIRST_PICK);
      }
      if (time >= duration) {
        if (pinned) return; // Held: the reader's scroll moves the step, never a timer.
        clockRef.current = { token: token + 1, elapsed: 0 };
        setTimeline({ step: (step + 1) % STEPS.length, token: token + 1 });
        if (step === STEPS.length - 1) { setRevealed(0); setPicked(null); }
        return;
      }
      const nextReveal = step === 0 && time < SESSION.length * REVEAL_MS ? REVEAL_MS - time % REVEAL_MS : duration - time;
      timer = window.setTimeout(tick, Math.max(1, Math.min(nextReveal, duration - time)));
    };
    timer = window.setTimeout(tick, 0);
    return () => {
      window.clearTimeout(timer);
      if (clockRef.current.token === token) {
        clockRef.current.elapsed = Math.min(duration, elapsed + performance.now() - start);
        if (bar) bar.style.transform = `scaleX(${clockRef.current.elapsed / duration})`;
      }
      animation?.cancel();
    };
  }, [step, token, running, pinned, setTimeline]);

  useEffect(() => {
    if (!reduced || step !== 0) return undefined;
    const id = window.setTimeout(() => { setRevealed(SESSION.length); setPicked(FIRST_PICK); }, 0);
    return () => window.clearTimeout(id);
  }, [reduced, step]);

  const goTo = (index, keyboard = false) => {
    if (pinned) { storyGoTo(index, { instant: keyboard }); return; }
    const nextToken = clockRef.current.token + 1;
    clockRef.current = { token: nextToken, elapsed: 0 };
    setTimeline({ step: index, token: nextToken });
    if (index === 0) { setRevealed(reduced ? SESSION.length : 0); setPicked(reduced ? FIRST_PICK : null); }
  };

  // The session's result is printed whole from the start (never a 0 / 50 counting up); only the tiles deal in.
  const marks = SESSION.reduce((sum, tile) => sum + MARK[tile.final], 0);
  const right = SESSION.filter((tile) => tile.final === 'right').length;
  const wrong = SESSION.filter((tile) => tile.final === 'wrong').length;
  const blank = SESSION.filter((tile) => tile.final === 'skip').length;
  const tilePicked = picked === null ? null : SESSION[picked];

  return (
    // The tour keeps playing under a passing cursor or a tap. Only keyboard focus holds it, so a
    // keyboard user is never moved on mid-read; the explicit button pauses it for everyone.
    <div className="ml" ref={rootRef} data-playing={running} data-held={pinned ? 'true' : 'false'} onFocus={(event) => { if (event.target.matches?.(':focus-visible')) setHold(true); }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHold(false); }}>
      <div className="ml__rail" data-ss-end="">
        <ol className="ml__steps">
          {STEPS.map((item, index) => {
            const active = index === step;
            return (
              <li key={item.key} data-active={active} data-done={index < step}>
                <button type="button" aria-label={item.title.startsWith(SHORT_STEP[index]) ? item.title : SHORT_STEP[index] + ': ' + item.title} onClick={(event) => { keyboardStep.current = event.detail === 0; if (pinned) { goTo(index, event.detail === 0); return; } setPlaying(false); goTo(index); if (index === 0) { clockRef.current.elapsed = SESSION.length * REVEAL_MS; setRevealed(SESSION.length); setPicked(FIRST_PICK); } }} aria-current={active ? 'step' : undefined}>
                  <span className="ml__label">{item.title}</span>
                  <span className="ml__short" aria-hidden="true">{SHORT_STEP[index]}</span>
                  <i className="ml__bar" aria-hidden="true">
                    {pinned ? <b className="ss-fill" data-state={index < step ? 'done' : active ? 'on' : 'off'} style={{ '--ss-i': index }} /> : active ? <b ref={progressRef} key={token} data-auto={!reduced} /> : null}
                  </i>
                </button>
              </li>
            );
          })}
        </ol>
        {/* All four descriptions share one slot sized to the tallest, so changing step never
            changes the rail's height or moves anything below it. */}
        <div className="ml__caption">
          {STEPS.map((item, index) => <p key={item.key} data-active={index === step} aria-hidden={index !== step}>{item.body}</p>)}
        </div>
        <div className="ml__controls"><button type="button" className="ml__pause" onClick={() => { keyboardStep.current = false; setPlaying((value) => !value); }} disabled={reduced}>
          {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          {reduced ? 'Autoplay is off' : playing ? 'Pause the tour' : 'Resume the tour'}
        </button>
        <button type="button" className="ml__restart" onClick={(event) => { keyboardStep.current = event.detail === 0; goTo(0); setPlaying(true); }}><RotateCcw size={15} aria-hidden="true" />Replay</button></div>
      </div>

      <figure className="ml__stage" data-ss-fit="0.62" data-ss-end="" aria-label="Sample Accountancy session, 10 questions">
        <div className="ml__bar-top">
          <div className="ml__session-label"><span>Sample Accountancy session, 10 questions</span></div>
        </div>

        <div className="ml__panels">
          <span className="ml__reading-region" ref={readingRef} aria-hidden="true" />
          {/* 1. Replay */}
          <section className="ml__panel" data-active={step === 0} aria-hidden={step !== 0} inert={step !== 0 ? true : undefined} aria-label="Replay the session">
            <div className="ml__score">
              <span className="ml__marks"><b>{marks}</b><small>/ 50 marks</small></span>
              <span className="ml__counts"><b data-k="right">{right} right</b>, <b data-k="wrong">{wrong} wrong</b>, {blank} blank</span>
            </div>
            <ul className="ml__tiles">
              {SESSION.map((tile, index) => {
                const on = index < revealed;
                return (
                  <li key={tile.n}>
                    <button type="button" className="ml__tile" data-state={on ? tile.final : 'idle'} data-picked={picked === index} onClick={() => { if (on) setPicked(index); }} disabled={!on} aria-label={on ? statusLabel(tile) : `Question ${tile.n}`}>
                      <span className="ml__tn">{tile.n}</span>
                      {on ? (tile.final === 'right' ? <Check size={16} aria-hidden="true" /> : tile.final === 'wrong' ? <X size={16} aria-hidden="true" /> : <Minus size={16} aria-hidden="true" />) : null}
                      {on && tile.change ? <span className="ml__swap" data-tone={tile.final === 'right' ? 'good' : 'bad'} aria-hidden="true">{tile.change.from}<ArrowRight size={8} strokeWidth={3} />{tile.change.to}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="ml__inspect" aria-live="polite">{inspectorText(tilePicked)}</p>
          </section>

          {/* 2. Leak */}
          <section className="ml__panel" data-active={step === 1} aria-hidden={step !== 1} inert={step !== 1 ? true : undefined} aria-label="Find where marks leaked">
            <p className="ml__ledger-h">{LEDGER.heading}</p>
            <ul className="ml__leaks">
              {LEDGER.groups.map((g, i) => (
                <li key={g.id} data-g={g.id} style={{ '--i': i, '--w': `${(g.marks / LEDGER.gap) * 100}%` }}>
                  <div><b>{g.label}</b><span>{g.line}</span></div>
                  <i aria-hidden="true"><em /></i>
                  <p>{ABOUT[g.id]?.(g.qs)}</p>
                </li>
              ))}
            </ul>
            <p className="ml__headline">{MOVE_LOST.lost} of the {LEDGER.gap} marks went on {MOVE.chapter}: {qList(MOVE_LOST.qs)}.</p>
            <SessionStrip kind="leak" />
          </section>

          {/* 3. Move */}
          <section className="ml__panel" data-active={step === 2} aria-hidden={step !== 2} inert={step !== 2 ? true : undefined} aria-label="Get one next move">
            <p className="ml__eyebrow">Your next move</p>
            <div className="ml__move">
              <h3>{MOVE.label}.</h3>
              <p className="ml__why">Why this: {MOVE.why}</p>
              <p className="ml__where">While you practise: {MOVE.rule.charAt(0).toLowerCase() + MOVE.rule.slice(1)}</p>
            </div>
            <p className="ml__note">Each mock you finish makes the next move sharper.</p>
            {/* Wide screens: the record behind the move as figures (the same numbers as "Why this"), so the screen holds
                its evidence instead of an empty band above the strip. Phones keep the sentence alone. */}
            <div className="ml__record" aria-hidden="true">
              <p>Marks lost on {MOVE.chapter}, oldest first</p>
              <ol>
                {MOVE.lost.map((n, i) => (
                  <li key={i} data-now={i === MOVE.lost.length - 1 ? 'true' : undefined}>
                    <b>{n}</b>
                    <span>{i === MOVE.lost.length - 1 ? 'This mock' : MOVE.lost.length - 1 - i === 1 ? 'Last mock' : `${MOVE.lost.length - 1 - i} mocks ago`}</span>
                  </li>
                ))}
              </ol>
              <small>{MOVE.record.right} right of {MOVE.record.of} answered across {MOVE.record.papers} papers.</small>
            </div>
            <SessionStrip kind="move" />
          </section>

          {/* 4. Check */}
          <section className="ml__panel" data-active={step === 3} aria-hidden={step !== 3} inert={step !== 3 ? true : undefined} aria-label="Check it on fresh questions">
            {/* Recovery checks leave out questions the student has already seen (recoverySessions.js, studyExposures),
                so this says what they are and promises nothing about a bank that runs dry. */}
            <p className="ml__eyebrow">Questions you have not answered before</p>
            <ol className="ml__checks">
              {[['Tomorrow', 'First check'], ['In 3 days', 'Second check'], ['In a week', 'Does it hold?']].map(([when, what], i) => (
                <li key={when} style={{ '--i': i }}>
                  <span className="ml__checkicon">{i === 0 ? <Clock size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}</span>
                  <div><b>{when}</b><span>{what}</span></div>
                </li>
              ))}
            </ol>
            <p className="ml__status" data-state={recoveryState}>
              {recoveryState === 'available' ? 'Open for every repair you finish.' : 'In this sample, each check unlocks on its day.'}
            </p>
            <SessionStrip kind="check" />
          </section>
        </div>

      </figure>
    </div>
  );
}

export default function MistakeLab({ recoveryState = 'blocked_content', recoveryReason = '' }) {
  const [timeline, setTimeline] = useState({ step: 0, token: 0 });
  // Held, the story's step owns the timeline; a new token restarts that step's own clock.
  const onStep = useCallback((next) => setTimeline((t) => (t.step === next ? t : { step: next, token: t.token + 1 })), []);
  return (
    <ScrollStory steps={STEPS.length} className="ml-story ss--centre" label="Replay a session, step by step" onStep={onStep} Content={LabStage}
      recoveryState={recoveryState} recoveryReason={recoveryReason} timeline={timeline} setTimeline={setTimeline} />
  );
}
