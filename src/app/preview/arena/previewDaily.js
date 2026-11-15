// Development-only fixtures for the Daily Five on the account (lane daily, 15 Nov 2026). Answered in this tab only; nothing
// is saved anywhere. Used by /preview/arena (Today's row, Today's week, the Mob den's strip) and by /preview/daily (the
// /daily page for a signed-in student, DailyPreviewClient.jsx).
//   &daily=none (default)   the account has no five today and no days
//          played           today's five saved (4 of 5 in 1:42), and the two days before: a run of 3; Today's week shows the
//                           three days as study days (the rhythm counts saved Daily Fives)
//          other            today's five was saved on another phone (3 of 5 in 2:10); this device holds nothing
//          error            the account cannot be read (503)
//   &dailymob=ready (default) | loading | error   the den's strip (with &view=mob&mob=den)
//   &crowd=some (default)   three of today's five have 30 or more answers (64%, 41%, 88%); two do not
//          none             fewer than 30 on every question: no lines
//   &save=ok (default) | fail   POST /api/daily/me answers with the saved record, or 503 (the result says so, Try again)
import { computeRhythm } from '@/lib/server/rhythm';
import { DAILY_FIVE_SIZE, addDays, todayDaily } from '@/lib/dailyFive.mjs';
import { ANSWER_LETTERS, questionRef } from '@/lib/dailyFiveAccount.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;

// Original illustrative questions, never real bank rows. Their keys are the fixture's own.
export const PREVIEW_FIVE = [
  { subject: 'english', chapter: 'Synonyms', q: 'Choose the word nearest in meaning to METICULOUS.', options: ['Careless', 'Thorough', 'Hurried', 'Generous'], correct: 1, why: 'Meticulous means showing great attention to detail, so thorough is closest. Careless and hurried are near opposites.' },
  { subject: 'general-test', chapter: 'Percentages', q: 'A price rises from ₹400 to ₹460. By what percent did it rise?', options: ['12%', '15%', '18%', '60%'], correct: 1, why: 'The rise is ₹60. As a share of the old price, 60 ÷ 400 = 0.15, which is 15%.' },
  { subject: 'english', chapter: 'Antonyms', q: 'Choose the word opposite in meaning to SCARCE.', options: ['Rare', 'Plentiful', 'Hidden', 'Costly'], correct: 1, why: 'Scarce means in short supply; plentiful means there is a lot of it. Rare is a near synonym, not an opposite.' },
  { subject: 'general-test', chapter: 'Number Series', q: 'What comes next: 3, 6, 12, 24, ...?', options: ['30', '36', '48', '72'], correct: 2, why: 'Each term doubles the one before it, so the next term is 24 × 2 = 48.' },
  { subject: 'english', chapter: 'Spotting Errors', q: 'Which part has the error? "Neither of the boys / have finished / their homework / yet."', options: ['Neither of the boys', 'have finished', 'their homework', 'yet'], correct: 1, why: '"Neither" takes a singular verb, so it should be "has finished", not "have finished".' },
];

const PLAYED = { picks: [1, 1, 0, 2, 1], ms: 102_000 };
const OTHER = { picks: [1, 0, 1, 2, 3], ms: 130_000 };

const recordOf = (date, day, { picks, ms }) => {
  const marks = picks.map((p, i) => p === PREVIEW_FIVE[i].correct);
  return { date, day, score: marks.filter(Boolean).length, ms, marks, picks };
};

/** The fixture five as GET /api/daily answers it, with tokens shaped like the server's (they open nowhere). */
export function previewFiveBody(now = Date.now()) {
  const { day, date } = todayDaily(now);
  return { day, date, questions: PREVIEW_FIVE.map((q, i) => ({ ...q, options: [...q.options], token: `d1.preview-${day}-${i + 1}.fixture-token-not-a-seal` })) };
}

function accountBody(kind, now) {
  const { day, date } = todayDaily(now);
  if (kind === 'played') return { day, date, record: recordOf(date, day, PLAYED), played: [addDays(date, -2), addDays(date, -1), date] };
  if (kind === 'other') return { day, date, record: recordOf(date, day, OTHER), played: [date] };
  return { day, date, record: null, played: [] };
}

function crowdBody(kind, now) {
  const { day, date } = todayDaily(now);
  const pct = kind === 'none' ? [null, null, null, null, null] : [64, null, 88, 41, null];
  return { day, date, questions: PREVIEW_FIVE.map((q, i) => ({ ref: questionRef(q), pct: pct[i] })) };
}

function stripBody(kind, now) {
  const { date } = todayDaily(now);
  const youPlayed = kind === 'played' || kind === 'other';
  return {
    day: todayDaily(now).day,
    date,
    members: [
      { name: 'Riya', colour: 3, you: false, state: 'marks', marks: [true, false, true, true, true] },
      { name: 'Aarav', colour: 1, you: true, ...(youPlayed ? { state: 'marks', marks: recordOf(date, 1, kind === 'other' ? OTHER : PLAYED).marks } : { state: 'not_yet' }) },
      { name: 'Zoya', colour: 1, you: false, state: 'played' },
    ],
  };
}

/**
 * The fixture's answer for a Daily Five route (and Today's rhythm with &daily=played), or null when the request is not one.
 * `json(body, status)` is the preview's own reply.
 */
export function previewDaily(url, method, init, fixture, json) {
  const now = Date.now();
  const kind = fixture.get('daily') || 'none';
  if (url.pathname === '/api/daily' && method === 'GET') return json(previewFiveBody(now));
  if (url.pathname === '/api/daily/me' && method === 'GET') {
    if (kind === 'error') return json({ error: 'unavailable' }, 503);
    return json(accountBody(kind, now));
  }
  if (url.pathname === '/api/daily/me' && method === 'POST') {
    if (fixture.get('save') === 'fail') return json({ error: 'unavailable' }, 503);
    const body = JSON.parse(init?.body || '{}');
    const { day, date } = todayDaily(now);
    const held = kind === 'other' ? recordOf(date, day, OTHER) : null;
    const picks = Array.isArray(body.answers) ? body.answers.map((a) => ANSWER_LETTERS.indexOf(a)) : [];
    if (!held && (picks.length !== DAILY_FIVE_SIZE || picks.some((p) => p < 0))) return json({ error: 'bad_answers' }, 400);
    return json({ day, date, record: held || recordOf(date, day, { picks, ms: Math.max(0, Number(body.ms) || 0) }), played: [...(kind === 'played' ? [addDays(date, -2), addDays(date, -1)] : []), date] });
  }
  if (url.pathname === '/api/daily/stats' && method === 'GET') return json(crowdBody(fixture.get('crowd') || 'some', now));
  if (url.pathname === '/api/daily/mob' && method === 'GET') {
    const state = fixture.get('dailymob') || 'ready';
    if (state === 'loading') return new Promise(() => {});
    if (state === 'error') return json({ error: 'unavailable' }, 503);
    return json(stripBody(kind, now));
  }
  if (url.pathname === '/api/me/rhythm' && kind === 'played') {
    // A student whose only study is the Daily Five: three saved fives in a row make three study days.
    const activities = [2, 1, 0].map((back) => ({ id: `d:${back}`, at: now - back * DAY_MS - 60_000, kind: 'daily' }));
    return json(computeRhythm({ activities, daysPerWeek: 4, now }));
  }
  return null;
}
