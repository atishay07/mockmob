"use client";

import { useEffect, useRef, useState } from 'react';
import { Tick } from '@/components/pricing/ProShowcase';
import { loadPublicStats } from './bankStats';
import { useCountUp, useSeenOnce } from './useCountUp';

// The plan card's lines, in groups (R3-D7, owner LK107, 5 Nov 2026: the numbers band "5,700 questions, 15 subjects, 99 per
// month ... relevance is less", so its true counts moved into the one plan). Two lines carry a live number from /api/stats (the
// same answer the hero's bank line reads, bankStats.js): the questions in the public bank and the public subjects that hold
// questions. While the answer loads, the number's place shows a still placeholder; if it fails, the line says the same thing
// without a number (never a made-up figure). The numbers count up once, when the first counted line is 60% in view (useCountUp).
// R8 PRICE-01 (8 Nov 2026): the observer used to watch the whole groups block at 40%, so a student who stopped with only the
// first lines on screen (the nav Pricing jump lands there) read "0 questions in one live bank". Now the first counted line is
// watched, and until it has been seen a known number keeps the still placeholder; a real number never paints as 0.
// `groups` is homeCopy.mjs planGroups(): [{ label, lines: [{ text, em } | { count, rest, fallback }] }].
// Owner, 7 Nov 2026 ("you can highlight unlimited also, and keywords like that"): a text line's `em` (its quantity or scope word,
// homeCopy planEm) is drawn like the counted numbers, so "Unlimited", "every chapter", "50 credits a month" and "Every Key card"
// carry the same weight as the live counts. The sentence stays one run of text for a screen reader (the mark is a plain <b>).

function WordLine({ line }) {
  const at = line.em ? line.text.indexOf(line.em) : -1;
  if (at < 0) return line.text;
  return <>{line.text.slice(0, at)}<b className="lp-count lp-count--word">{line.em}</b>{line.text.slice(at + line.em.length)}</>;
}

function CountLine({ line, value, state, seen }) {
  if (state === 'failed' || (state === 'ready' && value == null)) return line.fallback;
  if (state === 'loading') return <><span className="lp-count lp-count--wait" aria-hidden="true" /> {line.rest}</>;
  // Known but not yet seen: the still placeholder for the eye, the real number for a screen reader.
  if (!seen) return <><span className="lp-count lp-count--wait" aria-hidden="true" /><span className="lp-sr">{value.real.toLocaleString('en-IN')}</span> {line.rest}</>;
  return <><b className="lp-count" aria-hidden="true">{value.shown.toLocaleString('en-IN')}</b><span className="lp-sr">{value.real.toLocaleString('en-IN')}</span> {line.rest}</>;
}

export function PlanCounts({ groups }) {
  const ref = useRef(null);
  const firstCount = groups.flatMap((group) => group.lines).find((line) => line.count);
  const [stats, setStats] = useState(undefined);
  useEffect(() => {
    let live = true;
    loadPublicStats().then((s) => { if (live) setStats(s ?? null); });
    return () => { live = false; };
  }, []);
  const seen = useSeenOnce(ref, 0.6);
  const bank = useCountUp(stats?.bankSize ?? null, seen);
  const subjects = useCountUp(stats?.subjects ?? null, seen);
  const state = stats === undefined ? 'loading' : stats === null ? 'failed' : 'ready';
  const values = {
    bank: stats?.bankSize ? { real: stats.bankSize, shown: bank ?? 0 } : null,
    subjects: stats?.subjects ? { real: stats.subjects, shown: subjects ?? 0 } : null,
  };

  return (
    <div className="lp-plan__groups" aria-busy={state === 'loading' || undefined}>
      {groups.map((group) => (
        <div key={group.label} className="lp-plan__group">
          <p className="lp-plan__label">{group.label}</p>
          <ul className="lp-plan__lines">
            {group.lines.map((line) => (
              <li key={line.count || line.text} ref={line === firstCount ? ref : undefined}>
                <Tick className="lp-plan__tick" />
                <span>{line.count ? <CountLine line={line} value={values[line.count]} state={state} seen={seen} /> : <WordLine line={line} />}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default PlanCounts;
