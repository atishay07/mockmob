// The first run for a brand-new student (web IA plan section 3, steps 3 to 6; packet IA3).
//
//   sign up  ->  onboarding 1: subjects (up to 5)  ->  onboarding 2: days a week  ->  Today
//
// Pure helpers plus small storage wrappers, so pages stay thin and node tests can check the rules.
// Every storage read and write is wrapped: a private window or blocked storage never breaks a page.
// Copy rules: sentence case, no "!", no em dash. Numbers come from plan_facts or the server only.
import { VISITOR_KEY, parseVisitorHint } from '../../lib/navigation.js';
import {
  SAMPLE_IMPORT_PATH, clearSampleHandoff, importOutcome, markImported, readSampleHandoff, sampleImportBody, shouldImport, writeSampleHandoff,
} from '../../../data/sample_handoff.mjs';
import { PLAN_FACTS } from '../../../data/plan_facts.mjs';

export const SUBJECT_CAP = 5;
export const STEPS = Object.freeze(['subjects', 'days']);
export const DAY_OPTIONS = Object.freeze([1, 2, 3, 4, 5, 6, 7]);
// The server reads a missing goal as 4 days (src/lib/server/appPrefs.js goalOut), so Skip keeps 4.
export const DEFAULT_DAYS = 4;
export const GOAL_PATH = '/api/me/goal';

/**
 * The step to show. Editing subjects (You > Your sheet) is one step. Days needs saved subjects, so a
 * student without any always starts on subjects, whatever the URL says.
 */
export function resolveStep({ step = null, edit = false, hasSubjects = false } = {}) {
  if (edit) return 'subjects';
  return step === 'days' && hasSubjects ? 'days' : 'subjects';
}

/**
 * What the page does with the session it has:
 *   wait      the session check is still running
 *   signup    signed out on a first run: create the account first
 *   login     signed out while editing subjects: log in and come back
 *   leave     a member who already has subjects opened the first run again: send them home
 *   stay      show the step
 */
export function onboardingEntry({ status, hasSubjects = false, edit = false, step = null } = {}) {
  if (status === 'unauthenticated') return edit ? 'login' : 'signup';
  if (status !== 'authenticated') return 'wait';
  if (!edit && hasSubjects && step !== 'days') return 'leave';
  return 'stay';
}

/** A whole number of days between 1 and 7, or the default. */
export function cleanDays(value) {
  const n = Math.trunc(Number(value));
  return DAY_OPTIONS.includes(n) ? n : DEFAULT_DAYS;
}

/** "4 days a week" / "1 day a week". */
export function daysLine(days) {
  const n = cleanDays(days);
  return `${n} ${n === 1 ? 'day' : 'days'} a week`;
}

/** The count line beside the subjects button: "3 of 5 picked". */
export function pickedLine(count, cap = SUBJECT_CAP) {
  const n = Math.max(0, Math.trunc(Number(count) || 0));
  return `${n} of ${cap} picked`;
}

/** The one line of verified free facts on sign-up (plan 3 step 3, 4.4). */
export function signupFactsLine() {
  const p = PLAN_FACTS;
  return `Free to start, no card. You begin with ${p.practiceCredits.startingBalance.value} practice credits, plus ${p.aiCredits.freeMonthly.value} AI credits every month.`;
}

// ---------------------------------------------------------------------------------------------
// The returning hint (plan 3 rules): "Welcome back" appears only when this device has signed in
// before. The hint holds no personal data: the kind, the plan and whether a session was started.

function local() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function session() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** The visitor kind stored on this device: new, returning or member. Never throws. */
export function readVisitorKind(store = local()) {
  try {
    return parseVisitorHint(store?.getItem(VISITOR_KEY) ?? null).kind;
  } catch {
    return 'new';
  }
}

/** Has this device signed in before? Only then may a page say "Welcome back". */
export function isKnownVisitor(kind) {
  return kind === 'member' || kind === 'returning';
}

/**
 * Records a confirmed signed-in member. `started` is true once a scored session exists, false on a
 * first run, null when this page cannot tell (an existing value is kept). Never throws.
 */
export function rememberMember({ pro = false, started = null } = {}, store = local()) {
  if (!store) return false;
  try {
    const before = parseVisitorHint(store.getItem(VISITOR_KEY));
    const keep = started === null && before.kind === 'member' ? before.started : started;
    store.setItem(VISITOR_KEY, JSON.stringify({ kind: 'member', plan: pro ? 'pro' : 'free', started: keep === true ? true : keep === false ? false : null }));
    return true;
  } catch {
    return false;
  }
}

/**
 * A page confirmed this device is signed out: a stored member becomes returning, so public pages
 * offer Log in first. A new visitor stays new. Never throws.
 */
export function rememberReturning(store = local()) {
  if (!store) return false;
  try {
    if (parseVisitorHint(store.getItem(VISITOR_KEY)).kind !== 'member') return false;
    store.setItem(VISITOR_KEY, JSON.stringify({ kind: 'returning' }));
    return true;
  } catch {
    return false;
  }
}

/** The sign-up line while a landing sample waits to be saved: "Your 5 sample answers will be saved to your account." */
export function sampleNoteLine() {
  return `Your ${PLAN_FACTS.sessions.sampleQuestions.value} sample answers will be saved to your account.`;
}

// ---------------------------------------------------------------------------------------------
// The sample import (plan 3 step 4): the five landing answers go to the new account once,
// silently. It is not a mock and uses no credits. A 409 counts as done.

let inFlight = null;

/**
 * Posts the stored sample handoff once. Resolves to 'none' (nothing to send), 'done', 'later' (kept
 * for the next page load) or 'drop' (the server refused the body). Never throws, never shows UI.
 */
export function runSampleImport({ storage = session(), fetchImpl = typeof fetch === 'function' ? fetch : null } = {}) {
  if (inFlight) return inFlight;
  const handoff = readSampleHandoff(storage);
  if (!shouldImport(handoff) || !fetchImpl) return Promise.resolve('none');
  // Marked before the request, so a reload while it is in flight never posts it twice.
  markImported(storage, handoff);
  inFlight = (async () => {
    let outcome = 'later';
    try {
      const response = await fetchImpl(SAMPLE_IMPORT_PATH, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sampleImportBody(handoff)),
      });
      outcome = importOutcome(response?.status);
    } catch {
      outcome = 'later';
    }
    if (outcome === 'later') writeSampleHandoff(storage, { ...handoff, imported: false });
    if (outcome === 'drop') clearSampleHandoff(storage);
    return outcome;
  })().finally(() => { inFlight = null; });
  return inFlight;
}

/** Is there a sample waiting to be saved to the account (for the sign-up line)? Never throws. */
export function hasPendingSample(storage = session()) {
  return shouldImport(readSampleHandoff(storage));
}
