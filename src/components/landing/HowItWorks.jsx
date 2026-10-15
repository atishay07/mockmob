"use client";

import { useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { ExamComparator } from './ExamComparator';
import { PLAN_FACTS } from '@/../data/plan_facts.mjs';

// How it works (web IA plan 4.2, section 2): the loop as 4 steps, each with a real product screen
// drawn from example data. One "Example" tag covers the section. Choosing a step swaps the screen
// with a short crossfade; nothing plays by itself. Tabs follow the WAI-ARIA tabs pattern (arrow
// keys, Home and End move between steps).
const REPAIR_COST = PLAN_FACTS.aiCredits.repairCost.value;
const QUICK_COUNT = PLAN_FACTS.sessions.quickCounts.value[1];

export const HOW_STEPS = Object.freeze([
  { id: 'mock', label: 'Take a mock', line: 'Timed, in your own subjects, on the MockMob screen or the NTA-style one.' },
  { id: 'marks', label: 'See what cost marks', line: 'Every answer is traced to its chapter, including the answers you changed.' },
  { id: 'repair', label: 'Repair the mistake', line: `Why your pick was tempting, why the key is right, and a rule to keep. ${REPAIR_COST} AI credit for each mistake.` },
  { id: 'practise', label: 'Practise the chapter', line: 'A short set on the chapter that cost you most. Then your next mock.' },
]);

function MarksScreen() {
  return (
    <div className="lp-shot">
      <p className="lp-shot__head">Accountancy mock, question 14</p>
      <p className="lp-shot__title">Partnership: goodwill on admission</p>
      <ol className="lp-shot__steps">
        <li data-tone="good"><Check size={16} aria-hidden="true" /><span><b>First answer</b> C, sacrificing ratio</span><span className="lp-shot__pts">+5</span></li>
        <li data-tone="bad"><X size={16} aria-hidden="true" /><span><b>Changed to</b> A, new ratio</span><span className="lp-shot__pts">-1</span></li>
      </ol>
      <p className="lp-shot__big">That change turned +5 into -1.</p>
      <p className="lp-shot__note">You changed 3 answers in this mock. 2 went from right to wrong.</p>
    </div>
  );
}

function RepairScreen() {
  return (
    <div className="lp-shot">
      <p className="lp-shot__head">Mistake 1 of 4, Partnership</p>
      <dl className="lp-shot__repair">
        <div><dt>Why new ratio was tempting</dt><dd>New ratio shares future profits, so it feels like the ratio for anything that happens at admission.</dd></div>
        <div><dt>Why sacrificing ratio is right</dt><dd>Goodwill pays the old partners for the share they give up. What each gives up is the sacrificing ratio.</dd></div>
        <div className="lp-shot__rule"><dt>Rule to keep</dt><dd>Goodwill follows the sacrifice.</dd></div>
      </dl>
      <p className="lp-shot__note">Explain it another way is included. {REPAIR_COST} AI credit for this mistake.</p>
    </div>
  );
}

function PractiseScreen() {
  return (
    <div className="lp-shot">
      <p className="lp-shot__head">After this mock</p>
      <p className="lp-shot__title">Do these next</p>
      <ul className="lp-shot__rows">
        <li><span><b>Partnership, {QUICK_COUNT} questions</b><span>3 of 4 wrong in this mock</span></span><span className="lp-shot__time">about {QUICK_COUNT} min</span></li>
        <li><span><b>Money and banking, {QUICK_COUNT} questions</b><span>2 of 3 wrong, and slow on both</span></span><span className="lp-shot__time">about {QUICK_COUNT} min</span></li>
      </ul>
      <p className="lp-shot__note">One tap sets it up. Nothing is spent until you press Start.</p>
    </div>
  );
}

export default function HowItWorks() {
  const [active, setActive] = useState(0);
  const tabsRef = useRef([]);
  const step = HOW_STEPS[active];

  function choose(i, focus = false) {
    const next = (i + HOW_STEPS.length) % HOW_STEPS.length;
    setActive(next);
    if (focus) tabsRef.current[next]?.focus();
  }

  function onKey(event) {
    const moves = { ArrowRight: active + 1, ArrowDown: active + 1, ArrowLeft: active - 1, ArrowUp: active - 1, Home: 0, End: HOW_STEPS.length - 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    choose(moves[event.key], true);
  }

  return (
    <div className="lp-how">
      <div className="lp-how__steps" role="tablist" aria-label="How it works" onKeyDown={onKey}>
        {HOW_STEPS.map((s, i) => (
          <button
            key={s.id}
            ref={(node) => { tabsRef.current[i] = node; }}
            type="button"
            role="tab"
            id={`how-tab-${s.id}`}
            aria-selected={i === active}
            aria-controls="how-panel"
            tabIndex={i === active ? 0 : -1}
            className="lp-how__step"
            onClick={() => choose(i)}
          >
            <span className="lp-how__copy"><b>{s.label}</b><span>{s.line}</span></span>
          </button>
        ))}
      </div>
      <div className="lp-how__stage" role="tabpanel" id="how-panel" aria-labelledby={`how-tab-${step.id}`}>
        <p className="lp-how__tag">Example</p>
        {/* On phones the step list shows labels only, so the chosen step's line sits here. */}
        <p className="lp-how__line">{step.line}</p>
        <div className="lp-how__screen" key={step.id}>
          {step.id === 'mock' ? (
            <>
              <ExamComparator />
              <p className="lp-how__fine">NTA mode is Pro. This preview is free.</p>
            </>
          ) : null}
          {step.id === 'marks' ? <MarksScreen /> : null}
          {step.id === 'repair' ? <RepairScreen /> : null}
          {step.id === 'practise' ? <PractiseScreen /> : null}
        </div>
      </div>
    </div>
  );
}
