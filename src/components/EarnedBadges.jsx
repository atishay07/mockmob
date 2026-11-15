"use client";

// The earned moment on the result (BADGES-REFINE-1018 section 3; lane "badges", 16 Nov 2026): when this scored set earned a
// badge, the mark comes down onto the page right after the summary, with its name, what the student did and what the next
// one needs (BadgeMoment.jsx). Never a modal: the page's volt key stays above it, reachable. Never shown twice: each badge is
// remembered on this device with the date the server gave it (lib/badgeShelf.js). Two or three earned together are one
// moment. A badge counts only with a real date from the server's list; if that list cannot be read nothing is drawn (the
// badge is on Progress either way). Its own markup and styles only, so the result page's layout around it is free to change.
import { useEffect, useState } from 'react';
import { api } from '@/lib/fetcher';
import { badgePathsFromApi } from '@/lib/studyBadges';
import { earnedByAttempt, markSeen, unseen } from '@/lib/badgeShelf';
import { markPaperLooked } from '@/lib/badgeMoment';
import { BadgeMomentView, shownThisTab, storageOrNull, tabKey } from '@/components/BadgeMoment';
import './study-badges.css';

export default function EarnedBadges({ attempt }) {
  const id = attempt?.id;
  const completedAt = attempt?.completedAt;
  const [found, setFound] = useState(null); // { board, steps }

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    // The route lets the browser keep its answer for a minute; this read follows a save, so it asks the server whether anything changed
    // (a 304 costs nothing) and the server has dropped its own 5-minute copy (forgetBadges on the routes that save an attempt).
    api('/api/me/badges', { cache: 'no-cache' }).then((body) => {
      if (!alive) return;
      const board = badgePathsFromApi(body);
      if (!board) return;
      const fresh = unseen(storageOrNull(), earnedByAttempt(board.paths, board.records, { id, completedAt }, Date.now())).filter((s) => !shownThisTab.has(tabKey(s)));
      if (fresh.length) setFound({ board, steps: fresh.slice(0, 3), all: fresh });
      // Nothing owed by this paper: Today need not look for it again.
      else markPaperLooked(storageOrNull(), id);
    }).catch(() => { /* No moment: the badge is on Progress either way. */ });
    return () => { alive = false; };
  }, [id, completedAt]);

  if (!found) return null;
  // Shown means on screen: it is remembered once the moment has been seen, so one that never scrolled into view is still owed
  // (Today shows it then).
  const onSeen = () => {
    const storage = storageOrNull();
    markSeen(storage, found.all);
    found.all.forEach((s) => shownThisTab.add(tabKey(s)));
    markPaperLooked(storage, id);
  };
  return <BadgeMomentView board={found.board} steps={found.steps} onSeen={onSeen} where="result" />;
}
