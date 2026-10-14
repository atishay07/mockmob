// Mobi's discipline: he is a presence, not a show. How often he may react, how long a screen waits
// before he points, and the once-a-day and once-a-run gates for his greeting, his nudge, his line
// and his shrug. The same rules as the app (flutter_app lib/core/mascot/mobi_ration.dart,
// MobiRation), tested in data/tests/mobi_moments.test.mjs.
//
// A screen names itself with a short stable key ("today", "profile", "saved") and asks ONCE, from an
// effect (see useMobiGate in mobiHooks.js), never from render: asking consumes the gate.
//
// Per-day gates live in localStorage (a day is the device's local day), because a web page loads
// afresh each visit and "once a day" must survive that. Everything else lives for the page run.
// Storage can be blocked: then the gate falls back to memory for this run.

import { entranceAt, isLate } from './mobiMoments.js';

/** At most one reaction keyed the same in this long (the app's glanceGap, 2.5 s). */
export const GLANCE_GAP_MS = 2500;
/** A screen's Mobi points at its one action only after this long with no touch and no scroll. */
export const NUDGE_AFTER_MS = 4000;
/** A wait shorter than this gets no Mobi at all (the app's MobiLoader delay). */
export const WAIT_DELAY_MS = 300;
/** A wait this long gets the loading act (the app's waitLong). */
export const WAIT_LONG_MS = 2000;
/** How far apart two failures on one screen can be and still be the same run (the app's failureRun). */
export const FAILURE_RUN_MS = 90000;

let clock = () => Date.now();
const days = new Map();
const runs = new Set();
const lastFailure = new Map();
const lastReaction = new Map();
const failing = new Set();

/** Tests replace the clock; reset() restores it. */
export function setClock(fn) { clock = typeof fn === 'function' ? fn : () => Date.now(); }

const pad = (n) => String(n).padStart(2, '0');
function dayKey(at) {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function readDay(key) {
  try { return window.localStorage.getItem(`mm:mobi-day:${key}`); } catch { return days.get(key) || null; }
}
function writeDay(key, value) {
  days.set(key, value);
  try { window.localStorage.setItem(`mm:mobi-day:${key}`, value); } catch { /* Memory holds it for this run. */ }
}

function oncePerDay(key) {
  const today = dayKey(clock());
  const last = typeof window === 'undefined' ? days.get(key) : readDay(key) || days.get(key);
  if (last === today) return false;
  writeDay(key, today);
  return true;
}

/** True the first time `screen` asks today: Mobi waves hello once a day per screen; after that he is simply there. */
export const helloToday = (screen) => oncePerDay(`hello:${screen}`);

/** True the first time `screen` asks today: he points at the action once per screen per day. */
export const nudgeToday = (screen) => oncePerDay(`nudge:${screen}`);

/** True the first time `screen` asks in this page run: he speaks at most once per screen per run. */
export const speakOnce = (screen) => { const key = `say:${screen}`; if (runs.has(key)) return false; runs.add(key); return true; };

/** True for the first failure of a run on `screen`: he shrugs once and stays calm on every failed retry, until recovered(). */
export const oops = (screen) => { if (failing.has(screen)) return false; failing.add(screen); return true; };

/** The load on `screen` succeeded: the next failure is a new run and may shrug again. */
export const recovered = (screen) => { failing.delete(screen); lastFailure.delete(screen); };

/**
 * For a screen that cannot tell when its load recovered (a shared error state): true for the first
 * failure, and again only once FAILURE_RUN_MS has passed since the last one was seen, so a retry
 * loop that keeps failing, even through a fresh error view each time, shrugs once.
 */
export function oopsRun(screen) {
  const at = clock();
  const last = lastFailure.get(screen);
  lastFailure.set(screen, at);
  return last == null || at - last > FAILURE_RUN_MS;
}

/** True when a reaction keyed `key` may play now: one per `gap` for each key. Asking with a true answer starts the gap. */
export function reactNow(key, gap = GLANCE_GAP_MS) {
  const at = clock();
  const last = lastReaction.get(key);
  if (last != null && at - last < gap) return false;
  lastReaction.set(key, at);
  return true;
}

/**
 * The entrance for `screen`'s Mobi: asleep or sleepy late at night, a hello the first time today,
 * otherwise `otherwise`. Consumes the hello gate (not at night: at night he is just there, asleep).
 */
export function greeting(screen, otherwise = 'idle') {
  const at = clock();
  if (isLate(at)) return entranceAt(at);
  return helloToday(screen) ? 'hello' : otherwise;
}

/** Forgets every gate (tests). */
export function reset() {
  days.clear(); runs.clear(); failing.clear(); lastFailure.clear(); lastReaction.clear();
  clock = () => Date.now();
  try { for (const key of Object.keys(window.localStorage)) if (key.startsWith('mm:mobi-day:')) window.localStorage.removeItem(key); } catch { /* No storage to forget. */ }
}
