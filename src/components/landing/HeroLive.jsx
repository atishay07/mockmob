"use client";

import { useEffect, useState } from 'react';
import { formatCount } from './liveCount.mjs';
import { loadPractisedCounts } from './landingStats.mjs';

// The hero's live line: the number of questions a student can practise in the 15 CUET subjects MockMob offers,
// from the stored daily counts (landingStats.mjs reads them once for the whole page; liveCount.mjs defines the
// number). It shows that one figure, whole, the moment it is known: nothing counts up, so no screenshot, reader or
// test ever sees a number that is not the count. It is a plain sentence in the small print: no dot, no ping and no
// mono figure, because the count is a daily recount, not a live feed. The server passes the counts it read for the
// page (initial: { questions, subjects }), so the line is in the first HTML; the client read only refreshes it.
// Without either, the line holds its place empty (so nothing below it moves).

// The 15 public subjects carried 94.9% of CUET UG paper registrations in 2026 (NTA totals; docs/brain/
// SUBJECT-COVERAGE-2026-10-17.md), so the line says "19 of every 20 papers" only while all 15 have questions to
// practise; with fewer it falls back to the plain count. It never names the stored total of every subject.
const COVERED_SUBJECTS = 15;

export function HeroLive({ initial = null }) {
  const [counts, setCounts] = useState(initial?.questions > 0 ? initial : null);

  useEffect(() => {
    let alive = true;
    loadPractisedCounts().then((counted) => { if (alive && counted) setCounts(counted); });
    return () => { alive = false; };
  }, []);

  return (
    <p className="lp-live" data-ready={counts ? 'true' : 'false'}>
      {counts ? (
        <span className="lp-live__text">
          <b>{formatCount(counts.questions)}</b> questions to practise{counts.subjects === COVERED_SUBJECTS ? ` in the ${COVERED_SUBJECTS} subjects behind 19 of every 20 CUET papers.` : ` across ${counts.subjects} CUET subjects.`}
        </span>
      ) : null}
    </p>
  );
}
