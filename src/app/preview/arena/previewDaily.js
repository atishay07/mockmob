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
// Playing for a college (17 Nov 2026, src/lib/daily/team.mjs):
//   &team=none (default)    the account's fives were played for no college; &team=<college id> (hansraj-college ...): the
//                           account's latest five was played for it (yesterday, so today's can still carry it), and a check
//                           of today answers with it; &changed=<date> the day it last changed
//   &seat=4127 (default)    the account's seat number on the admit card (&seat=none: none sent)
//   &mine=none (default)    My colleges (GET /api/me/colleges) is empty; &mine=hansraj: Hansraj College, then Miranda House
//   &board=many (default)   GET /api/daily/board: twelve colleges today (the first nine with an average), the week, no
//                           Sunday board yet (its first one opens 22 Nov), yesterday's trap
//          few              three colleges, under every floor;  zero: nobody played for a college;  fail: 503
// The checks of a signed-in fixture student are kept in this tab (window.__previewDaily): the first pick of each question
// stands, and GET /api/daily/me builds today's record from them once all five are checked, as the server does.
// "Your five" (21 Nov 2026, lane daily-ui; contract tmp/1121-stories/daily/CONTRACT.md): GET /api/daily/mine and the checks of
// a personal five. &five= picks the state (/preview/daily, signed in; it works on /preview/arena too):
//   (absent)   GET /api/daily/mine is not answered here (the preview's own 503): the page plays the shared five, quietly
//   mine       the student's own five, untouched (2 they missed, 2 from their weak chapters, 1 new)
//   two        the same five with places 1 and 2 answered on this device and the account (1: right on a question missed
//              before, so a mistake fixed; 2: wrong, so sent back to the mistakes): the page resumes on question 3
//   done       all five answered (4 of 5), the day's end not seen yet: the page opens on it. The streak reads 12 days first,
//              then 13 with today counted (the five made today count), so the number steps up once (previewDailyStreak)
//   shared     { personal: false }, &reason=no_subjects (default) | thin_bank | shared_started | off | unavailable
//   fail       GET /api/daily/mine answers 503: the shared five, no error
// A check of a personal question answers `fed` as the server does: a wrong first pick 'mistakes', a right first pick on a
// question missed before 'fixed', else null (a retry: null).
import { computeRhythm } from '@/lib/server/rhythm';
import { DAY_GOAL, MAKE_UP_EVERY, MAKE_UP_GOAL, PASS_EVERY, PASS_FIRST_AT, PASS_PER_FIXES, computeChain } from '@/lib/chain/chain.mjs';
import { previewStreak } from './previewStreak';
import { DAILY_FIVE_SIZE, addDays, todayDaily } from '@/lib/dailyFive.mjs';
import { ANSWER_LETTERS, questionRef } from '@/lib/dailyFiveAccount.mjs';
import { DAILY_MINE_STORE } from '@/components/daily/dailyMineUi.mjs';

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
const BOARD_COLLEGES = ['hansraj-college', 'miranda-house', 'shri-ram-college-of-commerce', 'kirori-mal-college', 'hindu-college', 'lady-shri-ram-college-for-women', 'st-stephens-college', 'ramjas-college', 'gargi-college', 'daulat-ram-college', 'sri-guru-gobind-singh-college-of-commerce', 'shaheed-rajguru-college-of-applied-sciences-for-women'];
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

function teamBody(fixture, date, recorded) {
  const college = fixture.get('team');
  if (!college || college === 'none') return memory().team && recorded ? { college: memory().team, since: date, changedOn: null, last: date } : null;
  const changedOn = fixture.get('changed') || null;
  return { college, since: changedOn || addDays(date, -3), changedOn, last: recorded ? date : addDays(date, -1) };
}

function accountBody(kind, now, fixture) {
  const { day, date } = todayDaily(now);
  const picks = heldPicks(kind);
  const whole = picks.every((p) => Number.isInteger(p));
  const record = whole ? recordOf(date, day, { picks, ms: kind === 'other' ? OTHER.ms : kind === 'played' ? PLAYED.ms : memory().ms ?? 60_000 }) : null;
  const before = kind === 'played' ? [addDays(date, -2), addDays(date, -1)] : [];
  const seat = fixture.get('seat') === 'none' ? null : Number(fixture.get('seat') || 4127);
  return { day, date, record, review: record ? REVIEW : null, played: [...before, ...(record ? [date] : [])], team: teamBody(fixture, date, Boolean(record)), seat };
}

function boardBody(kind, now) {
  const { day, date } = todayDaily(now);
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  const from = addDays(date, -((dow + 6) % 7));
  const sunday = { state: 'first', week: '2026-11-22', at: Date.parse('2026-11-22T23:05:00+05:30') };
  if (kind === 'zero') return { day, date, today: { players: 0, counted: 0, colleges: [] }, week: { from, to: date, players: 0, colleges: [] }, sunday, trap: null };
  if (kind === 'few') {
    return {
      day, date, sunday, trap: null,
      today: { players: 5, counted: 4, colleges: [{ college: BOARD_COLLEGES[0], players: 2, avg: null }, { college: BOARD_COLLEGES[3], players: 1, avg: null }, { college: BOARD_COLLEGES[1], players: 1, avg: null }] },
      week: { from, to: date, players: 6, colleges: [{ college: BOARD_COLLEGES[0], players: 3, days: 5, perPlayer: null }, { college: BOARD_COLLEGES[3], players: 1, days: 2, perPlayer: null }] },
    };
  }
  const players = [38, 31, 24, 19, 14, 11, 9, 7, 6, 4, 3, 1];
  const avg = [3.4, 3.1, 3.6, 2.9, 3.2, 3, 2.7, 3.3, 3.5, null, null, null];
  const week = [[44, 2.6], [37, 2.4], [30, 2.3], [25, 2.1], [20, 2], [17, 1.9], [15, 1.8], [13, 1.6], [12, 1.5], [4, null], [3, null], [2, null]];
  return {
    day, date, sunday,
    today: { players: 190, counted: 167, colleges: players.map((p, i) => ({ college: BOARD_COLLEGES[i], players: p, avg: avg[i] })) },
    week: { from, to: date, players: 260, colleges: week.map(([p, per], i) => ({ college: BOARD_COLLEGES[(i + 2) % BOARD_COLLEGES.length], players: p, days: per ? Math.round(p * per) : p + 1, perPlayer: per })) },
    trap: { date: addDays(date, -1), q: 'Choose the word nearest in meaning to CANDID.', letter: 'B', wrong: 'Careful', right: 'Frank', pct: 41, of: 212 },
  };
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

// ---------------------------------------------------------------------------------------------------------------------
// "Your five": original illustrative questions (never real bank rows), their keys the fixture's own. `back`: how many days
// ago the student missed it (a `missed` place's `since`).
export const PREVIEW_MINE = [
  { subject: 'accountancy', name: 'Accountancy', chapter: 'Accounting Ratios', kind: 'missed', back: 7, q: 'Which ratio compares current assets with current liabilities?', options: ['Quick ratio', 'Current ratio', 'Debt equity ratio', 'Proprietary ratio'], correct: 1, why: 'The current ratio is current assets divided by current liabilities. The quick ratio leaves out inventory and prepaid expenses.' },
  { subject: 'economics', name: 'Economics', chapter: 'National Income Accounting', kind: 'missed', back: 9, q: 'Which of these is a stock, not a flow?', options: ['Income', 'Wealth', 'Consumption', 'Investment'], correct: 1, why: 'Wealth is measured at a point in time, so it is a stock. Income, consumption and investment are measured over a period, so they are flows.' },
  { subject: 'accountancy', name: 'Accountancy', chapter: 'Admission of a Partner', kind: 'weak', q: 'Goodwill brought in cash by a new partner is credited to which account?', options: ['Premium for goodwill account', 'Revaluation account', 'Realisation account', 'Cash account'], correct: 0, why: 'The cash brought in for goodwill is credited to the premium for goodwill account, then shared by the old partners in their sacrificing ratio.' },
  { subject: 'business-studies', name: 'Business Studies', chapter: 'Principles of Management', kind: 'weak', q: 'Which principle says each employee should take orders from one boss only?', options: ['Unity of direction', 'Unity of command', 'Scalar chain', 'Order'], correct: 1, why: 'Unity of command means one employee, one superior. Unity of direction is one plan for a group of activities with the same objective.' },
  { subject: 'economics', name: 'Economics', chapter: 'Non-Competitive Markets', kind: 'subject', q: 'Which market has a single seller and no close substitutes?', options: ['Perfect competition', 'Monopoly', 'Oligopoly', 'Monopolistic competition'], correct: 1, why: 'A monopoly has one seller of a good with no close substitutes, so the seller can set the price.' },
];
/** The picks the `two` and `done` states hold: 1 right (a missed question: fixed), 2 wrong (sent back), 3 to 5 right. */
export const PREVIEW_MINE_PICKS = [1, 0, 0, 1, 1];
const MINE_STATES = ['mine', 'two', 'done'];
const MINE_TOKEN = /^d1\.pmine-\d+-(\d)\./;
const mineMemory = () => (memory().mine ||= { picks: {} });
const fedFor = (n, pick) => (pick !== PREVIEW_MINE[n - 1].correct ? 'mistakes' : PREVIEW_MINE[n - 1].kind === 'missed' ? 'fixed' : null);

/** GET /api/daily/mine's personal body for today: the server's shape, tokens that open nowhere. */
export function previewMineBody(now = Date.now()) {
  const { day, date } = todayDaily(now);
  const mix = { missed: 0, weak: 0, subject: 0 };
  const questions = PREVIEW_MINE.map((item, i) => {
    mix[item.kind] += 1;
    return {
      subject: item.subject, q: item.q, options: [...item.options], chapter: item.chapter,
      token: `d1.pmine-${day}-${i + 1}.fixture-token-not-a-seal`,
      why: { kind: item.kind, subject: item.name, chapter: item.chapter, ...(item.kind === 'missed' ? { since: addDays(date, -item.back) } : {}) },
    };
  });
  return { ok: true, personal: true, date, day, questions, mix };
}

/**
 * The `two` and `done` states, set up before the page loads (DailyPreviewClient.jsx): the account holds the first k picks, and
 * the page's own device record is handed the same k checks with what each fed. Returns { checks, fed }.
 */
export function seedPreviewMine(k) {
  const held = mineMemory();
  held.picks = {};
  const checks = [];
  const fed = {};
  for (let n = 1; n <= k; n += 1) {
    const pick = PREVIEW_MINE_PICKS[n - 1];
    const { correct, why } = PREVIEW_MINE[n - 1];
    held.picks[n] = pick;
    checks.push({ pick, right: pick === correct, correct, why, recorded: true, team: null });
    fed[n] = fedFor(n, pick);
  }
  if (k === DAILY_FIVE_SIZE) held.ms = 96_000;
  return { checks, fed };
}

/**
 * /preview/arena has no page-load seeding (DailyPreviewClient.jsx does it for /preview/daily): with &five=done (or two) and
 * nothing held in this tab yet, the first read of the account seeds the same picks, and this device's note of what each fed
 * (dailyMineUi.mjs DAILY_MINE_STORE, the preview student's), unless one for today is already there. So Today's row shows the
 * played state of a personal five (21 Nov 2026 critic: five=done and five=mine printed the same line).
 */
function seedForArena(five, date) {
  const want = five === 'done' ? DAILY_FIVE_SIZE : five === 'two' ? 2 : 0;
  if (!want || Object.keys(mineMemory().picks).length) return;
  const { fed } = seedPreviewMine(want);
  if (typeof window === 'undefined') return;
  try {
    const held = JSON.parse(window.localStorage.getItem(DAILY_MINE_STORE) || 'null');
    if (!held || held.date !== date) window.localStorage.setItem(DAILY_MINE_STORE, JSON.stringify({ v: 1, date, user: 'preview-user', personal: true, fed }));
  } catch { /* storage blocked: the row reads the score alone */ }
}

function mineAccountBody(now, fixture) {
  const { day, date } = todayDaily(now);
  seedForArena(fixture.get('five'), date);
  const held = mineMemory();
  const picks = [1, 2, 3, 4, 5].map((n) => held.picks[n] ?? null);
  const whole = picks.every((p) => Number.isInteger(p));
  const marks = picks.map((p, i) => p === PREVIEW_MINE[i].correct);
  const record = whole ? { date, day, score: marks.filter(Boolean).length, ms: held.ms ?? 60_000, marks, picks } : null;
  const seat = fixture.get('seat') === 'none' ? null : Number(fixture.get('seat') || 4127);
  return { day, date, record, review: record ? PREVIEW_MINE.map((q) => ({ correct: q.correct, why: q.why })) : null, played: record ? [date] : [], team: null, seat };
}

function mineCheck(n, asked, ms) {
  const held = mineMemory();
  const first = !Number.isInteger(held.picks[n]);
  if (first) held.picks[n] = asked;
  if (first && n === DAILY_FIVE_SIZE && Number.isFinite(Number(ms))) held.ms = Number(ms);
  const pick = held.picks[n];
  const { correct, why } = PREVIEW_MINE[n - 1];
  return { n, pick, right: pick === correct, correct, why, recorded: true, for: null, fed: first ? fedFor(n, pick) : null };
}

const DAY = 86_400_000;
const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const addIst = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
/** Today's five finished in this tab (the shared five's picks, or the student's own). */
const fiveDone = () => [1, 2, 3, 4, 5].every((n) => Number.isInteger(mineMemory().picks[n]))
  || [1, 2, 3, 4, 5].every((n) => Number.isInteger(memory().picks[n]));

/**
 * GET /api/me/streak for /preview/daily (DailyPreviewClient.jsx only; the arena keeps previewStreak.js): with &streak= it is
 * previewStreak's fixture; else 12 days in a row up to yesterday, computed by the real chain code. The first read of the tab
 * is today not counted yet; a later read, once today's five are all answered, counts today (a whole five is a streak day:
 * src/lib/server/streakDays.js), so the day's end sees the number rise from 12 to 13.
 */
export function previewDailyStreak(url, method, init, fixture, json) {
  if (url.pathname !== '/api/me/streak') return null;
  if (fixture.get('streak')) return previewStreak(url, method, init, fixture, json);
  if (method !== 'GET') return json({ error: { code: 'BODY_INVALID', message: 'Preview only.' } }, 400);
  const held = memory();
  const reads = held.streakReads || 0;
  held.streakReads = reads + 1;
  const T = istToday();
  const daily = Array.from({ length: 12 }, (_, i) => ({ day: addIst(T, i - 12), answered: 8 + ((i * 7) % 13) }));
  if (reads > 0 && fiveDone()) daily.push({ day: T, answered: DAILY_FIVE_SIZE });
  return json({
    ...computeChain({ daily, pauses: [], today: T }),
    rule: { answers: DAY_GOAL, makeUp: MAKE_UP_GOAL, makeUpEvery: MAKE_UP_EVERY, passFirstAt: PASS_FIRST_AT, passEvery: PASS_EVERY, passPerFixes: PASS_PER_FIXES },
  });
}

/**
 * The fixture's answer for a Daily Five route (and Today's rhythm with &daily=played), or null when the request is not one.
 * `json(body, status)` is the preview's own reply.
 */
export function previewDaily(url, method, init, fixture, json) {
  const now = Date.now();
  const kind = fixture.get('daily') || 'none';
  const five = fixture.get('five');
  const mineState = MINE_STATES.includes(five);
  if (url.pathname === '/api/daily' && method === 'GET') return json(previewFiveBody(now));
  if (url.pathname === '/api/daily/mine' && method === 'GET') {
    if (!five) return null;
    if (fixture.get('auth') === 'out') return json({ error: 'unauthorized' }, 401);
    if (five === 'fail') return json({ error: 'unavailable' }, 503);
    if (five === 'shared') return json({ ok: true, personal: false, reason: fixture.get('reason') || 'no_subjects' });
    return json(previewMineBody(now));
  }
  if (url.pathname === '/api/daily/me' && method === 'GET' && mineState && kind !== 'error') return json(mineAccountBody(now, fixture));
  if (url.pathname === '/api/daily/me' && method === 'GET') {
    if (kind === 'error') return json({ error: 'unavailable' }, 503);
    return json(accountBody(kind, now, fixture));
  }
  if (url.pathname === '/api/daily/check' && method === 'POST') {
    const mode = fixture.get('check') || 'ok';
    if (mode === 'fail') return json({ error: 'unavailable' }, 503);
    const body = JSON.parse(init?.body || '{}');
    const own = Number(MINE_TOKEN.exec(String(body.token || ''))?.[1]);
    if (Number.isInteger(own) && own >= 1 && own <= DAILY_FIVE_SIZE && ANSWER_LETTERS.includes(body.pick)) {
      const answer = mineCheck(own, ANSWER_LETTERS.indexOf(body.pick), body.ms);
      return mode === 'slow' ? new Promise((resolve) => setTimeout(() => resolve(json(answer)), 1500)) : json(answer);
    }
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
    // The college the five counts for: the account's (&team=), else the one the page asked for, kept for this tab.
    const fixed = fixture.get('team') && fixture.get('team') !== 'none' ? fixture.get('team') : null;
    if (!guest && !memory().team) memory().team = fixed || (typeof body.for === 'string' ? body.for : null);
    const answer = { n, pick, right: pick === correct, correct, why, recorded: !guest, ...(guest ? {} : { for: memory().team || null }) };
    return mode === 'slow' ? new Promise((resolve) => setTimeout(() => resolve(json(answer)), 1500)) : json(answer);
  }
  if (url.pathname === '/api/daily/stats' && method === 'GET') return json(crowdBody(fixture.get('crowd') || 'some', now));
  if (url.pathname === '/api/daily/board' && method === 'GET') {
    const kind = fixture.get('board') || 'many';
    return kind === 'fail' ? json({ error: 'unavailable' }, 503) : json(boardBody(kind, now));
  }
  if (url.pathname === '/api/me/colleges' && method === 'GET') {
    if (fixture.get('mine') !== 'hansraj') return json({ colleges: [] });
    return json({ colleges: [
      { programmeId: 'b-com-hons', programme: 'B.Com. (Hons.)', college: 'Hansraj College', position: 1 },
      { programmeId: 'b-a-hons-economics', programme: 'B.A. (Hons.) Economics', college: 'Miranda House (W)', position: 2 },
    ] });
  }
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
