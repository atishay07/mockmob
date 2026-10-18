"use client";

// One open state for the Upgrade sheet, the facts pages have shared this visit, and the per-student record on this
// device (src/lib/proNudge.mjs holds the rules). Any page calls openUpgrade({ trigger, facts }) when a Free student taps a
// Pro feature; the result page calls reportFirstAction({ kind: 'paper', at }) when a scored set lands; onboarding calls
// noteOnboardedNow(userId) as it finishes. Storage is read and written inside try/catch: a private window or blocked
// storage means the first-session sheet simply does not show, and inline nudges show without a remembered dismissal.
import { useSyncExternalStore } from 'react';
import { emptyRecord, mergeFacts, noteOnboarded, quietInline, readRecord } from '@/lib/proNudge.mjs';

const RECORD_KEY = (userId) => `mm:pro-nudge:v1:${userId}`;
const SESSION_KEY = 'mm:pro-nudge:session';
export const FIRST_ACTION_EVENT = 'mockmob:pro-first-action';

let state = { open: false, trigger: 'generic', facts: {}, at: 0, opener: null };
// True while a ProNudgeHost is mounted for a Free student, so a caller can fall back to /pricing when nothing would show.
let hostReady = false;
export function setUpgradeHost(ready) { hostReady = Boolean(ready); }
let shared = {};
const listeners = new Set();
const emit = () => { for (const fn of listeners) fn(); };

/** Opens the sheet. Returns false when no host is mounted to show it (Pro, signed out), so the caller can go to /pricing. */
export function openUpgrade({ trigger = 'generic', facts = {}, opener = null } = {}) {
  state = { open: true, trigger, facts: mergeFacts(shared, facts), at: Date.now(), opener: opener || (typeof document !== 'undefined' ? document.activeElement : null) };
  emit();
  return hostReady;
}

export function closeUpgrade() {
  if (!state.open) return;
  state = { ...state, open: false };
  emit();
}

export function upgradeState() { return state; }

/** Facts a page holds about the student (subjects, mocks taken, weakest chapter, balance), kept for this visit only. */
export function shareProFacts(facts) {
  shared = mergeFacts(shared, facts);
}

export function sharedProFacts() { return shared; }

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const closed = { open: false, trigger: 'generic', facts: {}, at: 0, opener: null };
export function useUpgradeState() {
  return useSyncExternalStore(subscribe, upgradeState, () => closed);
}

// ---------- The record on this device ----------

export function loadRecord(userId) {
  if (!userId) return emptyRecord();
  try { return readRecord(JSON.parse(window.localStorage.getItem(RECORD_KEY(userId)) || 'null')); } catch { return emptyRecord(); }
}

export function saveRecord(userId, record) {
  if (!userId) return false;
  try { window.localStorage.setItem(RECORD_KEY(userId), JSON.stringify(record)); return true; } catch { return false; }
}

/** This browser session's id, made on first ask. null when session storage is blocked. */
export function browserSession() {
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch { return null; }
}

/** Onboarding just finished: the first usage session starts in this browser session. */
export function noteOnboardedNow(userId) {
  const session = browserSession();
  if (!userId || !session) return;
  saveRecord(userId, noteOnboarded(loadRecord(userId), { now: Date.now(), session }));
}

/** A scored set landed (or a Today move finished): the host decides whether this is the first-session moment. */
export function reportFirstAction(action) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FIRST_ACTION_EVENT, { detail: { kind: action?.kind || 'paper', at: action?.at ?? Date.now() } }));
}

/** A dismissed inline nudge stays quiet for 7 days. */
export function quietNudge(userId, placement) {
  saveRecord(userId, quietInline(loadRecord(userId), placement, Date.now()));
}
