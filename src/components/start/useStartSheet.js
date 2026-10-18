"use client";

// The Start sheet's data for this student.
//
// The hero is the same next step Today shows: /api/learning/plan, read when the sheet opens (once per
// account per page load, again after two minutes, so a finished session moves it on). While it loads
// the hero keeps its place with a skeleton; if it fails the other rows still work and the hero says
// so in one quiet line. The chosen subject is remembered on this device only.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { SUBJECT_KEY, pickSubject, startRows, startSubjects } from './startModel.mjs';
import { useDailySet } from '@/lib/useDailySet';

const FRESH_MS = 120_000;

function readStored() {
  try { return window.localStorage.getItem(SUBJECT_KEY); } catch { return null; }
}
function writeStored(value) {
  try { window.localStorage.setItem(SUBJECT_KEY, value); } catch { /* Private mode: a convenience only. */ }
}

export function useStartSheet({ open = false, user = null }) {
  const userId = user?.id || null;
  const pro = Boolean(user?.isPremium);
  const balance = user?.creditBalance === null || user?.creditBalance === undefined || !Number.isFinite(Number(user.creditBalance)) ? null : Number(user.creditBalance);
  const userSubjects = user?.subjects;
  const subjects = useMemo(() => startSubjects(userSubjects), [userSubjects]);
  const [chosen, setChosen] = useState(null);
  // { userId, plan, state: 'ready' | 'failed' }
  const [record, setRecord] = useState(null);
  const [nonce, setNonce] = useState(0);
  const inflight = useRef(null);
  const tonightKey = `tonight-start-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // The stored subject, read once the sheet first opens (never during server render).
  useEffect(() => {
    if (!open || chosen !== null) return;
    const id = window.setTimeout(() => setChosen(pickSubject(subjects, readStored()) || ''), 0);
    return () => window.clearTimeout(id);
  }, [open, chosen, subjects]);

  const mine = record?.userId === userId ? record : null;
  const fetched = useRef({ userId: null, at: 0 });

  useEffect(() => {
    if (!open || !userId || inflight.current === userId) return undefined;
    const last = fetched.current;
    if (last.userId === userId && Date.now() - last.at < FRESH_MS) return undefined;
    inflight.current = userId;
    const controller = new AbortController();
    let settled = false;
    fetch('/api/learning/plan', { cache: 'no-store', signal: controller.signal, credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`plan ${res.status}`))))
      .then((plan) => {
        settled = true;
        inflight.current = null;
        fetched.current = { userId, at: Date.now() };
        setRecord({ userId, plan, state: 'ready' });
      })
      .catch((error) => {
        settled = true;
        inflight.current = null;
        // A failed read is not cached: the next open, or Try again, asks again.
        if (error?.name !== 'AbortError') setRecord({ userId, plan: null, state: 'failed' });
      });
    // Closed before the read finished: forget it, so the next open asks again.
    return () => { if (!settled) { controller.abort(); inflight.current = null; } };
  }, [open, userId, nonce]);

  const subject = pickSubject(subjects, chosen || null);
  // Today's included 10-question set, read from the server quote only while the sheet is open (the quote is shared and kept a minute).
  const dailySet = useDailySet({ userId: open ? userId : null, premium: pro, subject });
  const model = useMemo(() => startRows({ plan: mine?.plan || null, subjects, subject, pro, balance, tonightKey, dailySet }), [mine, subjects, subject, pro, balance, tonightKey, dailySet]);
  const selectSubject = useCallback((id) => { setChosen(id); writeStored(id); }, []);
  const retry = useCallback(() => { fetched.current = { userId: null, at: 0 }; setRecord(null); setNonce((n) => n + 1); }, []);

  return {
    ...model,
    subjects,
    subject,
    pro,
    balance,
    planState: mine ? mine.state : 'loading',
    selectSubject,
    retry,
  };
}
