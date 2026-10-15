"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ShieldCheck, X } from 'lucide-react';
import { createDemoPlayback } from '@/../data/demo_playback.mjs';

export const DemoPlaybackContext = createContext({ active: false, reduced: false });

function useSequence(play, events, settled) {
  const { active, reduced } = useContext(DemoPlaybackContext);
  const clock = useRef(null);
  const [value, setValue] = useState(settled);
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
// slide becomes active, then holds the finished state. Paused and hidden demos retain their current
// stage. Inactive and reduced-motion screens are settled. Values are illustrative. Every screen carries two
// beats of real content (the moment, then what follows from it) and they all come out about the same
// height, because the tour's tools share one card and a short screen would leave an empty slab.

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

/** Types `text` out while playing; shows it whole otherwise. */
function useTyped(play, text, { delay = 250, every = 38 } = {}) {
  const events = useMemo(() => [{ at: 0, value: 0 }, ...Array.from({ length: text.length }, (_, i) => ({ at: delay + (i + 1) * every, value: i + 1 }))], [text, delay, every]);
  const count = useSequence(play, events, text.length);
  return text.slice(0, count);
}

function Frame({ title, right, step, className = '', children }) {
  return (
    <figure className={`ts ${className}`} data-step={step}>
      <div className="ts__bar">
        <span className="ts__live" aria-hidden="true" />
        <span className="ts__title">{title}</span>
        {right ?? null}
      </div>
      <div className="ts__body">{children}</div>
    </figure>
  );
}

const on = (value) => (value ? 'true' : 'false');

// ---------- 1. Practice ----------
const PRACTICE_T = [200, 400, 600, 800, 1500, 2300];
const PRACTICE_OPTS = ['Liabilities side', 'Assets side', 'Reserves and surplus', 'Not shown at all'];
export function PracticeScreen({ play }) {
  const step = useSteps(play, PRACTICE_T);
  const clock = useCountdown(play, 38 * 60 + 12);
  return (
    <Frame title="Accountancy full mock" step={step} right={<span className="ts__timer">{clock}</span>}>
      <p className="ts__meta">Question 22 of 50</p>
      <p className="ts__q">A partner’s capital account shows a debit balance. Where does it go in the balance sheet?</p>
      <ul className="ts__opts">
        {PRACTICE_OPTS.map((text, i) => (
          <li key={text} data-in={on(step > i)} data-picked={on(i === 1 && step >= 5)}>
            <b>{'ABCD'[i]}</b><span>{text}</span>
            {i === 1 ? <span className="ts__tap" data-on={on(step === 5)} aria-hidden="true" /> : null}
            {i === 1 && step >= 5 ? <Check size={15} className="ts__tick" aria-hidden="true" /> : null}
          </li>
        ))}
      </ul>
      <div className="ts__progress" aria-hidden="true"><i style={{ '--p': step >= 6 ? '44%' : '42%' }} /></div>
      <p className="ts__meta ts__meta--row"><span>{step >= 6 ? 22 : 21} of 50 answered</span><span data-on={on(step >= 6)} className="ts__saved">Saved</span></p>
    </Frame>
  );
}

// ---------- 2. Mistake Repair ----------
const REPAIR_T = [250, 750, 1250, 1750, 2350];
const REPAIR_ROWS = [
  ['Why A looked right', 'Capital usually sits on the liabilities side.'],
  ['Where it breaks', 'A debit balance means the partner owes the firm.'],
  ['Why B is right', 'Money owed to the firm is an asset.'],
];
export function RepairScreen({ play }) {
  const step = useSteps(play, REPAIR_T);
  return (
    <Frame title="Mistake Repair" step={step} right={<span className="ts__badge">Q22</span>}>
      <p className="ts__pick"><span data-tone="bad"><b>A</b>Your answer</span><span data-tone="good"><b>B</b>Official key</span></p>
      <p className="ts__check" data-in={on(step >= 1)}><ShieldCheck size={14} aria-hidden="true" />Solved by the AI first. It matches the key.</p>
      <ol className="ts__steps">
        {REPAIR_ROWS.map(([title, detail], i) => (
          <li key={title} data-in={on(step >= 2 + i)} data-key={on(i === 2)}>
            <span className="ts__dot">{i + 1}</span>
            <p><b>{title}</b>{detail}</p>
          </li>
        ))}
      </ol>
      <p className="ts__cta" data-in={on(step >= 5)}>5 fresh questions on this idea<ArrowRight size={14} aria-hidden="true" /></p>
    </Frame>
  );
}

// ---------- 2b. Learn ----------
// A real released recall card (WordNet 3.0 sense and example), shown as it appears after a lesson.
const LEARN_T = [300, 700, 1100, 1500, 2300, 3000];
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
      <p className="ts__cta" data-in={on(step >= 6)}>Then: practise Vocabulary questions<ArrowRight size={14} aria-hidden="true" /></p>
    </Frame>
  );
}

// ---------- 3. Mistake Replay ----------
const REPLAY_T = [250, 650, 1050, 1700, 2300, 2800];
const REPLAY_MORE = [['Q8', 'A at 1:05, then C at 2:41', '−6', 'bad'], ['Q9', 'D at 0:30, then B at 1:50', '+6', 'good']];
export function ReplayScreen({ play }) {
  const step = useSteps(play, REPLAY_T);
  const changed = step >= 4;
  return (
    <Frame title="Replay, question 4" step={step}>
      <div className="ts__timeline">
        <div className="ts__node" data-in={on(step >= 1)}><span className="ts__node-dot" data-tone="good"><Check size={14} aria-hidden="true" /></span><b>00:42</b><small>Picked B</small></div>
        <i className="ts__line" data-in={on(step >= 2)} aria-hidden="true" />
        <div className="ts__node" data-in={on(step >= 3)}><span className="ts__node-dot" data-tone="bad"><X size={14} aria-hidden="true" /></span><b>03:18</b><small>Changed to D</small></div>
      </div>
      <div className="ts__verdict" data-changed={on(changed)}>
        <span className="ts__opt">{changed ? 'D' : 'B'}</span>
        <p><b>{changed ? 'Incorrect' : 'Correct'}</b>{changed ? 'After the change' : 'First answer'}</p>
        <strong className="ts__marks">{changed ? '−1' : '+5'}<small>marks</small></strong>
      </div>
      <p className="ts__note" data-in={on(step >= 5)}>Going back to this one cost you <b>6 marks</b>.</p>
      <ul className="ts__also" data-in={on(step >= 6)} aria-label="Other answers changed in this mock">
        {REPLAY_MORE.map(([q, what, marks, tone]) => <li key={q}><b>{q}</b><span>{what}</span><em data-tone={tone}>{marks}</em></li>)}
      </ul>
    </Frame>
  );
}

// ---------- 4. Radar ----------
const RADAR_T = [200, 400, 600, 800, 1000, 1200, 1800];
const RADAR_ROWS = [
  ['Partner retirement', 'Accountancy', 38],
  ['Money and banking', 'Economics', 52],
  ['Reading passages', 'English', 61],
  ['Business environment', 'Business Studies', 68],
  ['Ratio analysis', 'Accountancy', 76],
  ['Cash flow', 'Accountancy', 84],
];
export function RadarScreen({ play }) {
  const step = useSteps(play, RADAR_T);
  return (
    <Frame title="Radar after one mock" step={step}>
      <ul className="ts__bars">
        {RADAR_ROWS.map(([chapter, subject, pct], i) => (
          <li key={chapter} data-in={on(step > i)} data-low={on(pct < 50)}>
            <span className="ts__bars-name"><b>{chapter}</b><small>{subject}</small>{i === 0 ? <span className="ts__flag" data-in={on(step >= 7)}>Fix first</span> : null}</span>
            <span className="ts__bars-track" aria-hidden="true"><i style={{ '--w': `${pct}%` }} /></span>
            <em>{pct}%</em>
          </li>
        ))}
      </ul>
      <p className="ts__note" data-in={on(step >= 7)}>Partner retirement lost the most marks. Tonight starts there.</p>
    </Frame>
  );
}

// ---------- 5. PrepOS ----------
const PREP_T = [1150, 1650, 1950, 2250, 2550, 2950];
const PREP_PLAN = [['20 min', 'Retirement: 10 fresh questions'], ['10 min', 'Re-read the two you changed'], ['Tomorrow', 'One timed half mock']];
export function PrepOSScreen({ play }) {
  const step = useSteps(play, PREP_T);
  const asked = useTyped(play, 'What should I do tonight?');
  return (
    <Frame title="PrepOS" step={step} right={<span className="ts__badge">Your record</span>}>
      <p className="ts__bubble ts__bubble--me">{asked}<i className="ts__caret" data-on={on(asked.length < 25)} aria-hidden="true" /></p>
      <div className="ts__reply">
        {step === 1 ? <p className="ts__typing" aria-hidden="true"><i /><i /><i /></p> : null}
        <div className="ts__bubble ts__bubble--ai" data-in={on(step >= 2)}>
          <p className="ts__ai-head"><span className="ts__mobi" aria-hidden="true"><i /><i /></span><b>Mobi</b><small>from your last 3 mocks</small></p>
          <p>Retirement in Accountancy cost you the most this week. Tonight:</p>
          <ol>
            {PREP_PLAN.map(([time, what], i) => <li key={what} data-in={on(step >= 3 + i)}><b>{time}</b>{what}</li>)}
          </ol>
          <p className="ts__replies" data-in={on(step >= 6)}><span data-main="true">Start the 10<ArrowRight size={12} aria-hidden="true" /></span><span>Why this?</span></p>
        </div>
      </div>
    </Frame>
  );
}

// ---------- 6. Compass ----------
const COMPASS_T = [250, 600, 950, 1300, 1800, 2300];
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
const COMBO_T = [250, 450, 650, 850, 1050, 1600, 2200];
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
const BENCH_T = [250, 1900, 2500];
const BENCH_LADDER = [['DU level', '88%'], ['College level', '82%'], ['Daily', '78%', 'target'], ['You, today', '72%', 'you']];
export function BenchmarkScreen({ play }) {
  const step = useSteps(play, BENCH_T);
  const clock = useCountdown(play, 4 * 60 + 30);
  return (
    <Frame title="Daily benchmark" step={step} right={<span className="ts__timer">{clock}</span>}>
      <p className="ts__meta">25 questions. Hold 78% accuracy at 55 seconds a question.</p>
      <div className="ts__lanes">
        <div className="ts__lane" data-run={on(step >= 1)}><span>Your run</span><i><b style={{ '--w': '72%', '--t': '1.7s' }} /></i><em>72%</em></div>
        <div className="ts__lane" data-run={on(step >= 1)} data-target="true"><span>Target</span><i><b style={{ '--w': '78%', '--t': '1.2s' }} /></i><em>78%</em></div>
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
