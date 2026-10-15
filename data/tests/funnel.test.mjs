import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { FUNNEL_STEPS, FUNNEL_STAGES, isFunnelStep } from '../../src/lib/funnelSteps.js';
import { createFunnelTracker } from '../../src/lib/funnel.js';
import {
  evaluateFunnelRequest, funnelEnabled, isBotUserAgent, istDay, summariseFunnel, windowDays, MAX_BODY_BYTES,
} from '../../src/lib/server/funnel.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const BROWSER = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const headers = (extra = {}) => new Headers({ 'user-agent': BROWSER, host: 'mockmob.in', origin: 'https://mockmob.in', 'sec-fetch-site': 'same-origin', ...extra });
const body = (step) => JSON.stringify({ step });

test('the step whitelist is exactly the seven agreed steps', () => {
  assert.deepEqual([...FUNNEL_STEPS], ['landing_view', 'sample_subject_chosen', 'sample_started', 'sample_done', 'signup_click', 'signup_complete', 'login_click']);
  assert.equal(isFunnelStep('landing_view'), true);
  for (const bad of ['', 'LANDING_VIEW', 'landing_view ', '__proto__', 'constructor', null, undefined, 3, {}, ['landing_view']]) assert.equal(isFunnelStep(bad), false);
  assert.deepEqual(FUNNEL_STAGES.map((s) => s.step), FUNNEL_STEPS.filter((s) => s !== 'login_click'));
});

test('the migration matches the whitelist, is idempotent and counts atomically', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    const sql = read('../../supabase/migrations/20261015233000_funnel_daily.sql');
    await db.exec(sql); await db.exec(sql);
    // The database list is the same as the code list, in both directions.
    for (const step of FUNNEL_STEPS) await db.query('select funnel_increment($1)', [step]);
    await assert.rejects(db.query("select funnel_increment('page_view')"), /check/);
    await assert.rejects(db.query("insert into funnel_daily(day, step, count) values (current_date, 'nope', 1)"), /check/);
    assert.equal((await db.query('select count(*)::int n from funnel_daily')).rows[0].n, FUNNEL_STEPS.length);
    // Only aggregate columns exist: nothing that could identify a visit.
    const cols = (await db.query("select column_name from information_schema.columns where table_name='funnel_daily' order by ordinal_position")).rows.map((r) => r.column_name);
    assert.deepEqual(cols, ['day', 'step', 'count']);
    // Concurrent increments all land.
    await db.exec('delete from funnel_daily');
    await Promise.all(Array.from({ length: 50 }, () => db.query("select funnel_increment('sample_started')")));
    const row = (await db.query("select count, day::text d from funnel_daily where step='sample_started'")).rows[0];
    assert.equal(row.count, 50);
    assert.equal(row.d, istDay(), 'the day is the India day, taken by the database');
    // A negative count and a repeated (day, step) are impossible; the counter stops short of overflow.
    await assert.rejects(db.query("update funnel_daily set count = -1"), /check/);
    await db.exec("update funnel_daily set count = 2000000000");
    await db.query("select funnel_increment('sample_started')");
    assert.equal((await db.query('select count from funnel_daily')).rows[0].count, 2000000000);
    // Browser roles cannot touch it; the service role can.
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from funnel_daily'), /permission denied/);
    await assert.rejects(db.query("select funnel_increment('landing_view')"), /permission denied/);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from funnel_daily'), /permission denied/);
    await db.exec('set role service_role');
    await db.query("select funnel_increment('landing_view')");
    assert.equal((await db.query("select count from funnel_daily where step='landing_view'")).rows[0].count, 1);
    await db.exec('reset role');
    // The undo removes everything and can run twice.
    const undo = read('../../supabase/undo/20261015233000_funnel_daily.undo.sql');
    await db.exec(undo); await db.exec(undo);
    assert.equal((await db.query("select to_regclass('public.funnel_daily') t")).rows[0].t, null);
    assert.equal((await db.query("select count(*)::int n from pg_proc where proname='funnel_increment'")).rows[0].n, 0);
  } finally { await db.close(); }
});

test('the undo lives outside the migrations folder', () => {
  assert.match(read('../../supabase/undo/20261015233000_funnel_daily.undo.sql'), /drop table if exists public\.funnel_daily/);
});

test('request rules: whitelist, size, shape', () => {
  for (const step of FUNNEL_STEPS) assert.deepEqual(evaluateFunnelRequest({ headers: headers(), bodyText: body(step) }), { ok: true, step });
  const reason = (bodyText, h = headers()) => evaluateFunnelRequest({ headers: h, bodyText }).reason;
  assert.equal(reason(body('purchase')), 'unknown_step');
  assert.equal(reason(JSON.stringify({ step: ['landing_view'] })), 'unknown_step');
  assert.equal(reason('[]'), 'unknown_step');
  assert.equal(reason('null'), 'unknown_step');
  assert.equal(reason('not json'), 'bad_body');
  assert.equal(reason(''), 'bad_body');
  assert.equal(reason(undefined), 'bad_body');
  assert.equal(reason(JSON.stringify({ step: 'landing_view', pad: 'x'.repeat(MAX_BODY_BYTES) })), 'bad_body');
  // Extra keys within the size cap are read for nothing: the result carries only the step.
  assert.deepEqual(evaluateFunnelRequest({ headers: headers(), bodyText: JSON.stringify({ step: 'landing_view', userId: 'u1', ip: '1.2.3.4' }) }), { ok: true, step: 'landing_view' });
});

test('bots, scripts, privacy signals and other origins are ignored', () => {
  const bots = [
    '', 'curl/8.4.0', 'python-requests/2.31.0',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 HeadlessChrome/130.0 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36 Chrome-Lighthouse',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)', 'TelegramBot (like TwitterBot)', 'SkypeUriPreview Preview/0.5',
    'facebookexternalhit/1.1', 'WhatsApp/2.23.20.0', 'Go-http-client/2.0', 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
    'Playwright/1.40', 'AhrefsBot/7.0', 'okhttp/4.12.0', 'short',
  ];
  for (const ua of bots) {
    assert.equal(isBotUserAgent(ua), true, ua);
    assert.equal(evaluateFunnelRequest({ headers: headers({ 'user-agent': ua }), bodyText: body('landing_view') }).reason, 'bot');
  }
  assert.equal(isBotUserAgent(undefined), true);
  assert.equal(isBotUserAgent(null), true);
  assert.equal(isBotUserAgent(BROWSER), false);
  assert.equal(isBotUserAgent('Mozilla/5.0 (Linux; Android 10; CUBOT_X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'), false);
  assert.equal(isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'), false);
  const call = (extra) => evaluateFunnelRequest({ headers: headers(extra), bodyText: body('landing_view') }).reason;
  assert.equal(call({ dnt: '1' }), 'privacy_signal');
  assert.equal(call({ 'sec-gpc': '1' }), 'privacy_signal');
  assert.equal(call({ 'sec-fetch-site': 'cross-site' }), 'cross_origin');
  assert.equal(call({ origin: 'https://evil.example' }), 'cross_origin');
  assert.equal(call({ 'sec-fetch-site': 'same-site' }), 'cross_origin');
  assert.equal(call({ origin: 'https://www.mockmob.in' }), 'cross_origin');
  assert.equal(call({ host: 'www.mockmob.in', origin: 'https://www.mockmob.in' }), undefined);
  // Older browsers send neither header: allowed, the other checks still apply.
  const bare = new Headers({ 'user-agent': BROWSER });
  assert.equal(evaluateFunnelRequest({ headers: bare, bodyText: body('landing_view') }).ok, true);
});

test('kill switch is opt in and exact', () => {
  assert.equal(funnelEnabled({}), false);
  for (const v of ['', 'false', '0', 'TRUE', '1', 'yes', ' true']) assert.equal(funnelEnabled({ FUNNEL_ENABLED: v }), false, v);
  assert.equal(funnelEnabled({ FUNNEL_ENABLED: 'true' }), true);
});

test('route and helpers keep the privacy promises', () => {
  const route = read('../../src/app/api/funnel/route.js');
  const store = read('../../src/lib/server/funnelStore.js');
  const server = read('../../src/lib/server/funnel.js');
  const client = read('../../src/lib/funnel.js');
  for (const [name, src] of [['route', route], ['store', store], ['server rules', server], ['client', client]]) {
    const code = src.replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /cookies|set-cookie|document\.cookie|localStorage|sessionStorage|getClientIp|checkPersistentRateLimit|auth\(|getUser|user_id|userId/i, `${name} must not use cookies, storage, ids or the persistent limiter`);
  }
  // The route stores a step only, and only through the increment RPC.
  assert.match(route, /incrementFunnel\(decision\.step\)/);
  assert.match(store, /rpc\('funnel_increment', \{ p_step: step \}\)/);
  assert.doesNotMatch(store.replace(/\/\/.*$/gm, ''), /\.insert\(|\.upsert\(|\.update\(|\.delete\(/);
  assert.match(route, /FUNNEL_RATE_LIMIT/);
  assert.match(route, /funnelEnabled\(\)/);
  assert.ok(route.indexOf('funnelEnabled()') < route.indexOf('checkRateLimit('), 'kill switch comes first');
  assert.ok(route.indexOf('checkRateLimit(') < route.indexOf('request.text()'), 'rate limit comes before reading the body');
});

test('client helper: one beacon per step per page load, only the step, never throws', () => {
  const calls = [];
  const env = { navigator: { sendBeacon: (url, blob) => { calls.push({ url, blob }); return true; } } };
  const track = createFunnelTracker(() => env);
  assert.equal(track('landing_view'), true);
  assert.equal(track('landing_view'), false);
  assert.equal(track('sample_started'), true);
  assert.equal(track('purchase'), false);
  assert.equal(track(undefined), false);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, '/api/funnel');
  assert.equal(calls[0].blob.size, JSON.stringify({ step: 'landing_view' }).length);
  // A new page load is a new tracker, so it counts again.
  const next = createFunnelTracker(() => env);
  assert.equal(next('landing_view'), true);
  assert.equal(calls.length, 3);
  // No browser, privacy signals, a throwing beacon: all quiet.
  assert.equal(createFunnelTracker(() => ({}))('landing_view'), false);
  assert.equal(createFunnelTracker(() => ({ navigator: { doNotTrack: '1', sendBeacon: () => assert.fail('sent') } }))('landing_view'), false);
  assert.equal(createFunnelTracker(() => ({ navigator: { globalPrivacyControl: true, sendBeacon: () => assert.fail('sent') } }))('landing_view'), false);
  assert.equal(createFunnelTracker(() => ({ navigator: { sendBeacon: () => { throw new Error('x'); } } }))('landing_view'), false);
  assert.equal(createFunnelTracker(() => { throw new Error('no env'); })('landing_view'), false);
  // Without sendBeacon it falls back to a credential-free keepalive fetch.
  const fetched = [];
  const fallback = createFunnelTracker(() => ({ navigator: {}, fetch: (url, init) => { fetched.push({ url, init }); return Promise.resolve(); } }));
  assert.equal(fallback('signup_click'), true);
  assert.equal(fetched[0].init.credentials, 'omit');
  assert.equal(fetched[0].init.keepalive, true);
  assert.equal(fetched[0].init.body, body('signup_click'));
});

test('window and India day', () => {
  assert.equal(istDay(new Date('2026-10-15T18:29:59Z')), '2026-10-15');
  assert.equal(istDay(new Date('2026-10-15T18:30:00Z')), '2026-10-16');
  const days = windowDays('2026-10-15', 14);
  assert.equal(days.length, 14);
  assert.equal(days[0], '2026-10-02');
  assert.equal(days[13], '2026-10-15');
  assert.equal(windowDays('2026-03-02', 3).join(), '2026-02-28,2026-03-01,2026-03-02');
});

test('summary: rates, denominators, zero fill, out-of-window rows, small samples', () => {
  const today = '2026-10-15';
  const rows = [
    { day: '2026-10-15', step: 'landing_view', count: 600 },
    { day: '2026-10-14', step: 'landing_view', count: 400 },
    { day: '2026-10-01', step: 'landing_view', count: 99999 }, // before the window
    { day: '2026-10-16', step: 'landing_view', count: 99999 }, // after the window
    { day: '2026-10-15', step: 'sample_subject_chosen', count: 300 },
    { day: '2026-10-14', step: 'sample_subject_chosen', count: 100 },
    { day: '2026-10-15', step: 'sample_started', count: 200 },
    { day: '2026-10-15', step: 'sample_done', count: 20 },
    { day: '2026-10-15', step: 'signup_click', count: 60 },
    { day: '2026-10-15', step: 'signup_complete', count: 30 },
    { day: '2026-10-15', step: 'login_click', count: 50 },
    { day: '2026-10-15', step: 'mystery', count: 5 },
    { day: '2026-10-15', step: 'landing_view', count: -3 },
    { day: '2026-10-15', step: 'landing_view', count: 'abc' },
  ];
  const s = summariseFunnel(rows, { today, days: 14 });
  assert.equal(s.from, '2026-10-02');
  assert.equal(s.to, '2026-10-15');
  assert.equal(s.empty, false);
  const by = Object.fromEntries(s.stages.map((x) => [x.step, x]));
  assert.equal(by.landing_view.count, 1000);
  assert.equal(by.landing_view.ofPrevious, null);
  assert.equal(by.sample_subject_chosen.count, 400);
  assert.deepEqual([by.sample_subject_chosen.ofPrevious.numerator, by.sample_subject_chosen.ofPrevious.denominator, by.sample_subject_chosen.ofPrevious.rate], [400, 1000, 0.4]);
  assert.deepEqual([by.sample_started.ofPrevious.numerator, by.sample_started.ofPrevious.denominator], [200, 400]);
  assert.deepEqual([by.sample_started.ofLanding.numerator, by.sample_started.ofLanding.denominator], [200, 1000]);
  assert.equal(by.sample_done.ofPrevious.small, false);
  assert.equal(by.sample_done.ofPrevious.rate, 0.1);
  // 60 sign-up clicks against 20 finished samples: above 100% and a small denominator, both flagged.
  assert.equal(by.signup_click.ofPrevious.over, true);
  assert.equal(by.signup_click.ofPrevious.small, true);
  assert.equal(by.signup_complete.ofPrevious.rate, 0.5);
  assert.equal(by.signup_complete.ofLanding.rate, 0.03);
  assert.equal(by.signup_complete.ofLanding.againstLabel, 'Opened the landing page');
  assert.equal(s.side[0].count, 50);
  assert.deepEqual([s.side[0].ofLanding.numerator, s.side[0].ofLanding.denominator], [50, 1000]);
  // Days with nothing are zeros, in order, newest last.
  assert.equal(s.daily.length, 14);
  assert.deepEqual(s.daily.slice(-2), [
    { day: '2026-10-14', landing_view: 400, signup_complete: 0 },
    { day: '2026-10-15', landing_view: 600, signup_complete: 30 },
  ]);
  assert.deepEqual(s.daily[0], { day: '2026-10-02', landing_view: 0, signup_complete: 0 });
  // Nothing counted: empty, and no rate pretends to be zero.
  const none = summariseFunnel([], { today, days: 14 });
  assert.equal(none.empty, true);
  assert.equal(none.stages[1].ofPrevious.rate, null);
  assert.equal(none.stages[1].ofPrevious.denominator, 0);
  assert.equal(summariseFunnel(undefined, { today }).empty, true);
});
