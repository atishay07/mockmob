"use client";

import { useEffect, useState } from 'react';
import { loadLandingStats } from './landingStats.mjs';

// The subject lineup's fact line: the real number of questions a student can practise in one paper, from the
// stored daily counts. The server passes the count it read for the page (initial), so it is in the first HTML; the
// page's one client read (landingStats.mjs, shared with the hero's live line) then refreshes it. Without either,
// the line keeps its height empty, so nothing below it moves. Nothing is ever estimated or rounded up.

// General Test is stored under its internal id.
const STORED_ID = { general_test: 'gat' };

const whole = (value) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function SubjectCount({ id, initial = null }) {
  const [count, setCount] = useState(() => whole(initial));

  useEffect(() => {
    let alive = true;
    loadLandingStats().then((data) => {
      const n = whole(data?.subjectCounts?.[STORED_ID[id] || id]);
      if (alive && n) setCount(n);
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
