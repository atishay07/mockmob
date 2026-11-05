"use client";

import { useEffect, useRef, useState } from 'react';
import { Tick } from '@/components/pricing/ProShowcase';
import { loadPublicStats } from './bankStats';
import { useCountUp, useSeenOnce } from './useCountUp';

// The plan card's lines, in groups (R3-D7, owner LK107, 5 Nov 2026: the numbers band "5,700 questions, 15 subjects, 99 per
// month ... relevance is less", so its true counts moved into the one plan). Two lines carry a live number from /api/stats (the
// same answer the hero's bank line reads, bankStats.js): the questions in the public bank and the public subjects that hold
// questions. While the answer loads, the number's place shows a still placeholder; if it fails, the line says the same thing
// without a number (never a made-up figure). The numbers count up once, when the lines are 40% in view (useCountUp).
// `groups` is homeCopy.mjs planGroups(): [{ label, lines: [{ text } | { count, rest, fallback }] }].

function CountLine({ line, value, state }) {
  if (state === 'failed' || (state === 'ready' && value == null)) return line.fallback;
  if (state === 'loading') return <><span className="lp-count lp-count--wait" aria-hidden="true" /> {line.rest}</>;
  return <><b className="lp-count" aria-hidden="true">{value.shown.toLocaleString('en-IN')}</b><span className="lp-sr">{value.real.toLocaleString('en-IN')}</span> {line.rest}</>;
}

export function PlanCounts({ groups }) {
  const ref = useRef(null);
  const [stats, setStats] = useState(undefined);
  useEffect(() => {
    let live = true;
    loadPublicStats().then((s) => { if (live) setStats(s ?? null); });
    return () => { live = false; };
  }, []);
  const seen = useSeenOnce(ref, 0.4);
  const bank = useCountUp(stats?.bankSize ?? null, seen);
  const subjects = useCountUp(stats?.subjects ?? null, seen);
  const state = stats === undefined ? 'loading' : stats === null ? 'failed' : 'ready';
  const values = {
    bank: stats?.bankSize ? { real: stats.bankSize, shown: bank ?? 0 } : null,
    subjects: stats?.subjects ? { real: stats.subjects, shown: subjects ?? 0 } : null,
  };

  return (
    <div className="lp-plan__groups" ref={ref} aria-busy={state === 'loading' || undefined}>
      {groups.map((group) => (
        <div key={group.label} className="lp-plan__group">
          <p className="lp-plan__label">{group.label}</p>
          <ul className="lp-plan__lines">
            {group.lines.map((line) => (
              <li key={line.count || line.text}>
                <Tick className="lp-plan__tick" />
                <span>{line.count ? <CountLine line={line} value={values[line.count]} state={state} /> : line.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default PlanCounts;
