// Whether the phone dock's Start key should be quiet right now: true while the page's own volt key is on screen
// (pagePrimary.mjs sets it from AppLayoutClient, start.css draws it). A single boolean in a tiny store, so only the key
// re-renders when it changes, never the shell. The server render is always lime, which is also the look before a page has
// reported anything.
import { useSyncExternalStore } from 'react';

let quiet = false;
const listeners = new Set();

export function setStartQuiet(next) {
  const value = Boolean(next);
  if (value === quiet) return;
  quiet = value;
  for (const fn of listeners) fn();
}

export function startQuiet() {
  return quiet;
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useStartQuiet() {
  return useSyncExternalStore(subscribe, startQuiet, () => false);
}
