"use client";
// What Revise has due today, shared between the places that show it: the Revise run (which counts it down as each answer is
// confirmed by the server) and the Review badge in the navigation (LEARN-REVIEW-1017 5.12: the badge is Revise due today, and
// drops by one as each answer is confirmed, 8 to 6 two cards in). A tiny external store, no provider needed.
//   setReviseDue(n)     n = how many are still due (0 hides the badge); null = unknown (no badge, never "0")
//   useReviseDue()      the current value, or undefined until something has read it (the badge then reads /api/me/review)
import { useSyncExternalStore } from 'react';

let value;
const listeners = new Set();

export function setReviseDue(next) {
  const n = next === null ? null : Number.isFinite(Number(next)) ? Math.max(0, Math.trunc(Number(next))) : undefined;
  if (n === value) return;
  value = n;
  for (const listener of [...listeners]) listener();
}
export const getReviseDue = () => value;

function subscribe(listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useReviseDue() {
  return useSyncExternalStore(subscribe, getReviseDue, () => undefined);
}
