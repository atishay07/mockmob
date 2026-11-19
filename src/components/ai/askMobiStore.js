"use client";

// Ask Mobi's panel as the shell sees it (19 Nov 2026): open or not, its form ('dock', 'overlay', 'sheet') and whether the desktop
// launcher opened it. AskMobiHost writes it; the shell reads it for its dock attribute (data-mobi-dock) and the launcher for its
// pressed state and its place. Never restored: a fresh load starts closed.
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

/** True while the panel is open in its docked form: the shell narrows its main area by --mobi-dock-w. */
export function useMobiDocked() {
  const s = useAskMobiState();
  return s.open && s.form === 'dock';
}
