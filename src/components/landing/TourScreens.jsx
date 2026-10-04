"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
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
// stage. Inactive and reduced-motion screens are settled. Values are illustrative.

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
        {right ?? <span className="ts__badge">Example</span>}
      </div>
      <div className="ts__body">{children}</div>
    </figure>
  );
}

const on = (value) => (value ? 'true' : 'false');

// ---------- 1. Practice ----------
const PRACTICE_T = [250, 500, 750, 1500, 2300];
const PRACTICE_OPTS = ['Liabilities side', 'Assets side', 'Reserves and surplus'];
export function PracticeScreen({ play }) {
  const step = useSteps(play, PRACTICE_T);
  const clock = useCountdown(play, 38 * 60 + 12);
  return (
    <Frame title="Full mock · Accountancy" step={step} right={<span className="ts__timer">{clock}</span>}>
      <p className="ts__meta">Question 22 of 50</p>
      <p className="ts__q">A partner’s capital account shows a debit balance. Where does it go in the balance sheet?</p>
      <ul className="ts__opts">
        {PRACTICE_OPTS.map((text, i) => (
          <li key={text} data-in={on(step > i)} data-picked={on(i === 1 && step >= 4)}>
            <b>{'ABC'[i]}</b><span>{text}</span>
            {i === 1 ? <span className="ts__tap" data-on={on(step === 4)} aria-hidden="true" /> : null}
            {i === 1 && step >= 4 ? <Check size={15} className="ts__tick" aria-hidden="true" /> : null}
          </li>
        ))}
      </ul>
      <div className="ts__progress" aria-hidden="true"><i style={{ '--p': step >= 5 ? '44%' : '42%' }} /></div>
      <p className="ts__meta ts__meta--row"><span>{step >= 5 ? 22 : 21} of 50 answered</span><span data-on={on(step >= 5)} className="ts__saved">Saved</span></p>
    </Frame>
  );
}

// ---------- 2. Mistake Repair ----------
const REPAIR_T = [300, 950, 1600, 2300, 3000];
const REPAIR_ROWS = [
  ['AI solved it on its own', 'Its answer: B, assets side'],
  ['Matches the official key', 'So it is safe to explain'],
  ['Why A felt right', 'Capital normally sits with liabilities.'],
  ['The idea to keep', 'A debit capital balance is owed to the firm: an asset.'],
];
export function RepairScreen({ play }) {
  const step = useSteps(play, REPAIR_T);
  return (
    <Frame title="Mistake Repair" step={step}>
      <ol className="ts__steps">
        {REPAIR_ROWS.map(([title, detail], i) => (
          <li key={title} data-in={on(step > i)} data-key={on(i === 3)}>
            <span className="ts__dot">{i < 2 ? <Check size={13} aria-hidden="true" /> : i + 1}</span>
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
    <Frame title="Lock it in · Vocabulary" step={step} right={<span className="ts__badge">Card 1 of 5</span>}>
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
const REPLAY_T = [300, 800, 1300, 2100, 2800];
export function ReplayScreen({ play }) {
  const step = useSteps(play, REPLAY_T);
  const changed = step >= 4;
  return (
    <Frame title="Mistake Replay · Q4" step={step}>
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
      <p className="ts__note" data-in={on(step >= 5)}>Coming back to this one cost you <b>6 marks</b>.</p>
    </Frame>
  );
}

// ---------- 4. Radar ----------
const RADAR_T = [250, 500, 750, 1000, 1700];
const RADAR_ROWS = [
  ['Partner retirement', 'Accountancy', 38],
  ['Money and banking', 'Economics', 52],
  ['Reading passages', 'English', 61],
  ['Cash flow', 'Accountancy', 84],
];
export function RadarScreen({ play }) {
  const step = useSteps(play, RADAR_T);
  return (
    <Frame title="Radar · after one mock" step={step}>
      <ul className="ts__bars">
        {RADAR_ROWS.map(([chapter, subject, pct], i) => (
          <li key={chapter} data-in={on(step > i)} data-low={on(pct < 50)}>
            <span className="ts__bars-name"><b>{chapter}</b><small>{subject}</small>{i === 0 ? <span className="ts__flag" data-in={on(step >= 5)}>Fix first</span> : null}</span>
            <span className="ts__bars-track" aria-hidden="true"><i style={{ '--w': `${pct}%` }} /></span>
            <em>{pct}%</em>
          </li>
        ))}
      </ul>
      <p className="ts__note" data-in={on(step >= 5)}>Partner retirement costs more marks than the next two chapters combined.</p>
    </Frame>
  );
}

// ---------- 5. PrepOS ----------
const PREP_T = [1250, 1900, 2250, 2600, 2950];
const PREP_PLAN = [['20 min', 'Retirement: 10 fresh questions'], ['10 min', 'Re-read the two you changed'], ['Tomorrow', 'One timed half mock']];
export function PrepOSScreen({ play }) {
  const step = useSteps(play, PREP_T);
  const asked = useTyped(play, 'What should I do tonight?');
  return (
    <Frame title="PrepOS" step={step}>
      <p className="ts__bubble ts__bubble--me">{asked}<i className="ts__caret" data-on={on(asked.length < 25)} aria-hidden="true" /></p>
      {step === 1 ? <p className="ts__typing" aria-hidden="true"><i /><i /><i /></p> : null}
      <div className="ts__bubble ts__bubble--ai" data-in={on(step >= 2)}>
        <p>Retirement in Accountancy cost you the most this week. Tonight:</p>
        <ol>
          {PREP_PLAN.map(([time, what], i) => <li key={what} data-in={on(step >= 3 + i)}><b>{time}</b>{what}</li>)}
        </ol>
      </div>
    </Frame>
  );
}

// ---------- 6. Compass ----------
const COMPASS_T = [300, 800, 1300, 1900];
const COMPASS_ROWS = [['SRCC', 'B.Com (Hons)', 80, 'Stretch', 'far'], ['Hindu College', 'B.A. (Hons) Economics', 72, 'Close', 'near'], ['Hansraj College', 'B.Com (Hons)', 62, 'Clears it', 'in']];
export function CompassScreen({ play }) {
  const step = useSteps(play, COMPASS_T);
  return (
    <Frame title="Compass · your shortlist" step={step}>
      <p className="ts__meta">Your practice range against 2026 Round I cutoffs</p>
      <ul className="ts__compass">
        {COMPASS_ROWS.map(([college, course, cut, label, fit], i) => (
          <li key={college} data-in={on(step > i)}>
            <span className="ts__compass-name"><b>{college}</b><small>{course}</small></span>
            <span className="ts__compass-track" aria-hidden="true"><i className="ts__cut" style={{ '--x': `${cut}%` }} /><i className="ts__you" style={{ '--x': '70%' }} /></span>
            <em data-fit={fit} data-in={on(step >= 4)}>{label}</em>
          </li>
        ))}
      </ul>
      <p className="ts__legend"><span><i className="ts__you-key" />You</span><span><i className="ts__cut-key" />Cutoff</span></p>
    </Frame>
  );
}

// ---------- 7. Combo Planner ----------
const COMBO_T = [300, 550, 800, 1050, 1300, 2000];
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
        <li><Check size={14} aria-hidden="true" />B.Com (Hons)</li>
        <li><Check size={14} aria-hidden="true" />B.A. (Hons) Economics</li>
      </ul>
      <p className="ts__note" data-in={on(step >= 6)}>Checked against the published 2026 DU rules.</p>
    </Frame>
  );
}

// ---------- 8. Benchmarks ----------
const BENCH_T = [300, 2200];
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
