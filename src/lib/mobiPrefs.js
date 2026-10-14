'use client';

// The two motion choices a student can make, the same two the app has under Appearance and feel:
//   Reduce motion   off by default; follows the device unless the student turns it on here
//   Celebrations    Full, Quiet or Off (how much Mobi and the page celebrate)
// Both live in localStorage (always inside try/catch: private windows and blocked storage must not
// break a page) and are mirrored onto <html> as data-motion and data-celebrations, so plain CSS can
// honour them without a hook.

import { useMemo, useSyncExternalStore } from 'react';

export const MOTION_KEY = 'mm:motion:v1'; // 'reduced' when the student turned Reduce motion on; absent otherwise
export const CELEBRATIONS_KEY = 'mm:celebrations:v1'; // 'full' | 'quiet' | 'off'
export const CELEBRATION_LEVELS = ['full', 'quiet', 'off'];
// The acts that celebrate. Under Quiet they play as a small nod; under Off they play nothing.
export const CELEBRATION_ACTS = ['cheer', 'celebrate', 'proud'];

const EVENT = 'mm-prefs';
const celebrationSet = new Set(CELEBRATION_ACTS);

const state = { override: false, celebrations: 'full', device: false, ready: false };
// A primitive snapshot keeps useSyncExternalStore stable. The server snapshot is the default state.
let snapshot = 'auto|full|0';
let mediaQuery = null;
let listening = false;

function readStorage(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writeStorage(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch { /* The choice still applies for this visit without storage. */ }
}

function recompute() {
  snapshot = `${state.override ? 'on' : 'auto'}|${state.celebrations}|${state.device ? 1 : 0}`;
}

/** Mirrors the choices onto <html>: data-motion='reduced' (or absent) and data-celebrations. */
export function applyMotionAttributes() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const reduced = state.override || state.device;
  if (reduced) root.dataset.motion = 'reduced';
  else delete root.dataset.motion;
  root.dataset.celebrations = state.celebrations;
}

function loadFromBrowser() {
  state.override = readStorage(MOTION_KEY) === 'reduced';
  const saved = readStorage(CELEBRATIONS_KEY);
  state.celebrations = CELEBRATION_LEVELS.includes(saved) ? saved : 'full';
  try { state.device = Boolean(mediaQuery?.matches); } catch { state.device = false; }
  recompute();
  applyMotionAttributes();
}

function notify() {
  recompute();
  applyMotionAttributes();
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* No listeners to tell. */ }
}

/** Starts reading the browser once. Safe to call from anywhere on the client, any number of times. */
export function initMobiPrefs() {
  if (typeof window === 'undefined' || state.ready) return;
  state.ready = true;
  try { mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch { mediaQuery = null; }
  loadFromBrowser();
  if (listening) return;
  listening = true;
  const onDevice = () => { state.device = Boolean(mediaQuery?.matches); notify(); };
  try { mediaQuery?.addEventListener('change', onDevice); } catch { /* Older engines: the value is read at load. */ }
  window.addEventListener('storage', (event) => {
    if (event.key !== MOTION_KEY && event.key !== CELEBRATIONS_KEY && event.key !== null) return;
    loadFromBrowser();
    try { window.dispatchEvent(new Event(EVENT)); } catch { /* ignore */ }
  });
}

function subscribe(onChange) {
  initMobiPrefs();
  // Storage may have been read after hydration: tell React once so it re-reads the snapshot.
  const frame = window.setTimeout(onChange, 0);
  window.addEventListener(EVENT, onChange);
  return () => { window.clearTimeout(frame); window.removeEventListener(EVENT, onChange); };
}
const getSnapshot = () => snapshot;
const getServerSnapshot = () => 'auto|full|0';

/** Turns Reduce motion on or off. Off removes the override, so the device setting decides again. */
export function setReduceMotion(on) {
  initMobiPrefs();
  state.override = Boolean(on);
  writeStorage(MOTION_KEY, state.override ? 'reduced' : null);
  notify();
}

/** Sets Celebrations to 'full', 'quiet' or 'off'. */
export function setCelebrations(level) {
  initMobiPrefs();
  state.celebrations = CELEBRATION_LEVELS.includes(level) ? level : 'full';
  writeStorage(CELEBRATIONS_KEY, state.celebrations === 'full' ? null : state.celebrations);
  notify();
}

/** The choices right now, for code that is not a component (event handlers, timers). */
export function getMobiPrefs() {
  if (typeof window !== 'undefined') initMobiPrefs();
  return { reduced: state.override || state.device, celebrations: state.celebrations };
}

/** True when an act may play as authored under a Celebrations level. */
export function actAllowed(act, celebrations = state.celebrations) {
  return celebrations === 'full' || !celebrationSet.has(act);
}

/**
 * { reduced, celebrations, allow(act) } plus the parts the settings card needs:
 *   reduced      Reduce motion is in force (the student's switch or the device)
 *   deviceReduced / overridden   which of the two caused it
 *   allow(act)   false for a celebrating act under Quiet or Off
 */
export function useMobiPrefs() {
  const key = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => {
    const [mode, celebrations, device] = key.split('|');
    const overridden = mode === 'on';
    const deviceReduced = device === '1';
    return {
      reduced: overridden || deviceReduced,
      overridden,
      deviceReduced,
      celebrations,
      allow: (act) => actAllowed(act, celebrations),
    };
  }, [key]);
}
