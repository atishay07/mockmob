// Playing for a college, the server half (lane daily, 17 Nov 2026; owner LK293): the check writes the college the rule allows
// into the Daily Five row, GET /api/daily/me answers the account's college and its seat (signed in only), the seat is a stable
// keyed number, and GET /api/daily/board is public, rate-limited, cached and aggregate (colleges and counts, never a user id
// or a seat). An in-memory question_interactions stands in for Supabase. Software fixtures only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dailyTokenKey, sealDailyToken } from '../../src/lib/server/dailyFive.js';
import { createDailyHandlers, createDailyStore } from '../../src/lib/server/dailyFiveAccount.js';
import { BOARD_LIMIT, BOARD_TTL_MS, createBoardHandler, createTeamStore, seatOf, trapOf } from '../../src/lib/server/dailyTeam.js';
import { addDays, dayNumber } from '../../src/lib/dailyFive.mjs';
import { dayBoard } from '../../src/lib/daily/team.mjs';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const KEY = dailyTokenKey('a-software-fixture-secret-of-some-length');
const H = 'hansraj-college';
const M = 'miranda-house';
const K = 'kirori-mal-college';
const IDS = ['q1', 'q2', 'q3', 'q4', 'q5'];
const KEYS = [0, 1, 2, 3, 0];
const at = (date, hh = 12) => Date.parse(`${date}T${String(hh).padStart(2, '0')}:00:00+05:30`);

// An in-memory question_interactions for the calls createDailyStore makes.
function memoryDb() {
  const rows = [];
  function from() {
    const st = { filters: [], order: [], limit: Infinity, count: false };
    const valueOf = (row, column) => row[column];
    const run = () => {
      let out = rows.slice();
      for (const [kind, column, value] of st.filters) {
        if (kind === 'eq') out = out.filter((r) => valueOf(r, column) === value);
        if (kind === 'is') out = out.filter((r) => (valueOf(r, column) ?? null) === value);
        if (kind === 'gte') out = out.filter((r) => valueOf(r, column) >= value);
      }
      for (const [column, asc] of [...st.order].reverse()) out.sort((a, b) => (a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0) * (asc ? 1 : -1));
      return { data: out.slice(0, st.limit).map((r) => structuredClone(r)), error: null };
    };
    const q = {
      select() { return q; },
      eq(c, v) { st.filters.push(['eq', c, v]); return q; },
      is(c, v) { st.filters.push(['is', c, v]); return q; },
      gte(c, v) { st.filters.push(['gte', c, v]); return q; },
      order(c, o = {}) { st.order.push([c, o.ascending !== false]); return q; },
      limit(n) { st.limit = n; return q; },
      async upsert(list) { for (const r of list) if (!rows.some((x) => x.id === r.id)) rows.push(structuredClone(r)); return { error: null }; },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    return q;
  }
  return { rows, client: { from } };
}

function harness({ db = memoryDb(), user = 'u-1', seat = (id) => seatOf('a-seat-secret-of-good-length', id) } = {}) {
  let now = at('2026-11-15');
  const handlers = createDailyHandlers({
    auth: async () => (user ? { user: { id: user } } : null),
    rateLimit: async () => ({ allowed: true }),
    originOk: () => true,
    store: createDailyStore({ db: () => db.client, now: () => now }),
    key: KEY,
    five: async () => IDS.map((id, i) => ({ id, q: `Stem ${i}`, options: ['a', 'b', 'c', 'd'], correct: KEYS[i], why: `Why ${i}.` })),
    mobEnabled: () => true,
    seat,
    now: () => now,
  });
  const date = () => new Date(now + 330 * 60000).toISOString().slice(0, 10);
  const token = (n) => sealDailyToken(KEY, { date: date(), n, id: IDS[n - 1], correct: KEYS[n - 1], why: `Why ${n - 1}.` });
  const answer = (n, extra = {}) => handlers.postCheck(new Request('https://www.mockmob.in/api/daily/check', { method: 'POST', body: JSON.stringify({ token: token(n), pick: 'A', ...extra }) }));
  const playDay = async (day, team) => {
    now = at(day);
    const out = [];
    for (let n = 1; n <= 5; n += 1) out.push(await (await answer(n, team ? { for: team } : {})).json());
    return out;
  };
  const me = async () => (await handlers.getMe(new Request('https://www.mockmob.in/api/daily/me'))).json();
  return { db, handlers, playDay, answer, me, setNow: (t) => { now = t; } };
}

test('a signed-in five counts for the college the rule allows: a first pick, a free first change, then a week\'s wait', async () => {
  const h = harness();
  const d1 = await h.playDay('2026-11-15', H);
  assert.deepEqual(d1.map((a) => a.for), [H, H, H, H, H]);
  assert.ok(h.db.rows.every((r) => r.metadata.for === H && r.interaction_type === 'daily_five' && r.flow_context === null));
  // A check that asks for nothing (an older app) still counts for the account's college.
  const d2 = await h.playDay('2026-11-16', null);
  assert.deepEqual(d2.map((a) => a.for), [H, H, H, H, H]);
  // The first change is free.
  const d3 = await h.playDay('2026-11-17', M);
  assert.deepEqual(d3.map((a) => a.for), [M, M, M, M, M]);
  // A second change inside a week is not written: the five counts for the college it had.
  const d4 = await h.playDay('2026-11-19', K);
  assert.deepEqual(d4.map((a) => a.for), [M, M, M, M, M]);
  // A week after the change, it is.
  const d5 = await h.playDay('2026-11-24', K);
  assert.deepEqual(d5.map((a) => a.for), [K, K, K, K, K]);
  const mine = await h.me();
  assert.deepEqual(mine.team, { college: K, since: '2026-11-24', changedOn: '2026-11-24', last: '2026-11-24' });
  assert.equal(mine.day, dayNumber('2026-11-24'));
});

test('a day counts for one college: a later check of the day asking another keeps the day\'s', async () => {
  const h = harness();
  h.setNow(at('2026-11-15'));
  const first = await (await h.answer(1, { for: H })).json();
  const second = await (await h.answer(2, { for: M })).json();
  assert.equal(first.for, H);
  assert.equal(second.for, H);
  assert.deepEqual(h.db.rows.map((r) => r.metadata.for), [H, H]);
});

test('guests are answered and nothing is kept, college or not; an unknown college is ignored, never refused', async () => {
  const guest = harness({ user: null });
  guest.setNow(at('2026-11-15'));
  const res = await guest.answer(1, { for: H });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.recorded, false);
  assert.ok(!('for' in body));
  assert.equal(guest.db.rows.length, 0);
  const h = harness();
  h.setNow(at('2026-11-15'));
  const odd = await h.answer(1, { for: 'not-a-college' });
  assert.equal(odd.status, 200);
  assert.equal((await odd.json()).for, null);
  assert.ok(!('for' in h.db.rows[0].metadata));
});

test('GET /api/daily/me: the account\'s college and its seat, signed in only; the seat is stable, four digits and keyed', async () => {
  const h = harness();
  await h.playDay('2026-11-15', H);
  const body = await h.me();
  assert.deepEqual(body.team, { college: H, since: '2026-11-15', changedOn: null, last: '2026-11-15' });
  assert.equal(body.seat, seatOf('a-seat-secret-of-good-length', 'u-1'));
  assert.ok(body.seat >= 1000 && body.seat <= 9999);
  const out = harness({ user: null });
  assert.equal((await out.handlers.getMe(new Request('https://www.mockmob.in/api/daily/me'))).status, 401);
  // The seat: the same every time, its own for another secret, none without a usable secret or account.
  assert.equal(seatOf('a-seat-secret-of-good-length', 'u-1'), seatOf('a-seat-secret-of-good-length', 'u-1'));
  assert.equal(seatOf('short', 'u-1'), null);
  assert.equal(seatOf('a-seat-secret-of-good-length', ''), null);
  const seats = Array.from({ length: 4000 }, (_, i) => seatOf('a-seat-secret-of-good-length', `usr_${i}`));
  assert.ok(seats.every((s) => Number.isInteger(s) && s >= 1000 && s <= 9999));
  assert.ok(new Set(seats).size > 2500, 'spread over the 9,000 numbers');
  const other = Array.from({ length: 50 }, (_, i) => seatOf('another-secret-of-good-length', `usr_${i}`));
  assert.ok(other.some((s, i) => s !== seats[i]), 'the secret decides: a seat cannot be worked out from an account id');
});

// ---------------------------------------------------------------------------------------------------------------------
// The board.

const flatFive = (user, date, team, right) => [1, 2, 3, 4, 5].map((n) => ({ user, date, n, right: n <= right, team: team && n === 1 ? team : null }));

function boardHarness({ rows = [], sittings = [], teams = new Map(), picks = new Map(), limit = true, now = at('2026-11-18', 18), sundayOn = true } = {}) {
  const calls = { span: [], sunday: [], teams: [], picks: [] };
  const store = {
    async spanRows(from, to) { calls.span.push([from, to]); return rows; },
    async sundaySittings(week) { calls.sunday.push(week); return sittings; },
    async teamsOn(ids, date) { calls.teams.push([ids.length, date]); return teams; },
    async picksOn(date) { calls.picks.push(date); return picks; },
  };
  const five = async () => IDS.map((id, i) => ({ id, q: `Stem ${i}`, options: ['wa', 'wb', 'wc', 'wd'], correct: KEYS[i] }));
  let t = now;
  const handler = createBoardHandler({ rateLimit: async () => ({ allowed: limit }), store, five, sundayOn: () => sundayOn, now: () => t });
  const get = (day) => handler.getBoard(new Request(`https://www.mockmob.in/api/daily/board?day=${day}`));
  return { get, calls, setNow: (v) => { t = v; } };
}

test('the board: public, aggregate and cached; colleges and counts only, never a user id or a seat', async () => {
  const date = '2026-11-18';
  const rows = [
    ...['a', 'b', 'c', 'd', 'e'].flatMap((u) => flatFive(u, date, H, 4)),
    ...['f', 'g'].flatMap((u) => flatFive(u, date, M, 2)),
    ...flatFive('a', '2026-11-17', H, 3),
  ];
  const b = boardHarness({ rows });
  const res = await b.get(dayNumber(date));
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Cache-Control'), /^public, max-age=\d+$/);
  assert.match(res.headers.get('CDN-Cache-Control'), /^public, s-maxage=\d+$/);
  const body = await res.json();
  assert.deepEqual(body.today, { players: 7, counted: 7, colleges: [{ college: H, players: 5, avg: 4 }, { college: M, players: 2, avg: null }] });
  assert.deepEqual(body.week.colleges[0], { college: H, players: 5, days: 6, perPlayer: 1.2 });
  assert.equal(body.week.from, '2026-11-16');
  assert.deepEqual(b.calls.span, [['2026-11-16', date]], 'one read for the week, today inside it');
  // Before the first Sunday Mock's answers: when its board appears, and no table.
  assert.deepEqual(body.sunday, { state: 'first', week: '2026-11-22', at: Date.parse('2026-11-22T23:05:00+05:30') });
  assert.equal(b.calls.sunday.length, 0, 'no sitting is read before a Sunday has run');
  const text = JSON.stringify(body);
  for (const id of ['"a"', '"b"', '"f"', 'user', 'seat']) assert.ok(!text.includes(id), `nothing about one student: ${id}`);
  // Counted again at most every five minutes: a second ask in the window reads nothing.
  await b.get(dayNumber(date));
  assert.equal(b.calls.span.length, 1);
  assert.equal(BOARD_TTL_MS, 5 * 60 * 1000);
});

test('the board refuses another day and keeps to its limit; a failed read says so and is never cached', async () => {
  const b = boardHarness();
  const wrong = await b.get(dayNumber('2026-11-17'));
  assert.equal(wrong.status, 400);
  assert.equal(wrong.headers.get('Cache-Control'), 'no-store');
  assert.equal((await wrong.json()).date, '2026-11-18', 'it names today, so a page on a wrong clock can ask again');
  const limited = boardHarness({ limit: false });
  const res = await limited.get(dayNumber('2026-11-18'));
  assert.equal(res.status, 429);
  assert.equal(BOARD_LIMIT.limit, 30);
  const failing = createBoardHandler({ rateLimit: async () => ({ allowed: true }), store: { spanRows: async () => { throw new Error('down'); } }, now: () => at('2026-11-18', 18) });
  const down = await failing.getBoard(new Request(`https://www.mockmob.in/api/daily/board?day=${dayNumber('2026-11-18')}`));
  assert.equal(down.status, 503);
  assert.equal(down.headers.get('Cache-Control'), 'no-store');
});

test('a Sunday Mock\'s board after its answers open: each sitter counts for their college that Sunday, from 5 sitters', async () => {
  const sittings = [...['a', 'b', 'c', 'd', 'e'].map((user, i) => ({ user, scored: 100 + i * 10, max: 250 })), { user: 'f', scored: 30, max: 250 }];
  const teams = new Map([['a', H], ['b', H], ['c', H], ['d', H], ['e', H], ['f', M]]);
  // Monday after the first Sunday Mock.
  const b = boardHarness({ sittings, teams, now: at('2026-11-23', 18) });
  const body = await (await b.get(dayNumber('2026-11-23'))).json();
  assert.deepEqual(body.sunday, { state: 'ready', week: '2026-11-22', sitters: 6, counted: 6, colleges: [{ college: H, sitters: 5, avg: 120, max: 250 }, { college: M, sitters: 1, avg: null, max: 250 }] });
  assert.deepEqual(b.calls.sunday, ['2026-11-22']);
  assert.deepEqual(b.calls.teams, [[6, '2026-11-22']]);
  // On the Sunday itself before 11:05 pm the board is still the week before's (none before the first): the first's time.
  const sunday = boardHarness({ sittings, teams, now: at('2026-11-22', 20) });
  assert.equal((await (await sunday.get(dayNumber('2026-11-22'))).json()).sunday.state, 'first');
  const after = boardHarness({ sittings, teams, now: Date.parse('2026-11-22T23:06:00+05:30') });
  assert.equal((await (await after.get(dayNumber('2026-11-22'))).json()).sunday.state, 'ready');
  // Switched off with the Sunday Mock: no Sunday part at all.
  const off = boardHarness({ sittings, teams, now: at('2026-11-23', 18), sundayOn: false });
  assert.equal((await (await off.get(dayNumber('2026-11-23'))).json()).sunday, null);
});

test('yesterday\'s trap: the most-picked wrong answer from 30 answers up, about the very question; otherwise nothing', async () => {
  const five = IDS.map((id, i) => ({ id, q: `Stem ${i}`, options: ['wa', 'wb', 'wc', 'wd'], correct: KEYS[i] }));
  const picks = new Map([
    ['q1', { of: 40, picks: [20, 18, 2, 0], correct: 0 }], // 45% picked B
    ['q2', { of: 29, picks: [1, 0, 28, 0], correct: 1 }], // under the floor
    ['q3', { of: 50, picks: [10, 10, 25, 5], correct: 2 }], // 20% at most
  ]);
  assert.deepEqual(trapOf(picks, five, '2026-11-17'), { date: '2026-11-17', q: 'Stem 0', letter: 'B', wrong: 'wb', right: 'wa', pct: 45, of: 40 });
  assert.equal(trapOf(new Map([['q2', picks.get('q2')]]), five, '2026-11-17'), null);
  assert.equal(trapOf(new Map([['q1', { ...picks.get('q1'), correct: 3 }]]), five, '2026-11-17'), null, 'numbers about another key are not this question\'s');
  assert.equal(trapOf(picks, null, '2026-11-17'), null);
  const b = boardHarness({ picks, now: at('2026-11-18', 18) });
  const body = await (await b.get(dayNumber('2026-11-18'))).json();
  assert.equal(body.trap.pct, 45);
  assert.deepEqual(b.calls.picks, ['2026-11-17']);
});

// ---------------------------------------------------------------------------------------------------------------------
// The board's reads against a store that answers as PostgREST does: at most 1,000 rows a request, in the order asked (and in
// the order the rows were written when none is asked). Review, 17 Nov 2026.

function cappedDb() {
  const rows = [];
  const CAP = 1000;
  const pick = (row, path) => {
    const m = /^metadata->(>?)(\w+)$/.exec(path);
    if (!m) return row[path] ?? null;
    const v = row.metadata?.[m[2]];
    if (v === undefined || v === null) return null;
    return m[1] ? String(v) : v;
  };
  function from() {
    const st = { cols: [], filters: [], order: [], range: null, limit: Infinity };
    const run = () => {
      let out = rows.filter((r) => st.filters.every((f) => f(r)));
      for (const [column, asc] of [...st.order].reverse()) out.sort((a, b) => (pick(a, column) < pick(b, column) ? -1 : pick(a, column) > pick(b, column) ? 1 : 0) * (asc ? 1 : -1));
      const start = st.range ? st.range[0] : 0;
      const end = Math.min(st.range ? st.range[1] + 1 : Infinity, start + st.limit, start + CAP);
      const data = out.slice(start, end).map((r) => Object.fromEntries(st.cols.map(([name, path]) => [name, pick(r, path)])));
      return { data, error: null };
    };
    const q = {
      select(cols) { st.cols = cols.split(',').map((c) => (c.includes(':') ? c.split(':') : [c, c])); return q; },
      eq(c, v) { st.filters.push((r) => pick(r, c) === v); return q; },
      is(c, v) { st.filters.push((r) => (pick(r, c) ?? null) === v); return q; },
      not(c, op, v) { assert.equal(op, 'is'); st.filters.push((r) => (pick(r, c) ?? null) !== v); return q; },
      in(c, list) { st.filters.push((r) => list.includes(pick(r, c))); return q; },
      gte(c, v) { st.filters.push((r) => pick(r, c) >= v); return q; },
      lt(c, v) { st.filters.push((r) => pick(r, c) < v); return q; },
      order(c, o = {}) { st.order.push([c, o.ascending !== false]); return q; },
      range(a, b) { st.range = [a, b]; return q; },
      limit(n) { st.limit = n; return q; },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    return q;
  }
  const add = (user, date, team, { type = 'daily_five', right = true } = {}) => {
    for (let n = 1; n <= 5; n += 1) {
      rows.push({
        id: `daily5:${date}:${user}:${n}`, user_id: user, interaction_type: type, flow_context: null, session_id: `daily:${date}`,
        created_at: new Date(at(date)).toISOString(), metadata: { n, right, ...(team ? { for: team } : {}) },
      });
    }
  };
  return { rows, add, client: { from } };
}

test('a Sunday sitter counts for the college of their latest five, however long their history (PostgREST\'s 1,000-row cut)', async () => {
  const db = cappedDb();
  const sunday = '2026-11-22';
  // a: Hansraj for 110 days, then Miranda House for the last 10. Their latest fives were written last.
  for (let d = 119; d >= 10; d -= 1) db.add('a', addDays(sunday, -d), H);
  // b: Kirori Mal for 100 days.
  for (let d = 100; d >= 1; d -= 1) db.add('b', addDays(sunday, -d), K);
  for (let d = 9; d >= 0; d -= 1) db.add('a', addDays(sunday, -d), M);
  // c: a month of fives for no college, then one for Shri Ram College of Commerce; another feature's row is never read.
  for (let d = 40; d >= 3; d -= 1) db.add('c', addDays(sunday, -d), null);
  db.add('c', addDays(sunday, -2), 'shri-ram-college-of-commerce');
  db.add('a', sunday, K, { type: 'practice' });
  assert.ok(db.rows.length > 1000);
  const store = createTeamStore({ db: () => db.client });
  const teams = await store.teamsOn(['a', 'b', 'c', 'a', 'nobody'], sunday);
  assert.deepEqual(Object.fromEntries(teams), { a: M, b: K, c: 'shri-ram-college-of-commerce' });
  // As of a Sunday before the change, a was still Hansraj's.
  assert.equal((await store.teamsOn(['a'], addDays(sunday, -14))).get('a'), H);
});

test('the week\'s read keeps today whole: a cap ever reached cuts Monday, never today', async () => {
  const db = cappedDb();
  const days = ['2026-11-16', '2026-11-17', '2026-11-18'];
  for (const date of days) for (let i = 0; i < 150; i += 1) db.add(`u${String(i).padStart(3, '0')}`, date, H);
  const store = createTeamStore({ db: () => db.client, maxRows: 2000 });
  const rows = await store.spanRows(days[0], days[2]);
  assert.equal(rows.length, 2000, 'the cap was reached');
  assert.equal(dayBoard(rows, days[2]).players, 150, 'every one of today\'s players');
  assert.equal(dayBoard(rows, days[1]).players, 150);
});

test('the reads stay on the Daily Five\'s rows; the routes read no table themselves; the board route needs no session', () => {
  const store = code(read('src/lib/server/dailyTeam.js'));
  for (const m of store.matchAll(/qi\(\)\.select\([^)]*\)[^;]*/g)) assert.match(m[0], /eq\('interaction_type', DAILY_FIVE_INTERACTION\)/, m[0].slice(0, 80));
  assert.doesNotMatch(store, /\.(insert|upsert|delete|rpc)\(|\)\s*\.update\(\{/, 'the board only reads');
  const route = code(read('src/app/api/daily/board/route.js'));
  assert.match(route, /import \{ boardHandler \} from '@\/lib\/server\/dailyFiveDeps';/);
  assert.doesNotMatch(route, /\.from\(|\.rpc\(|supabase/);
  const deps = code(read('src/lib/server/dailyFiveDeps.js'));
  assert.match(deps, /seat: \(userId\) => seatOf\(dailyFiveSecret\(\), userId\)/);
  assert.match(deps, /store: createTeamStore\(\{ db: \(\) => supabaseAdmin\(\) \}\)/);
  assert.equal(typeof createTeamStore, 'function');
});
