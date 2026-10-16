// Security follow-ups from the 16 Oct 2026 review (branch fix/security-2-1016):
//  (a) browser roles lose every grant they do not need (migration run for real on an in-process Postgres),
//  (b) moderation routes compare INTERNAL_API_SECRET in constant time,
//  (c) heavy free recovery routes use the persistent limiter with an in-memory fallback,
//  (d) the legacy /api/billing/webhook grant path answers 410,
//  (e) a webhook event is claimed with an in-flight lease.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { sameSecret, hasInternalSecret } from '../../src/lib/server/secretCompare.js';
import { takeFromMemory, takePersistent } from '../../src/lib/server/rateLimitCore.js';
import { claimWebhookEventWith, isMissingLeaseColumn, reclaimFilter, LEASE_MS } from '../../src/lib/server/webhookClaim.js';
import {
  loadBilling, resetWorld, signedWebhook, webhookEvent, subscriptionEntity, paymentEntity, TEST_ENV,
} from './billing_harness.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const req = (headers = {}) => new Request('http://localhost/x', { method: 'POST', headers });

// ------------------------------------------------------------------ (b) constant-time secret compare

test('sameSecret: equal secrets match; empty, missing, shorter, longer and different secrets do not', () => {
  assert.equal(sameSecret('abc123', 'abc123'), true);
  assert.equal(sameSecret('abc123', 'abc124'), false);
  assert.equal(sameSecret('abc12', 'abc123'), false);
  assert.equal(sameSecret('abc1234', 'abc123'), false);
  assert.equal(sameSecret('', ''), false, 'an empty secret never matches, so an unset route stays closed');
  assert.equal(sameSecret(null, undefined), false);
  assert.equal(sameSecret(undefined, 'abc123'), false);
  assert.equal(sameSecret('ünï', 'ünï'), true, 'multi-byte secrets compare as bytes without throwing');
  assert.equal(sameSecret('ünï', 'uni'), false);
});

test('hasInternalSecret reads x-internal-secret and is closed when INTERNAL_API_SECRET is unset', () => {
  const was = process.env.INTERNAL_API_SECRET;
  try {
    process.env.INTERNAL_API_SECRET = 'internal-test-secret';
    assert.equal(hasInternalSecret(req({ 'x-internal-secret': 'internal-test-secret' })), true);
    assert.equal(hasInternalSecret(req({ 'x-internal-secret': 'internal-test-secreT' })), false);
    assert.equal(hasInternalSecret(req({ 'x-internal-secret': 'x' })), false);
    assert.equal(hasInternalSecret(req({})), false);
    delete process.env.INTERNAL_API_SECRET;
    assert.equal(hasInternalSecret(req({ 'x-internal-secret': '' })), false);
    assert.equal(hasInternalSecret(req({ 'x-internal-secret': 'undefined' })), false);
  } finally {
    if (was === undefined) delete process.env.INTERNAL_API_SECRET; else process.env.INTERNAL_API_SECRET = was;
  }
});

test('moderation routes and the cron routes use the shared helper, and no route compares the secret with !== or ===', () => {
  for (const path of ['src/app/api/internal/moderation/process/route.js', 'src/app/api/internal/moderation/recover/route.js']) {
    const src = read(path);
    assert.match(src, /hasInternalSecret/, `${path} uses hasInternalSecret`);
    assert.doesNotMatch(src, /INTERNAL_API_SECRET\s*[!=]==|[!=]==\s*process\.env\.INTERNAL_API_SECRET/, `${path} has no plain comparison`);
  }
  for (const path of ['src/app/api/internal/refresh-inventory/route.js', 'src/app/api/internal/rebuild-nta-index/route.js', 'src/app/api/internal/finalise-sessions/route.js']) {
    const src = read(path);
    assert.match(src, /from '@\/lib\/server\/secretCompare'/, `${path} uses the shared helper`);
    assert.doesNotMatch(src, /from 'node:crypto'/, `${path} no longer carries its own copy`);
  }
});

// ------------------------------------------------------------------ (c) persistent limiter with a safe fallback

test('takeFromMemory counts per key, blocks at the limit, and opens again after the window', () => {
  const buckets = new Map();
  const t0 = 1_000_000;
  const hit = (key, now) => takeFromMemory(buckets, key, { limit: 3, windowMs: 60_000 }, now);
  assert.equal(hit('a', t0).allowed, true);
  assert.equal(hit('a', t0 + 1).allowed, true);
  const third = hit('a', t0 + 2);
  assert.equal(third.allowed, true);
  assert.equal(third.remaining, 0);
  const fourth = hit('a', t0 + 3);
  assert.equal(fourth.allowed, false);
  assert.ok(fourth.retryAfterSeconds >= 1 && fourth.retryAfterSeconds <= 60);
  assert.equal(hit('b', t0 + 3).allowed, true, 'another key has its own count');
  assert.equal(hit('a', t0 + 60_001).allowed, true, 'the window ended');
});

test('takePersistent: the database answer wins, and a real "no" never falls back', async () => {
  const fallback = () => ({ allowed: true, via: 'memory' });
  assert.equal((await takePersistent({ take: async () => ({ data: true, error: null }), limit: 5, fallback })).allowed, true);
  const no = await takePersistent({ take: async () => ({ data: false, error: null }), limit: 5, fallback });
  assert.equal(no.allowed, false);
  assert.equal(no.via, undefined, 'a limit hit is not retried against memory');
});

test('takePersistent: when the database cannot answer, a fallback keeps the in-memory limit and no fallback fails closed', async () => {
  const failures = [
    async () => ({ data: null, error: { message: 'boom' } }),
    async () => { throw new Error('network'); },
    async () => ({ data: null, error: null }),
    async () => ({ data: 'yes', error: null }),
  ];
  for (const take of failures) {
    let noted = 0;
    const kept = await takePersistent({ take, limit: 5, fallback: () => ({ allowed: true, via: 'memory' }), onFallback: () => { noted += 1; } });
    assert.deepEqual([kept.allowed, kept.via, noted], [true, 'memory', 1]);
    const blocked = await takePersistent({ take, limit: 5 });
    assert.equal(blocked.allowed, false, 'without a fallback the call is refused');
    const memoryNo = await takePersistent({ take, limit: 5, fallback: () => ({ allowed: false, via: 'memory' }) });
    assert.equal(memoryNo.allowed, false, 'the in-memory limit can still say no');
  }
});

test('the heavy free recovery routes use the persistent limiter with the in-memory fallback', () => {
  const routes = [
    ['src/app/api/recovery/route.js', 2],
    ['src/app/api/recovery/check/route.js', 2],
    ['src/app/api/recovery/ask-context/route.js', 1],
    ['src/app/api/recovery/repair/route.js', 1],
    ['src/app/api/recovery/replay/route.js', 1],
    ['src/app/api/me/playbook/route.js', 1],
  ];
  for (const [path, calls] of routes) {
    const src = read(path);
    assert.doesNotMatch(src, /\bcheckRateLimit\b/, `${path} no longer uses the per-instance limiter directly`);
    const used = src.match(/await checkPersistentRateLimit\(/g) || [];
    assert.equal(used.length, calls, `${path} awaits the persistent limiter ${calls} time(s)`);
    assert.equal((src.match(/fallback:\s*'memory'/g) || []).length, calls, `${path} keeps the in-memory fallback`);
  }
});

test('rateLimit.js wires the persistent limiter to take_rate_limit and keeps a memory fallback only when asked', () => {
  const src = read('src/lib/server/rateLimit.js');
  assert.match(src, /take_rate_limit/);
  assert.match(src, /options\.fallback === 'memory'/);
  assert.match(src, /PERSISTENT_LIMITS_ENABLED/);
});

// ------------------------------------------------------------------ (d) legacy billing webhook

let b;
let db;
beforeEach(async () => {
  b = await loadBilling();
  db = resetWorld();
  b.rz.invoices.clear(); b.rz.subscriptions.clear(); b.rz.payments.clear(); b.rz.calls.length = 0;
  db.clock = () => Date.now();
  process.env.RAZORPAY_WEBHOOK_SECRET = TEST_ENV.RAZORPAY_WEBHOOK_SECRET;
  process.env.RAZORPAY_PLAN_ID_PRO_MONTHLY_99 = TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99;
});

test('the legacy /api/billing/webhook answers 410 whatever secret is sent, grants nothing and is documented', async () => {
  const was = process.env.BILLING_WEBHOOK_SECRET;
  const warn = console.warn;
  const lines = [];
  console.warn = (...a) => lines.push(a.join(' '));
  try {
    db.addUser('u1');
    for (const secret of [undefined, 'something']) {
      if (secret === undefined) delete process.env.BILLING_WEBHOOK_SECRET; else process.env.BILLING_WEBHOOK_SECRET = secret;
      const response = await b.legacyWebhook.POST(new Request('http://localhost/api/billing/webhook', {
        method: 'POST',
        headers: { 'x-mockmob-signature': secret || '', 'content-type': 'application/json' },
        body: JSON.stringify({ event: 'subscription.active', userId: 'u1' }),
      }));
      assert.equal(response.status, 410);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.match((await response.json()).error, /retired/);
    }
    assert.equal(db.user('u1').isPremium, false, 'nothing was granted');
    assert.ok(lines.some((l) => l.includes('[api/billing/webhook] 410')), 'a clear log line is written');
  } finally {
    console.warn = warn;
    if (was === undefined) delete process.env.BILLING_WEBHOOK_SECRET; else process.env.BILLING_WEBHOOK_SECRET = was;
  }
  const src = read('src/app/api/billing/webhook/route.js');
  const code = src.split(/\r?\n/).filter((line) => !line.trim().startsWith('//')).join(' ');
  assert.doesNotMatch(code, /supabaseAdmin|is_premium|subscription_status|timingSafeEqual|\.update\(/, 'the grant code is gone');
  assert.match(src, /RETIRED/);
  assert.doesNotMatch(read('src/app/api/billing/webhook/route.js'), /export async function (GET|PUT|PATCH|DELETE)/);
});

test('nothing in the repository calls the legacy webhook or reads its secret', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSyncSafe(dir)) {
      const full = `${dir}/${entry}`;
      if (/node_modules|\.next|\.git$/.test(full)) continue;
      if (/\.(js|jsx|mjs|ts|tsx|json)$/.test(entry) && !/security_followups_1016\.test\.mjs$/.test(entry)) {
        const text = readFileSync(new URL(`../../${full}`, import.meta.url), 'utf8');
        if (/BILLING_WEBHOOK_SECRET|x-mockmob-signature|api\/billing\/webhook/.test(text) && full !== 'src/app/api/billing/webhook/route.js') offenders.push(full);
      } else if (!entry.includes('.')) walk(full);
    }
  };
  walk('src');
  walk('scripts');
  assert.deepEqual(offenders, [], 'no caller or env read outside the retired route itself');
});

import { readdirSync } from 'node:fs';
function readdirSyncSafe(dir) {
  try { return readdirSync(new URL(`../../${dir}`, import.meta.url)); } catch { return []; }
}

// ------------------------------------------------------------------ (e) webhook claim lease

const NOW = Date.UTC(2026, 9, 16, 12, 0, 0);

/** An in-memory webhook_events table with the same atomic conditional update the real claim relies on. */
function memoryStore() {
  const rows = new Map();
  const calls = { legacy: 0, reclaim: 0 };
  const evaluate = (row, filter) => {
    const cutoff = filter.split('claimed_at.lt.')[1].split(')')[0];
    return row.error_message != null || (row.processed_at == null && (row.claimed_at == null || row.claimed_at < cutoff));
  };
  return {
    rows,
    calls,
    insert: async (r) => {
      if (rows.has(r.event_id)) return { error: { code: '23505' } };
      rows.set(r.event_id, { processed_at: null, error_message: null, ...r });
      return { error: null };
    },
    read: async (id) => ({ data: rows.get(id) || null, error: null }),
    reclaim: async (id, patch, filter) => {
      calls.reclaim += 1;
      const row = rows.get(id);
      if (!row || !evaluate(row, filter)) return { data: [], error: null };
      Object.assign(row, patch);
      return { data: [{ event_id: id }], error: null };
    },
    legacy: async () => { calls.legacy += 1; return 'legacy'; },
  };
}
const claim = (store, id, now = NOW) => claimWebhookEventWith(store, { eventId: id, eventType: 'payment.captured', payload: { n: 1 } }, { now });

test('first delivery owns the event; a duplicate during the lease is in_flight; after it finishes the duplicate is false', async () => {
  const store = memoryStore();
  assert.equal(await claim(store, 'evt1'), true);
  assert.equal(await claim(store, 'evt1', NOW + 5_000), 'in_flight');
  assert.equal(await claim(store, 'evt1', NOW + LEASE_MS - 1), 'in_flight');
  store.rows.get('evt1').processed_at = new Date(NOW + 6_000).toISOString();
  assert.equal(await claim(store, 'evt1', NOW + 7_000), false, 'already processed');
  assert.equal(await claim(store, 'evt1', NOW + 10 * LEASE_MS), false, 'still processed long after the lease');
});

test('a crashed first delivery is taken over once the lease has run out, and only one retry wins', async () => {
  const store = memoryStore();
  assert.equal(await claim(store, 'evt2'), true);
  const later = NOW + LEASE_MS + 1_000;
  const [x, y] = await Promise.all([claim(store, 'evt2', later), claim(store, 'evt2', later)]);
  assert.deepEqual([x, y].filter((v) => v === true).length + [x, y].filter((v) => v === 'in_flight').length, 2);
  assert.deepEqual([x, y].map(String).sort(), ['in_flight', 'true'], 'exactly one retry takes the event over');
  assert.equal(store.rows.get('evt2').claimed_at, new Date(later).toISOString(), 'the lease restarts for the new owner');
});

test('a failed event, or one processed with a note, is taken again at once (it can match later)', async () => {
  const store = memoryStore();
  await claim(store, 'evt3');
  Object.assign(store.rows.get('evt3'), { processed_at: null, error_message: 'boom' });
  assert.equal(await claim(store, 'evt3', NOW + 1_000), true, 'failed: retried immediately');
  assert.equal(store.rows.get('evt3').error_message, null);
  Object.assign(store.rows.get('evt3'), { processed_at: 'x', error_message: 'no matching payment record' });
  assert.equal(await claim(store, 'evt3', NOW + 2_000), true, 'noted: reprocessed, as before the lease existed');
  assert.equal(store.rows.get('evt3').processed_at, null);
});

test('rows written before the lease (claimed_at null) count as expired', async () => {
  const store = memoryStore();
  store.rows.set('old', { event_id: 'old', processed_at: null, error_message: null, claimed_at: null });
  assert.equal(await claim(store, 'old'), true);
});

test('a schema without claimed_at falls back to the old claim, and a missing table never blocks a payment', async () => {
  const noColumn = memoryStore();
  noColumn.insert = async () => ({ error: { code: '42703', message: 'column "claimed_at" of relation "webhook_events" does not exist' } });
  assert.equal(await claim(noColumn, 'evt4'), 'legacy');
  const postgrest = memoryStore();
  postgrest.insert = async () => ({ error: { code: 'PGRST204', message: "Could not find the 'claimed_at' column of 'webhook_events' in the schema cache" } });
  assert.equal(await claim(postgrest, 'evt4'), 'legacy');
  const dupNoColumn = memoryStore();
  dupNoColumn.rows.set('evt5', { processed_at: null });
  dupNoColumn.reclaim = async () => ({ data: null, error: { code: '42703', message: 'column webhook_events.claimed_at does not exist' } });
  assert.equal(await claim(dupNoColumn, 'evt5'), 'legacy');
  const noTable = memoryStore();
  noTable.insert = async () => ({ error: { code: '42P01', message: 'relation does not exist' } });
  assert.equal(await claim(noTable, 'evt6'), true);
  const broken = memoryStore();
  broken.insert = async () => ({ error: { code: '57014', message: 'timeout' } });
  await assert.rejects(claim(broken, 'evt7'), (e) => e.code === '57014');
  await assert.rejects(claim(memoryStore(), ''), /eventId required/);
  assert.equal(isMissingLeaseColumn({ code: '42703' }), true);
  assert.equal(isMissingLeaseColumn({ code: '23505', message: 'duplicate key' }), false);
  assert.equal(isMissingLeaseColumn(null), false);
});

test('reclaimFilter is the PostgREST or() expression for "noted, failed, or unprocessed with no live lease"', () => {
  const cutoff = '2026-10-16T11:58:00.000Z';
  assert.equal(
    reclaimFilter(cutoff),
    'error_message.not.is.null,and(processed_at.is.null,or(claimed_at.is.null,claimed_at.lt.2026-10-16T11:58:00.000Z))',
  );
});

async function fire(parts, opts) {
  const { request, id } = signedWebhook(webhookEvent('subscription.charged', parts), opts);
  const response = await b.webhook.POST(request);
  return { status: response.status, json: await response.json(), id, headers: response.headers };
}

function seedMonthly() {
  db.addUser('u1');
  db.addPayment({
    userId: 'u1', subscriptionId: 'sub_m1', planId: 'pro_monthly_99', razorpayPlanId: TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99, amount: 9900,
    status: 'created', paymentId: null, amountPaid: null, accessUntil: null,
  });
}

test('route: a duplicate delivery during processing gets 503 and is not processed; the retry after completion is a plain duplicate', async () => {
  seedMonthly();
  const parts = { subscription: subscriptionEntity(), payment: paymentEntity() };
  const first = signedWebhook(webhookEvent('subscription.charged', parts), { id: 'evt_dup_1' });
  const second = signedWebhook(webhookEvent('subscription.charged', parts), { id: 'evt_dup_1' });
  const [a, c] = await Promise.all([b.webhook.POST(first.request), b.webhook.POST(second.request)]);
  const results = [a, c].map((r) => r.status).sort();
  assert.deepEqual(results, [200, 503], 'one runs, the other is asked to come back');
  const busy = [a, c].find((r) => r.status === 503);
  assert.equal(busy.headers.get('retry-after'), '30');
  assert.deepEqual(await busy.json(), { ok: false, retry: true });
  const grants = b.rz.calls.filter(([name]) => name === 'invoices.fetch').length;
  assert.equal(grants, 1, 'the work ran once');

  const retry = signedWebhook(webhookEvent('subscription.charged', parts), { id: 'evt_dup_1' });
  const done = await b.webhook.POST(retry.request);
  assert.equal(done.status, 200);
  assert.deepEqual(await done.json(), { ok: true, deduped: true });
});

test('route: an event whose first delivery crashed is processed by the retry once the lease has run out', async () => {
  seedMonthly();
  const parts = { subscription: subscriptionEntity(), payment: paymentEntity() };
  // The first delivery claimed the event and died: row unprocessed, no error, claimed a moment ago.
  db._events.set('evt_crash', { eventId: 'evt_crash', eventType: 'subscription.charged', payload: {}, processed_at: null, error_message: null, claimed_at: new Date().toISOString() });
  const during = await fire(parts, { id: 'evt_crash' });
  assert.equal(during.status, 503);
  db.clock = () => Date.now() + LEASE_MS + 5_000;
  const after = await fire(parts, { id: 'evt_crash' });
  assert.equal(after.status, 200);
  assert.notEqual(after.json.deduped, true, 'it was processed, not skipped');
  assert.ok(db._events.get('evt_crash').processed_at, 'and marked done');
});

test('route: a failed delivery (500) is retried at once, not held by the lease', async () => {
  seedMonthly();
  const parts = { subscription: subscriptionEntity(), payment: paymentEntity() };
  b.rz.failNextInvoiceFetch = true;
  const failed = await fire(parts, { id: 'evt_fail_1' });
  assert.equal(failed.status, 500);
  const retry = await fire(parts, { id: 'evt_fail_1' });
  assert.equal(retry.status, 200, 'the failure cleared the way for the retry');
});

// ------------------------------------------------------------------ (a) browser roles, run for real

const PUBLIC_FUNCTIONS = [
  'apply_question_vote(text, text, question_vote_type)',
  'apply_question_vote(uuid, uuid, text)',
  'claim_moderation_job(text)',
  'count_distinct_mock_sessions(text, timestamptz)',
  'create_pending_payout(text, text)',
  'enforce_admin_role()',
  'link_user_to_creator()',
  'recover_stale_moderation_jobs(integer)',
  'set_updated_at()',
  'sync_question_scores_metadata()',
];

/** A public schema shaped like production: Supabase default grants, RLS on, policies on chapters, units and payments only. */
async function productionShapedDatabase() {
  const pg = new PGlite();
  await pg.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create type question_vote_type as enum ('up','down');
  `);
  const noPolicy = ['users', 'attempts', 'ai_credit_wallets', 'mentor_messages', 'moderation_jobs', 'question_scores', 'webhook_events', 'study_runs'];
  const withPolicy = ['chapters', 'units', 'payments'];
  const defaultGrantTables = new Set(['users', 'attempts', 'ai_credit_wallets', 'mentor_messages', 'moderation_jobs', 'question_scores', 'chapters', 'units']);
  for (const t of [...noPolicy, ...withPolicy]) {
    await pg.exec(`create table public.${t} (id text primary key); alter table public.${t} enable row level security;`);
    await pg.exec(`grant all on public.${t} to service_role;`);
    if (defaultGrantTables.has(t)) await pg.exec(`grant all on public.${t} to anon, authenticated;`);
  }
  await pg.exec(`
    create policy "read all" on public.chapters for select to anon, authenticated using (true);
    create policy "read all" on public.units for select to anon, authenticated using (true);
    create policy "Users can read their own payments" on public.payments for select to authenticated using (true);
    grant select on public.payments to authenticated;
  `);
  for (const sig of PUBLIC_FUNCTIONS) {
    const name = sig.slice(0, sig.indexOf('('));
    const args = sig.slice(sig.indexOf('(') + 1, -1);
    const params = args ? args.split(',').map((a, i) => `p${i} ${a.trim()}`).join(', ') : '';
    const returns = name.startsWith('enforce') || name.startsWith('link') || name.startsWith('set_') || name.startsWith('sync') ? 'trigger' : 'int';
    const body = returns === 'trigger' ? 'begin return new; end' : 'begin return 1; end';
    await pg.exec(`create function public.${name}(${params}) returns ${returns} language plpgsql as $f$ ${body} $f$;`);
  }
  return pg;
}

const tablePriv = async (pg, role, table, priv) => (await pg.query(`select has_table_privilege('${role}','public.${table}','${priv}') as ok`)).rows[0].ok;
const fnPriv = async (pg, role, sig) => (await pg.query(`select has_function_privilege('${role}','public.${sig}','execute') as ok`)).rows[0].ok;

test('migration 20261016170000 closes the browser roles on every table without a policy and every public function, and keeps the server roles', async () => {
  const pg = await productionShapedDatabase();
  const migration = read('supabase/migrations/20261016170000_browser_roles_least_privilege.sql');
  // before: the weakness exists
  assert.equal(await tablePriv(pg, 'anon', 'users', 'select'), true);
  assert.equal(await fnPriv(pg, 'anon', 'claim_moderation_job(text)'), true);

  await pg.exec(migration);
  await pg.exec(migration); // idempotent

  for (const t of ['users', 'attempts', 'ai_credit_wallets', 'mentor_messages', 'moderation_jobs', 'question_scores']) {
    for (const role of ['anon', 'authenticated']) {
      for (const priv of ['select', 'insert', 'update', 'delete', 'truncate']) {
        assert.equal(await tablePriv(pg, role, t, priv), false, `${role} has no ${priv} on ${t}`);
      }
    }
    assert.equal(await tablePriv(pg, 'service_role', t, 'select'), true, `service_role still reads ${t}`);
    assert.equal(await tablePriv(pg, 'service_role', t, 'update'), true, `service_role still writes ${t}`);
  }
  // webhook_events and study_runs never had browser grants: still closed, still server-only
  assert.equal(await tablePriv(pg, 'anon', 'webhook_events', 'select'), false);
  assert.equal(await tablePriv(pg, 'service_role', 'webhook_events', 'insert'), true);

  // the deliberate public read stays, and only the read
  for (const t of ['chapters', 'units']) {
    for (const role of ['anon', 'authenticated']) {
      assert.equal(await tablePriv(pg, role, t, 'select'), true, `${role} still reads ${t}`);
      for (const priv of ['insert', 'update', 'delete', 'truncate']) assert.equal(await tablePriv(pg, role, t, priv), false, `${role} cannot ${priv} ${t}`);
    }
    assert.equal(await tablePriv(pg, 'service_role', t, 'update'), true);
  }
  // payments keeps its own-rows read for signed-in students
  assert.equal(await tablePriv(pg, 'authenticated', 'payments', 'select'), true);
  assert.equal(await tablePriv(pg, 'anon', 'payments', 'select'), false);

  for (const sig of PUBLIC_FUNCTIONS) {
    assert.equal(await fnPriv(pg, 'anon', sig), false, `anon cannot run ${sig}`);
    assert.equal(await fnPriv(pg, 'authenticated', sig), false, `authenticated cannot run ${sig}`);
    assert.equal(await fnPriv(pg, 'service_role', sig), true, `service_role still runs ${sig}`);
  }
  await pg.close();
});

test('the server paths still work after the migration: service_role queries, writes and calls an RPC; anon is refused', async () => {
  const pg = await productionShapedDatabase();
  await pg.exec(read('supabase/migrations/20261016170000_browser_roles_least_privilege.sql'));
  await pg.exec(`set role service_role; insert into public.users (id) values ('u1'); update public.users set id = 'u2' where id = 'u1'; select public.claim_moderation_job('w'); reset role;`);
  assert.equal((await pg.query('select count(*)::int n from public.users')).rows[0].n, 1);
  await assert.rejects(pg.exec(`set role anon; select * from public.users;`), /permission denied/);
  await pg.exec('reset role');
  await assert.rejects(pg.exec(`set role authenticated; select public.claim_moderation_job('w');`), /permission denied/);
  await pg.exec('reset role');
  await pg.exec(`set role anon; select * from public.chapters; reset role;`);
  await pg.close();
});

test('the undo gives the browser roles their grants back', async () => {
  const pg = await productionShapedDatabase();
  await pg.exec(read('supabase/migrations/20261016170000_browser_roles_least_privilege.sql'));
  await pg.exec(read('supabase/undo/20261016170000_browser_roles_least_privilege.undo.sql'));
  for (const t of ['users', 'attempts', 'chapters', 'units']) {
    assert.equal(await tablePriv(pg, 'anon', t, 'select'), true, `${t} select restored`);
    assert.equal(await tablePriv(pg, 'authenticated', t, 'update'), true, `${t} update restored`);
  }
  for (const sig of PUBLIC_FUNCTIONS) {
    assert.equal(await fnPriv(pg, 'anon', sig), true);
    assert.equal(await fnPriv(pg, 'authenticated', sig), true);
  }
  await pg.close();
});

test('migration 20261016170100 adds claimed_at without touching existing rows, twice over, and the undo removes it', async () => {
  const pg = new PGlite();
  await pg.exec(`create table public.webhook_events (event_id text primary key, provider text default 'razorpay', event_type text not null, payload jsonb not null, received_at timestamptz default now(), processed_at timestamptz, error_message text);
    insert into public.webhook_events (event_id, event_type, payload) values ('old', 'payment.captured', '{}');`);
  const up = read('supabase/migrations/20261016170100_webhook_event_lease.sql');
  await pg.exec(up);
  await pg.exec(up);
  const row = (await pg.query(`select claimed_at from public.webhook_events where event_id = 'old'`)).rows[0];
  assert.equal(row.claimed_at, null, 'old rows count as expired');
  // the real filter semantics, in SQL: an unprocessed row with a live lease is not reclaimable, an expired one is
  await pg.exec(`insert into public.webhook_events (event_id, event_type, payload, claimed_at) values ('live', 'x', '{}', now()), ('stale', 'x', '{}', now() - interval '3 minutes')`);
  const reclaimable = (await pg.query(`select event_id from public.webhook_events
    where error_message is not null or (processed_at is null and (claimed_at is null or claimed_at < now() - interval '120 seconds')) order by 1`)).rows.map((r) => r.event_id);
  assert.deepEqual(reclaimable, ['old', 'stale']);
  await pg.exec(read('supabase/undo/20261016170100_webhook_event_lease.undo.sql'));
  const cols = (await pg.query(`select column_name from information_schema.columns where table_name = 'webhook_events'`)).rows.map((r) => r.column_name);
  assert.ok(!cols.includes('claimed_at'));
  await pg.close();
});
