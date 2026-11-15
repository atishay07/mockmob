// The Daily Five's route and service (15 Nov 2026, lane F-A): only today is served, the query is checked before the limiter
// and the database, and no question outside the public sample windows can ever be served. Software fixtures
// (data/tests/helpers/egress_fixtures.mjs); they do not establish academic reliability.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeDb, legacyRow, setFixtureSecret } from './helpers/egress_fixtures.mjs';
import { DEMO_POOL_SIZE } from '../../src/lib/demoSample.mjs';
import { createDemoSample, readDemoPool } from '../../src/lib/server/demoSample.js';
import { createDailyFive, parseDailyQuery } from '../../src/lib/server/dailyFive.js';
import { DAILY_FIVE_CYCLE_DAYS, DAILY_FIVE_MAX, acceptDailyFive, dateOfDay } from '../../src/lib/dailyFive.mjs';

const restore = setFixtureSecret();
after(restore);
const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// A bank with English, the General Test and a third subject whose questions must never appear.
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function bank(seed = 7) {
  const rand = rng(seed);
  const rows = [];
  let n = 0;
  for (const subject of ['english', 'gat', 'accountancy']) {
    for (let i = 0; i < 360; i += 1) {
      const row = legacyRow(rand, n, { subject });
      rows.push({ ...row, chapter: `Chapter ${i % 12}`, body: `${subject}: ${row.body}`, question: `${subject}: ${row.question}` });
      n += 1;
    }
  }
  return rows;
}
const tablesOf = (rows) => ({ questions: rows, recovery_family_holds: [] });
const at = (iso) => Date.parse(iso);
const day = (n) => ({ ok: true, day: n, date: dateOfDay(n) });

test('only today is served: the query is a day number, checked against the IST day before anything is read', () => {
  const now = at('2026-11-15T12:00:00Z'); // 5:30 pm IST, day 1
  const q = (s, t = now) => parseDailyQuery(new URLSearchParams(s), t);
  assert.deepEqual(q('day=1'), { ok: true, day: 1, date: '2026-11-15' });
  for (const bad of ['', 'day=', 'day=0', 'day=01', 'day=-1', 'day=1.5', 'day=abc', 'day=1e3', 'day=9999999', 'days=1']) {
    const r = q(bad);
    assert.equal(r.ok, false, bad);
    assert.deepEqual(r.today, { day: 1, date: '2026-11-15' }, 'a refusal names today');
  }
  assert.equal(q('day=2').error, 'not_today', 'tomorrow stays unseen');
  // The IST midnight boundary: 18:29:59 UTC is still day 1, 18:30 UTC is day 2.
  assert.equal(q('day=1', at('2026-11-15T18:29:59Z')).ok, true);
  assert.equal(q('day=1', at('2026-11-15T18:30:00Z')).error, 'not_today');
  assert.deepEqual(q('day=2', at('2026-11-15T18:30:00Z')), { ok: true, day: 2, date: '2026-11-16' });
});

test('the service: the day\'s five come from the public windows of English and the General Test only, every one of the 60 once a cycle', async () => {
  const rows = bank();
  const english = await readDemoPool(fakeDb(tablesOf(rows)), 'english');
  const gat = await readDemoPool(fakeDb(tablesOf(rows)), 'gat');
  assert.equal(english.length, DEMO_POOL_SIZE);
  assert.equal(gat.length, DEMO_POOL_SIZE);
  const windows = new Map([...english.map((x) => ['english', x]), ...gat.map((x) => ['general-test', x])].map(([slug, x]) => [JSON.stringify({ subject: slug, ...x }), slug]));
  let reads = 0;
  const service = createDailyFive({ sample: createDemoSample({ db: () => { reads += 1; return fakeDb(tablesOf(rows)); } }) });
  const seen = new Map();
  for (let d = 1; d <= DAILY_FIVE_CYCLE_DAYS * 3; d += 1) {
    const answer = await service.get(day(d));
    assert.equal(answer.day, d);
    assert.equal(answer.date, dateOfDay(d));
    assert.equal(answer.questions.length, 5);
    assert.ok(acceptDailyFive(answer), 'the page accepts it whole');
    for (const item of answer.questions) {
      const keys = Object.keys(item);
      assert.deepEqual(keys.filter((k) => k !== 'pastPaper'), ['subject', 'q', 'options', 'correct', 'why', 'chapter'], 'the sample\'s fields and nothing more');
      assert.ok(windows.has(JSON.stringify(item)), `day ${d}: "${item.q}" is a question of the public windows, exactly as the sample serves it`);
      assert.doesNotMatch(item.q, /^accountancy:/);
      seen.set(item.q, (seen.get(item.q) || 0) + 1);
    }
  }
  assert.equal(seen.size, DAILY_FIVE_MAX, 'the exact number of distinct questions the feature can ever show: 60');
  assert.ok([...seen.values()].every((n) => n === 3), 'three cycles, each question three times');
  assert.equal(reads, 2, 'one window read per subject, then the memo (the sample\'s own)');
});

test('a thin or empty subject: the day still fills from what the windows hold, or answers nothing', async () => {
  const rows = bank().filter((r) => r.subject !== 'gat');
  const service = createDailyFive({ sample: createDemoSample({ db: () => fakeDb(tablesOf(rows)) }) });
  const answer = await service.get(day(4));
  assert.equal(answer.questions.length, 5);
  assert.ok(answer.questions.every((x) => x.subject === 'english'));
  assert.equal(await createDailyFive({ sample: createDemoSample({ db: () => fakeDb(tablesOf([])) }) }).get(day(1)), null);
});

test('the route: public and rate-limited; the query first, then the limit, then the service; cached by day until IST midnight, tagged; nothing else cached', () => {
  const route = code(read('src/app/api/daily/route.js'));
  const pos = (s) => route.indexOf(s);
  assert.match(route, /export async function GET\(request\)/);
  assert.doesNotMatch(route, /\bauth\(/, 'no sign-in: the Daily Five is for guests too');
  assert.ok(pos('parseDailyQuery(') > 0 && pos('parseDailyQuery(') < pos('checkPersistentRateLimit(') && pos('checkPersistentRateLimit(') < pos('daily.get('));
  assert.match(route, /checkPersistentRateLimit\(request, \{ route: ROUTE, limit: DAILY_RATE_LIMIT, fallback: 'memory' \}\)/);
  assert.match(route, /const DAILY_RATE_LIMIT = 30;/, 'the sample\'s limit');
  assert.match(route, /createDailyFive\(\{ sample: createDemoSample\(\{ db: \(\) => supabaseAdmin\(\) \}\) \}\)/, 'the sample\'s own service, nothing else reads');
  assert.doesNotMatch(route, /\.from\(|\.rpc\(|\.select\(/, 'the route reads no table itself');
  assert.doesNotMatch(code(read('src/lib/server/dailyFive.js')), /\.from\(|\.rpc\(|\.select\(|supabase/, 'the service reads no table itself');
  assert.match(route, /reply\(diagnostics, 200, answer, \{ \.\.\.untilMidnight\(Date\.now\(\)\), \.\.\.CACHE_TAGS \}\)/);
  assert.match(route, /'CDN-Cache-Control': `public, s-maxage=\$\{seconds\}`/);
  assert.doesNotMatch(route, /stale-while-revalidate/, 'a day is never served after its midnight');
  assert.match(route, /'Vercel-Cache-Tag': 'demo-sample,daily-five'/);
  assert.equal((route.match(/untilMidnight\(/g) || []).length, 2, 'defined once, used once: on the 200 only');
  for (const status of ['400', '429', '503']) assert.match(route, new RegExp(`reply\\(diagnostics, ${status}, [^\\n]*NO_STORE`), status);
  assert.match(route.slice(route.indexOf('} catch (error) {')), /status: 503, headers: NO_STORE/);
});
