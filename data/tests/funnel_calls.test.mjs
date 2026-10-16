import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { FUNNEL_STEPS, FUNNEL_PRODUCT_STAGES, ONCE_PER_USER_STEPS, SERVER_ONLY_STEPS, FUNNEL_PLATFORMS } from '../../src/lib/funnelSteps.js';
import { evaluateFunnelRequest, summariseFunnel } from '../../src/lib/server/funnel.js';
import { createStepCounter, evaluateUserStepCount, funnelStepsForSession } from '../../src/lib/server/funnelOnce.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const BROWSER = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const hdrs = (extra = {}) => new Headers({ 'user-agent': BROWSER, ...extra });
const ON = { FUNNEL_ENABLED: 'true' };
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('the seven in-product steps are on the whitelist, server only, and the browser beacon cannot send them', () => {
  const expected = ['first_practice_started', 'first_practice_finished', 'first_mock_finished', 'first_repair', 'pricing_viewed', 'checkout_opened', 'payment_captured'];
  assert.deepEqual([...ONCE_PER_USER_STEPS], expected);
  assert.deepEqual(FUNNEL_PRODUCT_STAGES.map((s) => s.step), expected);
  for (const step of expected) {
    assert.ok(FUNNEL_STEPS.includes(step));
    assert.ok(SERVER_ONLY_STEPS.includes(step));
    assert.equal(evaluateFunnelRequest({ headers: new Headers({ 'user-agent': BROWSER, host: 'mockmob.in', origin: 'https://mockmob.in' }), bodyText: JSON.stringify({ step }) }).reason, 'server_only');
  }
});

test('kill switch: nothing is scheduled and the database is never called unless FUNNEL_ENABLED is exactly true', async () => {
  for (const env of [{}, { FUNNEL_ENABLED: '' }, { FUNNEL_ENABLED: 'TRUE' }, { FUNNEL_ENABLED: '1' }, { FUNNEL_ENABLED: 'false' }]) {
    const calls = []; let scheduled = 0;
    const count = createStepCounter({ env, rpc: async (...a) => { calls.push(a); return {}; }, schedule: (fn) => { scheduled += 1; fn(); } });
    count('usr_1', 'first_repair', hdrs());
    await tick();
    assert.equal(scheduled, 0); assert.equal(calls.length, 0);
  }
});

test('enabled: one rpc per step with the platform of the request, handed to schedule, returns nothing at once', async () => {
  const calls = []; let scheduledFn = null;
  const count = createStepCounter({ env: ON, rpc: async (name, args) => { calls.push({ name, args }); return { error: null }; }, schedule: (fn) => { scheduledFn = fn; } });
  assert.equal(count('usr_1', ['first_practice_finished', 'first_mock_finished', 'first_mock_finished', 'bogus'], hdrs()), undefined);
  assert.equal(calls.length, 0, 'nothing runs before the response is sent');
  await scheduledFn();
  assert.deepEqual(calls.map((c) => c.args), [
    { p_user_id: 'usr_1', p_step: 'first_practice_finished', p_platform: 'android_web' },
    { p_user_id: 'usr_1', p_step: 'first_mock_finished', p_platform: 'android_web' },
  ]);
  assert.ok(calls.every((c) => c.name === 'funnel_count_once'));
  calls.length = 0;
  count('usr_2', 'pricing_viewed', hdrs({ 'user-agent': 'MockMob/1.4 (Android 14) okhttp/4.12.0' })); await scheduledFn();
  count('usr_2', 'payment_captured', null); await scheduledFn();
  assert.deepEqual(calls.map((c) => c.args.p_platform), ['android_app', 'other']);
});

test('privacy signals, unknown steps and a missing user count nothing', async () => {
  const calls = [];
  const count = createStepCounter({ env: ON, rpc: async (...a) => { calls.push(a); return {}; }, schedule: (fn) => fn() });
  count('usr_1', 'first_repair', hdrs({ dnt: '1' }));
  count('usr_1', 'first_repair', hdrs({ 'sec-gpc': '1' }));
  count('usr_1', 'landing_view', hdrs());
  count('usr_1', 'signup_complete', hdrs());
  count('usr_1', [], hdrs());
  count('', 'first_repair', hdrs());
  count(null, 'first_repair', hdrs());
  count(42, 'first_repair', hdrs());
  await tick();
  assert.equal(calls.length, 0);
  assert.equal(evaluateUserStepCount({ headers: hdrs(), steps: 'checkout_opened', env: ON }).ok, true);
});

test('it never throws and never waits, whatever the database or the scheduler does', async () => {
  const warned = [];
  const boom = createStepCounter({ env: ON, rpc: async () => { throw new Error('db down'); }, schedule: (fn) => fn(), warn: (...a) => warned.push(a) });
  assert.doesNotThrow(() => boom('usr_1', ['first_repair', 'pricing_viewed'], hdrs()));
  await tick();
  assert.equal(warned.length, 2);
  const coded = createStepCounter({ env: ON, rpc: async () => ({ error: { code: '42883', message: 'secret detail' } }), schedule: (fn) => fn(), warn: (...a) => warned.push(a) });
  coded('usr_1', 'first_repair', hdrs()); await tick();
  assert.deepEqual(warned.at(-1), ['[funnel] count once failed', '42883'], 'only the code is logged');
  // A scheduler that throws (after() outside a request) falls back to running the work.
  const calls = [];
  const noAfter = createStepCounter({ env: ON, rpc: async (...a) => { calls.push(a); return {}; }, schedule: () => { throw new Error('outside a request'); } });
  assert.doesNotThrow(() => noAfter('usr_1', 'first_repair', hdrs())); await tick();
  assert.equal(calls.length, 1);
  // A hanging database does not hold the caller.
  const hang = createStepCounter({ env: ON, rpc: () => new Promise(() => {}), schedule: (fn) => { fn(); } });
  assert.equal(hang('usr_1', 'first_repair', hdrs()), undefined);
  // Garbage headers.
  assert.doesNotThrow(() => createStepCounter({ env: ON, rpc: async () => ({}), schedule: (fn) => fn() })('usr_1', 'first_repair', { get() { throw new Error('x'); } }));
});

test('sessions: which steps a start and a finish earn', () => {
  const ok = { id: 'att_1', mode: 'quick', selectionMeta: { mode: 'quick' } };
  assert.deepEqual(funnelStepsForSession({ kind: 'start', body: { subject: 'english', generationKey: 'k' }, result: { id: 's1' } }), ['first_practice_started']);
  assert.deepEqual(funnelStepsForSession({ kind: 'start', body: { sessionId: 's1' }, result: { id: 's1' } }), [], 'resume is not a start');
  assert.deepEqual(funnelStepsForSession({ kind: 'start', body: { episodeId: 'e1' }, result: { id: 's1' } }), [], 'delayed check is not a practice');
  assert.deepEqual(funnelStepsForSession({ kind: 'start', body: {}, result: null }), []);
  assert.deepEqual(funnelStepsForSession({ kind: 'finish', body: {}, result: ok }), ['first_practice_finished']);
  for (const mode of ['full', 'nta']) assert.deepEqual(funnelStepsForSession({ kind: 'finish', body: {}, result: { id: 'a', mode, selectionMeta: { mode } } }), ['first_practice_finished', 'first_mock_finished']);
  assert.deepEqual(funnelStepsForSession({ kind: 'finish', body: {}, result: { id: 'a', selectionMeta: { mode: 'smart' } } }), ['first_practice_finished']);
  assert.deepEqual(funnelStepsForSession({ kind: 'finish', body: {}, result: { id: 'a', selectionMeta: { episodeId: 'e1', mode: 'quick' } } }), []);
  assert.deepEqual(funnelStepsForSession({ kind: 'finish', body: {}, result: null }), []);
  assert.deepEqual(funnelStepsForSession({ kind: 'put', body: {}, result: ok }), []);
  assert.deepEqual(funnelStepsForSession({}), []);
});

test('the migration counts each person once per step, atomically, with no id in the funnel table, and the undo restores the first shape', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await db.exec('create table public.users (id text primary key, name text not null);');
    await db.exec(read('../../supabase/migrations/20261015233000_funnel_daily.sql'));
    const sql = read('../../supabase/migrations/20261016120000_funnel_product_steps.sql');
    await db.exec(sql); await db.exec(sql);
    await db.exec("insert into users values ('u1','A'),('u2','B')");
    const once = async (u, s, p = 'desktop') => (await db.query('select funnel_count_once($1,$2,$3) r', [u, s, p])).rows[0].r;
    assert.equal(await once('u1', 'first_repair'), true);
    assert.equal(await once('u1', 'first_repair'), false, 'same person, same step: not again');
    assert.equal(await once('u1', 'first_repair', 'ios_web'), false, 'a different platform does not make a second count');
    assert.equal(await once('u2', 'first_repair', 'android_app'), true);
    assert.equal(await once('u1', 'pricing_viewed'), true);
    assert.equal(await once('nobody', 'first_repair'), false, 'no such user: nothing counted');
    const rows = (await db.query('select step, platform, count from funnel_daily order by step, platform')).rows;
    assert.deepEqual(rows, [
      { step: 'first_repair', platform: 'android_app', count: 1 },
      { step: 'first_repair', platform: 'desktop', count: 1 },
      { step: 'pricing_viewed', platform: 'desktop', count: 1 },
    ]);
    assert.deepEqual((await db.query("select funnel_seen from users where id='u1'")).rows[0].funnel_seen.sort(), ['first_repair', 'pricing_viewed']);
    // The funnel table still holds only aggregates.
    const cols = (await db.query("select column_name from information_schema.columns where table_name='funnel_daily' order by ordinal_position")).rows.map((r) => r.column_name);
    assert.deepEqual(cols, ['day', 'step', 'platform', 'count']);
    // A bad step or platform raises and the claim rolls back: the person can still count later.
    await assert.rejects(db.query("select funnel_count_once('u2','page_view','desktop')"), /check/);
    await assert.rejects(db.query("select funnel_count_once('u2','checkout_opened','fridge')"), /check/);
    assert.deepEqual((await db.query("select funnel_seen from users where id='u2'")).rows[0].funnel_seen, ['first_repair']);
    assert.equal(await once('u2', 'checkout_opened'), true);
    // Concurrent calls for one person and step count once.
    await db.exec('delete from funnel_daily'); await db.exec("update users set funnel_seen = '{}'");
    const results = await Promise.all(Array.from({ length: 20 }, () => once('u1', 'payment_captured')));
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal((await db.query("select sum(count)::int n from funnel_daily where step='payment_captured'")).rows[0].n, 1);
    // Every whitelisted step is accepted, for each platform category.
    for (const platform of FUNNEL_PLATFORMS) {
      for (const step of ONCE_PER_USER_STEPS) {
        await db.exec("update users set funnel_seen='{}' where id='u2'");
        assert.equal(await once('u2', step, platform), true);
      }
    }
    // Roles.
    await db.exec('set role anon');
    await assert.rejects(db.query("select funnel_count_once('u1','first_repair','desktop')"), /permission denied/);
    await db.exec('set role authenticated');
    await assert.rejects(db.query("select funnel_count_once('u1','first_repair','desktop')"), /permission denied/);
    await db.exec('reset role');
    // Undo: the function, the column and the new rows go; the first migration's shape is back; it runs twice.
    const undo = read('../../supabase/undo/20261016120000_funnel_product_steps.undo.sql');
    await db.exec(undo); await db.exec(undo);
    assert.equal((await db.query("select count(*)::int n from pg_proc where proname='funnel_count_once'")).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::int n from information_schema.columns where table_name='users' and column_name='funnel_seen'")).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::int n from funnel_daily where step like 'first_%' or step in ('pricing_viewed','checkout_opened','payment_captured')")).rows[0].n, 0);
    await assert.rejects(db.query("select funnel_increment('first_repair','desktop')"), /check/);
    await db.query("select funnel_increment('landing_view','desktop')");
  } finally { await db.close(); }
});

test('summary: in-product steps are totalled and compared with finished sign ups', () => {
  const day = '2026-10-16';
  const rows = [
    { day, step: 'signup_complete', platform: 'android_app', count: 40 },
    { day, step: 'first_practice_started', platform: 'android_app', count: 30 },
    { day, step: 'first_practice_started', platform: 'desktop', count: 6 },
    { day, step: 'payment_captured', platform: 'other', count: 2 },
  ];
  const summary = summariseFunnel(rows, { today: day });
  assert.equal(summary.empty, false);
  assert.deepEqual(summary.product.map((p) => p.step), ONCE_PER_USER_STEPS);
  const started = summary.product.find((p) => p.step === 'first_practice_started');
  assert.equal(started.count, 36);
  assert.deepEqual([started.ofSignups.numerator, started.ofSignups.denominator], [36, 40]);
  assert.equal(summary.product.find((p) => p.step === 'first_repair').count, 0);
  assert.equal(summariseFunnel([{ day, step: 'pricing_viewed', platform: 'desktop', count: 1 }], { today: day }).empty, false);
  assert.equal(summariseFunnel([], { today: day }).empty, true);
});

test('wiring: each call sits at its real step, is fire-and-forget, and the funnel table path stays id-free', () => {
  const files = {
    sessions: read('../../src/app/api/sessions/route.js'),
    repair: read('../../src/app/api/recovery/repair/route.js'),
    order: read('../../src/app/create-subscription/route.js'),
    monthly: read('../../src/app/create-monthly-subscription/route.js'),
    verify: read('../../src/app/verify-payment/route.js'),
    webhook: read('../../src/app/webhook/route.js'),
    pricing: read('../../src/app/pricing/page.js'),
  };
  for (const [name, src] of Object.entries(files)) assert.match(src, /import \{ countStepOnce \} from '@\/lib\/server\/funnelOnceStore'/, name);
  // Never awaited: it must not block or fail the request.
  for (const [name, src] of Object.entries(files)) assert.doesNotMatch(src, /await countStepOnce|return countStepOnce/, name);
  assert.match(files.sessions, /funnelStepsForSession\(\{ kind: funnelKind, body, result \}\)/);
  assert.match(files.sessions, /startSession\(userId, body\), 'start'\);/);
  assert.match(files.sessions, /finishSession\(userId, body\), 'finish'\);/);
  assert.match(files.repair, /\['explained', 'stored'\]\.includes\(result\.status\)\) countStepOnce\(session\.user\.id, 'first_repair', request\.headers\)/);
  assert.match(files.order, /countStepOnce\(userId, 'checkout_opened', request\.headers\)/);
  assert.ok(files.order.indexOf("countStepOnce(userId, 'checkout_opened'") > files.order.indexOf('Database.createPayment'), 'after the order exists');
  assert.match(files.monthly, /countStepOnce\(userId, 'checkout_opened', request\.headers\)/);
  assert.ok(files.monthly.indexOf("countStepOnce(userId, 'checkout_opened'") > files.monthly.indexOf('Database.createPayment'));
  assert.equal((files.verify.match(/countStepOnce\(userId, 'payment_captured', requestHeaders\)/g) || []).length, 2, 'one-time and subscription verify');
  assert.equal((files.webhook.match(/countStepOnce\(paymentRecord\.userId, 'payment_captured', null\)/g) || []).length, 2, 'order and subscription webhook');
  assert.match(files.pricing, /session\?\.user\?\.id\) countStepOnce\(session\.user\.id, 'pricing_viewed'/);
  // The id-free landing path is untouched: the funnel table module never sees a user id or the flag.
  assert.match(read('../../src/lib/server/funnelOnceStore.js'), /schedule: after/);
  assert.doesNotMatch(read('../../src/lib/server/funnelStore.js').replace(/\/\/.*$/gm, ''), /funnel_count_once|funnel_seen/);
  assert.match(read('../../supabase/migrations/20261016120000_funnel_product_steps.sql'), /update public\.users\s+set funnel_seen = array_append/);
});
