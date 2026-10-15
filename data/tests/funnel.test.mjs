import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { FUNNEL_STEPS, FUNNEL_STAGES, FUNNEL_PLATFORMS, FUNNEL_PLATFORM_LABELS, SERVER_ONLY_STEPS, isFunnelPlatform, isFunnelStep } from '../../src/lib/funnelSteps.js';
import { createFunnelTracker } from '../../src/lib/funnel.js';
import {
  evaluateFunnelRequest, evaluateSignupCount, funnelEnabled, isBotUserAgent, istDay, platformFromUserAgent, summariseFunnel, windowDays, MAX_BODY_BYTES,
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
    for (const step of FUNNEL_STEPS) await db.query("select funnel_increment($1, 'desktop')", [step]);
    await assert.rejects(db.query("select funnel_increment('page_view', 'desktop')"), /check/);
    await assert.rejects(db.query("select funnel_increment('landing_view', 'smart_fridge')"), /check/);
    await assert.rejects(db.query("select funnel_increment('landing_view', null)"), /null|check/);
    await assert.rejects(db.query("insert into funnel_daily(day, step, platform, count) values (current_date, 'nope', 'desktop', 1)"), /check/);
    await assert.rejects(db.query("insert into funnel_daily(day, step, platform, count) values (current_date, 'landing_view', 'Desktop', 1)"), /check/);
    assert.equal((await db.query('select count(*)::int n from funnel_daily')).rows[0].n, FUNNEL_STEPS.length);
    // The platform list in the database is the code list, and the platform is part of the key.
    for (const platform of FUNNEL_PLATFORMS) await db.query("select funnel_increment('landing_view', $1)", [platform]);
    assert.equal((await db.query("select count(*)::int n from funnel_daily where step = 'landing_view'")).rows[0].n, FUNNEL_PLATFORMS.length);
    await db.query("select funnel_increment('landing_view', 'android_app')");
    assert.equal((await db.query("select count from funnel_daily where step = 'landing_view' and platform = 'android_app'")).rows[0].count, 2);
    assert.equal((await db.query("select count from funnel_daily where step = 'landing_view' and platform = 'ios_web'")).rows[0].count, 1);
    const keyCols = (await db.query("select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey) where i.indrelid = 'public.funnel_daily'::regclass and i.indisprimary")).rows.map((r) => r.attname).sort();
    assert.deepEqual(keyCols, ['day', 'platform', 'step']);
    // Only aggregate columns exist: nothing that could identify a visit.
    const cols = (await db.query("select column_name from information_schema.columns where table_name='funnel_daily' order by ordinal_position")).rows.map((r) => r.column_name);
    assert.deepEqual(cols, ['day', 'step', 'platform', 'count']);
    // Concurrent increments all land.
    await db.exec('delete from funnel_daily');
    await Promise.all(Array.from({ length: 50 }, () => db.query("select funnel_increment('sample_started', 'ios_web')")));
    const row = (await db.query("select count, day::text d from funnel_daily where step='sample_started' and platform='ios_web'")).rows[0];
    assert.equal(row.count, 50);
    assert.equal(row.d, istDay(), 'the day is the India day, taken by the database');
    // A negative count and a repeated (day, step) are impossible; the counter stops short of overflow.
    await assert.rejects(db.query("update funnel_daily set count = -1"), /check/);
    await db.exec("update funnel_daily set count = 2000000000");
    await db.query("select funnel_increment('sample_started', 'ios_web')");
    assert.equal((await db.query('select count from funnel_daily')).rows[0].count, 2000000000);
    // Browser roles cannot touch it; the service role can.
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from funnel_daily'), /permission denied/);
    await assert.rejects(db.query("select funnel_increment('landing_view', 'desktop')"), /permission denied/);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from funnel_daily'), /permission denied/);
    await db.exec('set role service_role');
    await db.query("select funnel_increment('landing_view', 'desktop')");
    assert.equal((await db.query("select count from funnel_daily where step='landing_view'")).rows[0].count, 1);
    await db.exec('reset role');
    // An earlier copy of the migration (one-argument function, no platform column) is removed too.
    await db.exec('drop table public.funnel_daily; drop function public.funnel_increment(text, text);');
    await db.exec('create table public.funnel_daily (day date not null, step text not null, count int not null default 0, primary key (day, step));');
    await db.exec('create function public.funnel_increment(p_step text) returns void language sql as $f$ select 1 $f$;');
    await db.exec(read('../../supabase/undo/20261015233000_funnel_daily.undo.sql'));
    assert.equal((await db.query("select count(*)::int n from pg_proc where proname='funnel_increment'")).rows[0].n, 0, 'old signature gone');
    await db.exec(sql);
    // The undo removes everything and can run twice.
    const undo = read('../../supabase/undo/20261015233000_funnel_daily.undo.sql');
    await db.exec(undo); await db.exec(undo);
    assert.equal((await db.query("select to_regclass('public.funnel_daily') t")).rows[0].t, null);
    assert.equal((await db.query("select count(*)::int n from pg_proc where proname='funnel_increment'")).rows[0].n, 0);
  } finally { await db.close(); }
});

test('the undo lives outside the migrations folder', () => {
  const undo = read('../../supabase/undo/20261015233000_funnel_daily.undo.sql');
  assert.match(undo, /drop table if exists public\.funnel_daily/);
  assert.match(undo, /drop function if exists public\.funnel_increment\(text, text\)/);
});

test('request rules: whitelist, size, shape', () => {
  for (const step of FUNNEL_STEPS.filter((x) => !SERVER_ONLY_STEPS.includes(x))) assert.deepEqual(evaluateFunnelRequest({ headers: headers(), bodyText: body(step) }), { ok: true, step, platform: 'android_web' });
  // signup_complete is counted by the server where the account is created, never by a beacon.
  assert.deepEqual([...SERVER_ONLY_STEPS], ['signup_complete']);
  assert.equal(evaluateFunnelRequest({ headers: headers(), bodyText: body('signup_complete') }).reason, 'server_only');
  const reason = (bodyText, h = headers()) => evaluateFunnelRequest({ headers: h, bodyText }).reason;
  assert.equal(reason(body('purchase')), 'unknown_step');
  assert.equal(reason(JSON.stringify({ step: ['landing_view'] })), 'unknown_step');
  assert.equal(reason('[]'), 'unknown_step');
  assert.equal(reason('null'), 'unknown_step');
  assert.equal(reason('not json'), 'bad_body');
  assert.equal(reason(''), 'bad_body');
  assert.equal(reason(undefined), 'bad_body');
  assert.equal(reason(JSON.stringify({ step: 'landing_view', pad: 'x'.repeat(MAX_BODY_BYTES) })), 'bad_body');
  // Extra keys within the size cap are read for nothing: the result carries only the step, and the
  // platform comes from the User-Agent, never from the body.
  assert.deepEqual(evaluateFunnelRequest({ headers: headers(), bodyText: JSON.stringify({ step: 'landing_view', platform: 'ios_web', userId: 'u1', ip: '1.2.3.4' }) }), { ok: true, step: 'landing_view', platform: 'android_web' });
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
  assert.match(route, /incrementFunnel\(decision\.step, decision\.platform\)/);
  assert.match(store, /rpc\('funnel_increment', \{ p_step: step, p_platform: platform \}\)/);
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

const UAS = {
  desktop: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  ],
  android_web: [
    BROWSER,
    'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0',
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  ],
  ios_web: [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/130.0 Mobile/15E148 Safari/605.1.15',
  ],
  android_app: [
    'Dart/3.5 (dart:io)',
    'okhttp/4.12.0',
    'MockMob/1.4.0 (Android 14; Pixel 8) okhttp/4.12.0',
    'MockMob-App/2.0 Dart/3.5 (dart:io)',
    'mockmob/1.0',
  ],
  other: [
    '', undefined, null, 42, {},
    'Mozilla/5.0 (PlayStation; PlayStation 5/2.26) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15',
    'Mozilla/5.0 (Nintendo Switch; WifiWebAuthApplet) AppleWebKit/601.6 (KHTML, like Gecko) NF/4.0.0.5.10 NintendoBrowser/5.1.0.13343',
    'Mozilla/5.0 (SMART-TV; Linux; Tizen 7.0) AppleWebKit/537.36 (KHTML, like Gecko) 94.0.4606.31/7.0 TV Safari/537.36',
    'curl/8.4.0',
  ],
};

test('platform comes from the User-Agent into exactly five categories', () => {
  assert.deepEqual([...FUNNEL_PLATFORMS], ['desktop', 'android_web', 'ios_web', 'android_app', 'other']);
  assert.deepEqual(Object.keys(FUNNEL_PLATFORM_LABELS), [...FUNNEL_PLATFORMS]);
  assert.deepEqual(Object.keys(UAS), [...FUNNEL_PLATFORMS]);
  for (const [platform, list] of Object.entries(UAS)) {
    for (const ua of list) {
      assert.equal(platformFromUserAgent(ua), platform, String(ua));
      assert.equal(isFunnelPlatform(platformFromUserAgent(ua)), true);
    }
  }
  for (const bad of ['Desktop', 'android', '', null, undefined, 3, {}, ['desktop'], '__proto__']) assert.equal(isFunnelPlatform(bad), false);
  // Only a category comes back, never any part of the header; a huge header is cut before it is read.
  assert.equal(platformFromUserAgent('x'.repeat(100000) + ' Android'), 'other');
  assert.equal(typeof platformFromUserAgent(BROWSER), 'string');
  assert.ok(FUNNEL_PLATFORMS.includes(platformFromUserAgent(BROWSER)));
});

test('the app token passes the beacon bot filter, scripts still do not', () => {
  assert.equal(isBotUserAgent('MockMob/1.4.0 (Android 14; Pixel 8) okhttp/4.12.0'), false);
  assert.equal(isBotUserAgent('okhttp/4.12.0'), true);
  assert.equal(isBotUserAgent('Dart/3.5 (dart:io)'), false, 'Dart is not a listed script');
  assert.equal(isBotUserAgent('MockMob/1.0 Googlebot/2.1'), true, 'a bot token still wins');
  const app = evaluateFunnelRequest({ headers: new Headers({ 'user-agent': 'MockMob/1.4.0 (Android 14; Pixel 8) okhttp/4.12.0' }), bodyText: body('landing_view') });
  assert.deepEqual(app, { ok: true, step: 'landing_view', platform: 'android_app' });
  for (const [platform, ua] of [['desktop', UAS.desktop[0]], ['ios_web', UAS.ios_web[0]], ['android_web', UAS.android_web[0]]]) {
    assert.deepEqual(evaluateFunnelRequest({ headers: headers({ 'user-agent': ua }), bodyText: body('sample_started') }), { ok: true, step: 'sample_started', platform });
  }
});

test('finished sign up: server count with platform, same privacy rules, no bot filter', () => {
  const on = { FUNNEL_ENABLED: 'true' };
  assert.deepEqual(evaluateSignupCount({ headers: headers(), env: on }), { ok: true, step: 'signup_complete', platform: 'android_web' });
  assert.deepEqual(evaluateSignupCount({ headers: new Headers({ 'user-agent': UAS.ios_web[0] }), env: on }), { ok: true, step: 'signup_complete', platform: 'ios_web' });
  assert.deepEqual(evaluateSignupCount({ headers: new Headers({ 'user-agent': 'okhttp/4.12.0' }), env: on }), { ok: true, step: 'signup_complete', platform: 'android_app' });
  assert.deepEqual(evaluateSignupCount({ headers: null, env: on }), { ok: true, step: 'signup_complete', platform: 'other' });
  assert.deepEqual(evaluateSignupCount({ headers: new Headers(), env: on }), { ok: true, step: 'signup_complete', platform: 'other' });
  assert.equal(evaluateSignupCount({ headers: headers(), env: {} }).reason, 'disabled');
  assert.equal(evaluateSignupCount({ headers: headers(), env: { FUNNEL_ENABLED: 'yes' } }).reason, 'disabled');
  assert.equal(evaluateSignupCount({ headers: headers({ dnt: '1' }), env: on }).reason, 'privacy_signal');
  assert.equal(evaluateSignupCount({ headers: headers({ 'sec-gpc': '1' }), env: on }).reason, 'privacy_signal');
});

test('sign up is counted where the account row is first created, once, without changing auth', async () => {
  const { ensureDbUser } = await import('../../src/lib/server/cookieSession.js');
  const rows = new Map();
  let counted = 0;
  const db = {
    getUserById: async (id) => rows.get(id) || null,
    getUserByEmail: async (email) => [...rows.values()].find((r) => r.email === email) || null,
    updateUser: async (id, patch) => ({ ...rows.get(id), ...patch }),
    createUser: async (row) => {
      await new Promise((r) => setTimeout(r, 5));
      if (rows.has(row.id)) throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
      rows.set(row.id, { ...row });
      return rows.get(row.id);
    },
  };
  const onCreated = async (...args) => { assert.equal(args.length, 0, 'nothing about the person is passed'); counted += 1; };
  const identity = { id: 'sb-1', email: 'asha@example.com', name: 'Asha' };
  // Two first requests at once: both get the row, only the one that created it counts.
  const [a, b] = await Promise.all([ensureDbUser(identity, db, { onCreated }), ensureDbUser(identity, db, { onCreated })]);
  assert.equal(a.id, 'sb-1');
  assert.equal(b.id, 'sb-1');
  assert.equal(counted, 1);
  // A returning student, or an older row found by email, is not a sign up.
  await ensureDbUser(identity, db, { onCreated });
  rows.set('legacy-9', { id: 'legacy-9', email: 'old@example.com', name: 'Old' });
  assert.equal((await ensureDbUser({ id: 'sb-2', email: 'old@example.com' }, db, { onCreated })).id, 'legacy-9');
  assert.equal(counted, 1);
  // A failing or missing counter never changes the result, and a failed create is not counted.
  const same = await ensureDbUser({ id: 'sb-4', email: 'b@example.com' }, db, { onCreated: async () => { throw new Error('rpc down'); } });
  assert.equal(same.id, 'sb-4');
  assert.equal((await ensureDbUser({ id: 'sb-5', email: 'c@example.com' }, db)).id, 'sb-5');
  await assert.rejects(ensureDbUser({ id: 'sb-6', email: 'd@example.com' }, { ...db, createUser: async () => { throw Object.assign(new Error('boom'), { code: '500' }); } }, { onCreated }));
  assert.equal(counted, 1);
  // The wiring: auth.ts passes a counter built from the request headers; the store keeps the category only.
  const auth = read('../../src/lib/auth.ts');
  assert.match(auth, /ensureDbUser\(\{[\s\S]*?\}, Database, \{[\s\S]*?onCreated[\s\S]*?countSignup\(requestHeaders\)/);
  assert.match(auth, /request\?\.headers/);
  const store = read('../../src/lib/server/funnelStore.js');
  assert.match(store, /export async function countSignup\(headers\)/);
  assert.match(store, /evaluateSignupCount\(\{ headers \}\)/);
  const code = store.replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /console\.(log|warn|error)\([^)]*(headers|agent|ip)/i);
});

test('summary by platform: shares add up, denominators shown, unknown platforms land in other', () => {
  const today = '2026-10-15';
  const rows = [
    { day: '2026-10-15', step: 'landing_view', platform: 'desktop', count: 300 },
    { day: '2026-10-14', step: 'landing_view', platform: 'desktop', count: 100 },
    { day: '2026-10-15', step: 'landing_view', platform: 'android_web', count: 450 },
    { day: '2026-10-15', step: 'landing_view', platform: 'ios_web', count: 150 },
    { day: '2026-10-01', step: 'landing_view', platform: 'ios_web', count: 99999 },
    { day: '2026-10-15', step: 'sample_started', platform: 'android_web', count: 90 },
    { day: '2026-10-15', step: 'signup_complete', platform: 'desktop', count: 10 },
    { day: '2026-10-15', step: 'signup_complete', platform: 'android_web', count: 30 },
    { day: '2026-10-14', step: 'signup_complete', platform: 'android_app', count: 20 },
    { day: '2026-10-15', step: 'signup_complete', platform: 'ios_web', count: 5 },
    { day: '2026-10-15', step: 'signup_complete', platform: 'toaster', count: 5 },
    { day: '2026-10-15', step: 'signup_complete', count: 2 },
    { day: '2026-10-15', step: 'landing_view', platform: 'desktop', count: -4 },
  ];
  const s = summariseFunnel(rows, { today, days: 14 });
  assert.deepEqual(s.byPlatform.map((p) => p.platform), [...FUNNEL_PLATFORMS]);
  const by = Object.fromEntries(s.byPlatform.map((p) => [p.platform, p]));
  assert.equal(s.totalVisits, 1000);
  assert.equal(s.totalSignups, 72);
  // Overall totals still include every row.
  assert.equal(s.stages.find((x) => x.step === 'signup_complete').count, 72);
  // Visits.
  assert.deepEqual([by.desktop.visitShare.numerator, by.desktop.visitShare.denominator, by.desktop.visitShare.rate], [400, 1000, 0.4]);
  assert.deepEqual([by.android_web.visitShare.numerator, by.android_web.visitShare.denominator], [450, 1000]);
  assert.equal(by.android_app.visitShare.numerator, 0);
  assert.equal(by.android_app.visitShare.rate, 0);
  // Sign ups, with the all-platform denominator and the small-sample flag (72 is above 30).
  assert.deepEqual([by.android_app.signupShare.numerator, by.android_app.signupShare.denominator], [20, 72]);
  assert.equal(by.android_app.signupShare.small, false);
  assert.deepEqual([by.other.signupShare.numerator, by.other.signupShare.denominator], [7, 72], 'unknown and missing platforms count as other');
  for (const key of ['visitShare', 'signupShare']) {
    assert.equal(s.byPlatform.reduce((sum, p) => sum + p[key].numerator, 0), key === 'visitShare' ? s.totalVisits : s.totalSignups);
  }
  // Each platform has its own funnel with its own rates.
  const dStarted = by.android_web.stages.find((x) => x.step === 'sample_started');
  assert.equal(dStarted.count, 90);
  assert.deepEqual([dStarted.ofPrevious.numerator, dStarted.ofPrevious.denominator], [90, 0], 'no chosen-subject count on this platform: no data, not zero percent');
  assert.equal(dStarted.ofPrevious.rate, null);
  assert.deepEqual([by.android_web.stages.at(-1).ofLanding.numerator, by.android_web.stages.at(-1).ofLanding.denominator], [30, 450]);
  assert.equal(by.android_app.stages.at(-1).ofLanding.rate, null, 'the app never opens the landing page: no rate against it');
  assert.equal(by.android_app.empty, false);
  assert.equal(by.ios_web.empty, false);
  // A platform with no rows is empty; with no rows at all every share is "no data".
  const only = summariseFunnel([{ day: today, step: 'landing_view', platform: 'desktop', count: 5 }], { today });
  assert.equal(only.byPlatform.find((p) => p.platform === 'ios_web').empty, true);
  assert.equal(only.byPlatform.find((p) => p.platform === 'desktop').visitShare.small, true);
  assert.equal(only.byPlatform.find((p) => p.platform === 'desktop').signupShare.rate, null);
  const none = summariseFunnel([], { today });
  assert.equal(none.totalVisits, 0);
  assert.ok(none.byPlatform.every((p) => p.empty && p.visitShare.rate === null && p.signupShare.denominator === 0));
});

test('the admin page reads the platform column and shows the split with denominators', () => {
  const store = read('../../src/lib/server/funnelStore.js');
  assert.match(store, /\.select\('day,step,platform,count'\)/);
  const view = read('../../src/components/admin/FunnelSummary.jsx');
  assert.match(view, /By platform/);
  assert.match(view, /Share of visits/);
  assert.match(view, /Share of sign ups/);
  assert.match(view, /summary\.byPlatform/);
  assert.match(view, /part\.numerator\)\} of \{number\(part\.denominator\)/);
  // The table's counters hold a category and a count: no user agent, id or address is written anywhere.
  const migration = read('../../supabase/migrations/20261015233000_funnel_daily.sql').replace(/--.*$/gm, '');
  assert.doesNotMatch(migration, /user_agent|useragent|\bua\b|ip_|user_id|session|cookie/i);
});
