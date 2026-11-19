"use client";

// Ask Mobi's window as the shell sees it (20 Nov 2026): open or not, its form ('window' or a phone's 'sheet') and whether the chat
// box at rest opened it. AskMobiHost writes it; the chat box (AskMobiLauncher.jsx) reads it to step away while the window is open
// and to take focus back when it closes. Never restored: a fresh load starts closed. Nothing in it changes the page's width.
import { useSyncExternalStore } from 'react';

const closed = Object.freeze({ open: false, form: null, launcher: false });
let state = closed;
const listeners = new Set();

export function setAskMobiState(next) {
  const merged = { ...state, ...next };
  if (merged.open === state.open && merged.form === state.form && merged.launcher === state.launcher) return;
  state = merged;
  for (const fn of listeners) fn();
}

export function askMobiState() {
  return state;
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** { open, form, launcher }. The server render is always closed. */
export function useAskMobiState() {
  return useSyncExternalStore(subscribe, askMobiState, () => closed);
}
