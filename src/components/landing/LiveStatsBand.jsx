"use client";

import { useEffect, useState } from 'react';
import { loadPractisedCounts } from './landingStats.mjs';

// The proof line: one sentence, not three stat cards. The figures are the real practice bank, counted the same
// way as the hero's live line and from the same single read of the stored counts (landingStats.mjs: only the
// subjects a student can practise, not every subject the bank has ever stored), so the page never says two
// different numbers for one thing. The figure shows whole the moment it is known; nothing counts up. A figure
// that cannot load is not shown: the sentence simply does not render.
export function LiveStatsBand() {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    let alive = true;
    loadPractisedCounts().then((counted) => { if (alive && counted) setCounts(counted); });
    return () => { alive = false; };
  }, []);

  if (!counts) return null;

  return (
    <p className="lp-proofline">
      <b>{counts.questions.toLocaleString('en-IN')}</b> questions across <b>{counts.subjects}</b> CUET subjects, each marked the way CUET marks it: <b>+5</b> right, <b>−1</b> wrong.
    </p>
  );
}
