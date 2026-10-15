"use client";

// The Start sheet's rows for this student (plan 2.2, 5.2).
//
// The hero is Tonight's move exactly as Today worked it out (published through shellSignals), so
// the two never disagree. When Today has not published one in this tab yet (a deep link straight to
// Practice, say), the sheet works it out from the same rules with the facts it can read cheaply:
// the sheet's subjects, the recent attempts list, the balances. Without the repair facts it never
// claims a repair it cannot count; the "Repair the next mistake" row still offers one.
// The attempts are read only when the sheet opens, once per account per page load.
import { useEffect, useMemo, useRef, useState } from 'react';
import { nextMove } from '@/../data/next_step_rules.mjs';
import { sheetRows } from './shellModel.mjs';
import { useShellSignal } from './shellSignals';

export function useStartSheet({ open = false, userId = null, user = null, aiBalance = null }) {
  const published = useShellSignal('move', userId);
  const tonight = useShellSignal('tonight', userId);
  // { userId, attempts, at, state: 'ready' | 'failed' } once the attempts list has been read.
  const [record, setRecord] = useState(null);
  const [subject, setSubject] = useState(null);
  const asked = useRef(null);
  const plan = user?.isPremium ? 'pro' : 'free';
  const balance = user?.creditBalance === null || user?.creditBalance === undefined || !Number.isFinite(Number(user.creditBalance)) ? null : Number(user.creditBalance);
  const sheetSubjects = user?.subjects;
  const subjects = useMemo(() => (Array.isArray(sheetSubjects) ? sheetSubjects.map((s) => (typeof s === 'string' ? s : s?.id)).filter(Boolean) : []), [sheetSubjects]);
  const needRecord = Boolean(open && userId && !published);

  useEffect(() => {
    if (!needRecord || asked.current === userId) return undefined;
    asked.current = userId;
    const controller = new AbortController();
    let settled = false;
    fetch('/api/attempts/summary?limit=20', { cache: 'no-store', signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`attempts ${res.status}`))))
      .then((body) => {
        settled = true;
        const attempts = (Array.isArray(body?.items) ? body.items : []).map((a) => ({ id: a.id, subject: a.subject, mode: a.mode, completedAt: a.completedAt }));
        setRecord({ userId, attempts, at: Date.now(), state: 'ready' });
      })
      .catch((error) => {
        settled = true;
        if (error?.name !== 'AbortError') setRecord({ userId, attempts: null, at: Date.now(), state: 'failed' });
      });
    // Closed (or Today published) before the read finished: forget it, so the next open asks again.
    return () => { if (!settled) { controller.abort(); asked.current = null; } };
  }, [needRecord, userId]);

  const mine = record?.userId === userId ? record : null;
  const fallbackMove = useMemo(() => (mine?.state === 'ready'
    ? nextMove({ now: mine.at, plan, practiceCredits: balance, aiCredits: aiBalance, subjects, attempts: mine.attempts, capabilities: { mistakeRepair: false } })
    : null), [mine, plan, balance, aiBalance, subjects]);
  const move = published || fallbackMove;
  const heroLoading = needRecord && !mine;
  const rows = useMemo(() => sheetRows({ move, plan, balance, aiBalance, subjects, tonight, selectedSubject: subject }),
    [move, plan, balance, aiBalance, subjects, tonight, subject]);
  return { rows, heroLoading, selectSubject: setSubject };
}
