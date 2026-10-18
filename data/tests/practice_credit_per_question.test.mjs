// Practice credits per question (owner, 18 Oct 2026, D65: "5, 10, 15, 20, like as many questions, that many credits").
// Quick practice costs 1 practice credit a question on Free; a full mock stays 50; Pro, every allowance, the starting 100 and
// the AI wallet are unchanged. The helpers, the quote, the charge, the server wiring, the words and the database migration
// supabase/migrations/20261018170000_practice_credit_per_question.sql (and its undo) run here. No network, no model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { TEST_MODES, practiceCreditCost, practiceCreditAction, PER_QUESTION_ACTIONS, resolveCount } from '../test_modes.js';
import { buildPracticeQuote, allowanceKindFor } from '../practice_quote.js';
import { practiceCharge } from '../practice_charge.js';
import { costLine, SESSION } from '../../src/components/start/startModel.mjs';
import { PRACTICE_PRICE, PRACTICE_PRICE_LINE, PRACTICE_PRICE_TAIL } from '../../src/lib/creditCopy.mjs';
import { FAQ_ITEMS } from '../../src/lib/helpFaq.mjs';
import { NEXT_MOVE_RULES } from '../result_next_move.mjs';

const file = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const MIGRATION = file('supabase/migrations/20261018170000_practice_credit_per_question.sql');
const UNDO = file('supabase/undo/20261018170000_practice_credit_per_question.undo.sql');
const PROD_MD5 = '7decd1ff44f4456ed2552a9e19ed1157';   // md5(prosrc) of public.spend_credits on production, read 18 Oct 2026
const PROD_LEN = 1535;

// ---- the price, one helper ---------------------------------------------------------------------------------------
test('Quick practice is 1 credit a question: 5, 10, 15 and 20 cost 5, 10, 15 and 20; a full mock stays 50', () => {
  assert.deepEqual(TEST_MODES.quick.countOptions, [5, 10, 15, 20]);
  for (const n of [5, 10, 15, 20]) {
    assert.equal(practiceCreditCost('quick', n), n);
    assert.equal(practiceCreditAction('quick', n), `attempt_${n}`);
  }
  assert.equal(practiceCreditCost('full', 50), 50);
  assert.equal(practiceCreditAction('full', 50), 'attempt_full');
  assert.deepEqual(PER_QUESTION_ACTIONS, ['attempt_5', 'attempt_10', 'attempt_15', 'attempt_20']);
});

test('any count outside 5, 10, 15, 20 has no Quick price and no action; the server resolves it to the default set', () => {
  for (const n of [0, 1, 4, 6, 7, 9, 11, 25, 30, 50, -5, 10.5, NaN, null, undefined, '10x']) {
    assert.equal(practiceCreditCost('quick', n), null, `count ${n}`);
    assert.equal(practiceCreditAction('quick', n), null, `count ${n}`);
  }
  assert.equal(practiceCreditCost('quick', '15'), 15, 'a numeric string is the same count');
  assert.equal(resolveCount(TEST_MODES.quick, 7), 10, 'the start paths resolve a stray count to 10 and charge for 10');
  assert.equal(resolveCount(TEST_MODES.quick, 50), 10);
});

test('Pro modes and unknown modes: no charge, no action', () => {
  for (const mode of ['smart', 'nta']) {
    assert.equal(practiceCreditCost(mode, 15), 0);
    assert.equal(practiceCreditAction(mode, 15), null);
  }
  assert.equal(practiceCreditCost('nope', 10), null);
  assert.equal(practiceCreditAction('nope', 10), null);
  assert.equal(TEST_MODES.quick.creditCost, undefined, 'no flat Quick price is left to read by mistake');
});

// ---- the quote ----------------------------------------------------------------------------------------------------
const inventory = { state: 'available', checkedAt: '2026-10-18T00:00:00Z', subjectCounts: { accountancy: 600, economics: 600, english: 600 } };
const free = (creditBalance = 100) => ({ id: 'u1', isPremium: false, premiumUntil: null, creditBalance });
const pro = { id: 'u2', isPremium: true, premiumUntil: '2027-07-31T18:29:59.000Z', creditBalance: 0 };
const quote = (over = {}) => buildPracticeQuote({ user: free(), subject: 'accountancy', mode: 'quick', count: 10, inventory, token: 'tok-123456789012', now: 0, ...over });

test('the quote prices each count: 5, 10, 15, 20 questions cost 5, 10, 15, 20 credits (the daily 10 set is free on its own)', () => {
  for (const n of [5, 10, 15, 20]) {
    const q = quote({ count: n });
    assert.equal(q.launchable, true);
    assert.equal(q.count, n);
    assert.equal(q.creditCost, n, `${n} questions`);
  }
  assert.equal(quote({ count: 10, allowance: { enabled: true, used: false } }).creditCost, 0, "today's included 10-question set is still free");
  assert.equal(quote({ count: 10, allowance: { enabled: true, used: true } }).creditCost, 10, 'once used, the second 10-question set is 10 credits');
  assert.equal(quote({ count: 15, allowance: { enabled: true, used: false } }).creditCost, 15, 'the included set is the 10-question set only');
  assert.equal(quote({ count: 7 }).count, 10, 'a stray count is the default set');
  assert.equal(quote({ count: 7 }).creditCost, 10);
});

test('the quote: a full mock is 50, Pro pays nothing for any count, and a balance below the price blocks with that price', () => {
  assert.equal(quote({ mode: 'full', count: 50 }).creditCost, 50);
  for (const n of [5, 10, 15, 20]) assert.equal(quote({ user: pro, count: n }).creditCost, 0);
  const short = quote({ user: free(14), count: 15 });
  assert.equal(short.launchable, false);
  assert.equal(short.reasonCode, 'insufficient_credits');
  assert.equal(short.creditCost, 15);
  assert.match(short.reason, /costs 15 credits and you have 14/);
  assert.equal(quote({ user: free(15), count: 15 }).launchable, true);
  assert.equal(quote({ user: free(5), count: 5 }).launchable, true);
  assert.equal(quote({ user: free(4), count: 5 }).launchable, false);
});

test('the free allowances are exactly as before: the daily 10-set, the first set in a subject, the full sample', () => {
  assert.equal(allowanceKindFor({ isPremium: false, modeId: 'quick', count: 10, purpose: 'ordinary', subjectId: 'accountancy' }), 'daily_practice');
  assert.equal(allowanceKindFor({ isPremium: false, modeId: 'quick', count: 5, purpose: 'baseline', subjectId: 'english' }), 'baseline:english');
  assert.equal(allowanceKindFor({ isPremium: false, modeId: 'full', count: 50, purpose: 'full_sample', subjectId: 'economics' }), 'full_sample:economics');
  assert.equal(allowanceKindFor({ isPremium: false, modeId: 'quick', count: 15, purpose: 'ordinary', subjectId: 'accountancy' }), null);
  assert.equal(quote({ count: 5, purpose: 'baseline', subject: 'english', allowance: { enabled: true, used: false } }).creditCost, 0, 'the first 5-question baseline is free');
  assert.equal(quote({ count: 5, purpose: 'baseline', subject: 'english', allowance: { enabled: true, used: true } }).creditCost, 5, 'a second 5-question set is 5');
});

// ---- the charge (what the start paths send to the database) -----------------------------------------------------
test('practiceCharge: the action follows the count; allowances, Pro and Mob papers are unchanged', () => {
  const base = { modeId: 'quick', subject: 'accountancy' };
  for (const n of [5, 10, 15, 20]) {
    const action = practiceCreditAction('quick', n);
    const charge = practiceCharge({ ...base, creditAction: action, count: n });
    assert.equal(charge.creditAction, action);
    assert.equal(charge.quota, n === 10 ? 'daily_practice' : null, `${n}`);
  }
  assert.deepEqual(practiceCharge({ ...base, creditAction: 'attempt_5', count: 5, purpose: 'baseline', subject: 'english' }), { creditAction: 'attempt_5', quota: 'baseline:english' });
  assert.deepEqual(practiceCharge({ modeId: 'full', creditAction: 'attempt_full', count: 50, purpose: 'full_sample', subject: 'economics' }), { creditAction: 'attempt_full', quota: 'full_sample:economics' });
  assert.deepEqual(practiceCharge({ ...base, creditAction: 'attempt_20', count: 20, isPremium: true }), { creditAction: null, quota: null });
  assert.deepEqual(practiceCharge({ ...base, creditAction: 'attempt_15', count: 15, mobPaper: { mobId: 'm', weekStart: '2026-10-12' } }), { creditAction: null, quota: null });
  assert.deepEqual(practiceCharge({ modeId: 'smart', creditAction: practiceCreditAction('smart', 15), count: 15, subject: 'accountancy' }), { creditAction: null, quota: null });
});

test('the start paths take the action from the one helper; the free 5-question recovery set stays free', () => {
  const sessions = file('src/lib/server/practiceSessions.js');
  assert.match(sessions, /creditAction: practiceCreditAction\(mode\.id, count\)/);
  assert.doesNotMatch(sessions, /mode\.creditAction/);
  const recovery = file('src/lib/server/recoverySessions.js');
  assert.match(recovery, /!\(mode\.id === 'quick' && count === 5\) \? practiceCreditAction\(mode\.id, count\) : null/);
  assert.doesNotMatch(recovery, /mode\.creditAction/);
  assert.match(file('data/db.js'), /\['generate', 'attempt', \.\.\.PER_QUESTION_ACTIONS, 'attempt_full'\]\.includes\(action\)/);
  for (const rel of ['src/app/(app)/dashboard/DashboardPageClient.jsx', 'src/app/(app)/today/page.jsx', 'src/components/start/startModel.mjs', 'src/components/CreditsRemainingModal.jsx', 'data/practice_quote.js']) {
    assert.doesNotMatch(file(rel), /TEST_MODES\.quick\.creditCost/, rel);
  }
});

test('the credits history names every Quick spend a Practice set and the full mock a Full mock', () => {
  const credits = file('src/lib/server/credits.js');
  for (const action of ['attempt', 'attempt_5', 'attempt_10', 'attempt_15', 'attempt_20']) assert.match(credits, new RegExp(`${action}: 'Practice set'`), action);
  assert.match(credits, /attempt_full: 'Full mock'/);
});

// ---- the words ----------------------------------------------------------------------------------------------------
test('one sentence says the price everywhere: "Practice credits: 1 a question. A 10-question set is 10, a full mock 50."', () => {
  assert.equal(PRACTICE_PRICE_LINE, 'Practice credits: 1 a question. A 10-question set is 10, a full mock 50.');
  assert.equal(PRACTICE_PRICE_TAIL, '1 a question. A 10-question set is 10, a full mock 50.');
  assert.deepEqual({ ...PRACTICE_PRICE }, { perQuestion: 1, set: 10, setQuestions: 10, full: 50 });
  const pricing = file('src/app/pricing/page.js');
  assert.match(pricing, /^ {2}PRACTICE_PRICE_LINE,$/m, '/pricing notes');
  assert.match(pricing, /1 a question in Quick practice, 50 a Full mock/);
  assert.match(pricing, /Quick practice, 5 to 20 questions, 1 practice credit a question/);
  assert.match(pricing, /\['Quick practice \(5 to 20 questions\)', '1 credit a question', 'Unlimited'\]/);
  assert.match(file('src/components/billing/PlanCard.jsx'), /\$\{PRACTICE_PRICE_LINE\}/);
  // Release 9: Practice says the price once (the mode tiles, and the card's Cost line), not again under the lede.
  assert.doesNotMatch(file('src/app/(app)/dashboard/DashboardPageClient.jsx'), /PRACTICE_PRICE_TAIL/);
  const faq = FAQ_ITEMS.find((item) => item.id === 'credits');
  assert.ok(faq.answer.includes(PRACTICE_PRICE_LINE), 'the help answer states it');
});

test('no page, help answer or helper still says Quick practice costs 10 or "a session"', () => {
  const files = ['src/app/pricing/page.js', 'src/app/features/page.js', 'src/app/page.js', 'src/app/pricing/ai-credits/page.js', 'src/components/billing/PlanCard.jsx',
    'src/components/CreditsRemainingModal.jsx', 'src/lib/helpFaq.mjs', 'src/lib/paperCopy.mjs', 'src/app/(app)/dashboard/DashboardPageClient.jsx', 'src/components/start/startModel.mjs', 'data/capabilities.js'];
  for (const rel of files) {
    assert.doesNotMatch(file(rel), /10 (practice )?credits a session|Quick practice (costs|uses) (\$\{[^}]+\}|10) practice credits|10 a Quick session|credits per session/i, `${rel} still states the flat price`);
  }
});

test('the Start sheet and the dashboard show each count with its own cost; Pro shows none', () => {
  assert.equal(SESSION.quickCost, 10);
  assert.deepEqual([5, 10, 15, 20].map((n) => costLine('quick', { count: n, short: true }).text), ['5 credits', '10 credits', '15 credits', '20 credits']);
  assert.equal(costLine('quick', { count: 15, pro: true }).text, 'Included with Pro.');
  const dash = file('src/app/(app)/dashboard/DashboardPageClient.jsx');
  assert.match(dash, /hint: `\$\{practiceCreditCost\(mode\.id, n\)\} credits`/);
  assert.match(dash, /isPremium \|\| !practiceCreditCost\(mode\.id, n\)/);
});

test('Today and the result page price a set by its size, a mock at 50', () => {
  assert.equal(NEXT_MOVE_RULES.practiceCost, 10);
  assert.equal(NEXT_MOVE_RULES.fullMockCost, 50);
  const today = file('src/app/(app)/today/page.jsx');
  assert.match(today, /practiceCreditCost\('quick'/);
  assert.match(today, /practiceCreditCost\('full', TEST_MODES\.full\.fixedCount\)/);
});

// ---- the database -------------------------------------------------------------------------------------------------
async function database({ migrated }) {
  const d = new PGlite();
  await d.exec(`create role anon;create role authenticated;create role service_role;
    create table users(id text primary key,credit_balance int);
    create table questions(id text primary key,subject text,chapter text,body text,options jsonb,correct_answer text,explanation text);
    create table attempts(id text primary key,user_id text,subject text,score int,correct int,wrong int,unattempted int,total int,details jsonb,questions_snapshot jsonb);
    create table user_question_progress(user_id text,question_id text,subject text,chapter text,seen_count int default 0,attempt_count int default 0,correct_count int default 0,skip_count int default 0,last_selected_key text,last_correct boolean,last_seen_at timestamptz);
    create table credit_transactions(user_id text,amount int,type text,reference text primary key,action text,credit_delta int);
    create table question_interactions(user_id text,question_id text);
    create table question_bookmarks(user_id text,question_id text);
    insert into users values('free',100),('poor',4),('pro',0);`);
  // The real migrations that define spend_credits and the two start functions, in their order.
  for (const f of ['0036_mode_aware_credits.sql', '20261001105920_score_recovery_foundations.sql', '20261002120000_connected_learning.sql', '20261002123000_answer_correction_history.sql'])
    await d.exec(readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8'));
  // Production's state before this change: the undo file holds production's spend_credits exactly as read on 18 Oct 2026.
  await d.exec(UNDO);
  if (migrated) await d.exec(MIGRATION);
  return d;
}
const q = (d, sql, params) => d.query(sql, params).then((r) => r.rows);
const balance = async (d, id) => (await q(d, 'select credit_balance b from users where id=$1', [id]))[0].b;
const spend = (d, user, action, ref) => q(d, 'select public.spend_credits($1,$2,$3) r', [user, action, ref]).then((r) => r[0].r);
const sessionRow = (id, user = 'free') => ({ id, user_id: user, request_key: `key_${id}_xxxxxxxx`, subject: 'economics', mode: 'quick', state: 'active', questions: [{ id: 'q1', familyId: `fam_${id}` }], selection_meta: {}, events: [], created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3600000).toISOString() });

test('the undo file is production exactly: md5(prosrc) and length match what production had on 18 Oct 2026', async () => {
  const d = await database({ migrated: false });
  try {
    const [row] = await q(d, "select md5(prosrc) m, length(prosrc) l, prosrc like '%attempt_5%' has5 from pg_proc where proname='spend_credits'");
    assert.equal(row.m, PROD_MD5);
    assert.equal(row.l, PROD_LEN);
    assert.equal(row.has5, false);
    assert.ok(MIGRATION.includes(PROD_MD5) && UNDO.includes(PROD_MD5), 'the header of both files records the md5 for the pre-check');
  } finally { await d.close(); }
});

test('before the migration the new actions are refused (why the migration goes first); the old ones work', async () => {
  const d = await database({ migrated: false });
  try {
    await assert.rejects(spend(d, 'free', 'attempt_5', 'before:1'), /unsupported credit spend action: attempt_5/);
    assert.equal(await spend(d, 'free', 'attempt', 'before:2'), true);
    assert.equal(await balance(d, 'free'), 90);
  } finally { await d.close(); }
});

test('after the migration: 5, 10, 15, 20 and full spend exactly that; the old attempt is still 10; generate still 10', async () => {
  const d = await database({ migrated: true });
  try {
    let left = 100;
    for (const [action, amount] of [['attempt_5', 5], ['attempt_10', 10], ['attempt_15', 15], ['attempt_20', 20], ['attempt_full', 50]]) {
      assert.equal(await spend(d, 'free', action, `spend:${action}`), true, action);
      left -= amount;
      assert.equal(await balance(d, 'free'), left, `${action} spends ${amount}`);
    }
    assert.equal(left, 0);
    const rows = await q(d, "select action, credit_delta from credit_transactions where user_id='free'");
    assert.deepEqual(Object.fromEntries(rows.map((r) => [r.action, r.credit_delta])), { attempt_10: -10, attempt_15: -15, attempt_20: -20, attempt_5: -5, attempt_full: -50 });
    await q(d, "update users set credit_balance = 100 where id='free'");
    assert.equal(await spend(d, 'free', 'attempt', 'old:attempt'), true);
    assert.equal(await spend(d, 'free', 'generate', 'old:generate'), true);
    assert.equal(await balance(d, 'free'), 80, "the old 'attempt' is still 10 and 'generate' is still 10");
  } finally { await d.close(); }
});

test('after the migration: a retry charges once; a different action or user on one reference is refused', async () => {
  const d = await database({ migrated: true });
  try {
    assert.equal(await spend(d, 'free', 'attempt_15', 'practice_same'), true);
    assert.equal(await spend(d, 'free', 'attempt_15', 'practice_same'), true, 'the retry answers true');
    assert.equal(await balance(d, 'free'), 85, 'and charged once');
    await assert.rejects(spend(d, 'free', 'attempt_10', 'practice_same'), /credit reference already used for a different transaction/);
    await assert.rejects(spend(d, 'pro', 'attempt_15', 'practice_same'), /credit reference already used/);
    assert.equal(await balance(d, 'free'), 85);
  } finally { await d.close(); }
});

test('after the migration: a balance below the price is refused (false) and never goes negative, for every count; unknown actions raise', async () => {
  const d = await database({ migrated: true });
  try {
    for (const [action, price] of [['attempt_5', 5], ['attempt_10', 10], ['attempt_15', 15], ['attempt_20', 20], ['attempt_full', 50]]) {
      await q(d, "update users set credit_balance = $1 where id='poor'", [price - 1]);
      assert.equal(await spend(d, 'poor', action, `short:${action}`), false, `${price - 1} credits cannot buy ${action}`);
      assert.equal(await balance(d, 'poor'), price - 1);
      await q(d, "update users set credit_balance = $1 where id='poor'", [price]);
      assert.equal(await spend(d, 'poor', action, `exact:${action}`), true, `${price} credits buy ${action}`);
      assert.equal(await balance(d, 'poor'), 0);
    }
    for (const bad of ['attempt_7', 'attempt_25', 'attempt_0', 'attempt_', 'attempt_50', 'ATTEMPT_5', 'attempt_5 ']) {
      await assert.rejects(spend(d, 'free', bad, `bad:${bad}`), /unsupported credit spend action/, bad);
    }
    assert.equal(await balance(d, 'free'), 100, 'a refused action spends nothing');
  } finally { await d.close(); }
});

test('through start_learning_session: the daily 10-set is free once, a second 10 is 10, and 5, 15, 20 and full are charged by size', async () => {
  const d = await database({ migrated: true });
  try {
    const start = (id, action, quota = null, period = null) => q(d, 'select start_learning_session($1,$2,$3,$4) r', [sessionRow(id), action, quota, period]);
    await start('daily1', 'attempt_10', 'daily_practice', '2026-10-18');
    assert.equal(await balance(d, 'free'), 100, "today's included set takes no credits");
    await start('daily2', 'attempt_10', 'daily_practice', '2026-10-18');
    assert.equal(await balance(d, 'free'), 90, 'a second 10-question set the same day is 10');
    await start('five', 'attempt_5');
    assert.equal(await balance(d, 'free'), 85);
    await start('fifteen', 'attempt_15');
    assert.equal(await balance(d, 'free'), 70);
    await start('twenty', 'attempt_20');
    assert.equal(await balance(d, 'free'), 50);
    await start('full', 'attempt_full');
    assert.equal(await balance(d, 'free'), 0);
    await start('five', 'attempt_5');
    assert.equal(await balance(d, 'free'), 0, 'a retry of a start (same request key) charges nothing more');
    await assert.rejects(start('late', 'attempt_5'), /insufficient credits/);
    assert.equal((await q(d, "select count(*)::int n from recovery_sessions where id='late'"))[0].n, 0, 'an unpaid start leaves no session');
    await q(d, "update users set credit_balance = 40 where id='free'");
    await q(d, 'select start_learning_session($1,$2,$3,$4)', [sessionRow('pro1', 'pro'), null, null, null]);
    await q(d, 'select start_recovery_session($1,$2)', [{ ...sessionRow('rec5'), request_key: 'rec5_key_xxxxxxxx' }, null]);
    assert.equal(await balance(d, 'free'), 40, 'the free 5-question recovery set sends no action');
    assert.equal(await balance(d, 'pro'), 0, 'Pro sends no action');
  } finally { await d.close(); }
});

test('start_recovery_session charges the count-based action in one transaction with the session row', async () => {
  const d = await database({ migrated: true });
  try {
    await q(d, 'select start_recovery_session($1,$2)', [{ ...sessionRow('rec15'), request_key: 'rec15_key_xxxxxxxx' }, 'attempt_15']);
    assert.equal(await balance(d, 'free'), 85);
    await q(d, "update users set credit_balance = 14 where id='free'");
    await assert.rejects(q(d, 'select start_recovery_session($1,$2)', [{ ...sessionRow('rec15b'), request_key: 'rec15b_key_xxxxxxx' }, 'attempt_15']), /insufficient credits/);
    assert.equal((await q(d, "select count(*)::int n from recovery_sessions where id='rec15b'"))[0].n, 0, 'no session without payment');
    assert.equal(await balance(d, 'free'), 14, 'and nothing was spent');
  } finally { await d.close(); }
});

test('the undo restores production exactly and the per-count actions are refused again; spends already made keep their rows', async () => {
  const d = await database({ migrated: true });
  try {
    assert.equal(await spend(d, 'free', 'attempt_15', 'undo:1'), true);
    await d.exec(UNDO);
    const [row] = await q(d, "select md5(prosrc) m, length(prosrc) l from pg_proc where proname='spend_credits'");
    assert.equal(row.m, PROD_MD5);
    assert.equal(row.l, PROD_LEN);
    await assert.rejects(spend(d, 'free', 'attempt_5', 'undo:2'), /unsupported credit spend action/);
    assert.equal(await spend(d, 'free', 'attempt', 'undo:3'), true);
    assert.equal(await balance(d, 'free'), 75);
    assert.equal((await q(d, "select count(*)::int n from credit_transactions where action='attempt_15'"))[0].n, 1);
  } finally { await d.close(); }
});

test('the migration changes only the price map: no table, grant, policy or other function is touched', () => {
  const code = MIGRATION.split('\n').filter((line) => !line.startsWith('--')).join('\n');
  assert.equal((code.match(/create or replace function/gi) || []).length, 1);
  const outside = code.replace(/\$function\$[\s\S]*\$function\$/, '');   // what the file does besides define the function
  assert.doesNotMatch(outside, /\b(alter|drop|grant|revoke|create (table|policy|index|trigger)|insert|update|delete)\b/i);
  assert.match(code, /set search_path to 'public', 'pg_temp'/, "production's search_path is kept");
  for (const [action, amount] of [['attempt_5', 5], ['attempt_10', 10], ['attempt_15', 15], ['attempt_20', 20], ['attempt', 10], ['attempt_full', 50], ['generate', 10]])
    assert.match(code, new RegExp(`WHEN '${action}'\\s+THEN ${amount}\\b`), action);
});
