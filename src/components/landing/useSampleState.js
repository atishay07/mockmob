'use client';

import { useEffect, useState } from 'react';

// What the landing's sample question has recorded about this visitor, shared with the hero and the phone dock.
// The sample writes localStorage "mm:sample:v1" = {"answered":n,"done":bool,"subject":"<id>","at":"ISO"} and
// announces it on window: "mm:sample-progress" after any answer, "mm:sample-done" when the sample is finished.
// This reads that record (storage can be blocked: every access is wrapped) and follows both events, plus the
// "storage" event so a second tab agrees, so a dock or a band updates live, with no reload.
export const SAMPLE_KEY = 'mm:sample:v1';
export const SAMPLE_EVENTS = ['mm:sample-progress', 'mm:sample-done'];
export const NO_SAMPLE = Object.freeze({ answered: 0, done: false });

function shape(value) {
  if (!value || typeof value !== 'object') return NO_SAMPLE;
  const n = Math.floor(Number(value.answered));
  const answered = Number.isFinite(n) && n > 0 ? n : 0;
  const done = value.done === true && answered > 0;
  // The finished run's next move (a chapter name), only when the record carries a plain one.
  const focus = done && typeof value.focus === 'string' && value.focus.trim() ? value.focus.trim().slice(0, 60) : null;
  return focus ? { answered, done, focus } : { answered, done };
}

export function readSample() {
  try {
    const raw = window.localStorage.getItem(SAMPLE_KEY);
    return raw ? shape(JSON.parse(raw)) : NO_SAMPLE;
  } catch {
    return NO_SAMPLE;
  }
}

/** member (signed in), sampled (answered at least one question) or new: the three states the landing's keys follow. */
export function visitorKind(isAuthenticated, sample) {
  if (isAuthenticated) return 'member';
  return sample && sample.answered > 0 ? 'sampled' : 'new';
}

/** { answered, done, focus? } for this browser. Starts empty (so the server and the first paint agree), then reads. */
export function useSample() {
  const [sample, setSample] = useState(NO_SAMPLE);

  useEffect(() => {
    const take = (next) => setSample((prev) => (prev.answered === next.answered && prev.done === next.done && prev.focus === next.focus ? prev : next));
    const onEvent = (event) => {
      const stored = readSample();
      // With storage blocked the event's own detail still tells the page what happened.
      const detail = event && event.detail && typeof event.detail === 'object' ? shape(event.detail) : NO_SAMPLE;
      take(stored.answered >= detail.answered ? stored : detail);
    };
    const onStorage = (event) => { if (event.key === SAMPLE_KEY || event.key === null) take(readSample()); };
    take(readSample());
    for (const name of SAMPLE_EVENTS) window.addEventListener(name, onEvent);
    window.addEventListener('storage', onStorage);
    return () => {
      for (const name of SAMPLE_EVENTS) window.removeEventListener(name, onEvent);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return sample;
}
