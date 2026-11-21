// "Your five" (lane daily-server, 21 Nov 2026; tmp/1121-stories/DAILY-SPEC.md, contract tmp/1121-stories/daily/CONTRACT.md):
// a signed-in student's Daily Five from their own record. Proved with an in-memory database and injected fakes only: the mix
// and each hand-on, the same five on a reload with and without the cookie, answered places frozen from their rows, the
// exclusions (shared five, held, seen, frozen), no key or id in the payload, the feedback writes and their fail-soft, the kill
// switch, and GET /api/daily/me's review for a personal five. Software fixtures; nothing here reads a real database.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { legacyRow, rng, setFixtureSecret } from './helpers/egress_fixtures.mjs';
import { dailyTokenKey, openDailyToken, sealDailyToken } from '../../src/lib/server/dailyFive.js';
import { createDailyHandlers, createDailyStore } from '../../src/lib/server/dailyFiveAccount.js';
import { MINE_RATE, createDailyMine, mineCookieLine, openMineCookie, openMineMark, sealMineCookie, sealMineToken, subjectsOf } from '../../src/lib/server/dailyFiveMine.js';
import { servedRow, storedIndexOf } from '../../data/option_order.js';
import { dayNumber } from '../../src/lib/dailyFive.mjs';
import {
  MINE_COOKIE, MINE_LIMITS, MINE_COPY, acceptMine, assembleFive, fedCounts, fedLines, mineEnabled, mineLabel, mineMix, minePayload, missedList,
  mixLine, rankIds, readMinePayload, subjectTurn, weakRanking,
} from '../../src/lib/dailyFiveMine.mjs';

const restore = setFixtureSecret();
after(restore);
const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const NOW = Date.parse('2026-11-21T06:30:00Z'); // 12:00 pm IST
const DATE = '2026-11-21';
const DAY = dayNumber(DATE);
const KEY = dailyTokenKey('a-software-fixture-secret-of-some-length');
const USER = 'u-1';

// ---------------------------------------------------------------------------------------------------------------------
// The bank: plain four-option rows (the Practice gate's own fixtures) with uuid-like ids, so the seeded windows wrap.

const uuid = (n) => { const h = createHash('md5').update(`q${n}`).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`; };
function bank({ perChapter = 12, chapters = {} } = {}) {
  const rand = rng(21);
  const rows = [];
  let n = 0;
  for (const subject of ['accountancy', 'economics', 'english', 'gat']) {
    for (let c = 0; c < 5; c += 1) {
      for (let i = 0; i < perChapter; i += 1) {
        const row = legacyRow(rand, n, { subject });
        rows.push({
          ...row, id: uuid(n), subject, chapter: chapters[subject]?.[c] || `Chapter ${c}`, status: 'live', is_deleted: false, verification_state: null, exploration_state: null,
          passage_group_id: null, legacy_screening: null, family_id: null, score: 1, explanation: `The stated rule for this entry applies in case ${n}.`,
          options: row.options.length === 4 && new Set(row.options).size === 4 ? row.options : ['One way', 'Two ways', 'Three ways', 'Four ways'],
        });
        n += 1;
      }
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------------------------------
// An in-memory Supabase: questions, user_question_progress, question_interactions (its real key and foreign key).

const VISIBLE = (r) => r.status === 'live' || (r.verification_state === 'verified' && r.exploration_state === 'active');
function memoryDb(tables, { failOn = null, beforeUpsert = null } = {}) {
  const calls = [];
  const valueOf = (row, column) => {
    const m = /^metadata->>(\w+)$/.exec(column);
    if (m) { const v = row.metadata?.[m[1]]; return v === undefined || v === null ? null : String(v); }
    return row[column];
  };
  function from(name) {
    const st = { filters: [], order: [], limit: Infinity, select: '*' };
    const run = () => {
      calls.push({ table: name, select: st.select, filters: st.filters.map((f) => `${f[0]}:${f[1]}`), limit: st.limit });
      if (failOn && failOn(name, st)) return { data: null, error: { code: 'XX000', message: 'fixture failure' } };
      let rows = (tables[name] || []).slice();
      for (const [kind, column, value] of st.filters) {
        if (kind === 'eq') rows = rows.filter((r) => valueOf(r, column) === value);
        if (kind === 'is') rows = rows.filter((r) => (valueOf(r, column) ?? null) === value);
        if (kind === 'in') rows = rows.filter((r) => value.includes(valueOf(r, column)));
        if (kind === 'gte') rows = rows.filter((r) => valueOf(r, column) >= value);
        if (kind === 'lt') rows = rows.filter((r) => valueOf(r, column) < value);
        if (kind === 'notnull') rows = rows.filter((r) => valueOf(r, column) != null);
        if (kind === 'visible') rows = rows.filter(VISIBLE);
      }
      for (const [column, asc] of [...st.order].reverse()) rows.sort((a, b) => (a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0) * (asc ? 1 : -1));
      rows = rows.slice(0, st.limit);
      calls[calls.length - 1].rows = rows.length;
      return { data: rows.map((r) => structuredClone(r)), error: null };
    };
    const q = {
      select(columns) { st.select = columns; return q; },
      eq(c, v) { st.filters.push(['eq', c, v]); return q; },
      is(c, v) { st.filters.push(['is', c, v]); return q; },
      in(c, v) { st.filters.push(['in', c, v]); return q; },
      gte(c, v) { st.filters.push(['gte', c, v]); return q; },
      lt(c, v) { st.filters.push(['lt', c, v]); return q; },
      not(c, op, v) { assert.equal(op, 'is'); assert.equal(v, null); st.filters.push(['notnull', c]); return q; },
      or(expression) { assert.match(expression, /^status\.eq\.live,/); st.filters.push(['visible']); return q; },
      order(c, opts = {}) { st.order.push([c, opts.ascending !== false]); return q; },
      limit(n) { st.limit = n; return q; },
      range(a, b) { st.limit = b - a + 1; return q; },
      maybeSingle: async () => { const r = run(); return { data: r.data?.[0] ?? null, error: r.error }; },
      async upsert(rows, opts) {
        calls.push({ table: name, upsert: rows.length });
        if (beforeUpsert) await beforeUpsert(rows);
        if (failOn && failOn(name, { op: 'upsert' })) return { error: { code: 'XX000', message: 'fixture failure' } };
        assert.equal(opts.onConflict, 'id');
        tables[name] ||= [];
        for (const r of rows) if (!tables.questions.some((x) => x.id === r.question_id)) return { error: { code: '23503', message: 'fk' } };
        const have = new Set(tables[name].map((r) => r.id));
        for (const r of rows) if (!have.has(r.id)) tables[name].push(structuredClone(r));
        return { error: null };
      },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    return q;
  }
  return { tables, calls, client: { from } };
}

// ---------------------------------------------------------------------------------------------------------------------
// The harness: the mine service, the check and me handlers wired to it, and fakes for every other dependency.

function harness({
  rows = bank(), subjects = ['accountancy', 'economics'], wrong = 3, held = new Set(), weakFrom = [['accountancy', 'Chapter 1', 3], ['economics', 'Chapter 2', 2], ['accountancy', 'Chapter 3', 1]],
  enabled = true, failOn = null, attemptsFail = false, progressFail = false, reviseFail = false, now = NOW, key = KEY, sharedFrom = 'english',
  wrongPlan = null, syllabusOption = null, failBox = null, beforeUpsert = null,
} = {}) {
  const tables = { questions: rows, user_question_progress: [], question_interactions: [], recovery_family_holds: [] };
  // failBox: a failure that can be switched on mid-test ({ on: (table, st) => boolean }).
  const db = memoryDb(tables, { failOn: failBox ? (name, st) => Boolean(failBox.on?.(name, st)) : failOn, beforeUpsert });
  // Wrong answers before today: the newest (14 Nov) of accountancy chapter 0, then chapter 4 and chapter 0 again (12 Nov).
  // wrongPlan: [[chapter index, row index in it, ISO time], ...] in place of that list.
  const ofChapter = (c) => rows.filter((r) => r.subject === 'accountancy' && r.chapter === `Chapter ${c}`);
  const plan = wrongPlan || [[0, 0, '2026-11-14T10:00:00Z'], [4, 0, '2026-11-12T10:00:00Z'], [0, 1, '2026-11-12T10:00:00Z']].slice(0, wrong);
  const wrongRows = plan.map(([c, i]) => ofChapter(c)[i]).filter(Boolean);
  plan.forEach(([c, i, at]) => {
    const r = ofChapter(c)[i];
    if (!r) return;
    tables.user_question_progress.push({
      user_id: USER, question_id: r.id, subject: r.subject, chapter: r.chapter, seen_count: 1, attempt_count: 1, correct_count: 0,
      last_correct: false, last_selected_key: 'A', last_attempted_at: at,
    });
  });
  // Today's shared five: five of the English window. `sharedBox.list` can be swapped mid-test (a window that changed).
  const shared = rows.filter((r) => r.subject === sharedFrom).slice(0, 5).map((r) => ({ id: r.id, q: r.question, options: r.options, correct: r.correct_index, why: r.explanation }));
  const sharedBox = { list: shared };
  const attempts = [{
    subject: 'accountancy',
    details: weakFrom.flatMap(([, , n], i) => Array.from({ length: n }, (_, k) => ({ qid: `paper-${i}-${k}`, isCorrect: false }))),
    questionsSnapshot: weakFrom.flatMap(([subject, chapter, n], i) => Array.from({ length: n }, (_, k) => ({ id: `paper-${i}-${k}`, subject, chapter }))),
  }];
  const progressCalls = [];
  const reviseCalls = [];
  const warnings = [];
  const clock = { t: now };
  const store = createDailyStore({ db: () => db.client, now: () => clock.t });
  const switchOn = { value: enabled };
  const mine = createDailyMine({
    db: () => db.client,
    auth: async (request) => (request.headers.get('x-user') === 'none' ? null : { user: { id: USER, subjects } }),
    rateLimit: async () => ({ allowed: true }),
    store,
    key,
    five: async () => sharedBox.list,
    held: async () => held,
    ...(syllabusOption ? { syllabusOption } : { syllabusOption: async () => null }),
    attempts: async () => { if (attemptsFail) throw new Error('papers down'); return attempts; },
    recordProgress: async (args) => {
      progressCalls.push(structuredClone(args));
      if (progressFail) throw new Error('progress down');
      for (const d of args.details) {
        const q = args.questionsSnapshot.find((x) => x.id === d.qid);
        const had = tables.user_question_progress.find((p) => p.user_id === args.userId && p.question_id === d.qid);
        const next = { user_id: args.userId, question_id: d.qid, subject: q.subject, chapter: q.chapter, last_correct: d.isCorrect, last_selected_key: 'ABCD'[d.givenIndex], last_attempted_at: new Date(clock.t).toISOString(), attempt_count: (had?.attempt_count || 0) + 1 };
        if (had) Object.assign(had, next); else tables.user_question_progress.push(next);
      }
    },
    answerRevise: async (userId, body) => { reviseCalls.push({ userId, ...body }); if (reviseFail) throw new Error('revise down'); return { http: 200, body: { ok: true } }; },
    enabled: () => switchOn.value,
    now: () => clock.t,
    warn: (line) => warnings.push(line),
  });
  const handlersFor = (userId) => createDailyHandlers({
    auth: async () => ({ user: { id: userId } }),
    rateLimit: async () => ({ allowed: true }),
    originOk: () => true,
    store,
    key,
    five: async () => sharedBox.list,
    mobEnabled: () => true,
    now: () => clock.t,
    mine,
  });
  const handlers = handlersFor(USER);
  let jar = null;
  const get = async ({ cookie = true, user = USER } = {}) => {
    const headers = { 'x-user': user || 'none' };
    if (cookie && jar) headers.cookie = `other=1; ${MINE_COOKIE}=${jar}`;
    const res = await mine.getMine(new Request('https://www.mockmob.in/api/daily/mine', { headers }));
    const set = res.headers.get('set-cookie');
    if (set) jar = /mm_daily_mine=([^;]+)/.exec(set)[1];
    return { res, set, body: await res.json() };
  };
  // The browser does not send the mine cookie to the check (its Path is /api/daily/mine); `cookie: true` sends it anyway.
  const check = async (token, pick, { cookie = false, as = null, tick = 1000 } = {}) => {
    clock.t += tick; // a real clock moves between two checks
    const headers = { 'content-type': 'application/json' };
    if (cookie && jar) headers.cookie = `${MINE_COOKIE}=${jar}`;
    const h = as ? handlersFor(as) : handlers;
    return (await h.postCheck(new Request('https://www.mockmob.in/api/daily/check', { method: 'POST', headers, body: JSON.stringify({ token, pick }) }))).json();
  };
  const me = async () => (await handlers.getMe(new Request('https://www.mockmob.in/api/daily/me'))).json();
  return {
    db, tables, mine, handlers, get, check, me, shared, sharedBox, wrongRows, progressCalls, reviseCalls, warnings, switchOn, clock,
    forgetCookie: () => { jar = null; }, jar: () => jar,
  };
}

const idsOf = (body) => body.questions.map((q) => openDailyToken(KEY, q.token).id);
const letter = (i) => 'ABCD'[i];

// ---------------------------------------------------------------------------------------------------------------------
// The pure rules.

test('the kill switch: on unless DAILY_MINE_ENABLED is the string false', () => {
  assert.equal(mineEnabled({}), true);
  assert.equal(mineEnabled({ DAILY_MINE_ENABLED: 'true' }), true);
  assert.equal(mineEnabled({ DAILY_MINE_ENABLED: 'false' }), false);
  assert.equal(mineEnabled({ DAILY_MINE_ENABLED: ' FALSE ' }), false);
});

test('the mix: missed, weak, subject in that order; a kind that cannot fill hands its places on', () => {
  const q = (id, chapter, subjectId = 's') => ({ id, chapterKey: chapter, subjectId });
  const full = assembleFive({ missed: [q('m1', 'a'), q('m2', 'b')], weak: [[q('w1', 'c')], [q('w2', 'd')]], subject: [q('s1', 'e')] });
  assert.deepEqual(full.map((p) => [p.n, p.kind, p.q.id]), [[1, 'missed', 'm1'], [2, 'missed', 'm2'], [3, 'weak', 'w1'], [4, 'weak', 'w2'], [5, 'subject', 's1']]);
  assert.deepEqual(mineMix(full), { missed: 2, weak: 2, subject: 1 });
  // One a chapter: a second missed question of chapter a is passed over.
  assert.deepEqual(assembleFive({ missed: [q('m1', 'a'), q('m1b', 'a'), q('m2', 'b')], weak: [[q('w1', 'c')], [q('w2', 'd')]], subject: [q('s1', 'e')] }).map((p) => p.q.id), ['m1', 'm2', 'w1', 'w2', 's1']);
  // No mistakes yet: weak takes four chapters, then subject.
  const noMissed = assembleFive({ missed: [], weak: [[q('w1', 'c')], [q('w2', 'd')], [q('w3', 'f')], [q('w4', 'g')], [q('w5', 'h')]], subject: [q('s1', 'e')] });
  assert.deepEqual(mineMix(noMissed), { missed: 0, weak: 4, subject: 1 });
  // One mistake, one weak chapter: the subject takes three.
  assert.deepEqual(mineMix(assembleFive({ missed: [q('m1', 'a')], weak: [[q('w1', 'c')]], subject: [q('s1', 'e'), q('s2', 'e'), q('s3', 'e'), q('s4', 'e')] })), { missed: 1, weak: 1, subject: 3 });
  // Weak lists of one chapter give one question, never two.
  assert.deepEqual(mineMix(assembleFive({ missed: [], weak: [[q('w1', 'c'), q('w1b', 'c')]], subject: [q('s1', 'e'), q('s2', 'e'), q('s3', 'e'), q('s4', 'e')] })), { missed: 0, weak: 1, subject: 4 });
  // Fewer than five in all: no personal five.
  assert.equal(assembleFive({ missed: [q('m1', 'a')], weak: [], subject: [q('s1', 'e')] }), null);
  assert.equal(assembleFive({}), null);
  // A pinned (answered) place keeps its question and counts toward its kind; the open places fill in order.
  const pinned = assembleFive({ pinned: [{ n: 1, kind: 'missed', q: q('m1', 'a') }], missed: [q('m1', 'a'), q('m2', 'b')], weak: [[q('w1', 'c')], [q('w2', 'd')]], subject: [q('s1', 'e')] });
  assert.deepEqual(pinned.map((p) => [p.kind, p.q.id]), [['missed', 'm1'], ['missed', 'm2'], ['weak', 'w1'], ['weak', 'w2'], ['subject', 's1']]);
  const pinned3 = assembleFive({ pinned: [{ n: 3, kind: 'weak', q: q('w1', 'c') }], missed: [q('m1', 'a'), q('m2', 'b')], weak: [[q('w1', 'c'), q('w1b', 'c')], [q('w2', 'd')]], subject: [q('s1', 'e')] });
  assert.deepEqual(pinned3.map((p) => p.q.id), ['m1', 'm2', 'w1', 'w2', 's1'], 'a pinned weak chapter is not used twice');
  assert.equal(assembleFive({ pinned: [{ n: 1, kind: 'missed', q: q('x', 'a') }, { n: 1, kind: 'weak', q: q('y', 'b') }] }), null, 'two rows for one place');
});

test('the seed, the day\'s subject, the weakest chapters and the missed list', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  assert.deepEqual(rankIds(ids, 'seed-1'), rankIds([...ids].reverse(), 'seed-1'), 'the same order whatever the input order');
  assert.notDeepEqual(rankIds(ids, 'seed-1'), rankIds(ids, 'seed-2'));
  assert.deepEqual(subjectTurn(['x', 'y', 'z'], 1), ['x', 'y', 'z']);
  assert.deepEqual(subjectTurn(['x', 'y', 'z'], 2), ['y', 'z', 'x']);
  assert.deepEqual(subjectTurn(['x', 'y', 'z'], 4), ['x', 'y', 'z']);
  const weak = weakRanking([{ subject: 'a', chapter: 'one' }, { subject: 'b', chapter: 'two' }, { subject: 'b', chapter: 'two' }, { subject: 'a', chapter: 'three' }, { subject: 'zz', chapter: 'gone' }], { subjectOf: (s) => (s === 'zz' ? null : s) });
  assert.deepEqual(weak, [{ subject: 'b', chapter: 'two', misses: 2 }, { subject: 'a', chapter: 'one', misses: 1 }, { subject: 'a', chapter: 'three', misses: 1 }]);
  const rows = [
    { question_id: 't', subject: 's', chapter: 'a', last_attempted_at: '2026-11-21T03:00:00Z' }, // today (IST): not yet
    { question_id: 'x', subject: 's', chapter: 'a', last_attempted_at: '2026-11-20T19:00:00Z' }, // 21 Nov 0:30 am IST: today
    { question_id: 'm1', subject: 's', chapter: 'a', last_attempted_at: '2026-11-14T10:00:00Z' },
    { question_id: 'm2', subject: 's', chapter: 'a', last_attempted_at: '2026-11-13T10:00:00Z' },
    { question_id: 'm3', subject: 's', chapter: 'b', last_attempted_at: '2026-11-12T10:00:00Z' },
  ];
  assert.deepEqual(missedList(rows, DATE), [{ id: 'm1', since: '2026-11-14' }, { id: 'm3', since: '2026-11-12' }, { id: 'm2', since: '2026-11-13' }], 'before today only; one of each chapter first');
  assert.deepEqual(missedList(rows, DATE, new Set(['t'])).map((m) => m.id), ['t', 'm3', 'x', 'm1', 'm2'].filter((id) => id !== 'x').sort((a, b) => ['t', 'm3', 'm1', 'm2'].indexOf(a) - ['t', 'm3', 'm1', 'm2'].indexOf(b)), 'an answered place stays in');
});

test('the words: labels, the mix line and the day\'s counts are plain and true', () => {
  assert.equal(mineLabel({ kind: 'missed', since: '2026-11-14' }), 'You missed this on 14 Nov');
  assert.equal(mineLabel({ kind: 'missed' }), 'You missed this before');
  assert.equal(mineLabel({ kind: 'weak', chapter: 'Ratio analysis' }), 'Your weak chapter: Ratio analysis');
  assert.equal(mineLabel({ kind: 'subject', subject: 'Economics' }), 'New from Economics');
  assert.equal(mixLine({ missed: 2, weak: 2, subject: 1 }), '2 you missed, 2 from your weak chapters, 1 new');
  assert.equal(mixLine({ missed: 0, weak: 4, subject: 1 }), '4 from your weak chapters, 1 new');
  assert.deepEqual(fedCounts([{ fed: 'fixed' }, { fed: 'mistakes' }, { fed: null }, 'mistakes', {}]), { fixed: 1, sent: 2 });
  assert.deepEqual(fedLines({ fixed: 1, sent: 1 }), ['1 mistake fixed', '1 sent back to your mistakes']);
  assert.deepEqual(fedLines({ fixed: 2, sent: 0 }), ['2 mistakes fixed']);
  assert.deepEqual(fedLines({}), []);
  for (const line of [...Object.values(MINE_COPY), mixLine({ missed: 1, weak: 1, subject: 3 }), ...fedLines({ fixed: 3, sent: 2 })]) {
    assert.doesNotMatch(line, /[—–!]|\p{Extended_Pictographic}/u, line);
    assert.match(line, /^[A-Z0-9]/, `sentence case: ${line}`);
  }
});

test('the cookie payload: today, this student, five distinct places of a known kind, or nothing', () => {
  const places = [1, 2, 3, 4, 5].map((n) => ({ n, kind: n < 3 ? 'missed' : n < 5 ? 'weak' : 'subject', since: n === 1 ? '2026-11-14' : null, q: { id: `q-${n}` } }));
  const payload = minePayload({ date: DATE, userId: USER, places });
  const back = readMinePayload(payload, { date: DATE, userId: USER });
  assert.deepEqual(back.map((p) => [p.n, p.id, p.kind, p.since]), [[1, 'q-1', 'missed', '2026-11-14'], [2, 'q-2', 'missed', null], [3, 'q-3', 'weak', null], [4, 'q-4', 'weak', null], [5, 'q-5', 'subject', null]]);
  assert.equal(readMinePayload(payload, { date: '2026-11-22', userId: USER }), null, 'another day');
  assert.equal(readMinePayload(payload, { date: DATE, userId: 'u-2' }), null, 'another student');
  assert.equal(readMinePayload({ ...payload, q: payload.q.slice(0, 4) }, { date: DATE, userId: USER }), null);
  assert.equal(readMinePayload({ ...payload, q: [...payload.q.slice(0, 4), payload.q[0]] }, { date: DATE, userId: USER }), null, 'a repeated id');
  const sealed = sealMineCookie(KEY, payload);
  assert.deepEqual(openMineCookie(KEY, sealed), payload);
  assert.equal(openMineCookie(dailyTokenKey('another-secret-of-enough-length'), sealed), null);
  assert.equal(openDailyToken(KEY, sealed), null, 'a cookie never opens as a token');
  assert.equal(openMineCookie(KEY, sealDailyToken(KEY, { date: DATE, n: 1, id: 'x', correct: 0 })), null, 'a token never opens as a cookie');
});

// ---------------------------------------------------------------------------------------------------------------------
// GET /api/daily/mine.

test('GET /api/daily/mine: signed in only, never cached, limited per student', async () => {
  const h = harness();
  const out = await h.get({ user: null });
  assert.equal(out.res.status, 401);
  assert.equal(out.res.headers.get('cache-control'), 'no-store');
  const limits = [];
  const mine = createDailyMine({ auth: async () => ({ user: { id: USER, subjects: ['economics'] } }), rateLimit: async (_r, opts) => { limits.push(opts); return { allowed: false, retryAfterSeconds: 30 }; }, key: KEY, enabled: () => true });
  const limited = await mine.getMine(new Request('https://www.mockmob.in/api/daily/mine'));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '30');
  assert.deepEqual(limits[0], { ...MINE_RATE, keyParts: [USER], identityOnly: true, fallback: 'memory' });
});

test('GET /api/daily/mine: the student\'s five, 2 missed, 2 weak, 1 subject, in the shared five\'s exact shape plus why', async () => {
  const h = harness();
  const { res, set, body } = await h.get();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(body.personal, true);
  assert.equal(body.date, DATE);
  assert.equal(body.day, DAY);
  assert.deepEqual(body.mix, { missed: 2, weak: 2, subject: 1 });
  assert.deepEqual(body.questions.map((q) => q.why.kind), ['missed', 'missed', 'weak', 'weak', 'subject']);
  for (const q of body.questions) {
    assert.deepEqual(Object.keys(q).filter((k) => k !== 'pastPaper').sort(), ['chapter', 'options', 'q', 'subject', 'token', 'why']);
    assert.equal(q.options.length, 4);
  }
  // The missed places: the student's wrong answers before today, with the day of that answer.
  const ids = idsOf(body);
  assert.deepEqual(ids.slice(0, 2).sort(), h.wrongRows.slice(0, 3).filter((r, i, all) => all.findIndex((x) => x.chapter === r.chapter) === i).map((r) => r.id).sort(), 'one a chapter, newest first');
  assert.equal(body.questions[0].why.since, '2026-11-14');
  assert.equal(body.questions[0].why.subject, 'Accountancy');
  // The weak places: the two weakest chapters, one each, questions never seen.
  assert.deepEqual(body.questions.slice(2, 4).map((q) => [q.subject, q.why.chapter]), [['accountancy', 'Chapter 1'], ['economics', 'Chapter 2']]);
  const seen = new Set(h.tables.user_question_progress.map((p) => p.question_id));
  for (const id of ids.slice(2)) assert.ok(!seen.has(id), 'weak and subject questions are unseen');
  // The subject place turns with the day: day 7 of ['accountancy', 'economics'] is accountancy ((7 - 1) mod 2 = 0).
  assert.equal(body.questions[4].subject, 'accountancy');
  assert.equal(body.questions[4].why.subject, 'Accountancy');
  // The page's reading, and the labels.
  const accepted = acceptMine(body);
  assert.equal(accepted.personal, true);
  assert.equal(accepted.questions[0].subject, 'Accountancy');
  assert.equal(accepted.questions[0].slug, 'accountancy');
  assert.equal(mineLabel(accepted.questions[0].why), 'You missed this on 14 Nov');
  assert.equal(mixLine(accepted.mix), '2 you missed, 2 from your weak chapters, 1 new');
  // The cookie: httpOnly, same-site, sent only to this route, until 12:00 am IST (12 hours from noon IST).
  assert.match(set, /^mm_daily_mine=m1\.[^;]+; Path=\/api\/daily\/mine; Max-Age=43200; HttpOnly; SameSite=Lax; Secure$/);
});

test('GET /api/daily/mine: no key, no reason and no id leave before a check; each token opens to its own place', async () => {
  const h = harness();
  const { body } = await h.get();
  const text = JSON.stringify(body);
  assert.doesNotMatch(text, /"correct"|"id"/);
  body.questions.forEach((q, i) => {
    const opened = openDailyToken(KEY, q.token);
    assert.equal(opened.date, DATE);
    assert.equal(opened.n, i + 1);
    const row = h.tables.questions.find((r) => r.id === opened.id);
    const served = servedRow(row).row;
    assert.equal(opened.correct, served.correct_index, 'the served key, as the shared five seals it');
    assert.ok(!text.includes(opened.id), 'no id');
    assert.ok(!text.includes(opened.why), 'no reason');
    assert.deepEqual(q.options, served.options.map(String), 'the stable option order every surface serves');
  });
});

test('GET /api/daily/mine: the same five on a reload, with the cookie and without it', async () => {
  const h = harness();
  const first = await h.get();
  const again = await h.get();
  assert.deepEqual(idsOf(again.body), idsOf(first.body), 'with the cookie');
  assert.equal(again.set, null, 'the cookie is not rewritten');
  h.forgetCookie();
  const fresh = await h.get({ cookie: false });
  assert.deepEqual(idsOf(fresh.body), idsOf(first.body), 'rebuilt from the seed');
  // Another student's cookie on this browser is not theirs.
  const other = harness();
  const theirs = sealMineCookie(KEY, minePayload({ date: DATE, userId: 'u-2', places: [1, 2, 3, 4, 5].map((n) => ({ n, kind: 'subject', q: { id: other.tables.questions[n].id } })) }));
  const res = await other.mine.getMine(new Request('https://www.mockmob.in/api/daily/mine', { headers: { cookie: `${MINE_COOKIE}=${theirs}` } }));
  assert.deepEqual(idsOf(await res.json()), idsOf(first.body));
});

test('GET /api/daily/mine: answered places stay frozen from their rows, and the others do not move', async () => {
  const h = harness();
  const first = await h.get();
  const ids = idsOf(first.body);
  // Place 1 (a missed question) answered right, place 3 (weak) answered wrong: the progress rows change with them.
  const key1 = openDailyToken(KEY, first.body.questions[0].token).correct;
  const key3 = openDailyToken(KEY, first.body.questions[2].token).correct;
  await h.check(first.body.questions[0].token, letter(key1));
  await h.check(first.body.questions[2].token, letter((key3 + 1) % 4));
  const rows = h.tables.question_interactions;
  // Each answer keeps its kind, and its check's own random mark (`r`, which tells this check's row from a second check's).
  assert.deepEqual(rows.map(({ metadata: { mine: { r, ...kind } } }) => kind), [{ k: 'missed', since: '2026-11-14' }, { k: 'weak' }], 'each answer keeps its kind');
  assert.ok(rows.every((row) => /^[A-Za-z0-9_-]{12}$/.test(row.metadata.mine.r)) && rows[0].metadata.mine.r !== rows[1].metadata.mine.r);
  // With the cookie, and without it (rebuilt: the answered places counted toward their kinds).
  assert.deepEqual(idsOf((await h.get()).body), ids);
  h.forgetCookie();
  const rebuilt = await h.get({ cookie: false });
  assert.deepEqual(idsOf(rebuilt.body), ids, 'the same five after two answers changed the record');
  assert.equal(rebuilt.set !== null, true, 'a rebuilt five writes the cookie again');
  assert.deepEqual(rebuilt.body.questions.map((q) => q.why.kind), ['missed', 'missed', 'weak', 'weak', 'subject']);
  assert.equal(rebuilt.body.questions[0].why.since, '2026-11-14');
  // Review 21 Nov 2026: every answer to a question of the student's own five carries its tag (it is sealed in the question's
  // token, so a check without the cookie is tagged too). A row without one is an answer to the shared five, so the account
  // keeps playing the shared five rather than build a personal five around it.
  for (const r of rows) delete r.metadata.mine;
  h.forgetCookie();
  assert.deepEqual((await h.get({ cookie: false })).body, { ok: true, personal: false, reason: 'shared_started' });
});

test('GET /api/daily/mine: never a question of today\'s shared five, a held one, a seen one or a frozen one', async () => {
  const rows = bank();
  const h0 = harness({ rows: structuredClone(rows) });
  const ids0 = idsOf((await h0.get()).body);
  // Hold the first pick, freeze the third, and make the fifth part of today's shared five: each is replaced.
  const held = new Set([ids0[0]]);
  const frozen = rows.map((r) => (r.id === ids0[2] ? { ...r, exploration_state: 'frozen' } : r));
  const h = harness({ rows: frozen, held, sharedFrom: 'accountancy' });
  const sharedIds = new Set(h.shared.map((q) => q.id));
  const ids = idsOf((await h.get()).body);
  assert.equal(ids.length, 5);
  assert.ok(!ids.includes(ids0[0]), 'held');
  assert.ok(!ids.includes(ids0[2]), 'frozen');
  for (const id of ids) assert.ok(!sharedIds.has(id), 'shared five');
  const seen = new Set(h.tables.user_question_progress.filter((p) => p.last_correct !== false).map((p) => p.question_id));
  for (const id of ids) assert.ok(!seen.has(id));
});

test('GET /api/daily/mine: no mistakes yet hands both places to weak chapters; no papers hands them to the subjects', async () => {
  const noWrong = await harness({ wrong: 0 }).get();
  assert.deepEqual(noWrong.body.mix, { missed: 0, weak: 3, subject: 2 }, 'three weak chapters in the papers, then the subjects');
  const nothing = await harness({ wrong: 0, attemptsFail: true }).get();
  assert.deepEqual(nothing.body.mix, { missed: 0, weak: 0, subject: 5 }, 'a failed paper read only skips the weak chapters');
  assert.ok(new Set(nothing.body.questions.map((q) => q.chapter)).size >= 1);
});

test('GET /api/daily/mine: personal false for no subjects, a thin bank, the kill switch, a started shared five or any failure', async () => {
  assert.deepEqual((await harness({ subjects: [] }).get()).body, { ok: true, personal: false, reason: 'no_subjects' });
  assert.deepEqual((await harness({ subjects: ['karate'] }).get()).body, { ok: true, personal: false, reason: 'no_subjects' });
  const thin = bank({ perChapter: 1 }).filter((r) => r.subject !== 'accountancy' && r.subject !== 'economics');
  assert.deepEqual((await harness({ rows: thin, wrong: 0 }).get()).body, { ok: true, personal: false, reason: 'thin_bank' });
  const off = harness({ enabled: false });
  const offRes = await off.get();
  assert.deepEqual(offRes.body, { ok: true, personal: false, reason: 'off' });
  assert.equal(offRes.set, null);
  assert.deepEqual(off.db.calls.map((c) => c.table), ['question_interactions'], 'the switch checks only whether a five was started');
  // Today's shared five already started on the account (the app): the page keeps playing it.
  const started = harness();
  const token = sealDailyToken(KEY, { date: DATE, n: 1, id: started.shared[0].id, correct: started.shared[0].correct, why: 'x' });
  await started.check(token, 'A', { cookie: false });
  assert.deepEqual((await started.get()).body, { ok: true, personal: false, reason: 'shared_started' });
  // A failed read: 200, personal false, logged. Never a 500.
  const down = harness({ failOn: (table) => table === 'user_question_progress' });
  const res = await down.get();
  assert.equal(res.res.status, 200);
  assert.deepEqual(res.body, { ok: true, personal: false, reason: 'unavailable' });
  assert.ok(down.warnings.some((w) => /daily-mine/.test(w)));
  const noKey = harness({ key: null });
  assert.deepEqual((await noKey.get()).body, { ok: true, personal: false, reason: 'unavailable' });
  assert.equal(acceptMine({ ok: true, personal: false, reason: 'thin_bank' }).personal, false);
  assert.equal(acceptMine({ ok: true, personal: true, day: DAY, date: DATE, questions: [] }), null, 'a short five is refused whole');
});

test('GET /api/daily/mine: the reads are bounded', async () => {
  const h = harness({ rows: bank({ perChapter: 40 }) });
  await h.get();
  const q = h.db.calls.filter((c) => c.table === 'questions');
  for (const c of q) assert.ok(c.limit <= MINE_LIMITS.lightRows || c.filters.includes('in:id'), JSON.stringify(c));
  const whole = q.filter((c) => /question,|explanation/.test(c.select));
  assert.ok(whole.length <= Math.ceil(MINE_LIMITS.fullRowsTotal / MINE_LIMITS.fullBatch) + 1);
  const progress = h.db.calls.filter((c) => c.table === 'user_question_progress' && c.filters.includes('eq:last_correct'));
  assert.equal(progress.length, 1);
  assert.equal(progress[0].limit, MINE_LIMITS.missedRows);
  assert.ok(h.db.calls.length < 40, `${h.db.calls.length} reads`);
});

// ---------------------------------------------------------------------------------------------------------------------
// POST /api/daily/check: the feedback.

test('the check: a wrong first answer goes into the student\'s mistakes through practice\'s writer, with the stored option', async () => {
  const h = harness();
  const { body } = await h.get();
  const opened = openDailyToken(KEY, body.questions[2].token);
  const pick = (opened.correct + 1) % 4;
  const out = await h.check(body.questions[2].token, letter(pick));
  assert.equal(out.right, false);
  assert.equal(out.recorded, true);
  assert.equal(out.fed, 'mistakes');
  assert.equal(h.progressCalls.length, 1);
  const row = h.tables.questions.find((r) => r.id === opened.id);
  assert.deepEqual(h.progressCalls[0], {
    userId: USER, subject: row.subject,
    details: [{ qid: row.id, givenIndex: storedIndexOf(servedRow(row).order, pick), isCorrect: false }],
    questionsSnapshot: [{ id: row.id, internalSubject: row.subject, subject: row.subject, chapter: row.chapter, options: row.options }],
  });
  assert.equal(h.reviseCalls.length, 0);
  // A retry of the same place feeds nothing again.
  const retry = await h.check(body.questions[2].token, letter(opened.correct));
  assert.equal(retry.pick, pick, 'the first pick stands');
  assert.equal(retry.fed, null);
  assert.equal(h.progressCalls.length, 1);
  // The mistake comes back: tomorrow it is in the missed list.
  const tomorrow = harness();
  tomorrow.tables.user_question_progress.push(...h.tables.user_question_progress.filter((p) => p.question_id === opened.id).map((p) => ({ ...p, last_attempted_at: '2026-11-21T06:30:00Z' })));
  assert.ok(missedList(tomorrow.tables.user_question_progress, '2026-11-22').some((m) => m.id === opened.id));
});

test('the check: a right answer to a question the student had wrong is fixed, and its Revise card is moved', async () => {
  const h = harness();
  const { body } = await h.get();
  const opened = openDailyToken(KEY, body.questions[0].token);
  const out = await h.check(body.questions[0].token, letter(opened.correct));
  assert.equal(out.right, true);
  assert.equal(out.fed, 'fixed');
  assert.deepEqual(h.reviseCalls, [{ userId: USER, questionId: opened.id, choice: opened.correct }], 'answerRevise with the served choice');
  assert.equal(h.progressCalls[0].details[0].isCorrect, true);
  assert.equal(h.tables.user_question_progress.find((p) => p.question_id === opened.id).last_correct, true, 'out of the wrong answers');
  // A right answer to a new question: recorded, nothing fixed.
  const fresh = openDailyToken(KEY, body.questions[4].token);
  assert.equal((await h.check(body.questions[4].token, letter(fresh.correct))).fed, null);
  assert.equal(h.reviseCalls.length, 1);
  assert.deepEqual(fedCounts([out, { fed: null }]), { fixed: 1, sent: 0 });
});

test('the check: the feedback fails soft, the shared five is untouched, the kill switch turns it all off', async () => {
  const failing = harness({ progressFail: true });
  const { body } = await failing.get();
  const o = openDailyToken(KEY, body.questions[3].token);
  const out = await failing.check(body.questions[3].token, letter((o.correct + 1) % 4));
  assert.equal(out.recorded, true, 'the answer stands');
  assert.equal(out.fed, null);
  assert.ok(failing.warnings.some((w) => /feedback skipped/.test(w)));
  const reviseDown = harness({ reviseFail: true });
  const b2 = (await reviseDown.get()).body;
  const o2 = openDailyToken(KEY, b2.questions[0].token);
  const reviseAnswer = await reviseDown.check(b2.questions[0].token, letter(o2.correct));
  assert.equal(reviseAnswer.recorded, true, 'a failed Revise move does not discard the answer');
  assert.equal(reviseAnswer.fed, null);
  assert.ok(reviseDown.warnings.some((w) => /revise answer failed/.test(w)));
  // A question of today's shared five: the answer is exactly as before (no fed), nothing written beyond its row.
  const h = harness();
  const s = h.shared[0];
  const shared = await h.check(sealDailyToken(KEY, { date: DATE, n: 1, id: s.id, correct: s.correct, why: s.why }), letter((s.correct + 1) % 4), { cookie: false });
  assert.deepEqual(Object.keys(shared).sort(), ['correct', 'for', 'n', 'pick', 'recorded', 'right', 'why']);
  assert.equal(h.progressCalls.length, 0);
  assert.equal(h.tables.question_interactions[0].metadata.mine, undefined);
  // A stale personal token cannot start a personal five while the switch is off.
  const off = harness();
  const b3 = (await off.get()).body;
  off.switchOn.value = false;
  const o3 = openDailyToken(KEY, b3.questions[2].token);
  const offOut = await off.check(b3.questions[2].token, letter((o3.correct + 1) % 4));
  assert.equal(offOut.error, 'changed');
  assert.equal(off.progressCalls.length, 0);
  assert.equal(off.tables.question_interactions.length, 0);
});

test('the check without the cookie: a personal question is still known (by its sealed mark) and fed', async () => {
  const h = harness();
  const { body } = await h.get();
  const o = openDailyToken(KEY, body.questions[3].token);
  const out = await h.check(body.questions[3].token, letter((o.correct + 1) % 4), { cookie: false });
  assert.equal(out.fed, 'mistakes');
  assert.equal(h.tables.question_interactions[0].metadata.mine?.k, 'weak', 'tagged from the token, not the cookie');
});

// ---------------------------------------------------------------------------------------------------------------------
// GET /api/daily/me.

test('GET /api/daily/me: a finished personal five is reviewed with its own questions\' keys and reasons, only after all five', async () => {
  const h = harness();
  const { body } = await h.get();
  const opened = body.questions.map((q) => openDailyToken(KEY, q.token));
  for (let i = 0; i < 4; i += 1) await h.check(body.questions[i].token, letter(opened[i].correct));
  const partial = await h.me();
  assert.equal(partial.record, null);
  assert.equal(partial.review, null, 'no keys before all five');
  await h.check(body.questions[4].token, letter((opened[4].correct + 1) % 4));
  const done = await h.me();
  assert.equal(done.record.score, 4);
  assert.deepEqual(done.review, opened.map((o) => ({ correct: o.correct, why: o.why })));
  assert.ok(done.review.every((r) => r.why.length > 0));
  assert.deepEqual(done.played, [DATE], 'a whole five is a day played');
});

// ---------------------------------------------------------------------------------------------------------------------
// The adversarial review (lane daily-review, 21 Nov 2026): each test below failed on the first build and names its defect.

const fiveOf = (rows, from, at = 0) => rows.filter((r) => r.subject === from).slice(at, at + 5).map((r) => ({ id: r.id, q: r.question, options: r.options, correct: r.correct_index, why: r.explanation }));

test('review: an answer to the shared five never feeds, even after the shared five\'s window moved', async () => {
  // Defect: the check told a personal question from a shared one by "not in today's shared five NOW". When the public window
  // moved during the day (a question pulled, the hourly cache read again), an earlier shared answer looked personal: it got
  // `fed`, went into the student's progress, and GET /api/daily/mine built a personal five on top of the shared answers.
  const h = harness();
  await h.get();
  const s = h.shared[0];
  const token = sealDailyToken(KEY, { date: DATE, n: 1, id: s.id, correct: s.correct, why: s.why });
  h.sharedBox.list = fiveOf(h.tables.questions, 'english', 5);
  const out = await h.check(token, letter((s.correct + 1) % 4));
  assert.equal('fed' in out, false, 'the shared five\'s answer is exactly as before');
  assert.equal(h.progressCalls.length, 0, 'nothing written into the student\'s progress');
  assert.equal(h.tables.question_interactions[0].metadata.mine, undefined);
  h.forgetCookie();
  assert.deepEqual((await h.get({ cookie: false })).body, { ok: true, personal: false, reason: 'shared_started' });
});

test('review: one student\'s token checked by another student feeds nothing and carries none of the owner\'s record', async () => {
  // Defect: a personal token was not bound to its student. Checked by another account it was fed into that account's mistakes
  // as if it were their own five (and with the cookie's reason it could carry the owner's "missed on" date).
  const h = harness();
  const { body } = await h.get();
  const o = openDailyToken(KEY, body.questions[0].token);
  const out = await h.check(body.questions[0].token, letter((o.correct + 1) % 4), { cookie: false, as: 'u-2' });
  assert.equal(out.recorded, true, 'the answer itself stands, as any answer does');
  assert.equal('fed' in out, false);
  assert.equal(h.progressCalls.length, 0);
  assert.equal(h.tables.question_interactions.find((r) => r.user_id === 'u-2').metadata.mine, undefined);
});

test('review: a personal answer keeps its kind without the cookie (another device, a lost cookie)', async () => {
  const h = harness();
  const { body } = await h.get();
  const o = openDailyToken(KEY, body.questions[0].token);
  await h.check(body.questions[0].token, letter((o.correct + 1) % 4), { cookie: false });
  assert.deepEqual(h.tables.question_interactions[0].metadata.mine?.k, 'missed');
  assert.equal(h.tables.question_interactions[0].metadata.mine?.since, '2026-11-14');
});

test('review: the five rebuilt without the cookie keeps its order after a weak place in a missed chapter is answered wrong', async () => {
  // Defect: the rebuild kept today's answered ids in the missed list. An answer today moves its progress row to the top with
  // today's date, so it took its chapter's "first" slot and pushed an older missed question of that chapter behind another
  // chapter's: places 1 and 2 swapped between two loads of the same day.
  const h = harness({
    wrongPlan: [[0, 0, '2026-11-14T10:00:00Z'], [0, 1, '2026-11-13T10:00:00Z'], [4, 0, '2026-11-12T10:00:00Z']],
    weakFrom: [['accountancy', 'Chapter 0', 3], ['economics', 'Chapter 2', 2]],
  });
  const first = await h.get();
  const ids = idsOf(first.body);
  assert.deepEqual(first.body.questions.map((q) => [q.why.kind, q.chapter]).slice(0, 3), [['missed', 'Chapter 0'], ['missed', 'Chapter 4'], ['weak', 'Chapter 0']]);
  const o3 = openDailyToken(KEY, first.body.questions[2].token);
  await h.check(first.body.questions[2].token, letter((o3.correct + 1) % 4));
  h.forgetCookie();
  assert.deepEqual(idsOf((await h.get({ cookie: false })).body), ids);
});

test('review: a failed read of what the student has seen never serves a seen question as new', async () => {
  // Defect: readUserProgress answers an empty Map on a failed chunk (incomplete), so every candidate looked unseen.
  const h = harness({ failOn: (table, st) => table === 'user_question_progress' && /attempt_count/.test(st.select || '') });
  assert.deepEqual((await h.get()).body, { ok: true, personal: false, reason: 'unavailable' });
});

test('review: the student\'s saved syllabus option is honoured, as Practice honours it', async () => {
  // Defect: Practice serves only the sections of the option a student saved (Accountancy AFS or CAS, Maths and CS B1 or B2);
  // the five ignored it.
  const chapters = { accountancy: ['Accounting Ratios', 'Cash Flow Statement', 'Computerised Accounting System', 'Admission of a Partner', 'Chapter 4'] };
  const asked = [];
  const syllabusOption = async (userId, subject) => { asked.push([userId, subject]); return subject === 'accountancy' ? 'CAS' : null; };
  const h = harness({ rows: bank({ chapters }), subjects: ['accountancy', 'economics'], wrong: 0, weakFrom: [['accountancy', 'Accounting Ratios', 3]], syllabusOption });
  const { body } = await h.get();
  assert.equal(body.personal, true);
  const served = idsOf(body).map((id) => h.tables.questions.find((r) => r.id === id).chapter);
  for (const c of served) assert.ok(!['Accounting Ratios', 'Cash Flow Statement'].includes(c), `an AFS chapter served to a CAS student: ${c}`);
  assert.deepEqual(asked, [[USER, 'accountancy']], 'one read, only for a subject that has options');
});

test('review: a key corrected after the five was served feeds nothing', async () => {
  // Defect: the pick was mapped through today's option order and recorded as right or wrong by the token's key, whatever the
  // question now says: a correction landing mid-day wrote a wrong record into the student's progress.
  const h = harness();
  const { body } = await h.get();
  const o = openDailyToken(KEY, body.questions[3].token);
  const row = h.tables.questions.find((r) => r.id === o.id);
  row.correct_index = (row.correct_index + 1) % 4;
  row.correct_answer = 'ABCD'[row.correct_index];
  assert.notEqual(servedRow(row).row.correct_index, o.correct);
  const out = await h.check(body.questions[3].token, letter((o.correct + 1) % 4));
  assert.equal(out.recorded, true, 'the answer stands');
  assert.equal(out.fed, null);
  assert.equal(h.progressCalls.length, 0);
  assert.ok(h.warnings.some((w) => /key changed/.test(w)));
});

test('edited wrong options leave the sealed answer intact but cannot be written as a different choice', async () => {
  const h = harness();
  const { body } = await h.get();
  const token = body.questions[3].token;
  const opened = openDailyToken(KEY, token);
  const row = h.tables.questions.find((r) => r.id === opened.id);
  const pick = (opened.correct + 1) % 4;
  const storedPick = storedIndexOf(servedRow(row).order, pick);
  row.options[storedPick] = 'An edited option with the same position.';
  assert.equal(servedRow(row).row.correct_index, opened.correct);
  const answer = await h.check(token, letter(pick));
  assert.equal(answer.recorded, true);
  assert.equal(answer.fed, null);
  assert.equal(h.progressCalls.length, 0);
  assert.ok(h.warnings.some((line) => /options changed/.test(line)));
});

test('review: two checks of one place in the same millisecond feed the mistakes once', async () => {
  // Defect: "this check wrote the row" was read from created_at alone, so two checks stamped the same millisecond (two tabs,
  // two servers) were both fresh and both fed: attempts counted twice.
  const h = harness();
  const { body } = await h.get();
  const o = openDailyToken(KEY, body.questions[2].token);
  const [a, b] = await Promise.all([
    h.check(body.questions[2].token, letter((o.correct + 1) % 4), { tick: 0 }),
    h.check(body.questions[2].token, letter((o.correct + 2) % 4), { tick: 0 }),
  ]);
  assert.equal(h.progressCalls.length, 1);
  assert.deepEqual([a.fed, b.fed].map(String).sort(), ['mistakes', 'null']);
  assert.equal(a.pick, b.pick, 'the first pick stands for both');
});

test('review: once the student\'s own five is under way, a failed read answers retry, never the shared five', async () => {
  // Defect: a passing database error on a reload mid-five answered personal false, and the page played the shared five over
  // an account whose places already held the student's own questions (each check then answered another question's pick).
  const failBox = { on: null };
  const h = harness({ failBox });
  const { body } = await h.get();
  const o = openDailyToken(KEY, body.questions[0].token);
  await h.check(body.questions[0].token, letter(o.correct));
  h.forgetCookie();
  failBox.on = (table) => table === 'user_question_progress';
  const out = await h.get({ cookie: false });
  assert.equal(out.res.status, 200);
  assert.deepEqual(out.body, { ok: true, personal: false, reason: 'retry' });
  assert.deepEqual(acceptMine(out.body), { personal: false, reason: 'retry' });
  failBox.on = (table) => table === 'question_interactions';
  assert.equal((await h.get({ cookie: false })).body.reason, 'retry', 'an unread account cannot confirm a fallback is safe');
  // Once the account confirms there are no answers, a failed build sends the page to the shared five.
  assert.equal((await harness({ failOn: (table) => table === 'user_question_progress' }).get()).body.reason, 'unavailable');
});

test('a started personal five on a fresh device retries when the bank is thin, the subjects disappear, or the switch is off', async () => {
  const subjects = ['accountancy', 'economics'];
  const held = new Set();
  const h = harness({ subjects, held });
  const { body } = await h.get();
  const first = openDailyToken(KEY, body.questions[0].token);
  await h.check(body.questions[0].token, letter(first.correct));
  const onSecondDevice = () => h.get({ cookie: false });
  for (const row of h.tables.questions) if (row.id !== first.id) held.add(row.id);
  assert.equal((await onSecondDevice()).body.reason, 'retry');
  held.clear();
  subjects.length = 0;
  assert.equal((await onSecondDevice()).body.reason, 'retry');
  assert.equal((await h.get()).body.personal, true, 'the original device can still use its eligible set');
  h.switchOn.value = false;
  assert.equal((await onSecondDevice()).body.reason, 'retry');
});

test('an older app receives the shared answer without changing a started personal five', async () => {
  const h = harness();
  const { body } = await h.get();
  const personal = openDailyToken(KEY, body.questions[0].token);
  await h.check(body.questions[0].token, letter(personal.correct));
  for (const [i, shared] of h.shared.entries()) {
    const token = sealDailyToken(KEY, { date: DATE, n: i + 1, ...shared });
    const pick = (shared.correct + 1) % 4;
    assert.deepEqual(await h.check(token, letter(pick)), {
      n: i + 1, pick, right: false, correct: shared.correct, why: shared.why, recorded: false, for: null,
    });
  }
  assert.equal(h.tables.question_interactions.length, 1);
  assert.equal(h.tables.question_interactions[0].question_id, personal.id);
  assert.equal((await h.get({ cookie: false })).body.personal, true);
});

test('concurrent first checks from independent handlers reserve one mode across different places', { timeout: 3000 }, async () => {
  for (const personalFirst of [true, false]) {
    const secondReady = Promise.withResolvers();
    const firstSaved = Promise.withResolvers();
    const h = harness({ beforeUpsert: ([row]) => {
      if (Boolean(row.metadata.mine) === personalFirst) return secondReady.promise;
      secondReady.resolve();
      return firstSaved.promise;
    } });
    const { body } = await h.get();
    const mine = body.questions[2].token;
    const shared = sealDailyToken(KEY, { date: DATE, n: 1, ...h.shared[0] });
    const firstCheck = h.check(personalFirst ? mine : shared, 'A', { as: USER, tick: 0 }).finally(firstSaved.resolve);
    const secondCheck = h.check(personalFirst ? shared : mine, 'A', { as: USER, tick: 0 });
    const [first, second] = await Promise.all([firstCheck, secondCheck]);
    assert.equal(first.recorded, true);
    assert.equal(h.tables.question_interactions.length, 1);
    assert.equal(h.tables.question_interactions[0].metadata.n, personalFirst ? 3 : 1);
    assert.equal(Boolean(h.tables.question_interactions[0].metadata.mine), personalFirst);
    assert.equal((await h.get()).body.personal, personalFirst);
    if (personalFirst) {
      assert.equal(second.correct, h.shared[0].correct);
      assert.equal(second.recorded, false);
    } else {
      assert.equal(second.error, 'changed');
      assert.equal(h.progressCalls.length, 0);
    }
  }
});

test('a personal question held by a Mob after the five loaded does not disclose its answer or record a pick', async () => {
  const held = new Set();
  const h = harness({ held });
  const { body } = await h.get();
  const old = openDailyToken(KEY, body.questions[0].token);
  held.add(old.id);
  for (const as of [USER, 'u-2']) {
    assert.deepEqual(await h.check(body.questions[0].token, letter(old.correct), { as }), { error: 'changed', day: DAY, date: DATE });
  }
  assert.equal(h.tables.question_interactions.length, 0);
  assert.equal(h.progressCalls.length, 0);
  assert.ok(!idsOf((await h.get()).body).includes(old.id), 'the next five replaces the held question');
});

test('review: an answered question corrected later (a longer reason) keeps its place', async () => {
  // Defect: an answered place was shaped with the card's fit rules again; a reason lengthened by a correction no longer fit,
  // and the whole five answered unavailable for the rest of the day.
  const h = harness();
  const { body } = await h.get();
  const ids = idsOf(body);
  const o = openDailyToken(KEY, body.questions[1].token);
  await h.check(body.questions[1].token, letter(o.correct));
  const row = h.tables.questions.find((r) => r.id === o.id);
  row.explanation = `${row.explanation} ${'One more line on why this holds. '.repeat(20)}`;
  const again = await h.get();
  assert.equal(again.body.personal, true);
  assert.deepEqual(idsOf(again.body), ids);
  h.forgetCookie();
  assert.deepEqual(idsOf((await h.get({ cookie: false })).body), ids);
});

test('review: around 12:00 am IST the cookie ends with the day, and yesterday\'s five is neither checked nor served', async () => {
  const h = harness({ now: Date.parse('2026-11-21T18:29:00Z') }); // 11:59 pm IST
  const late = await h.get();
  assert.equal(late.body.date, DATE);
  assert.match(late.set, /Max-Age=60;/, 'the cookie lasts the minute left of the IST day');
  assert.match(mineCookieLine('x', { now: Date.parse('2026-11-21T18:29:59.500Z') }), /Max-Age=1;/, 'never 0 (a 0 would delete it)');
  assert.match(mineCookieLine('x', { now: Date.parse('2026-11-21T18:30:00Z') }), /Max-Age=86400;/);
  h.clock.t = Date.parse('2026-11-21T18:31:00Z'); // 12:01 am IST, 22 Nov
  const o = openDailyToken(KEY, late.body.questions[2].token);
  const out = await h.check(late.body.questions[2].token, letter((o.correct + 1) % 4), { tick: 0 });
  assert.equal(out.error, 'not_today', 'yesterday\'s token is answered nowhere');
  assert.equal(h.progressCalls.length, 0);
  const next = await h.get(); // yesterday's cookie is still in the jar
  assert.equal(next.body.date, '2026-11-22');
  assert.equal(next.body.day, DAY + 1);
  assert.ok(next.set, 'a new five, a new cookie');
  for (const q of next.body.questions) assert.equal(openDailyToken(KEY, q.token).date, '2026-11-22');
});

test('review: a finished five on a reload is its five rows, read once, with no other read', async () => {
  // Egress: a reload after the fifth answer (any device, no cookie) rebuilt the whole five and read a spare subject window.
  const h = harness();
  const { body } = await h.get();
  const ids = idsOf(body);
  for (const q of body.questions) await h.check(q.token, letter(openDailyToken(KEY, q.token).correct));
  h.forgetCookie();
  const before = h.db.calls.length;
  const again = await h.get({ cookie: false });
  assert.deepEqual(idsOf(again.body), ids);
  assert.deepEqual(again.body.questions.map((q) => q.why.kind), body.questions.map((q) => q.why.kind));
  assert.deepEqual(again.body.questions.map((q) => q.why.since ?? null), body.questions.map((q) => q.why.since ?? null));
  assert.equal(again.set, null, 'nothing left to keep the same');
  const reads = h.db.calls.slice(before);
  assert.deepEqual(reads.map((c) => c.table), ['question_interactions', 'questions'], JSON.stringify(reads));
});

test('review: a build reads few whole question rows', async (t) => {
  // Egress: a whole row carries the signed evidence record (35 to 40 KB on an evidence row, STATUS 15 Oct). Reading sixteen
  // to find one usable question per weak chapter read several times what the five needs.
  const h = harness({ rows: bank({ perChapter: 40 }) });
  await h.get();
  const whole = h.db.calls.filter((c) => c.table === 'questions' && /explanation/.test(c.select || ''));
  const rowsRead = whole.reduce((n, c) => n + (c.rows || 0), 0);
  assert.ok(rowsRead <= 30, `${rowsRead} whole rows for one five`);
  t.diagnostic(`${rowsRead} whole rows and ${h.db.calls.length} reads for one five`);
});

// ---------------------------------------------------------------------------------------------------------------------
// The wiring.

test('wiring: the route is thin, the deps reuse practice\'s and Revise\'s writers, the reads are the narrow ones', () => {
  const route = code(read('src/app/api/daily/mine/route.js'));
  assert.match(route, /import \{ mineHandler \} from '@\/lib\/server\/dailyFiveDeps';/);
  assert.match(route, /export const dynamic = 'force-dynamic';/);
  assert.match(route, /export const GET = \(request\) => mineHandler\(\)\.getMine\(request\);/);
  assert.doesNotMatch(route, /\.from\(|\.rpc\(|supabase/);
  const deps = code(read('src/lib/server/dailyFiveDeps.js'));
  assert.match(deps, /recordProgress: \(args\) => Database\._recordAttemptProgress\(args\)/);
  assert.match(deps, /answerRevise: \(userId, body\) => answerRevise\(userId, body\)/);
  assert.match(deps, /held: \(userId\) => readHeldQuestionIds\(supabaseAdmin\(\), userId\)/);
  assert.match(deps, /attempts: \(userId\) => Database\.getAttempts\(userId, \{ limit: MINE_LIMITS\.attempts, slim: 'plan' \}\)/);
  assert.match(deps, /enabled: \(\) => mineEnabled\(process\.env\)/);
  assert.match(deps, /mine: dailyMine\(\),/);
  const server = code(read('src/lib/server/dailyFiveMine.js'));
  assert.doesNotMatch(server, /\.(upsert|insert|delete)\(|\)\s*\.update\(\{/, 'the service writes nothing itself');
  assert.doesNotMatch(server, /\.rpc\(/);
  assert.doesNotMatch(server, /from\('question_interactions'\)/, 'today\'s rows come through the store');
  assert.match(server, /sealMineToken\(deps\.key, \{ date, n: place\.n, id: q\.id, correct: q\.correct, why: q\.why, userId, kind: place\.kind, since, optionHash: q\.optionHash \}\)/);
  // The check names the token, so the mark is read from the seal, never from the cookie or the shared five's ids.
  assert.match(code(read('src/lib/server/dailyFiveAccount.js')), /deps\.mine\.tagOf\(\{ token: asked\.token, userId, item \}\)/);
  // The shared five's route and the app's contract are unchanged.
  assert.doesNotMatch(code(read('src/app/api/daily/route.js')), /mine/i);
  assert.equal(subjectsOf(['general_test', 'Accountancy', 'gat', 'karate']).map((s) => s.slug).join(','), 'general-test,accountancy');
});

test('the personal token: the shared five\'s token with one more sealed element, bound to its student', () => {
  const token = sealMineToken(KEY, { date: DATE, n: 2, id: 'q-x', correct: 3, why: 'Because the rule says so.', userId: USER, kind: 'missed', since: '2026-11-14' });
  // openDailyToken (the check's own opener, src/lib/server/dailyFive.js) opens it to exactly the shared five's fields.
  assert.deepEqual(openDailyToken(KEY, token), { date: DATE, n: 2, id: 'q-x', correct: 3, why: 'Because the rule says so.' });
  assert.deepEqual(openMineMark(KEY, token), { userId: USER, kind: 'missed', since: '2026-11-14' });
  assert.equal(openMineMark(KEY, sealDailyToken(KEY, { date: DATE, n: 2, id: 'q-x', correct: 3, why: 'x' })), null, 'a shared token has no mark');
  assert.equal(openMineMark(dailyTokenKey('another-secret-of-enough-length'), token), null, 'another key');
  assert.equal(openMineMark(KEY, `${token.slice(0, -2)}AA`), null, 'a changed seal');
  assert.equal(openMineMark(KEY, sealMineCookie(KEY, { v: 1 })), null, 'a cookie is not a token');
  // A weak or new place carries no date.
  assert.deepEqual(openMineMark(KEY, sealMineToken(KEY, { date: DATE, n: 3, id: 'q-y', correct: 0, why: 'w', userId: USER, kind: 'weak', since: '2026-11-14' })), { userId: USER, kind: 'weak', since: null });
  // The longest reason the card takes (DEMO_LIMITS.whyMax, 420) with a uuid id and user still fits the check's limit.
  const long = sealMineToken(KEY, { date: DATE, n: 5, id: uuid(1), correct: 1, why: '₹'.repeat(420), userId: uuid(2), kind: 'missed', since: '2026-11-14' });
  assert.ok(long.length <= 2000, `${long.length}`);
});
