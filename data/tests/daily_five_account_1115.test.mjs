// The Daily Five on the account, the server half (lane daily, 15 Nov 2026): the windows are the sample's own, the tokens open
// only on this server, the save is scored by the server and the first finished run stands, the 30-student floor holds, the
// Mob strip is for members only, and a saved five is a study day and nothing more. An in-memory database stands in for
// Supabase (question_interactions with its real primary key, foreign key and flow_context check). Software fixtures only.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeDb, legacyRow, setFixtureSecret } from './helpers/egress_fixtures.mjs';
import { readDemoPool } from '../../src/lib/server/demoSample.js';
import { createDailyFive, createDailyWindows, dailyFiveSecret, dailyTokenKey, openDailyToken, readDailyWindow, sealDailyToken } from '../../src/lib/server/dailyFive.js';
import { CROWD_TTL_MS, DAILY_LIMITS, createDailyHandlers, createDailyStore } from '../../src/lib/server/dailyFiveAccount.js';
import { computeRhythm } from '../../src/lib/server/rhythm.js';
import { acceptDailyFive, dateOfDay } from '../../src/lib/dailyFive.mjs';
import { acceptAccount, dailyRowId } from '../../src/lib/dailyFiveAccount.mjs';

const restore = setFixtureSecret();
after(restore);
const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function bank(seed = 11) {
  const rand = rng(seed);
  const rows = [];
  let n = 0;
  for (const subject of ['english', 'gat', 'accountancy']) {
    for (let i = 0; i < 300; i += 1) {
      const row = legacyRow(rand, n, { subject });
      rows.push({ ...row, chapter: `Chapter ${i % (subject === 'gat' ? 4 : 12)}`, body: `${subject}: ${row.body}`, question: `${subject}: ${row.question}` });
      n += 1;
    }
  }
  return rows;
}
const tablesOf = (rows) => ({ questions: rows, recovery_family_holds: [] });
const KEY = dailyTokenKey('a-software-fixture-secret-of-some-length');
const NOW = Date.parse('2026-11-15T12:00:00Z'); // 5:30 pm IST, day 1
const DATE = '2026-11-15';

// ---------------------------------------------------------------------------------------------------------------------
// An in-memory question_interactions (and mob_members), answering the supabase-js calls the store makes.

const FLOWS = [null, 'mock', 'review', 'explore', 'shadow', 'learn'];
function memoryDb({ questions = [], members = [], failOn = null } = {}) {
  const tables = { question_interactions: [], mob_members: members.map((m) => ({ ...m })) };
  const questionIds = new Set(questions);
  const calls = [];
  const valueOf = (row, column) => {
    const m = /^metadata->>(\w+)$/.exec(column);
    if (m) { const v = row.metadata?.[m[1]]; return v === undefined || v === null ? null : String(v); }
    return row[column];
  };
  function from(name) {
    const st = { filters: [], order: [], limit: Infinity, head: false, count: false, op: 'select' };
    const run = () => {
      if (failOn && failOn(name, st)) return { data: null, error: { code: 'XX000', message: 'fixture failure' } };
      let rows = (tables[name] || []).slice();
      for (const [kind, column, value] of st.filters) {
        if (kind === 'eq') rows = rows.filter((r) => valueOf(r, column) === value);
        if (kind === 'is') rows = rows.filter((r) => (valueOf(r, column) ?? null) === value);
        if (kind === 'in') rows = rows.filter((r) => value.includes(valueOf(r, column)));
        if (kind === 'gte') rows = rows.filter((r) => valueOf(r, column) >= value);
      }
      for (const [column, asc] of [...st.order].reverse()) rows.sort((a, b) => (a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0) * (asc ? 1 : -1));
      rows = rows.slice(0, st.limit);
      calls.push({ table: name, filters: st.filters.map((f) => `${f[0]}:${f[1]}`) });
      if (st.count) return { data: null, count: rows.length, error: null };
      return { data: rows.map((r) => structuredClone(r)), error: null };
    };
    const q = {
      select(_columns, opts = {}) { if (opts.count) st.count = true; return q; },
      eq(c, v) { st.filters.push(['eq', c, v]); return q; },
      is(c, v) { st.filters.push(['is', c, v]); return q; },
      in(c, v) { st.filters.push(['in', c, v]); return q; },
      gte(c, v) { st.filters.push(['gte', c, v]); return q; },
      order(c, opts = {}) { st.order.push([c, opts.ascending !== false]); return q; },
      limit(n) { st.limit = n; return q; },
      maybeSingle: async () => { const r = run(); return { data: r.data?.[0] ?? null, error: r.error }; },
      // INSERT ... ON CONFLICT (id) DO NOTHING, in one statement: a check or key failure writes nothing.
      async upsert(rows, opts) {
        calls.push({ table: name, upsert: rows.length, opts });
        if (failOn && failOn(name, { op: 'upsert' })) return { error: { code: 'XX000', message: 'fixture failure' } };
        assert.equal(opts.onConflict, 'id');
        assert.equal(opts.ignoreDuplicates, true);
        for (const r of rows) {
          if (!FLOWS.includes(r.flow_context ?? null)) return { error: { code: '23514', message: 'question_interactions_flow_context_check' } };
          if (!questionIds.has(r.question_id)) return { error: { code: '23503', message: 'question_interactions_question_id_fkey' } };
        }
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

test('the windows: readDailyWindow is the public sample\'s window question for question, with each id kept on the server', async () => {
  const rows = bank();
  for (const subject of ['english', 'gat', 'accountancy']) {
    const sample = await readDemoPool(fakeDb(tablesOf(rows)), subject);
    const daily = await readDailyWindow(fakeDb(tablesOf(rows)), subject);
    assert.ok(sample.length > 0, subject);
    assert.deepEqual(daily.map(({ id, ...card }) => card), sample, `${subject}: the same questions in the same order`);
    assert.ok(daily.every((q) => typeof q.id === 'string' && rows.some((r) => r.id === q.id && r.subject === subject)), 'each id is its own row');
  }
  // A thin window too (fewer rows than a window): still the same.
  const thin = bank(5).filter((r, i) => r.subject !== 'gat' || i % 9 === 0);
  assert.deepEqual((await readDailyWindow(fakeDb(tablesOf(thin)), 'gat')).map(({ id, ...card }) => card), await readDemoPool(fakeDb(tablesOf(thin)), 'gat'));
});

test('the tokens: every question leaves sealed with its date, place, id and key; no id leaves; a changed token opens to nothing', async () => {
  const rows = bank();
  const service = createDailyFive({ windows: createDailyWindows({ db: () => fakeDb(tablesOf(rows)) }), key: KEY });
  const answer = await service.get({ day: 1, date: DATE });
  const accepted = acceptDailyFive(answer);
  assert.ok(accepted, 'the page accepts it');
  assert.ok(accepted.questions.every((q) => typeof q.token === 'string'), 'the page keeps each token');
  const ids = (await service.five({ day: 1, date: DATE })).map((q) => q.id);
  assert.doesNotMatch(JSON.stringify(answer), new RegExp(ids.join('|')), 'no question id in what leaves');
  answer.questions.forEach((q, i) => assert.deepEqual(openDailyToken(KEY, q.token), { date: DATE, n: i + 1, id: ids[i], correct: q.correct }));
  const t = answer.questions[0].token;
  const flipped = `${t.slice(0, -3)}${t.at(-3) === 'A' ? 'B' : 'A'}${t.slice(-2)}`;
  assert.equal(openDailyToken(KEY, flipped), null, 'tampered');
  assert.equal(openDailyToken(dailyTokenKey('another-secret-of-enough-length'), t), null, 'another server\'s secret');
  assert.equal(openDailyToken(KEY, 'd1.x.y'), null);
  assert.equal(openDailyToken(null, t), null);
  assert.equal(dailyTokenKey('short'), null, 'no usable secret: no tokens (the page keeps the five on the device)');
  assert.equal(dailyFiveSecret({ PRACTICE_SESSION_SECRET: 'p', SUPABASE_SERVICE_ROLE_KEY: 's' }), 'p');
  assert.equal(dailyFiveSecret({ DAILY_FIVE_SECRET: 'd', PRACTICE_SESSION_SECRET: 'p' }), 'd');
  const plain = await createDailyFive({ windows: createDailyWindows({ db: () => fakeDb(tablesOf(rows)) }) }).get({ day: 1, date: DATE });
  assert.ok(plain.questions.every((q) => !('token' in q)));
});

// The handlers against the in-memory database, a fake session and a counting limiter.
function harness({ userId = 'u-1', now = NOW, members = [], failOn = null, allowed = true, originOk = true } = {}) {
  const ids = ['q-1', 'q-2', 'q-3', 'q-4', 'q-5'];
  const keys = [1, 0, 3, 2, 1];
  const db = memoryDb({ questions: ids, members, failOn });
  const limits = [];
  const store = createDailyStore({ db: () => db.client, now: () => now });
  const handlers = createDailyHandlers({
    auth: async () => (userId ? { user: { id: userId } } : null),
    rateLimit: async (_request, opts) => { limits.push(opts); return { allowed }; },
    originOk: () => originOk,
    store,
    key: KEY,
    five: async () => ids.map((id, i) => ({ id, q: `Stem ${i}`, options: ['a', 'b', 'c', 'd'], correct: keys[i] })),
    mobEnabled: () => true,
    now: () => now,
  });
  const tokens = ids.map((id, i) => sealDailyToken(KEY, { date: DATE, n: i + 1, id, correct: keys[i] }));
  const post = (body) => handlers.postMe(new Request('https://www.mockmob.in/api/daily/me', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }));
  const saveBody = (answers, change = {}) => ({ day: 1, date: DATE, tokens, answers, ms: 90_000, ...change });
  return { db, limits, store, handlers, tokens, post, saveBody, ids, keys };
}

test('the save: signed in, same origin, a persistent limit, today only, today\'s tokens only, answers A to D only', async () => {
  const h = harness();
  let r = await h.post(h.saveBody(['B', 'A', 'D', 'C', 'B']));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const saved = acceptAccount(await r.json());
  assert.deepEqual(saved.record.marks, [true, true, true, true, true]);
  assert.deepEqual(saved.played, [DATE]);
  const limit = h.limits.find((l) => l.route === DAILY_LIMITS.save.route);
  assert.equal(limit.persistent, true, 'kept in the database across servers');
  assert.deepEqual(limit.keyParts, ['u-1']);
  assert.equal(limit.identityOnly, true);

  assert.equal((await harness({ userId: null }).post(h.saveBody(['A', 'A', 'A', 'A', 'A']))).status, 401, 'sign-in required');
  assert.equal((await harness({ originOk: false }).post(h.saveBody(['A', 'A', 'A', 'A', 'A']))).status, 403, 'another site\'s form');
  assert.equal((await harness({ allowed: false }).post(h.saveBody(['A', 'A', 'A', 'A', 'A']))).status, 429);
  const fresh = harness();
  for (const [body, status, error] of [
    [fresh.saveBody(['A', 'B', 'C', 'D', 'E']), 400, 'bad_answers'],
    [fresh.saveBody(['A', 'B', 'C', 'D']), 400, 'bad_answers'],
    [fresh.saveBody(['A', 'B', 'C', 'D', 'A'], { day: 2, date: dateOfDay(2) }), 409, 'not_today'],
    [fresh.saveBody(['A', 'B', 'C', 'D', 'A'], { tokens: [...fresh.tokens].reverse() }), 400, 'bad_questions'],
    [fresh.saveBody(['A', 'B', 'C', 'D', 'A'], { tokens: fresh.tokens.map((t, i) => (i ? t : sealDailyToken(KEY, { date: '2026-11-14', n: 1, id: 'q-1', correct: 1 }))) }), 400, 'bad_questions'],
    [fresh.saveBody(['A', 'B', 'C', 'D', 'A'], { tokens: fresh.tokens.map((t, i) => (i ? t : sealDailyToken(dailyTokenKey('a-forger-with-a-long-secret'), { date: DATE, n: 1, id: 'q-9', correct: 0 }))) }), 400, 'bad_questions'],
    ['not json', 400, 'bad_body'],
    [`{"pad":"${'x'.repeat(5000)}"}`, 400, 'bad_body'],
  ]) {
    const res = await fresh.post(body);
    assert.equal(res.status, status, error);
    assert.equal((await res.json()).error, error);
  }
  assert.equal(fresh.db.tables.question_interactions.length, 0, 'nothing refused was written');
  // The day ends at 12:00 am IST: a five sent a minute after is refused (the page keeps it on the device).
  const late = harness({ now: Date.parse('2026-11-15T18:31:00Z') });
  assert.equal((await late.post(late.saveBody(['A', 'A', 'A', 'A', 'A']))).status, 409);
});

test('the save is scored by the server and the first finished run stands: a reload, a second tab or a second phone changes nothing', async () => {
  const h = harness();
  // Three wrong of five by the server's key, whatever the page might claim.
  const first = await (await h.post({ ...h.saveBody(['B', 'B', 'D', 'A', 'A']), marks: [true, true, true, true, true], score: 5 })).json();
  assert.deepEqual(first.record.marks, [true, false, true, false, false]);
  assert.equal(first.record.score, 2);
  assert.equal(h.db.tables.question_interactions.length, 5);
  assert.deepEqual(h.db.tables.question_interactions.map((r) => r.id), [1, 2, 3, 4, 5].map((n) => dailyRowId(DATE, 'u-1', n)));
  assert.ok(h.db.tables.question_interactions.every((r) => r.flow_context === null && r.interaction_type === 'daily_five'));
  // The same request again (a reload), a better run (a second phone) and both at once: still the first.
  const again = await Promise.all([h.post(h.saveBody(['B', 'B', 'D', 'A', 'A'])), h.post(h.saveBody(['B', 'A', 'D', 'C', 'B'])), h.post(h.saveBody(['B', 'A', 'D', 'C', 'B'], { ms: 1 }))]);
  for (const res of again) {
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.record, first.record, 'the first run, every time');
  }
  assert.equal(h.db.tables.question_interactions.length, 5, 'never a sixth row');
  // GET: the record and the run of days.
  const me = await (await h.handlers.getMe(new Request('https://www.mockmob.in/api/daily/me'))).json();
  assert.deepEqual(me.record, first.record);
  assert.deepEqual(me.played, [DATE]);
  assert.equal((await harness({ userId: null }).handlers.getMe(new Request('https://www.mockmob.in/api/daily/me'))).status, 401);
  // A question pulled since the five were served: nothing is written, and the page is told.
  const gone = harness();
  const res = await gone.handlers.postMe(new Request('https://x/api/daily/me', { method: 'POST', body: JSON.stringify({ ...gone.saveBody(['A', 'A', 'A', 'A', 'A']), tokens: gone.tokens.map((t, i) => (i ? t : sealDailyToken(KEY, { date: DATE, n: 1, id: 'q-pulled', correct: 1 }))) }) }));
  assert.equal(res.status, 409);
  assert.equal(gone.db.tables.question_interactions.length, 0, 'all five or none');
  // A database failure is a 503 the page can retry, never a success.
  const down = harness({ failOn: (name, st) => name === 'question_interactions' && st.op === 'upsert' });
  assert.equal((await down.post(down.saveBody(['A', 'A', 'A', 'A', 'A']))).status, 503);
});

test('the run of days on the account: one per day, from the first question\'s row, read back across days', async () => {
  const h = harness();
  const rows = (date, user) => [1, 2, 3, 4, 5].map((n) => ({ id: dailyRowId(date, user, n), question_id: `q-${n}`, user_id: user, interaction_type: 'daily_five', session_id: `daily:${date}`, flow_context: null, created_at: `${date}T06:00:00.000Z`, metadata: { n, day: 1, pick: 'A', right: true, score: 5 } }));
  h.db.tables.question_interactions.push(...rows('2026-11-13', 'u-1'), ...rows('2026-11-14', 'u-1'), ...rows('2026-11-14', 'u-2'));
  // A row of another feature with the same user is never read as a day.
  h.db.tables.question_interactions.push({ id: 'x', question_id: 'q-1', user_id: 'u-1', interaction_type: 'attempted', flow_context: 'learn', session_id: 'daily:2026-11-12', created_at: '2026-11-12T06:00:00.000Z', metadata: { n: 1 } });
  assert.deepEqual(await h.store.played('u-1'), ['2026-11-13', '2026-11-14']);
});

test('how everyone did: counted per question on the server, nothing under 30, cached five minutes, public and aggregate', async () => {
  let now = NOW;
  const h = harness();
  const handlers = createDailyHandlers({ auth: async () => null, rateLimit: async () => ({ allowed: true }), originOk: () => true, store: h.store, key: KEY, five: async () => h.ids.map((id, i) => ({ id, q: `Stem ${i}`, options: ['a', 'b', 'c', 'd'], correct: h.keys[i] })), mobEnabled: () => true, now: () => now });
  // 30 students on question 1 (19 right), 29 on question 2.
  for (let s = 0; s < 30; s += 1) {
    const picks = h.keys.map((k, i) => (i === 0 ? (s < 19 ? k : (k + 1) % 4) : k));
    const rows = h.ids.map((id, i) => ({ id: dailyRowId(DATE, `s${s}`, i + 1), question_id: id, user_id: `s${s}`, interaction_type: 'daily_five', session_id: `daily:${DATE}`, flow_context: null, created_at: 'x', metadata: { n: i + 1, pick: 'ABCD'[picks[i]], right: picks[i] === h.keys[i] } }));
    h.db.tables.question_interactions.push(...(s === 29 ? rows.filter((r) => r.metadata.n !== 2) : rows));
  }
  const ask = (day = 1) => handlers.getStats(new Request(`https://www.mockmob.in/api/daily/stats?day=${day}`));
  const res = await ask();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.questions.map((q) => q.pct), [63, null, 100, 100, 100], 'question 2 has 29: no number');
  assert.match(res.headers.get('cdn-cache-control'), /s-maxage=300/);
  assert.match(res.headers.get('cache-control'), /^public, max-age=60/);
  assert.doesNotMatch(JSON.stringify(body), /s\d|q-\d/, 'no student and no question id');
  const reads = h.db.calls.filter((c) => c.table === 'question_interactions').length;
  await ask();
  assert.equal(h.db.calls.filter((c) => c.table === 'question_interactions').length, reads, 'the second visit is the cached count');
  now += CROWD_TTL_MS + 1;
  await ask();
  assert.ok(h.db.calls.filter((c) => c.table === 'question_interactions').length > reads, 'counted again after five minutes');
  assert.equal((await ask(2)).status, 400, 'only today');
  assert.ok(h.db.calls.filter((c) => c.table === 'question_interactions' && c.filters).every((c) => c.filters.includes('eq:interaction_type')), 'every read names the Daily Five type');
});

test('the Mob strip: members only, through the den\'s membership; a removed member is neither let in nor listed; the den\'s order', async () => {
  const mob = '6b1f0c2e-5a7d-4e3b-9c1a-2f4e6d8a0b1c';
  const members = [
    { mob_id: mob, user_id: 'u-zoya', display_name: 'Zoya', colour: 2, show_score: true, joined_at: '2026-11-03T00:00:00Z' },
    { mob_id: mob, user_id: 'u-1', display_name: 'Aarav', colour: 1, show_score: true, joined_at: '2026-11-02T00:00:00Z' },
    { mob_id: mob, user_id: 'u-riya', display_name: 'Riya', colour: 3, show_score: true, joined_at: '2026-11-01T00:00:00Z' },
  ];
  const h = harness({ members });
  await h.post(h.saveBody(['B', 'A', 'D', 'C', 'B']));
  const get = (handlers, id = mob) => handlers.getMob(new Request(`https://www.mockmob.in/api/daily/mob?mob=${id}`));
  const body = await (await get(h.handlers)).json();
  assert.deepEqual(body.members.map((m) => [m.name, m.state]), [['Aarav', 'marks']], 'members who have not played are not named (F2)');
  assert.doesNotMatch(JSON.stringify(body), /u-/);
  // Removed: the membership row is gone (mob_remove deletes it).
  h.db.tables.mob_members.splice(h.db.tables.mob_members.findIndex((m) => m.user_id === 'u-zoya'), 1);
  assert.deepEqual((await (await get(h.handlers)).json()).members.map((m) => m.name), ['Aarav']);
  const outsider = createDailyHandlers({ auth: async () => ({ user: { id: 'u-zoya' } }), rateLimit: async () => ({ allowed: true }), originOk: () => true, store: h.store, key: KEY, five: async () => null, mobEnabled: () => true, now: () => NOW });
  assert.equal((await get(outsider)).status, 404, 'a removed member reads nothing');
  assert.equal((await get(h.handlers, 'not-a-uuid')).status, 400);
  const off = createDailyHandlers({ auth: async () => ({ user: { id: 'u-1' } }), rateLimit: async () => ({ allowed: true }), originOk: () => true, store: h.store, key: KEY, five: async () => null, mobEnabled: () => false, now: () => NOW });
  assert.equal((await get(off)).status, 404, 'the Mob off: nothing');
  assert.equal((await get(harness({ userId: null, members }).handlers)).status, 401);
});

test('a saved Daily Five is a study day: the week and the run count it; it is never a session, a repair or a mock', () => {
  const now = Date.parse('2026-11-19T12:00:00Z'); // a Thursday
  const daily = (iso) => ({ id: `d:${iso}`, at: `${iso}T05:00:00Z`, kind: 'daily' });
  const r = computeRhythm({ activities: [daily('2026-11-16'), daily('2026-11-17'), daily('2026-11-18'), daily('2026-11-19')], daysPerWeek: 4, now });
  assert.equal(r.studyDays, 4);
  assert.deepEqual(r.studyDayDates, ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19']);
  assert.equal(r.metThisWeek, true);
  assert.deepEqual(r.counts, { sessions: 0, repairs: 0, weeksMet: 1 }, 'no session and no repair is counted');
  assert.equal(r.mocksThisWeek, 0);
  assert.equal(r.milestones.find((m) => m.id === 'first_scored_session').achievedAt, null);
  const dup = computeRhythm({ activities: [daily('2026-11-19'), daily('2026-11-19')], now });
  assert.equal(dup.studyDays, 1, 'one day, once');
  // The reader: one row per day, Daily Five rows only, a failed read leaves the rhythm whole.
  const prefs = code(read('src/lib/server/appPrefs.js'));
  const reader = prefs.slice(prefs.indexOf('export async function loadDailyFiveDays'));
  assert.match(reader, /\.from\('question_interactions'\)\.select\('session_id,created_at'\)\.eq\('user_id', userId\)\.is\('flow_context', null\)\s*\.eq\('interaction_type', 'daily_five'\)\.eq\('metadata->>n', '1'\)\.gte\('created_at', since\)/);
  assert.match(reader, /if \(error\) return \[\];/);
  assert.match(reader, /kind: 'daily'/);
  assert.match(prefs.slice(prefs.indexOf('export async function loadActivity')), /\.\.\.daily\]/);
});

test('the rows stay out of every other reader: the routes, the store and the table\'s other users', () => {
  const store = code(read('src/lib/server/dailyFiveAccount.js'));
  for (const m of store.matchAll(/qi\(\)\.select\([^)]*\)[^;]*/g)) assert.match(m[0], /eq\('interaction_type', DAILY_FIVE_INTERACTION\)/, m[0].slice(0, 80));
  // The interact route cannot write a Daily Five row (its own types only), and the mock count reads the mock flow only.
  const interact = read('src/app/api/questions/[id]/interact/route.js');
  assert.doesNotMatch(interact, /daily_five/);
  for (const route of ['me', 'stats', 'mob']) {
    const src = code(read(`src/app/api/daily/${route}/route.js`));
    assert.match(src, /import \{ dailyHandlers \} from '@\/lib\/server\/dailyFiveDeps';/);
    assert.doesNotMatch(src, /\.from\(|\.rpc\(|supabase/, `${route}: the route reads no table itself`);
  }
  const deps = code(read('src/lib/server/dailyFiveDeps.js'));
  assert.match(deps, /allowedWriteOrigin\(\{/, 'the same-origin rule every API write follows');
  assert.match(deps, /rateLimit: checkPersistentRateLimit/);
  assert.match(deps, /mobEnabled: \(\) => process\.env\.MOB_ENABLED === 'true'/);
  assert.match(deps, /import 'server-only';/);
});
