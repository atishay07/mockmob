// The first run on the website, in three steps (ported from the restructure the owner kept, 15 Oct; the colleges step
// added 17 Oct from the owner's 16 Oct ask that picking colleges happen inside onboarding):
//
//   sign up  ->  1: which subjects (up to 5)  ->  2: how many study days a week  ->  3: target colleges (optional)
//     ->  today's free 10-question set, when the quote says it is free (15 Nov 2026), else Practice
//     (or, from 16 Nov 2026, the page the sign-up door promised: src/lib/auth-redirect.js firstRunDestination)
//
// Pure helpers only, so the page stays thin and node tests can check the rules. The live auth and
// redirect rules are unchanged: signed out goes to /signup, a member who already has subjects goes
// to /dashboard, and the first run ends on /dashboard. The one addition is that a student who has
// just saved subjects in this visit (or reloads on ?step=days) stays for the days step.
// Copy rules: sentence case, no "!", no em dash. Every line here is checked against the server.
import { CUET_MAX_SUBJECTS } from '../../lib/cuetRules.mjs';

export const SUBJECT_CAP = CUET_MAX_SUBJECTS;
export const STEPS = Object.freeze(['subjects', 'days', 'colleges']);
export const DAY_OPTIONS = Object.freeze([1, 2, 3, 4, 5, 6, 7]);
// The server reads a missing goal as 4 days (src/lib/server/appPrefs.js goalOut), so Skip keeps 4.
export const DEFAULT_DAYS = 4;
export const GOAL_PATH = '/api/me/goal';
export const DONE_PATH = '/dashboard';
export const SIGNUP_PATH = '/signup';
// The rhythm rule, as the server counts it (src/lib/server/rhythm.js, MIN_ANSWERED = 5) and as the
// rhythm card on Today and Progress already says it.
export const STUDY_DAY_RULE = 'A day counts when you finish a scored session of at least 5 answers, or a Mistake Repair.';

/**
 * The step to show. Editing subjects (Practice or You > Edit subjects) is one step. Days needs
 * saved subjects, so a student without any always starts on subjects, whatever the URL says.
 */
export function resolveStep({ wanted = null, edit = false, hasSubjects = false } = {}) {
  if (edit) return 'subjects';
  return (wanted === 'days' || wanted === 'colleges') && hasSubjects ? wanted : 'subjects';
}

/** The step a URL asks for (?step=days or ?step=colleges), or null. */
export function stepFromQuery(value) {
  return value === 'days' || value === 'colleges' ? value : null;
}

/**
 * What the page does with the session it has (the live rules, plus the days step):
 *   wait     the session check is still running
 *   signup   signed out: create the account first
 *   leave    a member who already had subjects opened the first run again: send them to Practice
 *   stay     show the step
 * `inFlow` is true once this visit saved subjects, or the URL asked for the days step.
 */
export function onboardingEntry({ status, savedSubjects = 0, edit = false, inFlow = false } = {}) {
  if (status === 'unauthenticated') return 'signup';
  if (status !== 'authenticated') return 'wait';
  if (!edit && !inFlow && savedSubjects > 0) return 'leave';
  return 'stay';
}

/** A whole number of days between 1 and 7, or the default. */
export function cleanDays(value) {
  const n = Math.trunc(Number(value));
  return DAY_OPTIONS.includes(n) ? n : DEFAULT_DAYS;
}

/**
 * The PUT body for the goal. The route clears a pause it is not sent, so a pause the student set in
 * the app (still running today or later) goes back with the new days; an ended one is dropped.
 */
export function goalBody(days, pausedUntil = null, now = Date.now()) {
  const today = new Date(now).toISOString().slice(0, 10);
  const keep = typeof pausedUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(pausedUntil) && pausedUntil >= today;
  return { daysPerWeek: cleanDays(days), pausedUntil: keep ? pausedUntil : null };
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

// What each choice means, in plain words. No promise of marks: the days are the student's plan,
// and the ring on Today is the only thing they drive.
export const DAY_RHYTHMS = Object.freeze({
  1: Object.freeze({ name: 'A light start', line: 'One study day a week. Easy to keep, and easy to raise later.' }),
  2: Object.freeze({ name: 'Easy going', line: 'Two study days a week, with plenty of room around them.' }),
  3: Object.freeze({ name: 'Steady', line: 'Three study days a week, with rest days between them.' }),
  4: Object.freeze({ name: 'Balanced', line: 'Four study days a week. Most of the week, with room to rest.' }),
  5: Object.freeze({ name: 'Most weekdays', line: 'Five study days a week, with two days off.' }),
  6: Object.freeze({ name: 'Full push', line: 'Six study days a week, with one day off.' }),
  7: Object.freeze({ name: 'Every day', line: 'Seven study days a week. A short session still counts.' }),
});

/** The name and line for a choice. */
export function dayRhythm(days) {
  return DAY_RHYTHMS[cleanDays(days)];
}

/** How Mobi answers a choice: a cheer for every day, encouragement for a light start, else a nod. */
export function mobiForDays(days) {
  const n = cleanDays(days);
  if (n === 7) return 'cheer';
  if (n === 1) return 'encourage';
  return 'nod';
}

// The week ring, drawn the way the rhythm card on Today draws it (src/components/RhythmCard.jsx):
// one arc per study day, round from the top, with a small gap between arcs.
export const RING = Object.freeze({ center: 60, radius: 46 });
const round2 = (n) => Math.round(n * 100) / 100;
const polar = (deg) => [RING.center + RING.radius * Math.cos((deg * Math.PI) / 180), RING.center + RING.radius * Math.sin((deg * Math.PI) / 180)];

/** SVG path data for each arc of a ring with `days` arcs (1 to 7). */
export function ringArcs(days) {
  const n = cleanDays(days);
  const gap = n > 1 ? 14 : 0;
  const span = n === 1 ? 359.9 : (360 - gap * n) / n;
  return Array.from({ length: n }, (_, i) => {
    const a0 = -90 + gap / 2 + i * (span + gap);
    const [x0, y0] = polar(a0);
    const [x1, y1] = polar(a0 + span);
    return `M${round2(x0)} ${round2(y0)}A${RING.radius} ${RING.radius} 0 ${span > 180 ? 1 : 0} 1 ${round2(x1)} ${round2(y1)}`;
  });
}

/** Where the volt thumb sits on the 1 to 7 track, as a 0-based index. */
export function thumbIndex(days) {
  return cleanDays(days) - 1;
}

// ---------- Where the first run ends (15 Nov 2026, O1 and F3) ----------
// The last key opens today's free set (src/lib/firstSet.mjs) or, when it is not free, Practice. Both go to the same subject:
// the one the home page's sample was in, when the student kept it ticked, else their first subject.

/** The subject of the first set: the sampled one when it is among the picks, else the first pick, else null. */
export function firstSetSubject({ picks = [], sampled = null } = {}) {
  const list = Array.isArray(picks) ? picks.filter(Boolean) : [];
  if (sampled && list.includes(sampled)) return sampled;
  return list[0] || null;
}

/** Practice, when the first set is not free: open on the sampled subject when the student kept it, else as before. */
export function practiceAfter({ picks = [], sampled = null } = {}) {
  const list = Array.isArray(picks) ? picks : [];
  return sampled && list.includes(sampled) ? `${DONE_PATH}?${new URLSearchParams({ subject: sampled })}` : DONE_PATH;
}

// A page a sign-up door promised (16 Nov 2026), as its preview view; a chapter's Key cards is learn2-cards with the chapter.
const PREVIEW_VIEWS = Object.freeze({ '/test': 'test', '/cards': 'learn2', '/sunday': 'sunday', '/mob': 'mob', '/recovery': 'recovery' });
const PUBLIC_PAGES = Object.freeze(['/daily', '/pricing', '/cuet-cutoff-calculator']);

/**
 * The development preview's version of the same ending (/preview/arena, no account): the runner or Practice as preview views,
 * keeping the fixture settings that shape them (the plan, the data state, the allowance, the quote) and the path's own query.
 * A promised page with a preview view opens that view; a public one (the Daily Five, the plans, the calculator) opens itself.
 */
export function previewFinish(path, search = '') {
  const [whole, hash = ''] = String(path || DONE_PATH).split('#');
  const [route, query = ''] = whole.split('?');
  const deck = /^\/cards\/([^/]+)$/.exec(route);
  if (PUBLIC_PAGES.includes(route)) return `${route}${hash ? `#${hash}` : ''}`;
  const view = deck ? 'learn2-cards' : PREVIEW_VIEWS[route] || 'dashboard';
  const out = new URLSearchParams({ view });
  if (deck) out.set('chapter', deck[1]);
  const kept = new URLSearchParams(search);
  for (const key of ['plan', 'data', 'allowance', 'quote', 'inventory', 'study', 'decks']) if (kept.get(key)) out.set(key, kept.get(key));
  for (const [key, value] of new URLSearchParams(query)) out.set(key, value);
  return `/preview/arena?${out}`;
}

/** The five slots in the bar: each picked subject in order, then empty slots up to the cap. */
export function pickedSlots(selected = [], cap = SUBJECT_CAP) {
  const picked = Array.isArray(selected) ? selected.slice(0, cap) : [];
  return Array.from({ length: cap }, (_, i) => (i < picked.length ? picked[i] : null));
}
