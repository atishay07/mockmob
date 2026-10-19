// The daily study time on this device and on the account (client only; rules and words in goalMinutes.mjs).
//
// A choice is kept in two places. The account holds it when the server can (PUT /api/me/goal { dailyMinutes }), and this
// device always holds the last one the student chose, so a choice is never lost while the server is still being widened
// from 10, 20 and 30 to 5-999 (web/1020-goal-minutes). Until the account holds it, the plan is asked only for a length
// the server accepts (sendableMinutes), and the page says that, never that the account holds what it does not.
import { api } from '@/lib/fetcher';
import { STORE_KEY, cleanMinutes, readStored, sendableMinutes, storedText } from '@/lib/goalMinutes.mjs';

const GOAL_PATH = '/api/me/goal';
const PREFS_PATH = '/api/study/preferences';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** This device's kept length, or null (private windows, blocked storage and stale values all read as none). */
export function readDeviceMinutes() {
  try { return readStored(window.localStorage.getItem(STORE_KEY)); } catch { return null; }
}

/** Keeps a length on this device. Never throws. */
export function writeDeviceMinutes(minutes) {
  try {
    if (cleanMinutes(minutes) === null) window.localStorage.removeItem(STORE_KEY);
    else window.localStorage.setItem(STORE_KEY, storedText(minutes));
  } catch { /* the choice stays on screen for this visit */ }
}

/**
 * When the account does not hold a long day yet, the plan is still pointed at the longest length the server accepts for
 * it (the usual study time in the study preferences). Best effort and silent: returns that length, or null when the plan
 * could not be reached (the study plan is off, the student is signed out, the read or the save failed).
 */
export async function mirrorToPlan(minutes, call = api) {
  const target = sendableMinutes(minutes);
  if (target === null) return null;
  try {
    const prefs = await call(PREFS_PATH);
    if (!prefs || prefs.state !== 'ready' || !Number.isInteger(prefs.revision)) return null;
    if (prefs.minutes === target) return target;
    await call(PREFS_PATH, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ minutes: target, expectedRevision: prefs.revision }) });
    return target;
  } catch { return null; }
}

/**
 * Saves a daily length on its own (no days). Returns { where: 'account' | 'device', planMinutes } or throws the server's
 * error for a failure that is not "the server cannot hold this yet" (offline, signed out, server down): the caller says
 * nothing was saved and keeps the choice on screen.
 */
export async function saveDailyMinutes(minutes, call = api) {
  let body = null;
  try {
    body = await call(GOAL_PATH, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ dailyMinutes: minutes }) });
  } catch (error) {
    if (error?.status === 409 || error?.status === 422) body = null; // the server cannot hold it yet
    else throw error;
  }
  if (body && cleanMinutes(body.dailyMinutes) === minutes && body.minutesOnAccount !== false) {
    writeDeviceMinutes(minutes);
    return { where: 'account', planMinutes: null };
  }
  writeDeviceMinutes(minutes);
  const planMinutes = await mirrorToPlan(minutes, call);
  return { where: 'device', planMinutes };
}

/**
 * After a goal read that came from a server which knows the daily minutes (the body has the field) and holds none, a length
 * this device kept is offered to the account once. Returns the minutes now on the account, or null.
 */
export async function promoteDeviceMinutes(body, call = api) {
  if (!body || typeof body !== 'object' || !('dailyMinutes' in body) || body.minutesOnAccount === false) return null;
  if (cleanMinutes(body.dailyMinutes) !== null) return null;
  const kept = readDeviceMinutes();
  if (kept === null) return null;
  try {
    const answer = await call(GOAL_PATH, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ dailyMinutes: kept }) });
    return cleanMinutes(answer?.dailyMinutes) === kept ? kept : null;
  } catch { return null; }
}
