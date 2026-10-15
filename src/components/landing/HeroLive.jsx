"use client";

import { useEffect, useState } from 'react';
import { formatCount } from './liveCount.mjs';
import { loadPractisedCounts } from './landingStats.mjs';

// The hero's live line: the number of questions a student can practise in the 15 CUET subjects MockMob offers,
// from the stored daily counts (landingStats.mjs reads them once for the whole page; liveCount.mjs defines the
// number). It shows that one figure, whole, the moment it is known: nothing counts up, so no screenshot, reader or
// test ever sees a number that is not the count. The pulsing dot only ever sits beside a true number: until the
// counts answer, the line holds its place empty (so nothing below it moves), and if they never answer it stays empty.

export function HeroLive() {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    let alive = true;
    loadPractisedCounts().then((counted) => { if (alive && counted) setCounts(counted); });
    return () => { alive = false; };
  }, []);

  return (
    <p className="lp-live" data-ready={counts ? 'true' : 'false'}>
      {counts ? (
        <>
          <span className="lp-live__dot" aria-hidden="true" />
          <span className="lp-live__text">
            <b className="mm-measure">{formatCount(counts.questions)}</b> questions across {counts.subjects} CUET subjects
          </span>
        </>
      ) : null}
    </p>
  );
}
