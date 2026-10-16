"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ShieldCheck, X } from 'lucide-react';
import { createDemoPlayback } from '@/../data/demo_playback.mjs';
import { durations } from '@/lib/motion/tokens.g.js';
import { labStory, signed } from './labStory.mjs';

export const DemoPlaybackContext = createContext({ active: false, reduced: false, paused: false });

// Every screen reaches its finished layout within about 600 ms of its tool coming on: rows arrive one
// shared stagger step apart (the app's staggerStep), and only flourishes (a tap, a bar's sweep, a
// verdict flipping) run after that. A reader who scrolls on after a second never sees a half-built screen.
const STAGGER = durations.staggerStep;
const lineUp = (count, from = 60) => Array.from({ length: count }, (_, i) => from + i * STAGGER);

function useSequence(play, events, settled) {
  const { active, reduced, paused } = useContext(DemoPlaybackContext);
  const clock = useRef(null);
  // A screen that will play starts from its first frame (no flash of the finished screen before the
  // build); a paused, reduced or inactive one starts finished.
  const [value, setValue] = useState(() => (active && !reduced && !paused ? events[0]?.value ?? settled : settled));
  useEffect(() => {
    if (!active || reduced) {
      const timer = setTimeout(() => setValue(settled), 0);
      return () => clearTimeout(timer);
    }
    const playback = createDemoPlayback(events, setValue);
    clock.current = playback;
    return () => { playback.dispose(); clock.current = null; };
  }, [active, reduced, events, settled]);
  useEffect(() => {
    if (play && active && !reduced) clock.current?.resume();
    else clock.current?.pause();
  }, [play, active, reduced]);
  return value;
}

// Compact product screens for the feature tour. Each one plays a short scripted demo every time its
// slide becomes active (in place within about 600 ms, see STAGGER), then holds the finished state.
// Paused and hidden demos retain their current stage. Inactive and reduced-motion screens are settled.
// Values are illustrative. Every screen carries two beats of real content (the moment, then what
// follows from it) and they all come out about the same height, because the tour's tools share one
// card and a short screen would leave an empty slab.

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

function Frame({ title, right, step, className = '', children }) {
  return (
    <figure className={`ts ${className}`} data-step={step}>
      <div className="ts__bar">
        <span className="ts__title">{title}</span>
        {right ?? null}
      </div>
      <div className="ts__body">{children}</div>
    </figure>
  );
}

const on = (value) => (value ? 'true' : 'false');

// ---------- 1. Practice ----------
const PRACTICE_T = [...lineUp(4), 520, 820];
const PRACTICE_OPTS = ['Liabilities side', 'Assets side', 'Reserves and surplus', 'Not shown at all'];
export function PracticeScreen({ play }) {
  const step = useSteps(play, PRACTICE_T);
  const clock = useCountdown(play, 38 * 60 + 12);
  return (
    <Frame title="Accountancy full mock" step={step} right={<span className="ts__timer">{clock}</span>}>
      <p className="ts__meta">Question 22 of 50</p>
      <p className="ts__q">A partner’s capital account shows a debit balance. Where does it go in the balance sheet?</p>
      {/* The options look pressable, so a press does something real: it takes the reader to the live sample at the
          top of the page (DemoJump), where the same kind of question is answered for real. */}
      <a href="#try-practice" className="ts__live" aria-label="Answer a real question like this in the five-question sample">
        <ul className="ts__opts">
          {PRACTICE_OPTS.map((text, i) => (
            <li key={text} data-in={on(step > i)} data-picked={on(i === 1 && step >= 5)}>
              <b>{'ABCD'[i]}</b><span>{text}</span>
              {i === 1 ? <span className="ts__tap" data-on={on(step === 5)} aria-hidden="true" /> : null}
              {i === 1 && step >= 5 ? <Check size={15} className="ts__tick" aria-hidden="true" /> : null}
            </li>
          ))}
        </ul>
      </a>
      <div className="ts__progress" aria-hidden="true"><i style={{ '--p': step >= 6 ? '44%' : '42%' }} /></div>
      <p className="ts__meta ts__meta--row"><span>{step >= 6 ? 22 : 21} of 50 answered</span><span data-on={on(step >= 6)} className="ts__saved">Saved</span></p>
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
export function LearnScreen({ play }) {
  const step = useSteps(play, LEARN_T);
  return (
    <Frame title="Vocabulary recall" step={step} right={<span className="ts__badge">Card 1 of 5</span>}>
      <p className="ts__meta">Meaning in context</p>
      <p className="ts__q">“I gave them my <b>candid</b> opinion.” What does candid mean here?</p>
      <ul className="ts__opts">
        {LEARN_OPTS.map((text, i) => (
          <li key={text} data-in={on(step > i)} data-picked={on(i === 1 && step >= 4)}>
            <b>{'ABC'[i]}</b><span>{text}</span>
            {i === 1 ? <span className="ts__tap" data-on={on(step === 4)} aria-hidden="true" /> : null}
            {i === 1 && step >= 5 ? <Check size={15} className="ts__tick" aria-hidden="true" /> : null}
          </li>
        ))}
      </ul>
      <p className="ts__meta ts__meta--row"><span data-on={on(step >= 5)} className="ts__saved">Correct</span><span>{step >= 6 ? 'Comes back in a few days' : ' '}</span></p>
      <p className="ts__cta" data-in={on(step >= 6)}>Then: practise Vocabulary questions</p>
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
const RADAR_T = [...lineUp(6), 400];
// Across several mocks (one CUET paper is one subject), each chapter with its count of right answers, so a bar is
// never a bare percentage from a handful of questions.
const RADAR_ROWS = [
  ['Partner retirement', 'Accountancy', 5, 13],
  ['Money and banking', 'Economics', 11, 21],
  ['Reading passages', 'English', 14, 23],
  ['Business environment', 'Business Studies', 13, 19],
  ['Ratio analysis', 'Accountancy', 16, 21],
  ['Cash flow', 'Accountancy', 21, 25],
];
export function RadarScreen({ play }) {
  const step = useSteps(play, RADAR_T);
  return (
    <Frame title="Weak chapters across your last mocks" step={step}>
      <ul className="ts__bars">
        {RADAR_ROWS.map(([chapter, subject, right, of], i) => (
          <li key={chapter} data-in={on(step > i)} data-low={on(right / of < 0.5)}>
            <span className="ts__bars-name"><b>{chapter}</b><small>{subject}</small>{i === 0 ? <span className="ts__flag" data-in={on(step >= 7)}>Fix first</span> : null}</span>
            <span className="ts__bars-track" aria-hidden="true"><i style={{ '--w': `${(right / of) * 100}%` }} /></span>
            <em>{right} of {of}</em>
          </li>
        ))}
      </ul>
      <p className="ts__note" data-in={on(step >= 7)}>Partner retirement lost the most marks. Tonight starts there.</p>
    </Frame>
  );
}

// ---------- 5. PrepOS ----------
// Your question lands, the reply is typed for a beat, then it and its three steps line up.
const PREP_T = [40, 160, ...lineUp(5, 420)];
const PREP_PLAN = [['20 min', 'Retirement: 10 fresh questions'], ['10 min', 'Re-read the two you changed'], ['Tomorrow', 'One timed half mock']];
export function PrepOSScreen({ play }) {
  const step = useSteps(play, PREP_T);
  return (
    <Frame title="Ask MockMob" step={step} right={<span className="ts__badge">Your record</span>}>
      <p className="ts__bubble ts__bubble--me" data-in={on(step >= 1)}>What should I do tonight?</p>
      <div className="ts__reply">
        {step === 2 ? <p className="ts__typing" aria-hidden="true"><i /><i /><i /></p> : null}
        <div className="ts__bubble ts__bubble--ai" data-in={on(step >= 3)}>
          <p className="ts__ai-head"><b>Mobi</b><small>from your last 3 mocks</small></p>
          <p>Retirement in Accountancy cost you the most this week. Tonight:</p>
          <ol>
            {PREP_PLAN.map(([time, what], i) => <li key={what} data-in={on(step >= 4 + i)}><b>{time}</b>{what}</li>)}
          </ol>
          <p className="ts__replies" data-in={on(step >= 7)}><span data-main="true">Start the 10</span><span>Why this?</span></p>
        </div>
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
      <p className="ts__meta">Your practice range against 2026 Round I cutoffs</p>
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
// The two bars sweep in as the flourish; the facts and the ladder are already in place behind them.
const BENCH_T = lineUp(3);
const BENCH_LADDER = [['DU level', '88%'], ['College level', '82%'], ['Daily', '78%', 'target'], ['You, today', '72%', 'you']];
export function BenchmarkScreen({ play }) {
  const step = useSteps(play, BENCH_T);
  const clock = useCountdown(play, 4 * 60 + 30);
  return (
    <Frame title="Daily benchmark" step={step} right={<span className="ts__timer">{clock}</span>}>
      <p className="ts__meta">25 questions. Hold 78% accuracy at 55 seconds a question.</p>
      <div className="ts__lanes">
        <div className="ts__lane" data-run={on(step >= 1)}><span>Your run</span><i><b style={{ '--w': '72%', '--t': '1.1s' }} /></i><em>72%</em></div>
        <div className="ts__lane" data-run={on(step >= 1)} data-target="true"><span>Target</span><i><b style={{ '--w': '78%', '--t': '0.8s' }} /></i><em>78%</em></div>
      </div>
      <div className="ts__facts" data-in={on(step >= 2)}>
        <p><b>52s</b>a question</p>
        <p><b>6 pts</b>short today</p>
      </div>
      <ol className="ts__ladder" data-in={on(step >= 3)} aria-label="Benchmark levels">
        {BENCH_LADDER.map(([level, score, mark]) => <li key={level} data-mark={mark}><span>{level}</span>{mark === 'target' ? <small>Today’s target</small> : null}<b>{score}</b></li>)}
      </ol>
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
};
