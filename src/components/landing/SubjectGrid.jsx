"use client";

import { useEffect, useState } from 'react';
import { loadLandingStats } from './landingStats.mjs';

// The subject lineup's fact line: the real number of questions a student can practise in one paper, from the
// page's one read of the stored daily counts (landingStats.mjs, shared with the hero's live line and the proof
// sentence). Until the counts answer, the line keeps its height empty, so nothing below it moves; if they never
// answer it stays empty. Nothing is ever estimated or rounded up.

// General Test is stored under its internal id.
const STORED_ID = { general_test: 'gat' };

export function SubjectCount({ id }) {
  const [count, setCount] = useState(null);

  useEffect(() => {
    let alive = true;
    loadLandingStats().then((data) => {
      const n = Math.floor(Number(data?.subjectCounts?.[STORED_ID[id] || id]));
      if (alive && Number.isFinite(n) && n > 0) setCount(n);
    });
    return () => { alive = false; };
  }, [id]);

  return (
    <span className="lp-shelf__fact" data-ready={count ? 'true' : 'false'}>
      {count ? `${count.toLocaleString('en-IN')} questions` : null}
    </span>
  );
}

export default SubjectCount;
