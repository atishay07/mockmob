"use client";

// One open state for every Start key on the page (sidebar and phone bar) and the one sheet.
// A key calls openStart({ opener }); the sheet host renders while it is open and gives focus back
// to the key that opened it.
import { useSyncExternalStore } from 'react';

let state = { open: false, row: null, opener: null, at: 0 };
const listeners = new Set();
const emit = () => { for (const fn of listeners) fn(); };

export function openStart({ row = null, opener = null } = {}) {
  if (state.open) return;
  state = { open: true, row, opener, at: Date.now() };
  emit();
}

export function closeStart() {
  if (!state.open) return;
  state = { ...state, open: false };
  emit();
}

export function startState() {
  return state;
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const closedState = { open: false, row: null, opener: null, at: 0 };

/** { open, row, opener } for components. Server render is always closed. */
export function useStartState() {
  return useSyncExternalStore(subscribe, startState, () => closedState);
}
