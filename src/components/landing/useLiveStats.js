"use client";

import { useEffect, useState } from 'react';
import { PUBLIC_SUBJECTS } from '@/../data/subject_art.mjs';

// One request to /api/stats serves the whole landing (the hero line, the subject tiles and the
// proof band). Only live numbers render: while the request runs, or when it fails, the number is
// simply absent, never a placeholder or an invented figure.
let pending = null;

function load() {
  if (!pending) {
    pending = fetch('/api/stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => (data && data.state !== 'unavailable' ? data : null))
      .catch(() => null)
      .then((data) => {
        // A failed read may be retried on the next page view, never in a loop.
        if (!data) pending = null;
        return data;
      });
  }
  return pending;
}

/** A whole, non-negative count, or null. */
const count = (value) => (Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.trunc(Number(value)) : null);

/** Live counts per public subject (public id), reading both the public and the internal key. */
export function subjectCountsFrom(data) {
  const raw = data?.subjectCounts;
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const s of PUBLIC_SUBJECTS) {
    const value = count(raw[s.id] ?? raw[s.internal]);
    if (value !== null) out[s.id] = value;
  }
  return out;
}

/** { status: 'loading'|'ready'|'failed', bankSize, subjectCounts, subjectsCovered } */
export function useLiveStats() {
  const [state, setState] = useState({ status: 'loading', bankSize: null, subjectCounts: null, subjectsCovered: null });
  useEffect(() => {
    let live = true;
    load().then((data) => {
      if (!live) return;
      if (!data) { setState({ status: 'failed', bankSize: null, subjectCounts: null, subjectsCovered: null }); return; }
      const subjectCounts = subjectCountsFrom(data);
      const covered = subjectCounts ? Object.values(subjectCounts).filter((n) => n > 0).length : null;
      setState({ status: 'ready', bankSize: count(data.bankSize), subjectCounts, subjectsCovered: covered });
    });
    return () => { live = false; };
  }, []);
  return state;
}
