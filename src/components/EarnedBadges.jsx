"use client";

// The earned moment on the result (BADGES-REFINE-1018 section 3): when this scored set earned a badge, one compact
// row near the top of the analysis says so: the medal, its name and the way to the shelf. The medal reveals once
// (scale 0.85 to 1 and one light sweep, 600 ms; a 150 ms fade under reduced motion). Never a modal, and never
// shown twice: each badge is remembered on this device with the date the server gave it (lib/badgeShelf.js).
// Two earned together are one row: "2 badges earned". A badge counts only with a real date from the server's list;
// if that list cannot be read the row simply is not drawn (the badge is on Progress either way).
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/fetcher';
import { useInView } from '@/lib/motion/useInView';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { Medal } from '@/components/Medal';
import { badgePathsFromApi } from '@/lib/studyBadges';
import { earnedByAttempt, markSeen, momentWords, unseen } from '@/lib/badgeShelf';
import './study-badges.css';

// Badges already shown in this tab, so a blocked localStorage cannot make a row come back on a client-side return.
const shownThisTab = new Set();
const tabKey = (s) => `${s.id}:${s.earnedAt}`;

function storageOrNull() {
  try { return window.localStorage; } catch { return null; }
}

export default function EarnedBadges({ attempt }) {
  const id = attempt?.id;
  const completedAt = attempt?.completedAt;
  const [steps, setSteps] = useState(null);
  const [ref, inView] = useInView({ threshold: 0.5 });
  const { reduced } = useMobiPrefs();
  const marked = useRef(false);

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    marked.current = false;
    // The route lets the browser keep its answer for a minute; this read follows a save, so it asks the server whether anything changed
    // (a 304 costs nothing) and the server has dropped its own 5-minute copy (forgetBadges on the routes that save an attempt).
    api('/api/me/badges', { cache: 'no-cache' }).then((body) => {
      if (!alive) return;
      const board = badgePathsFromApi(body);
      if (!board) return;
      const fresh = unseen(storageOrNull(), earnedByAttempt(board.paths, board.records, { id, completedAt }, Date.now())).filter((s) => !shownThisTab.has(tabKey(s)));
      if (fresh.length) setSteps(fresh);
    }).catch(() => { /* No row: the badge is on Progress either way. */ });
    return () => { alive = false; };
  }, [id, completedAt]);

  // Shown means on screen: it is remembered once the row has been seen, so a row that never scrolled into view is still owed.
  useEffect(() => {
    if (!steps || !inView || marked.current) return;
    marked.current = true;
    markSeen(storageOrNull(), steps);
    steps.forEach((s) => shownThisTab.add(tabKey(s)));
  }, [steps, inView]);

  const words = steps ? momentWords(steps) : null;
  if (!words) return null;
  const armed = inView || reduced;
  return (
    <section ref={ref} className="sb-earned" aria-label={words.title} data-armed={armed ? 'true' : 'false'} role="status">
      <div className="sb-earned__medals">
        {steps.slice(0, 3).map((s) => <Medal key={s.id} id={s.id} status="earned" size="row" reveal />)}
      </div>
      <div className="sb-earned__text">
        <b>{words.title}</b>
        <span>{words.detail}</span>
      </div>
      <Link className="sb-link sb-earned__link" href="/progress#badges">See your badges</Link>
    </section>
  );
}
