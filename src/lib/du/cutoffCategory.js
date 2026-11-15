'use client';
// The category a student reads DU cutoffs in, remembered on this device and shared with the cutoff calculator: both
// keep it as `c` in the calculator's saved choice (src/lib/du/client.js, mm.du.v1), so picking SC on a cutoff page
// opens the calculator on SC and the other way round. The rest of that saved choice (subjects, score) is kept as it is.
// The server and the first paint read UR (the static HTML shows UR); a remembered choice applies right after.
// Blocked storage (private mode) still works for the visit: the choice is held in memory.
import { useCallback, useSyncExternalStore } from 'react';
import { readSaved, writeSaved } from './client';
import { CUTOFF_CATEGORIES } from './cutoffPages.mjs';

const STORE_KEY = 'mm.du.v1';
const listeners = new Set();
let memory = null;

function read() {
  if (memory) return memory;
  const saved = readSaved();
  return saved && CUTOFF_CATEGORIES.includes(saved.c) ? saved.c : 'UR';
}

function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (event) => {
    if (event.key === null || event.key === STORE_KEY) {
      memory = null;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

const serverCategory = () => 'UR';

/** [category, setCategory]: one of the 11 DU categories, UR until the student picks another. */
export function useDuCategory() {
  const category = useSyncExternalStore(subscribe, read, serverCategory);
  const setCategory = useCallback((next) => {
    if (!CUTOFF_CATEGORIES.includes(next)) return;
    const saved = readSaved();
    writeSaved({ ...(saved && typeof saved === 'object' ? saved : {}), c: next });
    // Held in memory only when storage refused the write, so the calculator's own later saves still win.
    memory = readSaved()?.c === next ? null : next;
    for (const listener of listeners) listener();
  }, []);
  return [category, setCategory];
}
