"use client";
// The one line a page says when a student arrives from the sign-up door that promised it (16 Nov 2026; the words and the rule
// are in src/lib/firstRunPromise.mjs, the mark in src/lib/auth-redirect.js). Shown once per device: the mark is taken (cleared)
// after the page mounts, and the line stays for that visit. The mark is read in the first client render, so a page reached by
// a client navigation (the end of onboarding) draws the line in its first frame; pages draw it with their loaded content, so
// nothing moves when it shows.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { peekArrival, takeArrival } from '@/lib/auth-redirect';
import { arrivalLine } from '@/lib/firstRunPromise.mjs';
import './arrival.css';

const noSubscribe = () => () => {};
const serverNone = () => false;

/** The arrival line for this page (`kind`, and for one chapter's Key cards its key), or null. */
export function useArrival(kind, { chapter = null } = {}) {
  const marked = useSyncExternalStore(noSubscribe, () => peekArrival(kind, { chapter }), serverNone);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!marked) return undefined;
    const id = window.setTimeout(() => { if (takeArrival(kind, { chapter })) setHeld(true); }, 0);
    return () => window.clearTimeout(id);
  }, [marked, kind, chapter]);
  return marked || held ? arrivalLine(kind) : null;
}

export default function ArrivalLine({ line, className = '' }) {
  if (!line) return null;
  return <p className={`arrive ${className}`.trim()} role="status">{line}</p>;
}
