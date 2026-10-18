// One credits balance (owner, 18 Oct 2026, D78). The real migrations run on an in-process Postgres (PGlite): production's
// state is built from the repo's migrations plus the undo file (which holds production's exact bodies), then
// supabase/migrations/20261018210000_one_credits_balance.sql is applied. No network, no paid model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { walletWindow, projectWallet, unifiedFromWallet } from '../../src/services/credits/aiWalletState.js';
import { CREDIT_PACKS, LEGACY_AI_PACKS, findCreditPack } from '../../src/services/credits/creditPacks.mjs';

const file = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const MIGRATION = file('supabase/migrations/20261018210000_one_credits_balance.sql');
const UNDO = file('supabase/undo/20261018210000_one_credits_balance.undo.sql');

// md5(prosrc) and length(prosrc) on production, read-only, 18 Oct 2026.
const PROD = {
  spend_credits: ['911105fda93f7c1dcd687b08dd7c1059', 1666],
  mm_ai_consume_credits: ['c1ce92df1577794e2e49a54d82a0fd42', 4144],
  mm_ai_reserve_credits: ['499b44d19273c8901b11d65f0874e9fc', 4149],
  mm_ai_release_credits: ['9c1d744b969d7e52c74d06e5537110f5', 2211],
  reserve_runtime_ai: ['f6026ff6dde4b329e6f021dae3b51b7a', 2404],
};

const CHAIN = [
  'supabase/migrations/0036_mode_aware_credits.sql',
  'supabase/migrations/20261001105920_score_recovery_foundations.sql',
  'supabase/migrations/20261002120000_connected_learning.sql',
  'supabase/migrations/20261002123000_answer_correction_history.sql',
  'db/migrations/2026_05_02_ai_overlay_credits_fix.sql',
  'supabase/migrations/20261002121000_runtime_ai_guard.sql',
  'supabase/migrations/20261002130000_prepos_credit_reservations.sql',
  'supabase/migrations/20261004120000_runtime_ai_monthly_cap.sql',
  'supabase/migrations/20261005090000_runtime_ai_price_gpt6_luna.sql',
  'supabase/migrations/20261014120000_runtime_ai_price_claude_haiku_5_5.sql',
  'supabase/migrations/20261017120000_runtime_ai_user_cap.sql',
  'supabase/migrations/20261018130000_free_ai_wallet_50.sql',
  'supabase/migrations/20261018170000_practice_credit_per_question.sql',
];

async function database({ migrated = true } = {}) {
  const d = new PGlite();
  await d.exec(`create role anon;create role authenticated;create role service_role;
    create table users(id text primary key,credit_balance int);
    create table questions(id text primary key,subject text,chapter text,body text,options jsonb,correct_answer text,explanation text);
    create table attempts(id text primary key,user_id text,subject text,score int,correct int,wrong int,unattempted int,total int,details jsonb,questions_snapshot jsonb);
    create table user_question_progress(user_id text,question_id text,subject text,chapter text,seen_count int default 0,attempt_count int default 0,correct_count int default 0,skip_count int default 0,last_selected_key text,last_correct boolean,last_seen_at timestamptz);
    create table credit_transactions(user_id text,amount int,type text,reference text primary key,action text,credit_delta int);
    create table question_interactions(user_id text,question_id text);
    create table question_bookmarks(user_id text,question_id text);`);
  for (const rel of CHAIN) await d.exec(file(rel));
  // Production's values: the global ceiling removed (1000000), Free Rs 2.50, Paid Rs 5, fresh prices.
  await d.exec(`update runtime_ai_budget set monthly_cap_usd=1000000 where id='student_ai';
    update runtime_ai_budget set monthly_cap_usd=0.0568 where id='student_user_paid';
    update runtime_ai_prices set verified_at=now();`);
  await d.exec(UNDO); // production's exact bodies
  if (migrated) await d.exec(MIGRATION);
  return d;
}

const q = (d, sql, params) => d.query(sql, params).then((r) => r.rows);
const one = async (d, sql, params) => (await q(d, sql, params))[0];
const W = walletWindow(new Date());
const LAST = walletWindow(new Date(Date.parse(W.periodStart) - 86400000));

async function user(d, id, { balance = 100, used = 0, bonus = 0, period = W, allowance = 50, wallet = true } = {}) {
  await q(d, 'insert into users values($1,$2)', [id, balance]);
  if (wallet) await q(d, 'insert into ai_credit_wallets(user_id,included_monthly_credits,included_credits_used,bonus_credits,period_start,reset_at) values($1,$2,$3,$4,$5,$6)', [id, allowance, used, bonus, period.periodStart, period.resetAt]);
}
const state = (d, id) => one(d, `select u.credit_balance balance, w.included_monthly_credits - w.included_credits_used free, w.bonus_credits bonus, w.period_start
  from users u left join ai_credit_wallets w on w.user_id=u.id where u.id=$1`, [id]).then((r) => ({ free: r.free, bonus: r.bonus, balance: r.balance }));
const spend = (d, id, action, ref) => one(d, 'select public.spend_credits($1,$2,$3) r', [id, action, ref]).then((r) => r.r);
const consume = (d, id, amount, key) => one(d, 'select public.mm_ai_consume_credits($1,$2,$3,$4,$5,$6,$7,$8) r', [id, amount, 'prepos_mentor', key, key, 50, W.periodStart, W.resetAt]).then((r) => r.r);
const reserve = (d, id, amount, key) => one(d, 'select public.mm_ai_reserve_credits($1,$2,$3,$4,$5,$6,$7) r', [id, amount, 'prepos_mentor', key, 50, W.periodStart, W.resetAt]).then((r) => r.r);
const release = (d, key) => one(d, 'select public.mm_ai_release_credits($1,$2) r', [key, 'test']).then((r) => r.r);
const commit = (d, key) => one(d, 'select public.mm_ai_commit_credits($1) r', [key]).then((r) => r.r);
const md5s = (d) => q(d, `select proname, md5(prosrc) m, length(prosrc) l from pg_proc where proname = any($1)`, [Object.keys(PROD)]);

// ---- production baseline and the undo -------------------------------------------------------------------------------
test('the undo file holds production exactly: md5(prosrc) and length of all five functions match production', async () => {
  const d = await database({ migrated: false });
  try {
    const rows = await md5s(d);
    assert.equal(rows.length, 5);
    for (const r of rows) assert.deepEqual([r.m, r.l], PROD[r.proname], r.proname);
    for (const [m] of Object.values(PROD)) assert.ok(MIGRATION.includes(m) && UNDO.includes(m), `${m} is recorded in both headers`);
  } finally { await d.close(); }
});

test('the undo after the migration restores every md5, drops the new functions and keeps the history columns', async () => {
  const d = await database();
  try {
    await user(d, 'u', { balance: 30, used: 50, bonus: 0 });
    assert.equal(await spend(d, 'u', 'attempt_10', 'undo:1'), true); // taken from users.credit_balance
    assert.equal((await reserve(d, 'u', 1, 'undo:open:1')).ok, true);
    await assert.rejects(d.exec(UNDO), /open reservations hold users.credit_balance credits/, 'refuses while a balance-paid reservation is open');
    await release(d, 'undo:open:1');
    await d.exec(UNDO);
    for (const r of await md5s(d)) assert.deepEqual([r.m, r.l], PROD[r.proname], r.proname);
    assert.equal((await one(d, "select count(*)::int n from pg_proc where proname in ('mm_wallet_take','mm_wallet_window','mm_bought_ai_credits_spent','mm_held_ai_credits_spent')")).n, 0);
    assert.equal((await one(d, "select count(*)::int n from runtime_ai_budget where id in ('student_bought_credit','student_held_credit')")).n, 0);
    assert.deepEqual((await one(d, "select parts from credit_transactions where reference='undo:1'")).parts, { included: 0, bonus: 0, balance: 10 });
    // Production behaviour again: practice spends only users.credit_balance.
    await q(d, "update ai_credit_wallets set included_credits_used=0 where user_id='u'");
    assert.equal(await spend(d, 'u', 'attempt_5', 'undo:2'), true);
    assert.deepEqual(await state(d, 'u'), { free: 50, bonus: 0, balance: 15 });
    assert.equal((await reserve(d, 'u', 1, 'undo:after:1')).ok, true, 'the restored reserve still works (from_balance null passes the restored check)');
  } finally { await d.close(); }
});

// ---- the IST month and the allowance ---------------------------------------------------------------------------------
test('mm_wallet_window equals walletWindow() in aiWalletState.js on month edges, and the allowance is 50 in both places', async () => {
  const d = await database();
  try {
    const instants = ['2026-10-18T13:20:00Z', '2026-09-30T18:29:59.999Z', '2026-09-30T18:30:00Z', '2026-12-31T18:30:00Z', '2027-02-28T18:29:59Z', '2027-02-28T18:30:00Z', '2026-01-01T00:00:00Z'];
    for (const at of instants) {
      const js = walletWindow(new Date(at));
      const sql = await one(d, 'select period_start, reset_at from public.mm_wallet_window($1)', [at]);
      assert.equal(sql.period_start.toISOString(), js.periodStart, at);
      assert.equal(sql.reset_at.toISOString(), js.resetAt, at);
    }
    const wallet = file('src/services/credits/aiCreditWallet.js');
    assert.match(wallet, /export const AI_FREE_MONTHLY_CREDITS = 50;/);
    assert.match(wallet, /export const AI_PRO_INCLUDED_MONTHLY_CREDITS = 50;/);
    assert.match(MIGRATION, /mm_wallet_take\(p_user_id, v_amount, v_window\.period_start, v_window\.reset_at, 50\)/);
  } finally { await d.close(); }
});

// ---- practice ---------------------------------------------------------------------------------------------------------
test('practice spends in one order: this month\'s free credits, then bonus, then users.credit_balance; parts are recorded', async () => {
  const d = await database();
  try {
    await user(d, 'p', { balance: 100, used: 0, bonus: 20 });
    assert.equal(await spend(d, 'p', 'attempt_full', 'p:1'), true);
    assert.deepEqual(await state(d, 'p'), { free: 0, bonus: 20, balance: 100 }, 'a full mock takes the 50 free credits');
    assert.equal(await spend(d, 'p', 'attempt_15', 'p:2'), true);
    assert.deepEqual(await state(d, 'p'), { free: 0, bonus: 5, balance: 100 }, 'then bonus');
    assert.equal(await spend(d, 'p', 'attempt_10', 'p:3'), true);
    assert.deepEqual(await state(d, 'p'), { free: 0, bonus: 0, balance: 95 }, '5 bonus, then 5 from the balance');
    const rows = await q(d, "select reference, amount, credit_delta, parts from credit_transactions where user_id='p' order by reference");
    assert.deepEqual(rows.map((r) => [r.reference, r.amount, r.credit_delta, r.parts]), [
      ['p:1', -50, -50, { included: 50, bonus: 0, balance: 0 }],
      ['p:2', -15, -15, { included: 0, bonus: 15, balance: 0 }],
      ['p:3', -10, -10, { included: 0, bonus: 5, balance: 5 }],
    ]);
  } finally { await d.close(); }
});

test('a practice set paid partly by free credits and partly by held credits', async () => {
  const d = await database();
  try {
    await user(d, 'mix', { balance: 40, used: 45, bonus: 3 });
    assert.equal(await spend(d, 'mix', 'attempt_10', 'mix:1'), true);
    assert.deepEqual(await state(d, 'mix'), { free: 0, bonus: 0, balance: 38 });
    assert.deepEqual((await one(d, "select parts from credit_transactions where reference='mix:1'")).parts, { included: 5, bonus: 3, balance: 2 });
  } finally { await d.close(); }
});

test('practice creates the wallet row when missing, a full month later the free credits come back, and old actions keep their prices', async () => {
  const d = await database();
  try {
    await user(d, 'new', { balance: 100, wallet: false });
    assert.equal(await spend(d, 'new', 'attempt', 'new:1'), true);
    assert.deepEqual(await state(d, 'new'), { free: 40, bonus: 0, balance: 100 }, "'attempt' is still 10, from a fresh wallet with 50 free");
    assert.equal(await spend(d, 'new', 'generate', 'new:2'), true);
    assert.deepEqual(await state(d, 'new'), { free: 30, bonus: 0, balance: 100 }, "'generate' is still 10");
    for (const [a, n] of [['attempt_5', 5], ['attempt_10', 10], ['attempt_15', 15], ['attempt_20', 20]]) {
      const before = await state(d, 'new');
      assert.equal(await spend(d, 'new', a, `new:${a}`), true);
      const after = await state(d, 'new');
      assert.equal(before.free + before.bonus + before.balance - (after.free + after.bonus + after.balance), n, a);
    }
    await assert.rejects(spend(d, 'new', 'attempt_7', 'new:bad'), /unsupported credit spend action/);
    // Period rollover: last month's wallet, all 50 used.
    await user(d, 'roll', { balance: 0, used: 50, bonus: 0, period: LAST });
    assert.equal(await spend(d, 'roll', 'attempt_20', 'roll:1'), true, "last month's used credits do not count this month");
    assert.deepEqual(await state(d, 'roll'), { free: 30, bonus: 0, balance: 0 });
    const w = await one(d, "select period_start, reset_at from ai_credit_wallets where user_id='roll'");
    assert.equal(w.period_start.toISOString(), W.periodStart);
    assert.equal(w.reset_at.toISOString(), W.resetAt);
  } finally { await d.close(); }
});

test('practice never goes negative: short of the price is false and nothing is taken; retries charge once', async () => {
  const d = await database();
  try {
    await user(d, 'poor', { balance: 4, used: 47, bonus: 2 });       // 3 + 2 + 4 = 9
    assert.equal(await spend(d, 'poor', 'attempt_10', 'poor:1'), false);
    assert.deepEqual(await state(d, 'poor'), { free: 3, bonus: 2, balance: 4 });
    assert.equal(await spend(d, 'poor', 'attempt_5', 'poor:2'), true);
    assert.equal(await spend(d, 'poor', 'attempt_5', 'poor:2'), true, 'the retry answers true');
    assert.deepEqual(await state(d, 'poor'), { free: 0, bonus: 0, balance: 4 }, 'and charged once');
    await assert.rejects(spend(d, 'poor', 'attempt_10', 'poor:2'), /credit reference already used/);
    assert.equal(await spend(d, 'poor', 'attempt_5', 'poor:3'), false, '4 left cannot buy 5');
    assert.deepEqual(await state(d, 'poor'), { free: 0, bonus: 0, balance: 4 });
    await assert.rejects(spend(d, 'ghost', 'attempt_5', 'ghost:1'), /user not found/);
  } finally { await d.close(); }
});

const sessionRow = (id, userId) => ({ id, user_id: userId, request_key: `key_${id}_xxxxxxxx`, subject: 'economics', mode: 'quick', state: 'active', questions: [{ id: 'q1', familyId: `fam_${id}` }], selection_meta: {}, events: [], created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3600000).toISOString() });

test('the start functions are untouched: a start paid from the one balance creates the session, an unpaid one leaves none, Pro practice is free', async () => {
  const d = await database();
  try {
    await user(d, 'st', { balance: 0, used: 40, bonus: 0 });    // 10 free credits left, nothing held
    const start = (id, uid, action) => q(d, 'select start_learning_session($1,$2,$3,$4) r', [sessionRow(id, uid), action, null, null]);
    await start('s1', 'st', 'attempt_10');
    assert.deepEqual(await state(d, 'st'), { free: 0, bonus: 0, balance: 0 }, 'the free AI-month credits paid for practice');
    await assert.rejects(start('s2', 'st', 'attempt_5'), /insufficient credits/);
    assert.equal((await one(d, "select count(*)::int n from recovery_sessions where id='s2'")).n, 0, 'an unpaid start leaves no session');
    await user(d, 'pro', { balance: 0, used: 50, bonus: 0 });
    await start('pro1', 'pro', null);
    assert.equal((await one(d, "select count(*)::int n from recovery_sessions where id='pro1'")).n, 1, 'Pro sends no action: practice is included');
    assert.deepEqual(await state(d, 'pro'), { free: 0, bonus: 0, balance: 0 });
    for (const name of ['start_learning_session', 'start_recovery_session']) assert.doesNotMatch(MIGRATION, new RegExp(`function public\\.${name}`), name);
  } finally { await d.close(); }
});

// ---- AI ---------------------------------------------------------------------------------------------------------------
test('AI consume spends in the same order and uses held credits once the free ones run out', async () => {
  const d = await database();
  try {
    await user(d, 'ai', { balance: 10, used: 49, bonus: 1 });
    let r = await consume(d, 'ai', 1, 'ai:c:0001');
    assert.equal(r.ok, true); assert.equal(r.includedSpent, 1); assert.equal(r.balance, 11);
    r = await consume(d, 'ai', 1, 'ai:c:0002');
    assert.equal(r.bonusSpent, 1);
    r = await consume(d, 'ai', 3, 'ai:c:0003');
    assert.equal(r.ok, true); assert.equal(r.balanceSpent, 3, 'a 3-credit Rival paid from practice credits');
    assert.deepEqual(await state(d, 'ai'), { free: 0, bonus: 0, balance: 7 });
    const again = await consume(d, 'ai', 3, 'ai:c:0003');
    assert.equal(again.idempotent, true);
    assert.deepEqual(await state(d, 'ai'), { free: 0, bonus: 0, balance: 7 }, 'a retry is not charged again');
    r = await consume(d, 'ai', 8, 'ai:c:0004');
    assert.equal(r.ok, false); assert.equal(r.error, 'insufficient_ai_credits'); assert.equal(r.balance, 7);
    assert.deepEqual(await state(d, 'ai'), { free: 0, bonus: 0, balance: 7 }, 'never negative');
    const src = await q(d, "select wallet_source, metadata->>'balanceSpent' b from ai_credit_ledger where user_id='ai' and reason='ai_spend' order by created_at, id");
    assert.deepEqual(src.map((x) => x.wallet_source).sort(), ['balance', 'bonus', 'included']);
  } finally { await d.close(); }
});

test('AI reserve takes free, bonus and held parts; release gives each part back exactly; commit keeps them; retries are idempotent', async () => {
  const d = await database();
  try {
    await user(d, 'r', { balance: 10, used: 48, bonus: 1 });
    let r = await reserve(d, 'r', 5, 'r:op:00001');
    assert.equal(r.ok, true);
    assert.deepEqual([r.includedSpent, r.bonusSpent, r.balanceSpent], [2, 1, 2]);
    assert.deepEqual(await state(d, 'r'), { free: 0, bonus: 0, balance: 8 });
    assert.deepEqual(await one(d, "select from_included, from_bonus, from_balance from ai_credit_reservations where operation_key='r:op:00001'"), { from_included: 2, from_bonus: 1, from_balance: 2 });
    assert.equal((await reserve(d, 'r', 5, 'r:op:00001')).idempotent, true);
    assert.deepEqual(await state(d, 'r'), { free: 0, bonus: 0, balance: 8 }, 'a retried reserve takes nothing more');
    r = await release(d, 'r:op:00001');
    assert.equal(r.ok, true); assert.equal(r.balance, 13);
    assert.deepEqual(await state(d, 'r'), { free: 2, bonus: 1, balance: 10 }, 'every part back where it came from');
    assert.equal((await release(d, 'r:op:00001')).idempotent, true);
    assert.deepEqual(await state(d, 'r'), { free: 2, bonus: 1, balance: 10 }, 'a second release gives nothing more');
    assert.equal((await reserve(d, 'r', 5, 'r:op:00001')).error, 'operation_released');
    const meta = (await one(d, "select metadata from ai_credit_ledger where idempotency_key='release:r:op:00001'")).metadata;
    assert.deepEqual([meta.includedRestored, meta.bonusRestored, meta.balanceRestored], [2, 1, 2]);
    // Commit keeps the spend.
    assert.equal((await reserve(d, 'r', 4, 'r:op:00002')).ok, true);
    assert.equal((await commit(d, 'r:op:00002')).ok, true);
    assert.equal((await release(d, 'r:op:00002')).error, 'already_committed');
    assert.deepEqual(await state(d, 'r'), { free: 0, bonus: 0, balance: 9 });
    // Short: refused, nothing taken.
    assert.equal((await reserve(d, 'r', 10, 'r:op:00003')).error, 'insufficient_ai_credits');
    assert.deepEqual(await state(d, 'r'), { free: 0, bonus: 0, balance: 9 });
    // Released across a month change: the free part becomes bonus (as before), the held part goes back to the balance.
    assert.equal((await reserve(d, 'r', 3, 'r:op:00004')).ok, true);
    await q(d, "update ai_credit_reservations set period_start=$1 where operation_key='r:op:00004'", [LAST.periodStart]);
    await q(d, "update ai_credit_reservations set from_included=1, from_balance=2 where operation_key='r:op:00004'");
    await release(d, 'r:op:00004');
    assert.deepEqual(await state(d, 'r'), { free: 0, bonus: 1, balance: 8 });
  } finally { await d.close(); }
});

// ---- the per-user USD cap ---------------------------------------------------------------------------------------------
// One Ask Mobi reply as the app runs it: reserve 1 credit, reserve the provider call under the student's cap, receipt the
// actual cost, commit the credit (or release it when the provider is refused). Bounds are the real ones for a fast Luna
// reply (about 12 KB of messages, 950 output tokens): reserved about USD 0.0017, actual 0.0003 to 0.000479 (production).
async function reply(d, id, n, tier = 'free') {
  const key = `prepos:${id}:${String(n).padStart(16, '0')}`;
  const credit = await reserve(d, id, 1, key);
  if (!credit.ok) return { credit: credit.error };
  try {
    await q(d, 'select public.reserve_runtime_ai($1,$2,$3,$4,$5,$6,$7)', [key, 'openai', 'gpt-6-luna', 12000, 950, id, tier]);
  } catch (e) {
    await release(d, key);
    return { runtime: /runtime user limit reached/.test(e.message) ? 'user_limit' : e.message };
  }
  await q(d, 'select public.receipt_runtime_ai($1,$2,$3)', [key, n % 5 === 0 ? 0.000479 : 0.0003, {}]);
  await commit(d, key);
  return { ok: true };
}

test('a Free student with 300 bought credits makes all 350 luna replies (50 free + 300 bought) in a month; the 351st is refused for credits', async () => {
  const d = await database();
  try {
    await user(d, 'buyer', { balance: 0, used: 0, bonus: 300 });
    for (let n = 1; n <= 350; n++) assert.deepEqual(await reply(d, 'buyer', n), { ok: true }, `reply ${n}`);
    assert.deepEqual(await reply(d, 'buyer', 351), { credit: 'insufficient_ai_credits' });
    assert.deepEqual(await state(d, 'buyer'), { free: 0, bonus: 0, balance: 0 });
    const spent = await one(d, "select sum(actual_usd)::float8 s from runtime_ai_requests where user_id='buyer'");
    assert.ok(spent.s > 0.0284, `spent USD ${spent.s}, above the free cap, all paid for`);
  } finally { await d.close(); }
  // Why the change: on production's bodies the same student is stopped by the Rs 2.50 cap long before 350.
  const before = await database({ migrated: false });
  try {
    await user(before, 'buyer', { balance: 0, used: 0, bonus: 300 });
    let n = 1;
    let out;
    while ((out = await reply(before, 'buyer', n)).ok && n < 350) n++;
    assert.deepEqual(out, { runtime: 'user_limit' });
    assert.ok(n < 120, `production refuses reply ${n} although ${350 - n + 1} credits were paid for`);
  } finally { await before.close(); }
});

test('held credits (users.credit_balance: signup grant, rewards) pay for AI but stay under the owner\'s cap; bought credits raise it; a free-only student is capped exactly as before', async () => {
  for (const migrated of [false, true]) {
    const d = await database({ migrated });
    try {
      // Only the free 50 (no bonus, no balance): the per-user cap is the only limit after heavy replies.
      await user(d, 'freeonly', { balance: 0, used: 0, bonus: 0 });
      await q(d, "insert into runtime_ai_requests(request_key,provider,model,reserved_usd,actual_usd,state,user_id) values('old-spend-0001','openai','gpt-6-luna',0.027,0.027,'receipted','freeonly')");
      assert.deepEqual(await reply(d, 'freeonly', 1), { runtime: 'user_limit' }, `migrated=${migrated}: USD 0.027 spent + 0.0017 > 0.0284`);
      assert.deepEqual(await state(d, 'freeonly'), { free: 50, bonus: 0, balance: 0 }, 'the refused reply released its credit');
      if (migrated) {
        // 100 held credits (the signup grant), the free 50 used: practice and AI may spend them (one balance) ...
        await q(d, "update users set credit_balance=100 where id='freeonly'");
        await q(d, "update ai_credit_wallets set included_credits_used=50 where user_id='freeonly'");
        assert.equal(await spend(d, 'freeonly', 'attempt_20', 'fo:practice'), true);
        // ... but they were not bought, so an AI reply from them stays under the owner's cap (refused here, credit back).
        assert.deepEqual(await reply(d, 'freeonly', 2), { runtime: 'user_limit' }, 'held credits do not lift the owner\'s cap');
        assert.deepEqual(await state(d, 'freeonly'), { free: 0, bonus: 0, balance: 80 }, 'the refused reply gave its held credit back');
        assert.equal((await one(d, "select public.mm_bought_ai_credits_spent('freeonly', public.runtime_ai_month_start()) n")).n, 0);
        // Below the cap, a held credit pays for a reply like any credit.
        await q(d, "update runtime_ai_requests set actual_usd=0.001 where request_key='old-spend-0001'");
        assert.deepEqual(await reply(d, 'freeonly', 3), { ok: true });
        assert.deepEqual(await state(d, 'freeonly'), { free: 0, bonus: 0, balance: 79 });
        // A bought credit (bonus) is spent before held ones and lifts the cap for its reply.
        await q(d, "update runtime_ai_requests set actual_usd=0.0284 where request_key='old-spend-0001'");
        await q(d, "update ai_credit_wallets set bonus_credits=1 where user_id='freeonly'");
        assert.deepEqual(await reply(d, 'freeonly', 4), { ok: true }, 'a reply paid from a bought credit is not refused by the cap');
        assert.equal((await one(d, "select public.mm_bought_ai_credits_spent('freeonly', public.runtime_ai_month_start()) n")).n, 1);
        assert.deepEqual(await state(d, 'freeonly'), { free: 0, bonus: 0, balance: 79 });
      }
    } finally { await d.close(); }
  }
});

test('each bought credit raises the cap by at most the student_bought_credit bound, and a released (failed) call does not raise it', async () => {
  const d = await database();
  try {
    assert.equal(Number((await one(d, "select monthly_cap_usd from runtime_ai_budget where id='student_bought_credit'")).monthly_cap_usd), 0.02);
    await user(d, 'h', { balance: 0, used: 50, bonus: 10 });
    await q(d, "insert into runtime_ai_requests(request_key,provider,model,reserved_usd,actual_usd,state,user_id) values('h-old-00000001','openai','gpt-6-luna',0.0284,0.0284,'receipted','h')");
    const key = 'prepos:h:0000000000000001';
    assert.equal((await reserve(d, 'h', 1, key)).ok, true);
    // 0.0284 spent + 0.0284 cap + 1 bought credit * 0.02: a request up to 0.02 dispatches, a bigger one (0.0252) is refused.
    await assert.rejects(q(d, 'select public.reserve_runtime_ai($1,$2,$3,$4,$5,$6,$7)', [key, 'openai', 'gpt-6-luna', 2000, 50000, 'h', 'free']), /runtime user limit reached/);
    await release(d, key);
    assert.equal((await one(d, "select public.mm_bought_ai_credits_spent('h', public.runtime_ai_month_start()) n")).n, 0, 'released credits do not count');
    assert.deepEqual(await reply(d, 'h', 2), { ok: true });
  } finally { await d.close(); }
});

test('a reply paid from 1 bought credit at the very edge of the cap dispatches both physical calls (primary + retry/fallback), even with the largest bounds the code can send', async () => {
  // MAX_PHYSICAL_CALLS in providerCore.js is 2; each call is reserved at its bound and a failed first call keeps its
  // reservation. 30 KB in + 3,000 out on luna = USD 0.0045 per call (the largest the code can reserve, about twice the
  // largest runtime reservation seen on production, 0.00237), so 0.009 for the reply.
  const src = readFileSync(new URL('../../src/services/ai/providerCore.js', import.meta.url), 'utf8');
  assert.match(src, /export const MAX_PHYSICAL_CALLS = 2;/);
  assert.match(src, /MAX_TOKENS_RANGE = Object\.freeze\(\{ min: 200, max: 2_000 \}\)/);
  assert.match(src, /low: 1000,/);
  for (const perCredit of [0.005, null]) {
    const d = await database();
    try {
      if (perCredit !== null) await q(d, "update runtime_ai_budget set monthly_cap_usd=$1 where id='student_bought_credit'", [perCredit]);
      await user(d, 'edge', { balance: 0, used: 50, bonus: 1 });
      await q(d, "insert into runtime_ai_requests(request_key,provider,model,reserved_usd,actual_usd,state,user_id) values('edge-old-0000001','openai','gpt-6-luna',0.0284,0.0284,'receipted','edge')");
      const key = 'prepos:edge:000000000000001';
      assert.equal((await reserve(d, 'edge', 1, key)).ok, true, 'paid from the 1 bought credit');
      await q(d, 'select public.reserve_runtime_ai($1,$2,$3,$4,$5,$6,$7)', [key, 'openai', 'gpt-6-luna', 30000, 3000, 'edge', 'free']);
      const second = q(d, 'select public.reserve_runtime_ai($1,$2,$3,$4,$5,$6,$7)', [`${key}:fallback`, 'anthropic', 'claude-haiku-5-5', 30000, 3000, 'edge', 'free']);
      if (perCredit === 0.005) await assert.rejects(second, /runtime user limit reached/, 'the 0.005 draft refused the second call of a paid reply');
      else await second;
    } finally { await d.close(); }
  }
});

test('after a failed reply at the cap edge (credit released, both provider reservations kept), the next reply paid from bought credits still dispatches both calls', async () => {
  for (const perCredit of [0.01, null]) {
    const d = await database();
    try {
      if (perCredit !== null) await q(d, "update runtime_ai_budget set monthly_cap_usd=$1 where id='student_bought_credit'", [perCredit]);
      await user(d, 'fail', { balance: 0, used: 50, bonus: 3 });
      await q(d, "insert into runtime_ai_requests(request_key,provider,model,reserved_usd,actual_usd,state,user_id) values('fail-old-0000001','openai','gpt-6-luna',0.0284,0.0284,'receipted','fail')");
      const call = (k, provider, model) => q(d, 'select public.reserve_runtime_ai($1,$2,$3,$4,$5,$6,$7)', [k, provider, model, 30000, 3000, 'fail', 'free']);
      // Reply 1: both calls reserved at the largest bounds, then it fails: the credit is released, the reservations stay.
      const k1 = 'prepos:fail:000000000000001';
      assert.equal((await reserve(d, 'fail', 1, k1)).ok, true);
      await call(k1, 'openai', 'gpt-6-luna');
      await call(`${k1}:fallback`, 'anthropic', 'claude-haiku-5-5');
      await release(d, k1);
      assert.deepEqual(await state(d, 'fail'), { free: 0, bonus: 3, balance: 0 }, 'the failed reply cost the student nothing');
      // Reply 2, paid from a bought credit.
      const k2 = 'prepos:fail:000000000000002';
      assert.equal((await reserve(d, 'fail', 1, k2)).ok, true);
      const first = call(k2, 'openai', 'gpt-6-luna');
      if (perCredit === 0.01) { await assert.rejects(first, /runtime user limit reached/, 'the 0.01 draft refused the next paid reply'); continue; }
      await first;
      await call(`${k2}:fallback`, 'anthropic', 'claude-haiku-5-5');
    } finally { await d.close(); }
  }
});

test("a reserve records the wallet's period, not the caller's: a clock behind at the month edge cannot turn free credits into bonus on release", async () => {
  const d = await database();
  try {
    await user(d, 'clock', { balance: 0, used: 40, bonus: 0 }); // wallet in this month, 10 free left
    const key = 'clock:op:000001';
    // The server clock is a month behind: it passes last month's window.
    const r = await one(d, 'select public.mm_ai_reserve_credits($1,$2,$3,$4,$5,$6,$7) r', ['clock', 2, 'prepos_mentor', key, 50, LAST.periodStart, LAST.resetAt]).then((x) => x.r);
    assert.equal(r.ok, true);
    const res = await one(d, 'select period_start from ai_credit_reservations where operation_key=$1', [key]);
    assert.equal(res.period_start.toISOString(), W.periodStart, 'the synced wallet period, as production stored it');
    await release(d, key);
    assert.deepEqual(await state(d, 'clock'), { free: 10, bonus: 0, balance: 0 }, 'the free part went back to free credits, not to bonus');
  } finally { await d.close(); }
});

// ---- the JS side ------------------------------------------------------------------------------------------------------
test('one balance view: free left + bonus + practice balance, with the parts and the reset date', () => {
  const now = new Date('2026-10-18T10:00:00Z');
  const w = walletWindow(now);
  const ai = projectWallet({ included_monthly_credits: 50, included_credits_used: 12, bonus_credits: 150, period_start: w.periodStart, reset_at: w.resetAt }, { paid: false, includedMonthlyCredits: 50, paidAiOpen: true, now });
  const u = unifiedFromWallet(ai, 40);
  assert.deepEqual(u, { known: true, total: 228, freeLeft: 38, freeAllowance: 50, resetAt: w.resetAt, held: 190, parts: { included: 38, bonus: 150, balance: 40 } });
  assert.deepEqual(unifiedFromWallet(projectWallet(null, { paid: false, includedMonthlyCredits: 50, paidAiOpen: true, now }), 100).total, 150, 'no wallet row yet: 50 free + 100');
  const stale = projectWallet({ included_monthly_credits: 50, included_credits_used: 50, bonus_credits: 0, period_start: '2026-08-31T18:30:00.000Z', reset_at: '2026-09-30T18:30:00.000Z' }, { paid: false, includedMonthlyCredits: 50, paidAiOpen: true, now });
  assert.equal(unifiedFromWallet(stale, 0).freeLeft, 50, 'a new month is projected as the database will sync it');
  assert.equal(unifiedFromWallet({ known: false }, 40).known, false, 'an unreadable wallet never reports a number');
  assert.equal(unifiedFromWallet({ known: false }, 40).total, null);
});

test('one set of credit packs, usable for everything; the old ai_credits_prepos_* ids still resolve for past orders and webhooks', () => {
  assert.deepEqual(CREDIT_PACKS.map((p) => [p.key, p.planId, p.amountInr, p.amountPaise, p.credits, Boolean(p.featured)]), [
    ['credits_10_50', 'credits_10_50', 10, 1000, 50, false],
    ['credits_29_150', 'credits_29_150', 29, 2900, 150, false],
    ['credits_49_300', 'credits_49_300', 49, 4900, 300, true],
  ]);
  for (const id of ['ai_credits_prepos_10_50', 'ai_credits_prepos_20_150', 'ai_credits_prepos_50_400', 'prepos_10_50']) assert.ok(findCreditPack(id), id);
  assert.equal(findCreditPack('ai_credits_prepos_50_400').credits, 400, 'an old order grants what it was sold for');
  assert.equal(findCreditPack('ai_credits_prepos_50_400').legacy, true);
  assert.equal(LEGACY_AI_PACKS.length, 3);
  assert.equal(findCreditPack('nope'), null);
  const wallet = file('src/services/credits/aiCreditWallet.js');
  assert.match(wallet, /from '\.\/creditPacks\.mjs'/);
});

test('an Ask Mobi reply always costs exactly 1 credit, whatever the mode or model', () => {
  const chat = file('src/app/api/ai/mentor/chat/route.js');
  const costs = [...chat.matchAll(/creditCost:\s*([^,\s}]+)/g)].map((m) => m[1]);
  assert.ok(costs.length >= 1);
  for (const c of costs) assert.equal(c, '1', `creditCost: ${c}`);
  assert.match(file('src/services/prepos/modelReply.js'), /creditCost = 1,/);
});

test('headroom left by bought credits never pays for a held-credit reply above the cap; the lift serves only a reply paid from bought credits (release 10 verifier M4)', async () => {
  const d = await database();
  try {
    // The free 50 used, 20 bought credits, 100 held credits, and already at the owner's cap.
    await user(d, 'mix', { balance: 100, used: 50, bonus: 20 });
    await q(d, "insert into runtime_ai_requests(request_key,provider,model,reserved_usd,actual_usd,state,user_id) values('mix-old-000001','openai','gpt-6-luna',0.0284,0.0284,'receipted','mix')");
    // Every reply paid from a bought credit dispatches at the cap edge.
    for (let n = 1; n <= 20; n++) assert.deepEqual(await reply(d, 'mix', n), { ok: true }, `bought reply ${n}`);
    assert.deepEqual(await state(d, 'mix'), { free: 0, bonus: 0, balance: 100 });
    assert.equal((await one(d, "select public.mm_bought_ai_credits_spent('mix', public.runtime_ai_month_start()) n")).n, 20, 'USD 0.40 of lift was earned, about 0.007 used');
    // The next reply is paid from held credits: no open bought reservation, so the plain cap refuses it and the credit goes back.
    assert.deepEqual(await reply(d, 'mix', 21), { runtime: 'user_limit' }, 'leftover bought headroom does not buy unpaid AI');
    assert.deepEqual(await state(d, 'mix'), { free: 0, bonus: 0, balance: 100 });
    // A newly bought credit lifts the cap again, for its own reply.
    await q(d, "update ai_credit_wallets set bonus_credits=1 where user_id='mix'");
    assert.deepEqual(await reply(d, 'mix', 22), { ok: true });
  } finally { await d.close(); }
});
