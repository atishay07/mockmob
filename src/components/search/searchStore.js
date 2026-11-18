"use client";

// One open state for Search (lane palette, 18 Nov 2026): the rail's Search key, the You page's and the Start sheet's Search
// fields and the keyboard (Ctrl+K, Cmd+K, "/") all open the one panel the shell hosts (SearchHost). The panel gives focus back
// to whatever opened it.
import { useSyncExternalStore } from 'react';

let state = { open: false, opener: null, at: 0 };
const listeners = new Set();
const emit = () => { for (const fn of listeners) fn(); };

export function openSearch({ opener = null } = {}) {
  if (state.open) return;
  state = { open: true, opener, at: Date.now() };
  emit();
}

export function closeSearch() {
  if (!state.open) return;
  state = { ...state, open: false };
  emit();
}

export function searchState() {
  return state;
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const closedState = { open: false, opener: null, at: 0 };

/** { open, opener, at } for components. Server render is always closed. */
export function useSearchState() {
  return useSyncExternalStore(subscribe, searchState, () => closedState);
}
