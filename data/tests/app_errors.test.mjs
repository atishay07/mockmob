import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import {
  scrubText, cleanScreen, messageHash, normalizeError, normalizeBatch, canCollectErrors, appErrorsEnabled, handleAppErrorsPost,
  summariseTopErrors, MAX_BATCH, MAX_BODY_BYTES, MAX_MESSAGE_CHARS, MAX_STACK_BYTES,
} from '../../src/lib/server/appErrors.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const good = (extra = {}) => ({
  kind: 'flutter', message: 'Null check operator used on a null value', stack: '#0 Foo.bar (package:mockmob/a.dart:10:5)\n#1 Baz (package:mockmob/b.dart:2:1)',
  screen: '/today', platform: 'android', app_version: '1.0.0', build: '12', os_version: 'Android 14', device_class: 'phone', ...extra,
});

test('scrubText removes emails, phone numbers, tokens, ids and addresses', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const cases = [
    ['mail asha.k+x@example.co.in failed', 'asha.k+x@example.co.in'],
    ['call 9876543210 now', '9876543210'],
    ['call +91 98765 43210 now', '98765 43210'],
    ['call +91-98765-43210 now', '98765-43210'],
    ['call 0091 9876543210 now', '9876543210'],
    ['id 123456789012 bad', '123456789012'],
    [`auth ${jwt}`, jwt],
    ['Authorization: Bearer abcDEF123456xyz', 'abcDEF123456xyz'],
    ['GET /x?access_token=abc123def456&y=1', 'abc123def456'],
    ['{"refresh_token":"r3fr3sh-value-9"}', 'r3fr3sh-value-9'],
    ['user 3f2504e0-4f89-11d3-9a0c-0305e82c3301 gone', '3f2504e0-4f89-11d3-9a0c-0305e82c3301'],
    ['key sk-abcdefghijklmnop1234 used', 'sk-abcdefghijklmnop1234'],
    ['from 192.168.1.100 refused', '192.168.1.100'],
    ['from 2001:0db8:85a3:0000:0000:8a2e:0370:7334 refused', '2001:0db8:85a3'],
    ['digest a3f9c2d1e8b74a6f9c0d1e2f3a4b5c6d7e8f9a0b done', 'a3f9c2d1e8b74a6f9c0d1e2f3a4b5c6d7e8f9a0b'],
    ['C:\\Users\\atish\\proj\\a.dart', 'atish'],
  ];
  for (const [input, secret] of cases) {
    const out = scrubText(input);
    assert.ok(!out.includes(secret), `${input} -> ${out}`);
  }
  assert.match(scrubText('mail a@b.com'), /\[email\]/);
  assert.match(scrubText('call 9876543210'), /\[phone\]/);
});

test('scrubText keeps ordinary error text readable', () => {
  const plain = [
    "type 'Null' is not a subtype of type 'String' in type cast",
    'RangeError (index): Invalid value: Not in inclusive range 0..4: 7',
    'package:mockmob/features/today/screens/today_screen.dart:120:9',
    'A RenderFlex overflowed by 14 pixels on the right.',
    'SomeVeryLongProviderNameThatIsOnlyLettersAndLong.build',
    'Unable to load asset: assets/art/mobi.png at 2026-10-16 12:30:00',
    'Duplicate key: subject',
  ];
  for (const text of plain) assert.equal(scrubText(text), text);
  assert.equal(scrubText(''), '');
  assert.equal(scrubText(null), '');
  assert.equal(scrubText(42), '');
});

test('scrubText is fast on a hostile megabyte', () => {
  const started = Date.now();
  scrubText('a'.repeat(1_000_000));
  scrubText('1.'.repeat(500_000));
  scrubText('a@'.repeat(500_000));
  assert.ok(Date.now() - started < 2000);
});

test('normalizeError trims message to 500 characters and stack to 4 KB, after scrubbing', () => {
  const row = normalizeError(good({ message: 'x '.repeat(900), stack: 'line é\n'.repeat(2000) }));
  assert.ok(row.message.length <= MAX_MESSAGE_CHARS);
  assert.ok(Buffer.byteLength(row.stack) <= MAX_STACK_BYTES);
  // A secret sitting across the cut is gone, not half kept.
  const email = 'someone@example.com';
  const edge = normalizeError(good({ message: `${'a '.repeat(245)}${email} tail` }));
  assert.ok(!edge.message.includes('someone'));
  assert.ok(!normalizeError(good({ stack: `${'a'.repeat(4080)} ${email}` })).stack.includes('someone'));
});

test('normalizeError never keeps an identity and refuses bad shapes', () => {
  const row = normalizeError(good({ user_id: 'u-1', email: 'a@b.com', ip: '1.2.3.4', user_agent: 'x', device_id: 'd', message: 'fail for a@b.com 9876543210' }));
  assert.deepEqual(Object.keys(row).sort(), ['app_version', 'build', 'count', 'device_class', 'kind', 'message', 'message_hash', 'os_version', 'platform', 'screen', 'stack']);
  assert.ok(!JSON.stringify(row).includes('a@b.com'));
  assert.ok(!JSON.stringify(row).includes('9876543210'));
  for (const bad of [null, undefined, 3, 'x', [], {}, { message: '' }, { message: '   ' }, { message: 5 }, { kind: 'flutter' }]) assert.equal(normalizeError(bad), null);
  const odd = normalizeError(good({ kind: 'weird', platform: 'toaster', device_class: 'fridge', app_version: 'x'.repeat(40), build: '1 2', count: 'many' }));
  assert.equal(odd.kind, 'other'); assert.equal(odd.platform, 'other'); assert.equal(odd.device_class, 'other');
  assert.equal(odd.app_version, null); assert.equal(odd.build, null); assert.equal(odd.count, 1);
  assert.equal(normalizeError(good({ count: 99999 })).count, 1000);
  assert.equal(normalizeError(good({ count: -4 })).count, 1);
  assert.equal(normalizeError(good({ stack: undefined })).stack, null);
});

test('cleanScreen keeps the shape of a route and drops ids and queries', () => {
  assert.equal(cleanScreen('/today'), '/today');
  assert.equal(cleanScreen('/learn/chapter/9f1c2d3e4a5b?x=1#y'), '/learn/chapter/:id');
  assert.equal(cleanScreen('/review/3f2504e0-4f89-11d3-9a0c-0305e82c3301'), '/review/:id');
  assert.equal(cleanScreen('   '), null);
  assert.equal(cleanScreen(null), null);
  assert.ok(cleanScreen('/' + 'a'.repeat(200)).length <= 64);
});

test('message_hash groups the same failure and separates different places', () => {
  const a = normalizeError(good({ message: 'Index 7 out of range for list of 5' }));
  const b = normalizeError(good({ message: 'Index 3 out of range for list of 9' }));
  assert.equal(a.message_hash, b.message_hash, 'numbers do not split a group');
  assert.match(a.message_hash, /^[0-9a-f]{32}$/);
  const elsewhere = normalizeError(good({ message: 'Index 7 out of range for list of 5', stack: '#0 Other.place (package:mockmob/z.dart:1:1)' }));
  assert.notEqual(a.message_hash, elsewhere.message_hash, 'a different first frame is a different error');
  const otherKind = normalizeError(good({ kind: 'zone', message: 'Index 7 out of range for list of 5' }));
  assert.notEqual(a.message_hash, otherKind.message_hash);
  const lineMove = normalizeError(good({ message: 'Index 7 out of range for list of 5', stack: '#0 Foo.bar (package:mockmob/a.dart:99:7)' }));
  assert.equal(a.message_hash, lineMove.message_hash, 'a moved line number is the same error');
  assert.equal(messageHash({ kind: 'flutter', message: 'm', stack: '' }), messageHash({ kind: 'flutter', message: 'M ', stack: null }));
});

test('normalizeBatch drops bad items, merges one hash into one row and bounds the batch', () => {
  const out = normalizeBatch([good(), good({ count: 4 }), null, { message: '' }, good({ message: 'Another failure' })]);
  assert.equal(out.rows.length, 2);
  assert.equal(out.dropped, 2);
  assert.equal(out.rows.find((r) => r.message.startsWith('Null')).count, 5);
  assert.ok(normalizeBatch('x').error);
  assert.ok(normalizeBatch([]).error);
  assert.ok(normalizeBatch(Array.from({ length: MAX_BATCH + 1 }, () => good())).error);
  assert.equal(normalizeBatch(Array.from({ length: MAX_BATCH }, (_, i) => good({ message: `m${'z'.repeat(i)}` }))).rows.length, MAX_BATCH);
});

test('consent follows the usage-data rule (D183: 18 or older and Rather not say, never under 18)', () => {
  assert.equal(canCollectErrors({ analytics_allowed: true, age_band: 'adult', withdrawn_at: null }), true);
  // "Rather not say" is the unknown band with usage data on.
  assert.equal(canCollectErrors({ analytics_allowed: true, age_band: 'unknown', withdrawn_at: null }), true);
  assert.equal(canCollectErrors({ analytics_allowed: true, age_band: 'unknown' }), true);
  for (const row of [
    null, undefined, {},
    { analytics_allowed: false, age_band: 'adult' }, { analytics_allowed: false, age_band: 'unknown' },
    { analytics_allowed: true, age_band: 'minor' }, { analytics_allowed: true, age_band: 'minor', withdrawn_at: null },
    { analytics_allowed: true, age_band: 'adult', withdrawn_at: '2026-10-01' }, { analytics_allowed: true, age_band: 'unknown', withdrawn_at: '2026-10-01' },
    { analytics_allowed: true }, { analytics_allowed: true, age_band: 'teen' }, { analytics_allowed: 'true', age_band: 'adult' },
  ]) {
    assert.equal(canCollectErrors(row), false, JSON.stringify(row));
  }
  assert.equal(appErrorsEnabled({}), true);
  assert.equal(appErrorsEnabled({ APP_ERRORS_ENABLED: 'off' }), false);
});

function fakeDeps(over = {}) {
  const calls = { record: [], consent: 0, auth: 0 };
  const deps = {
    env: {},
    rateLimit: () => ({ allowed: true, headers: {} }),
    authenticate: async () => { calls.auth += 1; return true; },
    loadConsent: async () => { calls.consent += 1; return { consent: { analytics_allowed: true, age_band: 'adult', withdrawn_at: null } }; },
    record: async (rows) => { calls.record.push(rows); return { ok: true }; },
    ...over,
  };
  return { deps, calls };
}
const post = (body, headers = {}) => new Request('https://mockmob.in/api/app/errors', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('handler stores a scrubbed batch for a consenting student and returns counts', async () => {
  const { deps, calls } = fakeDeps();
  const res = await handleAppErrorsPost(post({ errors: [good({ message: 'fail asha@example.com' }), good({ message: '' })] }), deps);
  assert.equal(res.status, 202);
  assert.deepEqual(await res.json(), { accepted: 1, dropped: 1, collecting: true });
  assert.equal(calls.record.length, 1);
  assert.ok(!JSON.stringify(calls.record).includes('asha@example.com'));
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('handler stores a batch for a student who chose Rather not say with usage data on', async () => {
  const { deps, calls } = fakeDeps({ loadConsent: async () => ({ consent: { analytics_allowed: true, age_band: 'unknown', withdrawn_at: null } }) });
  const res = await handleAppErrorsPost(post({ errors: [good()] }), deps);
  assert.equal(res.status, 202);
  assert.deepEqual(await res.json(), { accepted: 1, dropped: 0, collecting: true });
  assert.equal(calls.record.length, 1);
});

test('handler stores nothing without consent, and never reaches the store', async () => {
  for (const consent of [null, { analytics_allowed: false, age_band: 'adult' }, { analytics_allowed: false, age_band: 'unknown' }, { analytics_allowed: true, age_band: 'minor' }, { analytics_allowed: true, age_band: 'adult', withdrawn_at: 'x' }, { analytics_allowed: true, age_band: 'unknown', withdrawn_at: 'x' }]) {
    const { deps, calls } = fakeDeps({ loadConsent: async () => ({ consent }) });
    const res = await handleAppErrorsPost(post({ errors: [good()] }), deps);
    assert.equal(res.status, 202);
    assert.equal((await res.json()).collecting, false);
    assert.equal(calls.record.length, 0);
  }
  const { deps } = fakeDeps({ loadConsent: async () => ({ error: true }) });
  assert.equal((await handleAppErrorsPost(post({ errors: [good()] }), deps)).status, 503);
});

test('handler refuses what it should: kill switch, rate limit, signed out, size, shape', async () => {
  const off = fakeDeps({ env: { APP_ERRORS_ENABLED: 'off' } });
  const offRes = await handleAppErrorsPost(post({ errors: [good()] }), off.deps);
  assert.equal(offRes.status, 202); assert.equal((await offRes.json()).collecting, false); assert.equal(off.calls.auth, 0);

  const limited = fakeDeps({ rateLimit: () => ({ allowed: false, headers: { 'Retry-After': '30' } }) });
  const limRes = await handleAppErrorsPost(post({ errors: [good()] }), limited.deps);
  assert.equal(limRes.status, 429); assert.equal(limRes.headers.get('retry-after'), '30'); assert.equal(limited.calls.auth, 0);

  const out = fakeDeps({ authenticate: async () => false });
  assert.equal((await handleAppErrorsPost(post({ errors: [good()] }), out.deps)).status, 401);
  assert.equal(out.calls.record.length, 0);

  const { deps } = fakeDeps();
  assert.equal((await handleAppErrorsPost(post({ errors: [good()] }, { 'content-length': String(MAX_BODY_BYTES + 1) }), deps)).status, 413);
  assert.equal((await handleAppErrorsPost(post(JSON.stringify({ errors: [good({ stack: 'x'.repeat(MAX_BODY_BYTES) })] })), deps)).status, 413);
  for (const body of ['not json', '[]', '"x"', 'null', '{}', '{"errors":"x"}', '{"errors":[]}', JSON.stringify({ errors: Array.from({ length: MAX_BATCH + 1 }, () => good()) })]) {
    assert.equal((await handleAppErrorsPost(post(body), deps)).status, 400, body);
  }
});

test('handler reports an unset-up table as not collecting and a failing store as 503', async () => {
  const { deps } = fakeDeps({ record: async () => ({ ok: false, notSetUp: true }) });
  const res = await handleAppErrorsPost(post({ errors: [good()] }), deps);
  assert.equal(res.status, 202); assert.equal((await res.json()).accepted, 0);
  const failing = fakeDeps({ record: async () => ({ ok: false, notSetUp: false }) });
  assert.equal((await handleAppErrorsPost(post({ errors: [good()] }), failing.deps)).status, 503);
});

test('the route wires the handler to the real auth, consent and store, and keeps no identity', () => {
  const route = read('../../src/app/api/app/errors/route.js');
  assert.match(route, /handleAppErrorsPost/);
  assert.match(route, /auth\(req\)/);
  assert.match(route, /loadConsentFor\(userId\)/);
  assert.match(route, /checkRateLimit/);
  assert.ok(!/checkPersistentRateLimit/.test(route), 'the persistent limiter would write a hashed IP to the database');
  const lib = read('../../src/lib/server/appErrors.js') + read('../../src/lib/server/appErrorsStore.js');
  assert.ok(!/getClientIp|x-forwarded-for|user-agent|user_agent/i.test(lib), 'no IP or user agent is read');
});

async function freshDb() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  const sql = read('../../supabase/migrations/20261016100000_app_errors.sql');
  await db.exec(sql); await db.exec(sql);
  return db;
}
const rowsOf = (...items) => JSON.stringify(items.map((i) => normalizeError(good(i))));

test('migration: one row per day and hash, repeats count, no identity columns', async () => {
  const db = await freshDb();
  try {
    const cols = (await db.query("select column_name from information_schema.columns where table_name='app_errors' order by ordinal_position")).rows.map((r) => r.column_name);
    assert.deepEqual(cols, ['id', 'day', 'at', 'last_at', 'app_version', 'build', 'platform', 'os_version', 'device_class', 'kind', 'message_hash', 'message', 'stack', 'screen', 'count']);
    assert.ok(!cols.some((c) => /user|ip|agent|device_id|email|session/.test(c)));
    assert.equal((await db.query('select app_error_record($1::jsonb) n', [rowsOf({}, { message: 'Other thing' })])).rows[0].n, 2);
    const first = (await db.query('select at, last_at from app_errors order by id limit 1')).rows[0];
    await new Promise((r) => setTimeout(r, 20));
    await db.query('select app_error_record($1::jsonb)', [rowsOf({ count: 3, app_version: '1.0.1' })]);
    const all = (await db.query('select * from app_errors order by id')).rows;
    assert.equal(all.length, 2, 'the repeat added no row');
    assert.equal(all[0].count, 4);
    assert.equal(all[0].app_version, '1.0.1');
    assert.equal(all[0].at.getTime(), first.at.getTime(), 'first seen does not move');
    assert.ok(all[0].last_at.getTime() > first.last_at.getTime(), 'last seen moves');
    assert.equal(all[0].day.toISOString().slice(0, 10), new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10), 'the India day, taken by the database');
    // Bad input is harmless.
    assert.equal((await db.query('select app_error_record(null) n')).rows[0].n, 0);
    assert.equal((await db.query("select app_error_record('{}'::jsonb) n")).rows[0].n, 0);
    // Constraints hold even if a caller skips the route.
    await assert.rejects(db.query("insert into app_errors(platform, kind, message_hash, message) values ('toaster','flutter',repeat('a',32),'m')"), /check/);
    await assert.rejects(db.query("insert into app_errors(platform, kind, message_hash, message) values ('android','flutter','short','m')"), /check/);
    await assert.rejects(db.query("insert into app_errors(platform, kind, message_hash, message) values ('android','flutter',repeat('b',32),repeat('x',501))"), /check/);
    await assert.rejects(db.query("insert into app_errors(platform, kind, message_hash, message, stack) values ('android','flutter',repeat('c',32),'m',repeat('x',4097))"), /check/);
  } finally { await db.close(); }
});

test('migration: concurrent repeats all land, the daily cap holds, old rows go, top errors have denominators', async () => {
  const db = await freshDb();
  try {
    await Promise.all(Array.from({ length: 20 }, () => db.query('select app_error_record($1::jsonb)', [rowsOf({})])));
    const one = (await db.query('select count(*)::int n, sum(count)::int c from app_errors')).rows[0];
    assert.equal(one.c, 20);
    assert.equal(one.n, 1);

    // Cap: 2000 distinct errors a day, then only repeats of stored ones count.
    await db.exec("insert into app_errors(platform, kind, message_hash, message) select 'android','flutter', md5(g::text), 'filler '||g from generate_series(1, 1998) g");
    assert.equal((await db.query('select app_error_record($1::jsonb) n', [rowsOf({ message: 'brand new one' })])).rows[0].n, 1);
    assert.equal((await db.query('select count(*)::int n from app_errors')).rows[0].n, 2000, 'filled to 2000');
    assert.equal((await db.query('select app_error_record($1::jsonb) n', [rowsOf({ message: 'one too many' })])).rows[0].n, 0);
    assert.equal((await db.query('select count(*)::int n from app_errors')).rows[0].n, 2000);
    assert.equal((await db.query('select app_error_record($1::jsonb) n', [rowsOf({ message: 'brand new one' })])).rows[0].n, 1, 'a repeat still counts at the cap');

    // Retention and the top view.
    await db.exec("delete from app_errors where message like 'filler%' or message like 'brand new%' or message like 'Null%'");
    await db.exec("insert into app_errors(day, platform, kind, message_hash, message, count, at, last_at) values ((now() at time zone 'Asia/Kolkata')::date - 40, 'ios','zone', repeat('d',32), 'forty days old', 1, now() - interval '40 days', now() - interval '40 days')");
    await db.exec("insert into app_errors(day, platform, kind, message_hash, message, count, at, last_at) values ((now() at time zone 'Asia/Kolkata')::date - 3, 'ios','zone', repeat('e',32), 'older error', 5, now() - interval '3 days', now() - interval '2 days'), ((now() at time zone 'Asia/Kolkata')::date - 2, 'ios','zone', repeat('e',32), 'older error', 2, now() - interval '2 days', now() - interval '1 day'), ((now() at time zone 'Asia/Kolkata')::date - 9, 'ios','zone', repeat('f',32), 'outside the window', 50, now() - interval '9 days', now() - interval '9 days')");
    // The first write of a new day deletes rows older than 30 days.
    await db.query('select app_error_record($1::jsonb)', [rowsOf({ message: 'today error', count: 4 })]);
    assert.equal((await db.query("select count(*)::int n from app_errors where message = 'forty days old'")).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::int n from app_errors where message = 'outside the window'")).rows[0].n, 1, 'inside the 30 day retention, outside the 7 day view');
    const top = (await db.query('select * from app_errors_top(7, 50)')).rows;
    assert.deepEqual(top.map((r) => r.message), ['older error', 'today error']);
    assert.equal(Number(top[0].total), 7);
    assert.equal(Number(top[0].window_total), 11);
    assert.equal(Number(top[0].distinct_errors), 2);
    assert.ok(top[0].first_seen.getTime() < top[0].last_seen.getTime());
    const summary = summariseTopErrors(top);
    assert.equal(summary.windowTotal, 11); assert.equal(summary.distinct, 2); assert.equal(summary.hidden, 0);
    assert.deepEqual(summary.errors[0].share, { numerator: 7, denominator: 11 });
    const one1 = (await db.query('select * from app_errors_top(7, 1)')).rows;
    assert.equal(one1.length, 1);
    assert.equal(summariseTopErrors(one1).hidden, 1);
  } finally { await db.close(); }
});

test('migration: browser roles cannot touch the table or the functions; the service role can', async () => {
  const db = await freshDb();
  try {
    await db.exec('grant usage on schema public to anon, authenticated, service_role');
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from app_errors'), /permission denied/);
      await assert.rejects(db.query("select app_error_record('[]'::jsonb)"), /permission denied/);
      await assert.rejects(db.query('select * from app_errors_top()'), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    await db.query("select app_error_record('[]'::jsonb)");
    await db.query('select * from app_errors_top()');
    await db.query('select * from app_errors');
    await db.exec('reset role');
    assert.equal((await db.query("select relrowsecurity from pg_class where relname = 'app_errors'")).rows[0].relrowsecurity, true);
  } finally { await db.close(); }
});

test('the undo drops everything the migration made, and only that', async () => {
  const db = await freshDb();
  try {
    await db.exec(read('../../supabase/undo/20261016100000_app_errors.undo.sql'));
    assert.equal((await db.query("select count(*)::int n from pg_class where relname = 'app_errors'")).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::int n from pg_proc where proname in ('app_error_record','app_errors_top')")).rows[0].n, 0);
    await db.exec(read('../../supabase/undo/20261016100000_app_errors.undo.sql'));
  } finally { await db.close(); }
});

test('the admin page is admin only, and the dashboard links to it', () => {
  const page = read('../../src/app/admin/app-errors/page.jsx');
  assert.match(page, /requireAdmin\(\)/);
  assert.match(page, /redirect\(/);
  assert.match(read('../../src/app/admin/AdminDashboardClient.jsx'), /href="\/admin\/app-errors"/);
  const view = read('../../src/components/admin/AppErrorsSummary.jsx');
  assert.ok(!/[—·]/.test(view), 'plain copy: no em dash or middle dot');
  assert.ok(!/!(?!=)/.test(view.replace(/\{[^}]*\}/g, '')), 'plain copy: no exclamation mark in the text');
});
