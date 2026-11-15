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
//   &check=ok (default) | slow | fail   POST /api/daily/check answers at once, after 1.5 s, or with 503 (Try again)
//   &auth=out               /preview/daily as a guest: checks answer and nothing is recorded
// The checks of a signed-in fixture student are kept in this tab (window.__previewDaily): the first pick of each question
// stands, and GET /api/daily/me builds today's record from them once all five are checked, as the server does.
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

/** The fixture five as GET /api/daily answers it: no key and no reason, tokens shaped like the server's (they open nowhere). */
export function previewFiveBody(now = Date.now()) {
  const { day, date } = todayDaily(now);
  return { day, date, questions: PREVIEW_FIVE.map(({ correct: _key, why: _why, ...q }, i) => ({ ...q, options: [...q.options], token: `d1.preview-${day}-${i + 1}.fixture-token-not-a-seal` })) };
}

const REVIEW = PREVIEW_FIVE.map((q) => ({ correct: q.correct, why: q.why }));
/** This tab's checked picks for a signed-in fixture student: the first of each question stands. */
const memory = () => (typeof window === 'undefined' ? { picks: {} } : (window.__previewDaily ||= { picks: {} }));

function heldPicks(kind) {
  if (kind === 'played') return PLAYED.picks;
  if (kind === 'other') return OTHER.picks;
  return [0, 1, 2, 3, 4].map((i) => memory().picks[i + 1] ?? null);
}

function accountBody(kind, now) {
  const { day, date } = todayDaily(now);
  const picks = heldPicks(kind);
  const whole = picks.every((p) => Number.isInteger(p));
  const record = whole ? recordOf(date, day, { picks, ms: kind === 'other' ? OTHER.ms : kind === 'played' ? PLAYED.ms : memory().ms ?? 60_000 }) : null;
  const before = kind === 'played' ? [addDays(date, -2), addDays(date, -1)] : [];
  return { day, date, record, review: record ? REVIEW : null, played: [...before, ...(record ? [date] : [])] };
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
  if (url.pathname === '/api/daily/check' && method === 'POST') {
    const mode = fixture.get('check') || 'ok';
    if (mode === 'fail') return json({ error: 'unavailable' }, 503);
    const body = JSON.parse(init?.body || '{}');
    const n = Number(/^d1\.preview-\d+-(\d)\./.exec(String(body.token || ''))?.[1]);
    const asked = ANSWER_LETTERS.indexOf(body.pick);
    if (!Number.isInteger(n) || n < 1 || n > DAILY_FIVE_SIZE || asked < 0) return json({ error: 'bad_question' }, 400);
    const guest = fixture.get('auth') === 'out';
    let pick = asked;
    if (!guest) {
      const held = heldPicks(kind)[n - 1];
      if (Number.isInteger(held)) pick = held; // the first pick stands
      else { memory().picks[n] = asked; if (n === DAILY_FIVE_SIZE && Number.isFinite(Number(body.ms))) memory().ms = Number(body.ms); }
    }
    const { correct, why } = PREVIEW_FIVE[n - 1];
    const answer = { n, pick, right: pick === correct, correct, why, recorded: !guest };
    return mode === 'slow' ? new Promise((resolve) => setTimeout(() => resolve(json(answer)), 1500)) : json(answer);
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
