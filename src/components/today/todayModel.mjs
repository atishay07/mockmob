// What the Today page says, worked out from facts and nothing else (web IA plan 2.2 Today, 5.2).
// PURE: no I/O, no React, no clock (callers pass `now`), so it is unit-tested
// (data/tests/today_model.test.mjs). Copy rules: sentence case, no "!", no em dash, real numbers only.
import { isLateNightHour } from '../../lib/mobiMoments.js';
import { nextMove } from '../../../data/next_step_rules.mjs';

const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;

/** "Good evening, Asha", "Up late, Asha" from 11 PM to 5 AM (the app's TodayCopy.greeting). */
export function greetingFor(hour, firstName = '') {
  const who = String(firstName || '').trim();
  if (isLateNightHour(hour)) return who ? `Up late, ${who}` : 'Up late tonight';
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return who ? `Good ${part}, ${who}` : `Good ${part}`;
}

/** The first word of a display name, or ''. */
export function firstNameOf(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

/**
 * The input nextMove() reads, from the server's moveFacts plus what only the client knows.
 *   facts     moveFacts from /api/learning/plan (src/lib/server/todayFacts.js)
 *   user      the signed-in user: { subjects, isPremium }
 *   supported ids of the subjects the practice bank supports (from /api/subjects), or null when unknown
 *   practiceCredits, aiCredits  live balances, or null when unknown (the cost lines then name no balance)
 */
export function moveInput(facts, { user = null, supported = null, practiceCredits = null, aiCredits = null, now = Date.now(), timeZone = 'Asia/Kolkata' } = {}) {
  const mine = (user?.subjects || []).map((s) => (typeof s === 'string' ? s : s?.id)).filter(Boolean);
  const practiseable = supported ? mine.filter((id) => supported.has(id)) : mine;
  return {
    now,
    timeZone,
    plan: user?.isPremium ? 'pro' : 'free',
    practiceCredits,
    aiCredits,
    subjects: practiseable,
    attempts: facts?.attempts || [],
    openSession: facts?.openSession || null,
    unopenedResult: facts?.unopenedResult || null,
    repair: facts?.repair || null,
    weakChapter: facts?.weakChapter || null,
    freshCheck: facts?.freshCheck || null,
    capabilities: facts?.capabilities || {},
  };
}

/** The hero's move, or null when the facts could not be read (Today then says so and offers Practice). */
export function todayMove(facts, context) {
  if (!facts || typeof facts !== 'object') return null;
  return nextMove(moveInput(facts, context));
}

/**
 * What is missing from the sheet, for the "Finish your sheet" card. Only what the site can say it knows:
 * `course` and `colleges` come from the profile when the profile carries them. A profile that has no such
 * field (undefined) is "not stored here", not "missing", so the card never asks for something it cannot keep.
 * Returns null when nothing is missing.
 */
export function sheetGaps(user) {
  if (!user) return null;
  const missing = [];
  if ('course' in user && !user.course) missing.push('course');
  if ('colleges' in user && !(Array.isArray(user.colleges) && user.colleges.length)) missing.push('colleges');
  if (!missing.length) return null;
  const what = missing.length === 2 ? 'your course and colleges' : `your ${missing[0]}`;
  return { missing, line: `Add ${what}. Today plans the road from them.`, label: 'Finish your sheet', href: '/you#sheet' };
}

// The CUET UG 2027 calendar, as the app states it (core/domain/cuet_dates.dart). NTA has not published the
// 2027 bulletin: every date follows the 2026 cycle and is said as "expected".
export const CUET_DATES = Object.freeze({
  registration: Object.freeze({ id: 'registration', name: 'Registration', title: 'CUET registration', start: Date.UTC(2027, 1, 1), end: Date.UTC(2027, 2, 31), when: 'February to March 2027' }),
  boards: Object.freeze({ id: 'boards', name: 'Boards', title: 'Class 12 boards', start: Date.UTC(2027, 1, 15), end: Date.UTC(2027, 3, 5), when: 'Mid-February to early April 2027' }),
  exam: Object.freeze({ id: 'exam', name: 'CUET UG', title: 'CUET UG', start: Date.UTC(2027, 4, 1), end: Date.UTC(2027, 4, 31), when: 'May 2027' }),
});
export const WINDOW_MONTH = 'May 2027';
/** The first day after the last stop: the right edge of the road, and the day the card is gone. */
export const ROAD_END = Date.UTC(2027, 5, 1);

const utcDay = (t) => { const d = new Date(t); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** How far a stop is: "On now", "in 3 days", "in 15 weeks". */
export function etaLabel(stop, today) {
  if (today >= stop.start && today <= stop.end) return 'On now';
  const days = Math.round((stop.start - today) / DAY_MS);
  return days < WEEK_DAYS ? `in ${plural(Math.max(days, 1), 'day')}` : `in ${plural(Math.floor(days / WEEK_DAYS), 'week')}`;
}

/**
 * The road to May as plain values: the stretch to the expected exam window and the stops on the way, each
 * placed by its date between today and the end of the window. Calendar arithmetic only: no projection of
 * marks or chances. `now` is the device clock (ms). Null once the window has closed.
 */
export function roadToMay(now = Date.now()) {
  const today = utcDay(now);
  if (today >= ROAD_END) return null;
  const exam = CUET_DATES.exam;
  const days = Math.round((exam.start - today) / DAY_MS);
  const countdown = days > 0;
  const span = ROAD_END - today;
  const stops = Object.values(CUET_DATES)
    .filter((s) => s.end >= today)
    .map((s) => {
      const from = Math.max(s.start, today);
      return {
        id: s.id, name: s.name, title: s.title, when: s.when, tag: 'Expected',
        eta: etaLabel(s, today),
        // Where the bar starts and how wide it is, in percent of the road from today to the end of May.
        left: Math.max(0, ((from - today) / span) * 100),
        width: Math.max(1.5, ((s.end + DAY_MS - from) / span) * 100),
        current: today >= s.start && today <= s.end,
      };
    });
  const next = stops.find((s) => !s.current);
  const weeks = countdown ? Math.floor(days / WEEK_DAYS) : 0;
  const headline = countdown
    ? (days < WEEK_DAYS ? `${plural(days, 'day')} to the expected CUET window, ${WINDOW_MONTH}.` : `${plural(weeks, 'week')} to the expected CUET window, ${WINDOW_MONTH}.`)
    : `The expected CUET window is open, ${WINDOW_MONTH}.`;
  return { today, countdown, days, weeks, headline, stops, nextId: next?.id || null, note: 'Expected dates, from the 2026 cycle. NTA has not published the 2027 bulletin.' };
}

/**
 * The week ring's state from the goal. `goal` is /api/me/goal ({ daysPerWeek, set }). An older server sends no
 * `set`: then the days in force are the goal. Only an explicit `set: false` is "no goal chosen yet".
 */
export function goalState(goal) {
  if (!goal) return { known: false, set: true, days: null };
  const days = Number.isInteger(goal.daysPerWeek) ? goal.daysPerWeek : null;
  return { known: true, set: goal.set !== false, days };
}
