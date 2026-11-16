"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ShieldCheck, X } from 'lucide-react';
import { createDemoPlayback } from '@/../data/demo_playback.mjs';
import { durations } from '@/lib/motion/tokens.g.js';
import { labStory, signed } from './labStory.mjs';
import { firstState, shownValue } from './tourSequence.mjs';
import { BENCH_LEVELS, BENCH_RUN, START_REPLY, askView, benchView, learnView, letter, mobView, practiceView, whyReply } from './tourTaps.mjs';

// What the tour tells each screen: on stage or not, the reader's motion setting, the Pause key, the activation epoch
// (the story's step count when this screen came on stage) and whether the tour is held (ScrollStory) or a carousel.
export const DemoPlaybackContext = createContext({ active: false, reduced: false, paused: false, epoch: 0, held: false });

// Every screen reaches its finished layout within about 600 ms of its tool coming on: rows arrive one
// shared stagger step apart (the app's staggerStep), and only flourishes (a tap, a bar's sweep, a
// verdict flipping) run after that. A reader who scrolls on after a second never sees a half-built screen.
const STAGGER = durations.staggerStep;
const lineUp = (count, from = 60) => Array.from({ length: count }, (_, i) => from + i * STAGGER);

// One screen's demo (R3-D5, LK105, 5 Nov 2026). A screen stays mounted when its tool leaves the stage (5 Nov perf: a
// remount cost about 100 ms a step at 4x CPU), so coming back it must restart from its first frame in the very render
// that brings it on stage. That is done with an activation epoch, never a render-phase setState: the demo's state is
// { epoch, value }, and until this activation's playback has spoken the screen shows its first frame (tourSequence.mjs).
// The playback runs only while the screen is on stage; off stage a held screen is paused where it was and never
// settled, so a leaving screen fades out as it was. data-ts-step therefore reads 0 and then only climbs on every
// activation (the tour gate, tourGateBench.mjs).
function useSequence(play, events, settled) {
  const { active, reduced, paused, epoch, held } = useContext(DemoPlaybackContext);
  const clock = useRef(null);
  const first = events[0]?.value ?? settled;
  const [state, setState] = useState(() => firstState({ active, reduced, paused, epoch, first, settled }));
  useEffect(() => {
    if (!active || reduced) return undefined;
    const playback = createDemoPlayback(events, (value) => setState({ epoch, value }));
    clock.current = playback;
    return () => { playback.dispose(); clock.current = null; };
  }, [active, reduced, events, epoch]);
  useEffect(() => {
    if (play && active && !reduced) clock.current?.resume();
    else clock.current?.pause();
  }, [play, active, reduced, epoch]);
  return shownValue({ held, active, reduced, paused, epoch, state, first, settled });
}

// Compact product screens for the feature tour. For a mouse or a trackpad each one plays a short scripted demo every time
// its tool comes on stage, in place within about 600 ms (see STAGGER), then holds the finished state. Off-stage demos keep
// their current frame; reduced motion, a touch screen and a stage that is not held show them finished, playing nothing
// (FeatureTour.jsx hands those screens `reduced`).
// Values are illustrative. Every screen carries two beats of real content (the moment, then what
// follows from it) and they all come out about the same height, because the tour's tools share one
// card and a short screen would leave an empty slab.
//
// The five tools' screens answer taps (16 Nov 2026, owner: "It needs to be interactive"). A tap takes over at once: the
// demo stops, the screen shows its finished frame with the reader's state, and the screen stays the reader's (its demo
// never plays on it again, so a restart can never undo a tap). The rules are tourTaps.mjs; every control is a real
// button with a pressed state, the held choice is aria-pressed, and the result is read out from one polite live line
// per screen. One quiet hint line sits in each screen's foot. Nothing here pulses, blinks or fakes a tap: the demo
// simply shows its pick appear.

/** Steps through `timeline` (ms offsets) while `play` is true; returns the current step. */
function useSteps(play, timeline) {
  const events = useMemo(() => [0, ...timeline].map((at, value) => ({ at, value })), [timeline]);
  return useSequence(play, events, timeline.length);
}

/** Counts down once a second while playing; resets when the demo restarts. */
function useCountdown(play, from) {
  const events = useMemo(() => Array.from({ length: 6 }, (_, i) => ({ at: i * 1000, value: Math.max(0, from - i) })), [from]);
  const left = useSequence(play, events, from);
  return `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
}

// `foot` is the screen's one hint line; `said` the result a screen reader hears (empty until the reader acts).
function Frame({ title, right, step, className = '', foot = null, said = '', children }) {
  return (
    <figure className={`ts ${className}`} data-ts-step={step} data-foot={foot ? 'true' : undefined}>
      <div className="ts__bar">
        <span className="ts__title">{title}</span>
        {right ?? null}
      </div>
      <div className="ts__body">{children}</div>
      {foot ? <p className="ts__foot">{foot}</p> : null}
      {foot ? <p className="lp-sr" aria-live="polite">{said}</p> : null}
    </figure>
  );
}

const on = (value) => (value ? 'true' : 'false');

/** The demo's step until the reader acts, then the finished frame for good. `taken` stops the demo where it is. */
function useDemo(play, timeline, taken) {
  const step = useSteps(play && !taken, timeline);
  return taken ? timeline.length : step;
}

// ---------- 1. Practice ----------
// A tap picks an option and another moves the pick, as in a real mock. It never says right or wrong: a mock does not
// tell you mid-paper. The demo picks A (step 5) and saves (step 6).
const PRACTICE_T = [...lineUp(4), 520, 820];
const PRACTICE_OPTS = ['Liabilities side', 'Assets side', 'Reserves and surplus', 'Not shown at all'];
export function PracticeScreen({ play }) {
  const [mine, setMine] = useState(null);
  const taken = mine !== null;
  const step = useDemo(play, PRACTICE_T, taken);
  const clock = useCountdown(play && !taken, 38 * 60 + 12);
  const view = practiceView({ step, mine });
  return (
    <Frame title="Accountancy full mock" step={step} right={<span className="ts__timer">{clock}</span>} foot="Tap an option" said={view.said}>
      <p className="ts__meta">Question 22 of 50</p>
      <p className="ts__q">A partner’s capital account shows a debit balance. Where does it go in the balance sheet?</p>
      <ul className="ts__opts">
        {PRACTICE_OPTS.map((text, i) => (
          <li key={text} data-in={on(step > i)} data-picked={on(view.picked === i)}>
            <button type="button" className="ts__key ts__choice" aria-pressed={view.picked === i} onClick={() => setMine(i)}>
              <b>{letter(i)}</b><span>{text}</span>
              {view.picked === i ? <Check size={15} className="ts__tick" aria-hidden="true" /> : null}
            </button>
          </li>
        ))}
      </ul>
      <div className="ts__progress" aria-hidden="true"><i style={{ '--p': view.saved ? '44%' : '42%' }} /></div>
      <p className="ts__meta ts__meta--row"><span>{view.answered} of 50 answered</span><span data-on={on(view.saved)} className="ts__saved">Saved</span></p>
    </Frame>
  );
}

// ---------- 2. Mistake Repair ----------
const REPAIR_T = lineUp(5);
const REPAIR_ROWS = [
  ['Why A looked right', 'Capital usually sits on the liabilities side.'],
  ['Where it breaks', 'A debit balance means the partner owes the firm.'],
  ['Why B is right', 'Money owed to the firm is an asset.'],
];
export function RepairScreen({ play }) {
  const step = useSteps(play, REPAIR_T);
  return (
    <Frame title="Mistake Repair" step={step} right={<span className="ts__badge">Q22</span>}>
      <p className="ts__pick"><span data-tone="bad"><b>A</b>Your pick</span><span data-tone="good"><b>B</b>Key</span></p>
      <p className="ts__check" data-in={on(step >= 1)}><ShieldCheck size={14} aria-hidden="true" />Explained from the answer key (B).</p>
      <ol className="ts__steps">
        {REPAIR_ROWS.map(([title, detail], i) => (
          <li key={title} data-in={on(step >= 2 + i)} data-key={on(i === 2)}>
            <span className="ts__dot">{i + 1}</span>
            <p><b>{title}</b>{detail}</p>
          </li>
        ))}
      </ol>
      <p className="ts__cta" data-in={on(step >= 5)}>Practise 5 on this chapter</p>
    </Frame>
  );
}

// ---------- 2b. Learn ----------
// A real released recall card (WordNet 3.0 sense and example), shown as it appears after a lesson.
const LEARN_T = [...lineUp(3), 380, 520, 600];
const LEARN_OPTS = ['not eager', 'characterized by directness in manner or speech; without subtlety or evasion','easily tricked because of being too trusting'];
// A tap answers the card. B is right: "Correct" and the card comes back in a few days. A miss is marked, B is shown as the
// meaning and the line says what the app does with a missed card (tourTaps.mjs learnView, proved in tourTaps.test.mjs).
export function LearnScreen({ play }) {
  const [mine, setMine] = useState(null);
  const taken = mine !== null;
  const step = useDemo(play, LEARN_T, taken);
  const view = learnView({ step, mine });
  return (
    <Frame title="Vocabulary recall" step={step} right={<span className="ts__badge">Card 1 of 5</span>} foot="Tap the meaning" said={view.said}>
      <p className="ts__meta">Meaning in context</p>
      <p className="ts__q">“I gave them my <b>candid</b> opinion.” What does candid mean here?</p>
      <ul className="ts__opts">
        {LEARN_OPTS.map((text, i) => {
          const state = view.state(i);
          const ticked = (state === 'picked' && view.verdict === 'right') || state === 'answer';
          return (
            <li key={text} data-in={on(step > i)} data-picked={on(state === 'picked' || state === 'answer')} data-miss={state === 'miss' ? 'true' : undefined}>
              <button type="button" className="ts__key ts__choice" aria-pressed={view.picked === i} onClick={() => setMine(i)}>
                <b>{letter(i)}</b><span>{text}</span>
                {ticked ? <Check size={15} className="ts__tick" aria-hidden="true" /> : null}
                {state === 'miss' ? <X size={15} className="ts__cross-mark" aria-hidden="true" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="ts__meta ts__meta--row ts__result"><span data-on={on(Boolean(view.lead))} data-tone={view.verdict === 'miss' ? 'plain' : undefined} className="ts__saved">{view.lead}</span><span>{view.next}</span></p>
      <p className="ts__cta" data-in={on(view.then)}>Then: practise Vocabulary questions</p>
    </Frame>
  );
}

// ---------- 3. Mistake Replay ----------
// Q4 of the landing's sample mock (labStory.mjs), on the paper's clock like the Mistake Lab scenes: the
// right first pick, the change crossed out on its way to the wrong one, then the other two changes.
const STORY = labStory();
const REPLAY_Q = STORY.changes.find((c) => c.n === 4);
const REPLAY_T = [...lineUp(3), 420, 480, 540];
const REPLAY_MORE = STORY.changes.filter((c) => c.n !== REPLAY_Q.n).map((c) => [`Q${c.n}`, `${c.from} at ${c.at}, then ${c.to} at ${c.toAt}`, signed(c.net), c.net < 0 ? 'bad' : 'good']);
export function ReplayScreen({ play }) {
  const step = useSteps(play, REPLAY_T);
  const changed = step >= 4;
  const q = REPLAY_Q;
  return (
    <Frame title={`Replay, question ${q.n}`} step={step}>
      <div className="ts__timeline">
        <div className="ts__node" data-in={on(step >= 1)}><span className="ts__node-dot" data-tone="good"><Check size={14} aria-hidden="true" /></span><b>{q.at}</b><small>Picked {q.from}</small></div>
        <span className="ts__link" aria-hidden="true">
          <i className="ts__line" data-in={on(step >= 2)} />
          <b className="ts__cross" data-in={on(step >= 3)}><X size={10} strokeWidth={3} /></b>
        </span>
        <div className="ts__node" data-in={on(step >= 3)}><span className="ts__node-dot" data-tone="bad"><X size={14} aria-hidden="true" /></span><b>{q.toAt}</b><small>Changed to {q.to}</small></div>
      </div>
      <div className="ts__verdict" data-changed={on(changed)}>
        <span className="ts__opt">{changed ? q.to : q.from}</span>
        <p><b>{changed ? 'Wrong' : 'Right'}</b>{changed ? 'After the change' : 'First pick'}</p>
        <strong className="ts__marks">{changed ? '−1' : '+5'}<small>marks</small></strong>
      </div>
      <p className="ts__note" data-in={on(step >= 5)}>Changed {q.gap} later. That change cost you <b>{-q.net} marks</b>.</p>
      <ul className="ts__also" data-in={on(step >= 6)} aria-label="Other answers changed in this mock">
        {REPLAY_MORE.map(([label, what, marks, tone]) => <li key={label}><b>{label}</b><span>{what}</span><em data-tone={tone}>{marks}</em></li>)}
      </ul>
    </Frame>
  );
}

// ---------- 4. Radar ----------
// The same student as the Mistake Lab (R8 SEC-03): the Accountancy chapters carry the Lab's names and record across its
// three papers (labStory.mjs), so Partnership is the one to fix first, Cash flow sits mid-table and Ratios is the strongest.
// The other subjects' rows stay illustrative.
const RADAR_T = [...lineUp(6), 400];
const pct = ({ right, of }) => Math.round((right / of) * 100);
const RADAR_ROWS = [
  ['Partnership', 'Accountancy', 38],
  ['Money and banking', 'Economics', 52],
  ['Reading passages', 'English', 61],
  ['Cash flow', 'Accountancy', pct(STORY.swot.record['Cash flow'])],
  ['Business environment', 'Business Studies', 68],
  ['Ratios', 'Accountancy', pct(STORY.swot.record.Ratios)],
];
export function RadarScreen({ play }) {
  const step = useSteps(play, RADAR_T);
  return (
    <Frame title={`Chapter review across your last ${STORY.swot.partnershipLost.length} mocks`} step={step}>
      <ul className="ts__bars">
        {RADAR_ROWS.map(([chapter, subject, pct], i) => (
          <li key={chapter} data-in={on(step > i)} data-low={on(pct < 50)}>
            <span className="ts__bars-name"><b>{chapter}</b><small>{subject}</small>{i === 0 ? <span className="ts__flag" data-in={on(step >= 7)}>Fix first</span> : null}</span>
            <span className="ts__bars-track" aria-hidden="true"><i style={{ '--w': `${pct}%` }} /></span>
            <em>{pct}%</em>
          </li>
        ))}
      </ul>
      <p className="ts__note" data-in={on(step >= 7)}>Partnership cost the most marks. Tonight starts there.</p>
    </Frame>
  );
}

// ---------- 5. PrepOS (Ask Mobi) ----------
// The real Ask Mobi moment (LK87, 5 Nov): your question is sent (it rises from its tail corner), Mobi reads your record
// for a beat with the panel's own pending line ("Reading your record for tonight", AskMobiPanel, his eyes running along
// it), then the reply opens around him where he already sits, its three steps line up and the two quick replies come
// last. The reply's room is reserved from the first frame, so nothing below moves. This screen takes about 1.4 s, not
// the tour's usual 600 ms: the beat of reading is the moment, and the reply is its flourish.
const PREP_T = [60, 300, 860, 920, 975, 1030, 1140];
// The plan is the Lab's own (R8 SEC-03): its first set (Practise 10 on Partnership) and the answers it changed.
const PREP_PLAN = [['20 min', 'Partnership: 10 fresh questions'], ['10 min', `Re-read the ${['no', 'one', 'two', 'three', 'four'][STORY.changes.length] ?? STORY.changes.length} you changed`], ['Tomorrow', 'One timed half mock']];
// The two quick replies are buttons (16 Nov 2026). "Why this?" adds Mobi's reason from the same sample record the Lab tells
// (tourTaps.mjs whyReply: Partnership's lost marks in each of the last three mocks); "Start the 10" says the set is ready.
// Both answers share one reserved slot under the reply, so the screen never grows when one appears.
const PREP_ANSWERS = [['why', whyReply(STORY)], ['start', START_REPLY]];
export function PrepOSScreen({ play }) {
  const [mine, setMine] = useState(null);
  const taken = mine !== null;
  const step = useDemo(play, PREP_T, taken);
  const view = askView({ mine, story: STORY });
  return (
    <Frame title="Ask Mobi" step={step} right={<span className="ts__badge">Sample record</span>} foot="Tap a reply" said={view.said}>
      <p className="ts__bubble ts__bubble--me" data-in={on(step >= 1)}>What should I do tonight?</p>
      <div className="ts__reply">
        <p className="ts__reading" data-in={on(step === 2)} aria-hidden="true"><span className="ts__mobi" aria-hidden="true"><i /><i /></span>Reading your record for tonight</p>
        <div className="ts__bubble ts__bubble--ai" data-in={on(step >= 3)}>
          <p className="ts__ai-head"><span className="ts__mobi" aria-hidden="true"><i /><i /></span><b>Mobi</b><small>from your last 3 mocks</small></p>
          <p>Partnership in Accountancy cost you the most this week. Tonight:</p>
          <ol>
            {PREP_PLAN.map(([time, what], i) => <li key={what} data-in={on(step >= 4 + i)}><b>{time}</b>{what}</li>)}
          </ol>
          <p className="ts__replies" data-in={on(step >= 7)}>
            <button type="button" className="ts__key ts__reply-key" data-main="true" aria-pressed={mine === 'start'} onClick={() => setMine('start')}>Start the 10</button>
            <button type="button" className="ts__key ts__reply-key" aria-pressed={mine === 'why'} onClick={() => setMine('why')}>Why this?</button>
          </p>
        </div>
      </div>
      <div className="ts__more" aria-hidden="true">
        {PREP_ANSWERS.map(([key, text]) => (
          <div key={key} className="ts__bubble ts__bubble--ai" data-show={on(mine === key)}>
            <span className="ts__mobi" aria-hidden="true"><i /><i /></span>
            <p>{text}</p>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// ---------- 6. Compass ----------
const COMPASS_T = [...lineUp(4), 360, 420];
const COMPASS_ROWS = [['SRCC', 'B.Com (Hons)', 80, 'Stretch', 'far'], ['Hindu College', 'B.A. (Hons) Economics', 72, 'Close', 'near'], ['Hansraj College', 'B.Com (Hons)', 62, 'Clears it', 'in'], ['Kirori Mal College', 'B.Com (Hons)', 58, 'Clears it', 'in']];
export function CompassScreen({ play }) {
  const step = useSteps(play, COMPASS_T);
  return (
    <Frame title="Your Compass shortlist" step={step}>
      <p className="ts__meta">Your practice range against 2026 Round 1 cutoffs</p>
      <ul className="ts__compass">
        {COMPASS_ROWS.map(([college, course, cut, label, fit], i) => (
          <li key={college} data-in={on(step > i)}>
            <span className="ts__compass-name"><b>{college}</b><small>{course}</small></span>
            <span className="ts__compass-track" aria-hidden="true"><i className="ts__cut" style={{ '--x': `${cut}%` }} /><i className="ts__you" style={{ '--x': '70%' }} /></span>
            <em data-fit={fit} data-in={on(step >= 5)}>{label}</em>
          </li>
        ))}
      </ul>
      <p className="ts__legend"><span><i className="ts__you-key" />You</span><span><i className="ts__cut-key" />Cutoff</span></p>
      <p className="ts__note" data-in={on(step >= 6)}>Two clear today. <b>Accountancy</b> is the paper that moves Hindu.</p>
    </Frame>
  );
}

// ---------- 7. Combo Planner ----------
const COMBO_T = [...lineUp(5), 330, 420];
const COMBO_PAPERS = ['English', 'Accountancy', 'Business Studies', 'Economics', 'Mathematics'];
export function ComboScreen({ play }) {
  const step = useSteps(play, COMBO_T);
  const picked = Math.min(step, 5);
  return (
    <Frame title="Combo Planner" step={step}>
      <p className="ts__meta ts__meta--row"><span>Your five papers</span><span className="ts__count">{picked} of 5</span></p>
      <ul className="ts__chips">
        {COMBO_PAPERS.map((paper, i) => <li key={paper} data-on={on(step > i)}>{step > i ? <Check size={13} aria-hidden="true" /> : null}{paper}</li>)}
      </ul>
      <ul className="ts__opens" data-in={on(step >= 6)}>
        <li><Check size={14} aria-hidden="true" />B.Com (Hons)<small>Your goal</small></li>
        <li><Check size={14} aria-hidden="true" />B.A. (Hons) Economics<small>Your goal</small></li>
      </ul>
      <div className="ts__verdict ts__verdict--ok" data-in={on(step >= 7)}>
        <span className="ts__opt"><Check size={16} aria-hidden="true" /></span>
        <p><b>Both goals stay open</b>Checked against the published 2026 DU rules</p>
        <strong className="ts__marks">2/2<small>open</small></strong>
      </div>
    </Frame>
  );
}

// ---------- 8. Benchmarks ----------
// The two bars sweep in as the flourish; the facts and the ladder are already in place behind them. The three levels are
// buttons (16 Nov 2026): a tap makes that level today's target, and the Target bar, the points short, the top line and the
// "Today's target" tag follow it (tourTaps.mjs benchView).
const BENCH_T = lineUp(3);
export function BenchmarkScreen({ play }) {
  const [mine, setMine] = useState(null);
  const taken = mine !== null;
  const step = useDemo(play, BENCH_T, taken);
  const clock = useCountdown(play && !taken, 4 * 60 + 30);
  const view = benchView({ mine });
  return (
    <Frame title="Daily benchmark" step={step} right={<span className="ts__timer">{clock}</span>} foot="Tap a level to aim for it" said={view.said}>
      <p className="ts__meta">{view.line}</p>
      <div className="ts__lanes">
        <div className="ts__lane" data-run={on(step >= 1)}><span>Your run</span><i><b style={{ '--w': `${BENCH_RUN}%`, '--t': '1.1s' }} /></i><em>{BENCH_RUN}%</em></div>
        <div className="ts__lane" data-run={on(step >= 1)} data-target="true"><span>Target</span><i><b style={{ '--w': `${view.pct}%`, '--t': '0.8s' }} /></i><em>{view.pct}%</em></div>
      </div>
      <div className="ts__facts" data-in={on(step >= 2)}>
        <p><b>52s</b>a question</p>
        <p><b>{view.short} pts</b>short today</p>
      </div>
      <ol className="ts__ladder" data-in={on(step >= 3)} aria-label="Benchmark levels">
        {BENCH_LEVELS.map((level) => {
          const target = view.target === level.id;
          return (
            <li key={level.id} data-mark={target ? 'target' : undefined}>
              <button type="button" className="ts__key ts__level" aria-pressed={target} onClick={() => setMine(level.id)}>
                <span>{level.name}</span>{target ? <small>Today’s target</small> : null}<b>{level.pct}%</b>
              </button>
            </li>
          );
        })}
        <li data-mark="you"><span>You, today</span><b>{BENCH_RUN}%</b></li>
      </ol>
    </Frame>
  );
}

// ---------- 9. The Mob ----------
// A sprint as the Mob shows it: three friends' runs on the same five questions (+5 / -1, so 25 is full marks), each as
// the Fold they play as, then the week's quest, the chain and the fix that follows the game. Names and marks are
// illustrative; the rules are the Mob's own (src/lib/mob/v3/denCopy.mjs: same questions for 24 hours, the weekly
// quest, the chain in weeks, Fix it together shows only your own pick).
const FOLD_HEAD = 48; // the Fold characters read at 48 px, not the 20 px chips they were (LK73)
const MOB_T = [...lineUp(3), 420];
const MOB_RUNS = [
  { fold: 'dart', name: 'Dart, you', marks: 19, you: true },
  { fold: 'hexa', name: 'Hexa, Riya', marks: 15 },
  { fold: 'kandil', name: 'Kandil, Aman', marks: 14 },
];
// Fix it together is a button (16 Nov 2026): it opens, inside the screen, one real Economics question with four options,
// and a tap on an option shows right or wrong with its reason. The question is never written here: page.js reads it on the
// server from the home sample's own five (sampleFive.mjs publicSample) and hands it down as `sample`. The sprint and the
// question share one grid cell, so the screen keeps the taller one's height and nothing moves when it opens or closes.
const FIX_ROW = 'Fix it together: Q3 caught you. Try a fresh one like it.';
export function MobScreen({ play, sample = null }) {
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState(null);
  const [moved, setMoved] = useState(0);
  const fixRef = useRef(null);
  const stemRef = useRef(null);
  const taken = open || mine !== null;
  const step = useDemo(play, MOB_T, taken);
  const view = mobView({ sample, open, mine });
  // Focus follows the reader into the question and back to the row, so a keyboard never drops to the page.
  useEffect(() => {
    if (!moved) return;
    (open ? stemRef.current : fixRef.current)?.focus({ preventScroll: true });
  }, [open, moved]);
  const toggle = (next) => { setOpen(next); setMoved((n) => n + 1); };
  const foot = !sample ? null : !open ? 'Tap Fix it together' : view.answered ? 'Back to the sprint any time' : 'Tap an option';
  const said = !open ? '' : view.answered ? view.said : `Fix it together. ${sample?.subject} question: ${sample?.q}`;
  return (
    <Frame title="Economics sprint" step={step} right={<span className="ts__timer">5 questions</span>} foot={foot} said={said}>
      <div className="ts__panes">
        <div className="ts__pane" data-show={on(!open)} inert={open || undefined} aria-hidden={open || undefined}>
          <p className="ts__meta">Everyone gets the same questions for 24 hours.</p>
          <div className="ts__lanes">
            {MOB_RUNS.map((run, i) => (
              <div key={run.fold} className="ts__lane ts__lane--fold" data-run={on(step >= 1)} data-target={run.you ? undefined : 'true'} style={{ gridTemplateColumns: 'minmax(0, 9.5rem) 1fr 36px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span><img src={`/mob/folds/fold-${run.fold}-head@128.webp`} alt="" width={FOLD_HEAD} height={FOLD_HEAD} style={{ flex: `0 0 ${FOLD_HEAD}px`, width: FOLD_HEAD, height: FOLD_HEAD }} loading="lazy" decoding="async" />{run.name}</span>
                <i><b style={{ '--w': `${Math.round((run.marks / 25) * 100)}%`, '--t': `${0.9 + i * 0.2}s` }} /></i>
                <em>+{run.marks}</em>
              </div>
            ))}
          </div>
          <div className="ts__facts" data-in={on(step >= 2)}>
            <p><b>38 of 60</b>questions in this week’s quest</p>
            <p><b>4 weeks</b>in your Mob’s chain</p>
          </div>
          <ol className="ts__ladder" data-in={on(step >= 3)} aria-label="After the sprint">
            {sample ? (
              <li data-mark="you">
                <button type="button" ref={fixRef} className="ts__key ts__level ts__fix-key" aria-expanded={open} onClick={() => toggle(true)}>{FIX_ROW}</button>
              </li>
            ) : <li data-mark="you"><span>{FIX_ROW}</span></li>}
          </ol>
        </div>
        {sample ? (
          <div className="ts__pane ts__fix" data-show={on(open)} inert={!open || undefined} aria-hidden={!open || undefined}>
            <p className="ts__meta ts__meta--row"><span>Fix it together</span><span>{sample.chapter}</span></p>
            <p className="ts__q" ref={stemRef} tabIndex={-1}>{sample.q}</p>
            <ul className="ts__opts">
              {sample.options.map((text, i) => {
                const state = view.state(i);
                return (
                  <li key={text} data-picked={on(state === 'right')} data-miss={state === 'wrong' ? 'true' : undefined}>
                    <button type="button" className="ts__key ts__choice" aria-pressed={mine === i} aria-disabled={view.answered || undefined} onClick={() => { if (!view.answered) setMine(i); }}>
                      <b>{letter(i)}</b><span>{text}</span>
                      {state === 'right' ? <Check size={15} className="ts__tick" aria-hidden="true" /> : null}
                      {state === 'wrong' ? <X size={15} className="ts__cross-mark" aria-hidden="true" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="ts__why" data-in={on(view.answered)} data-tone={view.answered ? (view.right ? 'right' : 'miss') : undefined}><b>{view.mark}</b> {view.verdict}</p>
            <button type="button" className="ts__key ts__back" onClick={() => toggle(false)}>Back to the sprint</button>
          </div>
        ) : null}
      </div>
    </Frame>
  );
}

export const TOUR_SCREENS = {
  arena: PracticeScreen,
  repair: RepairScreen,
  learn: LearnScreen,
  replay: ReplayScreen,
  radar: RadarScreen,
  prepos: PrepOSScreen,
  compass: CompassScreen,
  combo: ComboScreen,
  rival: BenchmarkScreen,
  mob: MobScreen,
};
