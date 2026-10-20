// Friend referrals and the 50-credit welcome (owner D165, 20 Oct 2026). Money, so the real migration runs on an in-process
// Postgres (PGlite) and every rule is driven through it: the welcome default, attribution, qualification on the first finished
// practice, the idempotent +100 each, self-referral, replays, a friend who never practises, the monthly cap, the device and
// network holds, the kill switch, the Mob invite as a referral link, a failure that must not fail the practice, privileges and
// the undo. Then the shared JS (codes, the pending-invite cookie, words) and the server glue, with no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { NextRequest, NextResponse } from 'next/server.js';
import {
  INVITE_COOKIE, REFERRAL_COPY, captureFromVisit, codeFromInput, decodeInviteCookie, encodeInviteCookie, inviteKind, normaliseInviteCode,
  referralLink, referralView, referralsLive,
} from '../../src/lib/referrals/friendInvite.mjs';
import { claimInput, claimOutcome, claimReferral, hashFor, networkOf, readReferralStatus, referralBody } from '../../src/lib/server/referrals.js';
import { applyInviteCapture } from '../../src/lib/server/sessionProxy.js';
import { practiceWhat } from '../../src/lib/server/credits.js';
import { DELETION_STEPS } from '../../src/lib/server/accountDeletion.js';
import { WALLET_V13_COPY } from '../../src/components/wallet/walletModel.mjs';

const file = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const MIGRATION = file('supabase/migrations/20261020130000_referrals.sql');
const UNDO = file('supabase/undo/20261020130000_referrals.undo.sql');
const ON = { REFERRALS_ENABLED: 'true', REFERRAL_HASH_SECRET: 'test-secret' };

// The production shapes the migration touches, cut to the columns it reads (users.credit_balance DEFAULT 100 as on production).
const FIXTURE = `
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users (id uuid primary key, created_at timestamptz not null default now());
create table public.users (id text primary key, created_at timestamptz not null default now(), deleted_at timestamptz,
  credit_balance integer not null default 100);
create table public.credit_transactions (id uuid primary key default gen_random_uuid(), user_id text references public.users(id) on delete cascade,
  amount integer, type text, reference text, action text, credit_delta integer, parts jsonb, created_at timestamptz not null default now());
create unique index idx_credit_transactions_reference_unique on public.credit_transactions (reference);
create table public.attempts (id text primary key, user_id text references public.users(id) on delete cascade, subject text,
  correct integer, wrong integer, unattempted integer, total integer, details jsonb default '[]'::jsonb, completed_at timestamptz default now());
create table public.mob_invites (code text primary key, created_by text references public.users(id) on delete set null, revoked_at timestamptz);
create table public.mob_game_runs (game_id uuid not null, user_id text not null, finished_at timestamptz,
  right_n smallint not null default 0, wrong_n smallint not null default 0, primary key (game_id, user_id));
`;

async function db({ before = '' } = {}) {
  const d = new PGlite();
  await d.exec(FIXTURE);
  if (before) await d.exec(before);
  await d.exec(MIGRATION);
  await d.exec(MIGRATION); // re-runnable
  return d;
}
const one = async (d, sql, params = []) => (await d.query(sql, params)).rows[0];
const val = async (d, sql, params = []) => Object.values(await one(d, sql, params))[0];
const user = (d, id, ago = '0 seconds') => d.query(`insert into public.users (id, created_at) values ($1, now() - $2::interval)`, [id, ago]);
const codeOf = (d, id, device = null) => val(d, 'select public.mm_referral_code_for($1, $2)', [id, device]);
const attach = (d, referee, code, { source = 'link', clickedAgo = '1 minute', device = null, ip = null } = {}) =>
  val(d, `select public.mm_referral_attach($1, $2, $3, now() - $4::interval, $5, $6)`, [referee, code, source, clickedAgo, device, ip]);
let attemptN = 0;
const practise = (d, id, answered = 5) => d.query(`insert into public.attempts (id, user_id, correct, wrong, total) values ($1, $2, $3, $4, 10)`,
  [`att-${++attemptN}`, id, Math.ceil(answered / 2), Math.floor(answered / 2)]);
const balance = (d, id) => val(d, 'select credit_balance from public.users where id = $1', [id]);
const ref = (d, referee) => one(d, 'select * from public.referrals where referee_id = $1', [referee]);
const status = (d, id) => val(d, 'select public.mm_referral_status($1)', [id]);
const ledger = (d) => d.query(`select user_id, reference, credit_delta, action, type from public.credit_transactions order by reference`).then((r) => r.rows);

/** A new pair: an inviter A (an older account) and a friend who signed up a moment after opening A's link. */
async function pair(d, a = 'A', b = 'B') {
  await user(d, a, '30 days');
  const code = await codeOf(d, a);
  await user(d, b);
  return { code, joined: await attach(d, b, code) };
}

// ---- the welcome ---------------------------------------------------------------------------------------------------------

test('the welcome: a new account starts with 0 kept credits (only the month’s 50 free); existing balances are untouched', async () => {
  const d = await db({ before: `insert into public.users (id) values ('old1'), ('old2'); update public.users set credit_balance = 37 where id = 'old2';` });
  assert.equal(await balance(d, 'old1'), 100, 'an existing account keeps its 100');
  assert.equal(await balance(d, 'old2'), 37);
  await user(d, 'new1');
  assert.equal(await balance(d, 'new1'), 0, 'no one-time 100 for a new account (D165)');
  assert.equal(await val(d, `select column_default from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'credit_balance'`), '0');
  // The app no longer writes 100 itself: the column default is the one switch.
  const ensure = file('data/db.js').match(/async ensureUser\(user\) \{[\s\S]*?\n {2}\},/)[0];
  assert.doesNotMatch(ensure, /credit_balance/);
});

// ---- the happy path and replays -----------------------------------------------------------------------------------------

test('a friend who signs up with the link and finishes one practice: +100 each, recorded once', async () => {
  const d = await db();
  const { code, joined } = await pair(d);
  assert.match(code, /^[0-9A-HJKMNP-TV-Z]{7}$/);
  assert.deepEqual(joined, { ok: true, idempotent: false, state: 'joined', source: 'link' });
  assert.equal(await codeOf(d, 'A'), code, 'one code per student, made once');
  await practise(d, 'B', 5);
  const r = await ref(d, 'B');
  assert.equal(r.state, 'granted');
  assert.equal(r.referee_granted, true);
  assert.equal(r.referrer_granted, true);
  assert.match(r.qualifying_ref, /^attempt:att-/);
  assert.equal(await balance(d, 'A'), 100, 'the inviter: the reward (a new account starts with 0 kept credits)');
  assert.equal(await balance(d, 'B'), 0 + 100, 'the friend: the reward on top of the free 50 a month');
  assert.deepEqual((await ledger(d)).map((l) => [l.user_id, l.reference.replace(r.id, 'ID'), l.credit_delta, l.action, l.type]), [
    ['B', 'referral:ID:friend', 100, 'referral', 'earn'],
    ['A', 'referral:ID:inviter', 100, 'referral', 'earn'],
  ]);
  const s = await status(d, 'A');
  assert.deepEqual([s.joined, s.practised, s.rewarded, s.notCounted, s.earned, s.rewardedThisMonth, s.capReached], [1, 1, 1, 0, 100, 1, false]);
  assert.deepEqual((await status(d, 'B')).invited, { state: 'granted', rewarded: true, source: 'link' });
});

test('replays pay nothing twice: the grant, the qualification, a second practice and the credit itself', async () => {
  const d = await db();
  await pair(d);
  await practise(d, 'B');
  const id = (await ref(d, 'B')).id;
  const again = await val(d, 'select public.mm_referral_grant($1)', [id]);
  assert.equal(again.idempotent, true);
  assert.equal((await val(d, `select public.mm_referral_qualify('B', 10, 'replay')`)).qualified, false);
  await practise(d, 'B', 10);
  assert.equal(await val(d, 'select public.mm_referral_credit($1, 100, $2)', ['B', `referral:${id}:friend`]), false, 'the same reference pays nothing');
  await assert.rejects(d.query('select public.mm_referral_credit($1, 100, $2)', ['A', `referral:${id}:friend`]), /already used for a different transaction/);
  assert.equal((await val(d, 'select public.mm_referral_grant_due()')).paid, 0);
  assert.deepEqual([await balance(d, 'A'), await balance(d, 'B'), (await ledger(d)).length], [100, 100, 2]);
  // A replayed attach answers idempotent and changes nothing.
  assert.deepEqual(await attach(d, 'B', await codeOf(d, 'A')), { ok: true, idempotent: true, state: 'granted', source: 'link' });
});

test('a friend who never practises: joined, no credits; an answer count under 5 does not count', async () => {
  const d = await db();
  await pair(d);
  await practise(d, 'B', 4); // e.g. a 1-question episode check or an abandoned set
  await d.query(`insert into public.attempts (id, user_id, details) values ('att-details', 'B', '[{"qid":"q1","givenIndex":1},{"qid":"q2","givenIndex":null}]')`);
  const r = await ref(d, 'B');
  assert.deepEqual([r.state, r.qualified_at, r.referee_granted, r.referrer_granted], ['joined', null, false, false]);
  assert.deepEqual([await balance(d, 'A'), await balance(d, 'B'), (await ledger(d)).length], [0, 0, 0]);
  const s = await status(d, 'A');
  assert.deepEqual([s.joined, s.practised, s.rewarded, s.earned], [1, 0, 0, 0]);
  assert.deepEqual((await status(d, 'B')).invited, { state: 'joined', rewarded: false, source: 'link' });
  // Answers counted from the details when correct and wrong are not stored: 5 answered qualifies.
  await d.query(`insert into public.attempts (id, user_id, details) values ('att-d5', 'B', $1::jsonb)`,
    [JSON.stringify([0, 1, 2, 3, 0].map((g, i) => ({ qid: `q${i}`, givenIndex: g })))]);
  assert.equal((await ref(d, 'B')).state, 'granted');
});

// ---- who can be attributed ------------------------------------------------------------------------------------------------

test('self-referral is refused, by the function and by the table; a pair never refers each other both ways', async () => {
  const d = await db();
  await user(d, 'A');
  const code = await codeOf(d, 'A');
  assert.deepEqual(await attach(d, 'A', code), { ok: false, error: 'self' });
  await assert.rejects(d.query(`insert into public.referrals (referrer_id, referee_id, source, code) values ('A', 'A', 'link', $1)`, [code]), /referrals_not_self/);
  await user(d, 'B');
  assert.equal((await attach(d, 'B', code)).ok, true);
  assert.deepEqual(await attach(d, 'A', await codeOf(d, 'B'), { clickedAgo: '0 seconds' }), { ok: false, error: 'self' });
});

test('an existing account clicking a link is refused; only an account made after the click, and recently, counts', async () => {
  const d = await db();
  await user(d, 'A', '60 days');
  const code = await codeOf(d, 'A');
  await user(d, 'old', '2 hours');
  assert.deepEqual(await attach(d, 'old', code, { clickedAgo: '1 minute' }), { ok: false, error: 'existing_account' }, 'made before the click');
  await user(d, 'stale', '4 days');
  assert.deepEqual(await attach(d, 'stale', code, { clickedAgo: '5 days' }), { ok: false, error: 'existing_account' }, 'older than 3 days');
  await user(d, 'skew', '5 minutes');
  assert.equal((await attach(d, 'skew', code, { clickedAgo: '1 minute' })).ok, true, '10 minutes of clock grace');
  await user(d, 'practised');
  await practise(d, 'practised', 10);
  assert.deepEqual(await attach(d, 'practised', code), { ok: false, error: 'existing_account' }, 'already finished a practice');
  await user(d, 'played');
  await d.query(`insert into public.mob_game_runs (game_id, user_id, finished_at, right_n) values (gen_random_uuid(), 'played', now(), 3)`);
  assert.deepEqual(await attach(d, 'played', code), { ok: false, error: 'existing_account' }, 'already finished a Mob game');
  // The auth user's own creation time counts too: a fresh public row for an old sign-up is still an old account.
  await d.query(`insert into public.users (id) values ('11111111-1111-1111-1111-111111111111')`);
  await d.query(`insert into auth.users (id, created_at) values ('11111111-1111-1111-1111-111111111111', now() - interval '20 days')`);
  assert.deepEqual(await attach(d, '11111111-1111-1111-1111-111111111111', code), { ok: false, error: 'existing_account' });
  // A click time in the future (a forged cookie) is read as now.
  await user(d, 'future', '1 hour');
  assert.deepEqual(await attach(d, 'future', code, { clickedAgo: '-2 days' }), { ok: false, error: 'existing_account' });
  // Unknown, deleted and malformed.
  await user(d, 'other', '9 days');
  assert.deepEqual(await attach(d, 'skew', await codeOf(d, 'other')), { ok: false, error: 'already_referred' }, 'one inviter per account');
  await user(d, 'n1');
  assert.deepEqual(await attach(d, 'n1', 'ZZZZZZZ'), { ok: false, error: 'unknown_code' });
  assert.deepEqual(await attach(d, 'n1', 'hello!'), { ok: false, error: 'bad_code' });
  assert.deepEqual(await attach(d, 'ghost', code), { ok: false, error: 'user_not_found' });
  await d.query(`update public.users set deleted_at = now() where id = 'A'`);
  assert.deepEqual(await attach(d, 'n1', code), { ok: false, error: 'unknown_code' }, 'a deleted inviter');
});

test('one inviter per account: a second code is refused, the first stays', async () => {
  const d = await db();
  const { code } = await pair(d);
  await user(d, 'C', '9 days');
  assert.deepEqual(await attach(d, 'B', await codeOf(d, 'C')), { ok: false, error: 'already_referred' });
  assert.equal((await ref(d, 'B')).referrer_id, 'A');
  assert.equal(await val(d, 'select count(*)::int from public.referrals'), 1);
  assert.ok(code);
});

// ---- caps and abuse ----------------------------------------------------------------------------------------------------

test('the cap: an inviter is paid for 10 friends an IST month; the 11th friend still gets 100 and it says so', async () => {
  const d = await db();
  await user(d, 'A', '90 days');
  const code = await codeOf(d, 'A');
  for (let i = 1; i <= 11; i += 1) {
    await user(d, `f${i}`);
    assert.equal((await attach(d, `f${i}`, code, { ip: `net-hash-${i}-xxxx` })).ok, true);
    await practise(d, `f${i}`);
  }
  assert.equal(await balance(d, 'A'), 10 * 100);
  assert.equal(await balance(d, 'f11'), 100);
  const last = await ref(d, 'f11');
  assert.deepEqual([last.state, last.referee_granted, last.referrer_granted, last.referrer_capped], ['granted', true, false, true]);
  const s = await status(d, 'A');
  assert.deepEqual([s.joined, s.practised, s.rewarded, s.notCounted, s.earned, s.rewardedThisMonth, s.capReached], [11, 11, 10, 1, 1000, 10, true]);
  // Last month's rewards do not count against this month.
  await d.query(`update public.referrals set granted_at = granted_at - interval '40 days' where referrer_id = 'A'`);
  await user(d, 'f12');
  await attach(d, 'f12', code);
  await practise(d, 'f12');
  assert.equal((await ref(d, 'f12')).referrer_granted, true);
});

test('the same device as the inviter is held, never paid automatically; an override pays it once', async () => {
  const d = await db();
  await user(d, 'A', '30 days');
  const code = await codeOf(d, 'A', 'dev-hash-of-A-phone');
  await user(d, 'B');
  await attach(d, 'B', code, { device: 'dev-hash-of-A-phone' });
  await practise(d, 'B');
  const r = await ref(d, 'B');
  assert.deepEqual([r.state, r.held_reason, r.referee_granted, r.referrer_granted], ['held', 'same_device', false, false]);
  assert.deepEqual([await balance(d, 'A'), await balance(d, 'B'), (await ledger(d)).length], [0, 0, 0]);
  assert.equal((await status(d, 'A')).notCounted, 1);
  assert.equal((await val(d, 'select public.mm_referral_grant($1)', [r.id])).state, 'held', 'a plain retry keeps it held');
  assert.equal((await val(d, 'select public.mm_referral_grant($1, true)', [r.id])).state, 'granted', 'the owner can release it by hand');
  assert.equal((await val(d, 'select public.mm_referral_grant($1, true)', [r.id])).idempotent, true);
  assert.deepEqual([await balance(d, 'A'), await balance(d, 'B')], [100, 100]);
  // The inviter's own sign-up device (they were invited once themselves) counts as theirs.
  await user(d, 'X', '40 days');
  const xCode = await codeOf(d, 'X');
  await d.query(`update public.users set created_at = now() where id = 'C'`).catch(() => {});
  await user(d, 'C');
  await attach(d, 'C', xCode, { device: 'dev-hash-of-C-phone' });
  await practise(d, 'C');
  const cCode = await codeOf(d, 'C');
  await user(d, 'D');
  await attach(d, 'D', cCode, { device: 'dev-hash-of-C-phone' });
  await practise(d, 'D');
  assert.deepEqual([(await ref(d, 'D')).state, (await ref(d, 'D')).held_reason], ['held', 'same_device']);
});

test('a device that already earned a friend reward is held on a second account; three friends a month from one network, the fourth is held', async () => {
  const d = await db();
  await user(d, 'A', '30 days');
  const code = await codeOf(d, 'A');
  for (const id of ['B1', 'B2']) { await user(d, id); await attach(d, id, code, { device: 'one-phone-hash-0001' }); }
  await practise(d, 'B1');
  await practise(d, 'B2');
  assert.equal((await ref(d, 'B1')).state, 'granted');
  assert.deepEqual([(await ref(d, 'B2')).state, (await ref(d, 'B2')).held_reason], ['held', 'device_reused']);

  await user(d, 'N', '30 days');
  const nCode = await codeOf(d, 'N');
  for (let i = 1; i <= 4; i += 1) { await user(d, `n${i}`); await attach(d, `n${i}`, nCode, { ip: 'same-network-hash' }); await practise(d, `n${i}`); }
  const states = [];
  for (let i = 1; i <= 4; i += 1) states.push((await ref(d, `n${i}`)).state);
  assert.deepEqual(states, ['granted', 'granted', 'granted', 'held']);
  assert.equal((await ref(d, 'n4')).held_reason, 'same_network');
  assert.equal(await balance(d, 'N'), 300);
});

test('the kill switch: while grants are paused a friend’s practice waits as qualified; resuming pays it exactly once', async () => {
  const d = await db();
  await d.query('update public.referral_program set grants_paused = true');
  await pair(d);
  await practise(d, 'B');
  assert.equal((await ref(d, 'B')).state, 'qualified');
  assert.deepEqual([await balance(d, 'A'), await balance(d, 'B')], [0, 0]);
  assert.equal((await status(d, 'A')).paused, true);
  assert.deepEqual(await val(d, 'select public.mm_referral_grant_due()'), { ok: true, paused: true, paid: 0 });
  await d.query('update public.referral_program set grants_paused = false');
  assert.deepEqual(await val(d, 'select public.mm_referral_grant_due()'), { ok: true, seen: 1, paid: 1 });
  assert.deepEqual(await val(d, 'select public.mm_referral_grant_due()'), { ok: true, seen: 0, paid: 0 });
  assert.deepEqual([await balance(d, 'A'), await balance(d, 'B')], [100, 100]);
  // The reward amount and the cap come from the one row.
  await d.query('update public.referral_program set reward = 150, monthly_cap = 0');
  await user(d, 'C');
  await attach(d, 'C', await codeOf(d, 'A'));
  await practise(d, 'C');
  assert.deepEqual([await balance(d, 'A'), await balance(d, 'C')], [100, 150]);
});

// ---- the Mob invite link is the referral link -----------------------------------------------------------------------------

test('the Mob invite link is also a referral link; a finished Mob game is a practice; a revoked invite does not count', async () => {
  const d = await db();
  await user(d, 'host', '20 days');
  await d.query(`insert into public.mob_invites (code, created_by) values ('K7P2M9', 'host'), ('ABCDEFGH', 'host'), ('Q2W3E4', 'host')`);
  await d.query(`update public.mob_invites set revoked_at = now() where code = 'Q2W3E4'`);
  await user(d, 'm1');
  assert.deepEqual(await attach(d, 'm1', 'k7p 2m9', { source: 'mob_invite' }), { ok: true, idempotent: false, state: 'joined', source: 'mob_invite' });
  await user(d, 'm2');
  assert.equal((await attach(d, 'm2', 'ABCDEFGH', { source: 'code' })).source, 'mob_invite', 'an 8-character Mob code typed at sign-up');
  await user(d, 'm3');
  assert.deepEqual(await attach(d, 'm3', 'Q2W3E4'), { ok: false, error: 'unknown_code' });
  const game = await val(d, 'select gen_random_uuid()');
  await d.query(`insert into public.mob_game_runs (game_id, user_id) values ($1, 'm1')`, [game]);
  await d.query(`update public.mob_game_runs set right_n = 2, wrong_n = 1, finished_at = now() where user_id = 'm1'`);
  assert.equal((await ref(d, 'm1')).state, 'joined', '3 answers is not a practice');
  const game2 = await val(d, 'select gen_random_uuid()');
  await d.query(`insert into public.mob_game_runs (game_id, user_id) values ($1, 'm1')`, [game2]);
  await d.query(`update public.mob_game_runs set right_n = 4, wrong_n = 2, finished_at = now() where game_id = $1`, [game2]);
  const r = await ref(d, 'm1');
  assert.equal(r.state, 'granted');
  assert.match(r.qualifying_ref, /^mob_run:/);
  assert.deepEqual([await balance(d, 'host'), await balance(d, 'm1')], [100, 100]);
});

// ---- safety ------------------------------------------------------------------------------------------------------------

test('a referral failure never fails the practice: the attempt is saved, nothing is half paid, the next practice qualifies', async () => {
  const d = await db();
  await pair(d);
  const id = (await ref(d, 'B')).id;
  // A ledger row already holds the friend's reference for someone else: the grant raises inside the trigger.
  await d.query(`insert into public.credit_transactions (user_id, amount, type, reference, action, credit_delta) values ('A', 1, 'earn', $1, 'other', 1)`, [`referral:${id}:friend`]);
  await practise(d, 'B');
  assert.equal(await val(d, `select count(*)::int from public.attempts where user_id = 'B'`), 1, 'the practice is saved');
  assert.equal((await ref(d, 'B')).state, 'joined', 'rolled back to joined, not half paid');
  assert.deepEqual([await balance(d, 'A'), await balance(d, 'B')], [0, 0]);
  await d.query(`delete from public.credit_transactions where action = 'other'`);
  await practise(d, 'B');
  assert.equal((await ref(d, 'B')).state, 'granted');
  assert.deepEqual([await balance(d, 'A'), await balance(d, 'B')], [100, 100]);
});

test('privileges: RLS on with no policy, nothing for the browser roles, the functions for service_role only', async () => {
  const d = await db();
  for (const t of ['referrals', 'referral_codes', 'referral_program']) {
    assert.equal(await val(d, `select relrowsecurity from pg_class where oid = $1::regclass`, [`public.${t}`]), true, t);
    assert.equal(await val(d, `select count(*)::int from pg_policies where tablename = $1`, [t]), 0, t);
    for (const role of ['anon', 'authenticated']) assert.equal(await val(d, `select has_table_privilege($1, $2, 'select')`, [role, `public.${t}`]), false, `${role} ${t}`);
  }
  const fns = (await d.query(`select p.oid::regprocedure::text sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'mm_referral%'`)).rows.map((r) => r.sig);
  assert.equal(fns.length, 11);
  for (const sig of fns) {
    for (const role of ['anon', 'authenticated']) assert.equal(await val(d, `select has_function_privilege($1, $2, 'execute')`, [role, sig]), false, `${role} ${sig}`);
  }
  for (const sig of fns.filter((s) => !/on_attempt|on_mob_run/.test(s))) assert.equal(await val(d, `select has_function_privilege('service_role', $1, 'execute')`, [sig]), true, sig);
});

test('the status says counts only: never a friend’s id, name or the inviter of a friend', async () => {
  const d = await db();
  await pair(d);
  await practise(d, 'B');
  const s = await status(d, 'A');
  assert.deepEqual(Object.keys(s).sort(), ['capReached', 'code', 'earned', 'invited', 'joined', 'monthlyCap', 'ok', 'paused', 'practised', 'reward', 'rewarded', 'rewardedThisMonth', 'notCounted'].sort());
  assert.doesNotMatch(JSON.stringify(s), /"B"|referee|referrer/);
  assert.doesNotMatch(JSON.stringify(await status(d, 'B')), /"A"|referrer/);
});

test('the undo: puts the default back to 100, drops every function and trigger, keeps paid credits and their record', async () => {
  const d = await db();
  await pair(d);
  await practise(d, 'B');
  await d.exec(UNDO);
  await d.exec(UNDO); // re-runnable
  assert.equal(await val(d, `select column_default from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'credit_balance'`), '100');
  assert.equal(await val(d, `select count(*)::int from pg_proc where proname like 'mm_referral%'`), 0);
  assert.equal(await val(d, `select count(*)::int from pg_trigger where tgname like 'mm_referral%'`), 0);
  assert.deepEqual([await balance(d, 'A'), await balance(d, 'B'), (await ledger(d)).length], [100, 100, 2], 'never take credits away');
  assert.equal(await val(d, `select to_regclass('public.referrals') is not null`), true, 'kept: the record of paid credits');
  await user(d, 'C');
  await d.query(`insert into public.attempts (id, user_id, correct, wrong) values ('after-undo', 'C', 5, 5)`);
  // Re-applying picks the kept tables up again.
  await d.exec(MIGRATION);
  assert.equal(await val(d, 'select count(*)::int from public.referrals'), 1);

  const clean = await db();
  await clean.exec(UNDO);
  assert.equal(await val(clean, `select to_regclass('public.referrals') is null and to_regclass('public.referral_codes') is null and to_regclass('public.referral_program') is null`), true, 'nothing paid: all gone');
});

test('codes are read the same way in SQL and in JS (Crockford: O is 0, I and L are 1; spaces and dashes out)', async () => {
  const d = await db();
  for (const raw of ['k7p 2m9', 'K7P-2M9X', 'o1lIabc', 'ABCDEFGH', 'abcdefghi', 'U2345', '', 'K7P2M9!', '0OIL0OI']) {
    assert.equal(await val(d, 'select public.mm_referral_normalise_code($1)', [raw]), normaliseInviteCode(raw), raw);
  }
});

// ---- the shared JS ------------------------------------------------------------------------------------------------------

test('codes, links and the pending-invite cookie', () => {
  assert.equal(normaliseInviteCode('k7p 2m9x'), 'K7P2M9X');
  assert.equal(inviteKind('K7P2M9X'), 'referral');
  assert.equal(inviteKind('K7P2M9'), 'mob_invite');
  assert.equal(inviteKind('K7P2M'), null);
  assert.equal(codeFromInput('https://www.mockmob.in/r/K7P2M9X'), 'K7P2M9X');
  assert.equal(codeFromInput('mockmob.in/join/k7p2m9?x=1'), 'K7P2M9');
  assert.equal(codeFromInput('https://www.mockmob.in/?ref=K7P2M9X'), 'K7P2M9X');
  assert.equal(codeFromInput('no code here!'), null);
  assert.equal(codeFromInput('not a code'), 'N0TAC0DE', 'eight Crockford letters read as a Mob code: the database then finds no such invite');
  assert.equal(referralLink('K7P2M9X'), 'https://www.mockmob.in/r/K7P2M9X');
  const v = encodeInviteCookie({ code: 'k7p2m9x', source: 'link', at: Date.parse('2026-10-20T10:00:00Z') });
  assert.equal(v, 'K7P2M9X.link.1792490400');
  assert.deepEqual(decodeInviteCookie(v), { code: 'K7P2M9X', source: 'link', clickedAt: '2026-10-20T10:00:00.000Z' });
  assert.equal(decodeInviteCookie('K7P2M9X.evil.1792490400'), null);
  assert.equal(decodeInviteCookie('<script>'), null);
  assert.equal(encodeInviteCookie({ code: 'K7P2M9X', source: 'other' }), null);
  assert.equal(referralsLive({}), false);
  assert.equal(referralsLive({ REFERRALS_ENABLED: 'true' }), true);
});

test('which visit leaves a pending invite: a Mob invite and a typed code replace a link; a link never replaces one; /pricing is the creator codes’', () => {
  const now = Date.parse('2026-10-20T10:00:00Z');
  const link = captureFromVisit({ pathname: '/', ref: 'k7p2m9x', now });
  assert.equal(link, 'K7P2M9X.link.1792490400');
  assert.equal(captureFromVisit({ pathname: '/', ref: 'Q2W3E4R', existing: link, now }), null, 'the first friend keeps it');
  assert.equal(captureFromVisit({ pathname: '/pricing', ref: 'K7P2M9X', now }), null);
  assert.equal(captureFromVisit({ pathname: '/', ref: 'creator_1', now }), null);
  assert.equal(captureFromVisit({ pathname: '/', ref: 'K7P2M9', now }), null, 'a Mob code is not a ?ref= link');
  assert.equal(captureFromVisit({ pathname: '/join/K7P2M9', existing: link, now }), 'K7P2M9.mob_invite.1792490400', 'joining a Mob is explicit');
  assert.equal(captureFromVisit({ pathname: '/join/K7P2M9', existing: 'K7P2M9.mob_invite.1792490000', now }), null, 'the same invite again');
  assert.equal(captureFromVisit({ pathname: '/join/K7P2M9X', now }), null);
});

test('the proxy leaves the pending invite only while invites are on, and never touches the creator cookie', () => {
  const req = (path) => new NextRequest(`https://www.mockmob.in${path}`);
  const cookies = (res) => (res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')]).join(';');
  let res = NextResponse.next();
  assert.equal(applyInviteCapture(req('/join/K7P2M9'), res, { env: ON, secure: true }), true);
  assert.match(cookies(res), /mm_invite=K7P2M9\.mob_invite\.\d+/);
  assert.match(cookies(res), /mm_dev=[a-f0-9]{32}/);
  assert.doesNotMatch(cookies(res), /mm_ref=/);
  res = NextResponse.next();
  assert.equal(applyInviteCapture(req('/?ref=K7P2M9X'), res, { env: ON }), true);
  assert.equal(applyInviteCapture(req('/join/K7P2M9'), NextResponse.next(), { env: {} }), false, 'off: nothing');
  assert.equal(applyInviteCapture(req('/pricing?ref=K7P2M9X'), NextResponse.next(), { env: ON }), false);
  assert.match(file('src/proxy.js'), /applyRefCapture\(request, response\);\n\s+applyInviteCapture\(request, response\);/);
});

test('words: the owner’s example status line, every honest state, plain copy with no exclamation marks', () => {
  const base = { live: true, code: 'K7P2M9X', reward: 100, monthlyCap: 10 };
  assert.equal(referralView({ ...base, joined: 2, practised: 1, rewarded: 1, earned: 100 }).summary, '2 friends joined, 1 practised: +100 each.');
  const v = referralView({ ...base, joined: 2, practised: 1, rewarded: 1, earned: 100 });
  assert.equal(v.title, 'Invite a friend, you both get 100 credits');
  assert.deepEqual(v.lines, ['You have earned 100 credits from invites.']);
  assert.equal(v.link, 'https://www.mockmob.in/r/K7P2M9X');
  assert.equal(v.displayCode, 'K7P 2M9X');
  assert.equal(referralView({ ...base, joined: 0 }).summary, 'No friends have joined with your link yet.');
  assert.equal(referralView({ ...base, joined: 1, practised: 0 }).summary, '1 friend joined, 0 practised.');
  const held = referralView({ ...base, joined: 3, practised: 3, rewarded: 2, notCounted: 1, earned: 200 });
  assert.equal(held.summary, '3 friends joined, 3 practised.', 'never "+100 each" over a friend who was not paid');
  assert.ok(held.lines.includes('1 invite did not count toward your reward.'));
  assert.ok(referralView({ ...base, joined: 11, practised: 11, rewarded: 10, notCounted: 1, earned: 1000, capReached: true }).lines.includes(REFERRAL_COPY.capReached(10, 100)));
  assert.ok(referralView({ ...base, paused: true }).lines.includes(REFERRAL_COPY.paused));
  assert.equal(referralView({ ...base, invited: { state: 'joined', rewarded: false } }).invited, REFERRAL_COPY.invitedJoined(100));
  assert.equal(referralView({ ...base, invited: { state: 'granted', rewarded: true } }).invited, REFERRAL_COPY.invitedRewarded(100));
  assert.equal(referralView({ live: false }), null);
  assert.equal(referralView(null), null);
  const words = Object.values(REFERRAL_COPY).map((w) => (typeof w === 'function' ? w(100, 100) : w));
  for (const w of [...words, held.summary, ...held.lines]) {
    assert.doesNotMatch(w, /!|—|·/, w);
    assert.match(w, /^[A-Z0-9]/, w);
  }
  assert.equal(WALLET_V13_COPY.keptNote, 'Credits you earn or buy. They do not expire.');
  assert.equal(practiceWhat({ reference: 'referral:abc:inviter', action: 'referral', credit_delta: 100 }), 'A friend you invited practised');
  assert.equal(practiceWhat({ reference: 'referral:abc:friend', action: 'referral', credit_delta: 100 }), 'Joined with a friend’s invite');
});

test('pricing and copy: no page promises the old 100; the invite line shows only while invites are on', () => {
  const pricing = file('src/app/pricing/page.js');
  assert.doesNotMatch(pricing, /New accounts start with 100 credits/);
  assert.match(pricing, /REFERRAL_COPY\.pricingWelcome,\n\s+\.\.\.\(referralsLive\(\) \? \[REFERRAL_COPY\.pricingInvite\(\)\] : \[\]\),/);
  assert.equal(REFERRAL_COPY.pricingWelcome, 'New accounts start with this month’s 50 free credits.');
  for (const rel of ['src/components/wallet/walletModel.mjs', 'src/app/pricing/page.js']) assert.doesNotMatch(file(rel), /welcome credits/i, rel);
});

// ---- the server glue -----------------------------------------------------------------------------------------------------

test('a claim reads the body first, then the cookie; a phone’s link age becomes server time; done clears the invite', () => {
  const now = Date.parse('2026-10-20T10:00:00Z');
  const cookie = 'K7P2M9X.link.1792490000';
  assert.deepEqual(claimInput({ cookieValue: cookie, now }), { code: 'K7P2M9X', source: 'link', clickedAt: new Date(1792490000 * 1000).toISOString(), fromCookie: true });
  assert.deepEqual(claimInput({ body: { code: 'q2w3e4r', source: 'code', linkAgeSeconds: 60 }, cookieValue: cookie, now }),
    { code: 'Q2W3E4R', source: 'code', clickedAt: '2026-10-20T09:59:00.000Z', fromCookie: false });
  assert.equal(claimInput({ body: { code: 'K7P2M9X', source: 'evil' }, now }).source, 'link');
  assert.equal(claimInput({ body: { code: 'K7P2M9X' }, now }).clickedAt, null, 'no time: the database reads it as now');
  assert.equal(claimInput({ body: {}, cookieValue: null, now }), null);
  assert.deepEqual(claimOutcome({ ok: true, state: 'joined', source: 'link' }), { ok: true, done: true, state: 'joined', reason: null, source: 'link' });
  for (const e of ['self', 'existing_account', 'already_referred', 'unknown_code', 'bad_code']) assert.equal(claimOutcome({ ok: false, error: e }).done, true, e);
  assert.equal(claimOutcome(null).done, false, 'a database that did not answer keeps the invite for the next try');
});

test('hashes: none without a secret, stable with one, device and network kept apart; the network is the IPv4 or the IPv6 /64', () => {
  assert.equal(hashFor('device', 'abc', {}), null);
  const a = hashFor('device', 'abc', ON);
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.equal(hashFor('device', 'abc', ON), a);
  assert.notEqual(hashFor('network', 'abc', ON), a);
  assert.equal(hashFor('network', 'unknown', ON), null);
  assert.equal(networkOf(new Headers({ 'x-forwarded-for': '49.36.1.2, 10.0.0.1' })), '49.36.1.2');
  assert.equal(networkOf(new Headers({ 'x-forwarded-for': '2401:4900:1c2a:5d1e:aaaa:bbbb:cccc:dddd' })), '2401:4900:1c2a:5d1e');
  assert.equal(networkOf(new Headers({})), null);
});

test('end to end through the server glue: claim, status body, live:false when off', async () => {
  const d = await db();
  const rpc = async (name, args) => {
    const keys = Object.keys(args);
    const r = await d.query(`select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`, keys.map((k) => args[k]));
    return { data: r.rows[0].r, error: null };
  };
  await user(d, 'A', '30 days');
  const s = await readReferralStatus({ rpc, userId: 'A', deviceId: 'web-device-id-0000000001', env: ON });
  const body = referralBody(s, { live: true });
  assert.equal(body.live, true);
  assert.equal(body.link, `https://www.mockmob.in/r/${body.code}`);
  assert.equal(body.invited, null);
  assert.equal((await one(d, `select array_length(device_hashes, 1) n from public.referral_codes where user_id = 'A'`)).n, 1, 'the inviter’s device is remembered, hashed');
  await user(d, 'B');
  const claimed = await claimReferral({ rpc, userId: 'B', input: claimInput({ cookieValue: encodeInviteCookie({ code: body.code, source: 'link', at: Date.now() - 60_000 }) }), deviceId: 'web-device-id-0000000001', network: '49.36.1.2', env: ON });
  assert.deepEqual(claimed, { ok: true, done: true, state: 'joined', reason: null, source: 'link' });
  await practise(d, 'B');
  assert.deepEqual([(await ref(d, 'B')).state, (await ref(d, 'B')).held_reason], ['held', 'same_device'], 'the inviter’s own browser');
  assert.deepEqual(await claimReferral({ rpc, userId: 'B', input: { code: body.code }, env: {} }), { ok: false, done: false, state: null, reason: 'off' });
  assert.equal(await readReferralStatus({ rpc, userId: 'A', env: {} }), null);
  assert.deepEqual(referralBody(null), { ok: true, live: false });
  const failing = async () => ({ data: null, error: { message: 'function does not exist' } });
  assert.deepEqual(await claimReferral({ rpc: failing, userId: 'B', input: { code: body.code }, env: ON }), { ok: false, done: false, state: null, reason: 'unavailable' });
});

test('wiring: routes are signed-in where they must be, the deletion plan covers the new tables, the shell claims before practice', () => {
  const status = file('src/app/api/referrals/route.js');
  const claim = file('src/app/api/referrals/claim/route.js');
  assert.match(status, /await auth\(request\)/);
  assert.match(claim, /await auth\(request\)/);
  assert.match(claim, /checkRateLimit/);
  assert.match(file('src/app/r/[code]/route.js'), /INVITE_COOKIE/);
  assert.match(file('src/components/AuthProvider.jsx'), /claimPendingInvite\(signedInId\)/);
  assert.match(file('src/app/api/auth/email-login/route.js'), /loginUrl\.searchParams\.set\('invite', invite\)/);
  const steps = new Map(DELETION_STEPS.map((s) => [s.table, s]));
  assert.equal(steps.get('referral_codes')?.action, 'delete');
  assert.equal(steps.get('referrals')?.action, 'anonymise');
  assert.equal(INVITE_COOKIE, 'mm_invite');
});
