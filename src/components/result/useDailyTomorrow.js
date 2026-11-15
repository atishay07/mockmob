"use client";

// O5: whether a new included 10-question set opens tomorrow for this student (tomorrowLine.mjs dailySetTomorrow), read from
// the same server quote Practice prices with (GET /api/practice/quote, read-only: it never charges, reserves or starts
// anything). Read only when the line could use it (a paper with no wrong answers, on Free); null until it lands, and when
// it fails, so the page then says nothing.
import { useEffect, useState } from 'react';
import { LAUNCH_SUBJECT_IDS } from '@/../data/capabilities.js';
import { dailySetTomorrow } from './tomorrowLine.mjs';

const subjectFor = (subject) => (LAUNCH_SUBJECT_IDS.includes(subject) ? subject : LAUNCH_SUBJECT_IDS[0]);

export function useDailyTomorrow({ need = false, userId = null, subject = null } = {}) {
  const key = need && userId ? `${userId}:${subjectFor(subject)}` : null;
  const [read, setRead] = useState({ key: null, value: null });
  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    const params = new URLSearchParams({ subject: subjectFor(subject), mode: 'quick', count: '10' });
    fetch(`/api/practice/quote?${params}`, { cache: 'no-store', credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => { if (alive) setRead({ key, value: dailySetTomorrow(body) }); })
      .catch(() => { if (alive) setRead({ key, value: null }); });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return read.key === key ? read.value : null;
}
