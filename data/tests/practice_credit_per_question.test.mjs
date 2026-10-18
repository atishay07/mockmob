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
import { countHint } from '../../src/lib/dailySet.mjs';

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
  assert.match(dash, /\.\.\.countHintFor\(n\)/);
  assert.match(dash, /countHint\(mode\.id, n, \{ isPremium, dailySet: dailyNow \}\)/);
  // The count hint is one pure helper: each count its own cost, Pro none, and the 10 follows the allowance (see the allowance tests below).
  assert.deepEqual([5, 10, 15, 20].map((n) => countHint('quick', n)), ['5 credits', '10 credits', '15 credits', '20 credits']);
  assert.equal(countHint('quick', 15, { isPremium: true }), null);
});

test('Today and the result page price a set by its size, a mock at 50', () => {
  assert.equal(NEXT_MOVE_RULES.practiceCost, 10);
  assert.equal(NEXT_MOVE_RULES.fullMockCost, 50);
  // Today's line is one pure function (src/lib/today/priceLine.mjs): a set by its link's count, a mock at 50.
  const price = file('src/lib/today/priceLine.mjs');
  assert.match(price, /practiceCreditCost\('quick'/);
  assert.match(price, /practiceCreditCost\('full', TEST_MODES\.full\.fixedCount\)/);
  assert.match(file('src/app/(app)/today/page.jsx'), /priceLineOf\(m, \{ premium, balance, dailySet \}\)/);
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

// =====================================================================================================================
// Release 9 part A, verifier fixes (18 Oct 2026). No surface may price today's included 10-question set at 10 credits.
// =====================================================================================================================
import { DAILY_FREE_LINE, DAILY_FREE_SHORT, DAILY_SET, PRICE_AT_START_LINE, dailySetFromQuote, dailySetState } from '../../src/lib/dailySet.mjs';
import { readDailySet, forgetDailySet } from '../../src/lib/useDailySet.js';
import { priceLineOf } from '../../src/lib/today/priceLine.mjs';
import { startRows, heroFromPlan } from '../../src/components/start/startModel.mjs';
import { nextMove, analysisFromRows, practiceCostLine, chapterPracticeClause } from '../result_next_move.mjs';
import { reviewInput } from '../review_input.mjs';
import { quickQuestionsFor } from '../../src/lib/creditCopy.mjs';
import { spendWithLegacyFallback, LEGACY_QUICK_ACTION } from '../practice_charge.js';
import { createHash } from 'node:crypto';

const RAW = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const quoteWith = (allowance, over = {}) => buildPracticeQuote({ user: free(40), subject: 'accountancy', mode: 'quick', count: 10, inventory, token: 'tok-123456789012', now: 0, allowance, ...over });

test('dailySetFromQuote reads the quote the way Practice does: available is free, used and off are priced, a failed read or a blocked quote is unknown', () => {
  assert.equal(dailySetFromQuote(quoteWith({ enabled: true, used: false })), DAILY_SET.free);
  assert.equal(dailySetFromQuote(quoteWith({ enabled: true, used: true })), DAILY_SET.priced, "today's set is used");
  assert.equal(dailySetFromQuote(quoteWith({ enabled: false, used: null })), DAILY_SET.priced, 'the allowance is off: every 10-question set is 10 credits, and that is true');
  assert.equal(dailySetFromQuote(quoteWith({ enabled: true, used: null })), DAILY_SET.unknown, 'the allowance read failed');
  assert.equal(dailySetFromQuote(quoteWith({ enabled: true, used: false }, { inventory: { state: 'unavailable' } })), DAILY_SET.unknown, 'blocked before the allowance step');
  assert.equal(dailySetFromQuote(null), DAILY_SET.unknown);
  assert.equal(dailySetFromQuote({ state: 'unavailable', reasonCode: 'unauthenticated' }), DAILY_SET.unknown);
  assert.equal(dailySetState('free'), 'free');
  assert.equal(dailySetState('unknown'), 'unknown');
  assert.equal(dailySetState(undefined), 'priced', 'a caller that never reads the allowance keeps the words as they were');
  assert.equal(quoteWith({ enabled: true, used: false }).creditCost, 0, 'and the quote itself charges 0 for it');
});

test('the read behind it is one shared, read-only GET of the quote, kept a minute, never kept when it fails', async () => {
  forgetDailySet();
  const calls = [];
  const fetcher = async (url, init) => { calls.push([url, init]); return { ok: true, json: async () => quoteWith({ enabled: true, used: false }) }; };
  const [a, b] = await Promise.all([readDailySet('u1', 'economics', { fetcher }), readDailySet('u1', 'economics', { fetcher })]);
  assert.deepEqual([a, b], ['free', 'free']);
  assert.equal(calls.length, 1, 'two surfaces, one request');
  assert.match(calls[0][0], /^\/api\/practice\/quote\?subject=economics&mode=quick&count=10$/);
  assert.equal(calls[0][1].method, undefined, 'a GET: the quote never charges, reserves or creates a session');
  assert.equal(await readDailySet('u1', 'economics', { fetcher }), 'free');
  assert.equal(calls.length, 1, 'fresh for a minute');
  assert.equal(await readDailySet('u1', 'economics', { fetcher, now: () => Date.now() + 61_000 }), 'free');
  assert.equal(calls.length, 2, 'then it asks again');
  forgetDailySet('u1');
  const down = async () => { throw new TypeError('offline'); };
  assert.equal(await readDailySet('u2', null, { fetcher: down }), 'unknown');
  assert.equal(await readDailySet('u2', null, { fetcher: async () => ({ ok: false }) }), 'unknown');
  assert.equal(await readDailySet('u2', 'english', { fetcher }), 'free', 'a failed read is not kept');
  assert.equal(calls.at(-1)[0].includes('subject=english'), true);
  assert.equal(await readDailySet(null, null, { fetcher }), 'unknown', 'signed out: no read');
  await readDailySet('u3', 'not_a_launch_subject', { fetcher });
  assert.match(calls.at(-1)[0], /subject=english/, 'a subject the quote cannot launch is replaced by one it can (the allowance is the same for every subject)');
  forgetDailySet();
});

test('the count options: the 10 says "Free today" when the set is free, nothing when unread, 10 credits when priced; 5, 15 and 20 never change; Pro has none', () => {
  assert.equal(countHint('quick', 10, { dailySet: 'free' }), DAILY_FREE_SHORT);
  assert.equal(countHint('quick', 10, { dailySet: 'unknown' }), null);
  assert.equal(countHint('quick', 10, { dailySet: 'priced' }), '10 credits');
  assert.equal(countHint('quick', 10), '10 credits');
  for (const n of [5, 15, 20]) for (const state of ['free', 'unknown', 'priced']) assert.equal(countHint('quick', n, { dailySet: state }), `${n} credits`, `${n} questions, ${state}`);
  assert.equal(countHint('quick', 10, { isPremium: true, dailySet: 'free' }), null);
  const dash = file('src/app/(app)/dashboard/DashboardPageClient.jsx');
  assert.match(dash, /const dailyNow = quoteStatus === 'ready' && quoteMatches && isDailySet\(mode\.id, quoteCount\) \? dailySetFromQuote\(quote\) : sharedDaily;/, "the screen's own Quick 10 quote wins over the shared read");
  assert.doesNotMatch(dash, /hint: `\$\{practiceCreditCost/, 'no hint is priced by the list price alone');
  assert.match(dash, /forgetDailySet\(user\?\.id\)/, 'starting a set forgets the read: the included set may be used');
});

test('Today: a 10-question set is free or priceless-until-read when the allowance says so; other sizes, mocks and Pro are untouched', () => {
  const set10 = { id: 'weakest', key: { href: '/dashboard?subject=economics&mode=quick&count=10' } };
  const set15 = { id: 'weakest', key: { href: '/dashboard?subject=economics&mode=quick&count=15' } };
  const mock = { id: 'firstMock', kind: 'mock', key: { href: '/dashboard?subject=economics&mode=full' } };
  const ctx = (dailySet) => ({ premium: false, balance: 40, dailySet });
  assert.equal(priceLineOf(set10, ctx('free')), DAILY_FREE_LINE);
  assert.equal(priceLineOf(set10, ctx('unknown')), PRICE_AT_START_LINE);
  assert.equal(priceLineOf(set10, ctx('priced')), 'This set uses 10 practice credits. You have 40.');
  assert.equal(priceLineOf(set10, { premium: false, balance: 40 }), 'This set uses 10 practice credits. You have 40.', 'default is the words as they were');
  for (const state of ['free', 'unknown', 'priced']) {
    assert.equal(priceLineOf(set15, ctx(state)), 'This set uses 15 practice credits. You have 40.', `15 questions never read the allowance (${state})`);
    assert.equal(priceLineOf(mock, ctx(state)), 'This mock uses 50 practice credits. You have 40.', `a mock has no free set (${state})`);
  }
  assert.equal(priceLineOf(set10, { premium: true, balance: 40, dailySet: 'free' }), null, 'Pro prints nothing');
  assert.equal(priceLineOf({ id: 'revise' }, ctx('free')), 'Free. No credits.');
  const today = file('src/app/(app)/today/page.jsx');
  assert.match(today, /const dailySet = useMyDailySet\(\);/);
  assert.match(today, /dailySet === 'unknown'/, 'the lead holds for the read, under the 1.5 s cap, so a free set never flashes "uses 10 credits"');
});

test('the Start sheet: a free included set reads "Free: today\'s included set." with no number or balance; unread says Practice shows the price; 15, 20, full and Pro are untouched', () => {
  assert.equal(costLine('quick', { balance: 40, dailySet: 'free' }).text, DAILY_FREE_LINE);
  assert.equal(costLine('quick', { balance: 40, count: 10, dailySet: 'free', short: true }).text, DAILY_FREE_SHORT);
  assert.equal(costLine('quick', { balance: 4, dailySet: 'free' }).tone, 'cost', 'free is never "short of credits"');
  assert.equal(costLine('quick', { balance: 40, dailySet: 'unknown' }).text, PRICE_AT_START_LINE);
  assert.equal(costLine('quick', { balance: 40, dailySet: 'priced' }).text, 'Uses 10 of your 40 practice credits.');
  assert.equal(costLine('quick', { balance: 40 }).text, 'Uses 10 of your 40 practice credits.', 'default as before');
  for (const state of ['free', 'unknown']) {
    assert.equal(costLine('quick', { balance: 40, count: 15, dailySet: state }).text, 'Uses 15 of your 40 practice credits.');
    assert.equal(costLine('full', { balance: 60, dailySet: state }).text, 'Uses 50 of your 60 practice credits.');
    assert.equal(costLine('quick', { pro: true, dailySet: state }).text, 'Included with Pro.');
    assert.equal(costLine('nta', { dailySet: state }).text, 'Needs Pro.');
  }
  assert.equal(costLine('quick', { balance: 40, count: 7, dailySet: 'free' }).text, DAILY_FREE_LINE, 'a stray count resolves to the 10-question set the allowance covers');
  const rows = startRows({ subjects: ['accountancy'], subject: 'accountancy', balance: 40, dailySet: 'free' });
  assert.equal(rows.rows.find((r) => r.id === 'quick').cost.text, DAILY_FREE_SHORT);
  assert.equal(rows.rows.find((r) => r.id === 'chapter').cost.text, DAILY_FREE_SHORT);
  assert.equal(rows.rows.find((r) => r.id === 'full').cost.text, costLine('full', { balance: 40, short: true }).text, 'the full mock row is untouched');
  const plan = { primary: { kind: 'ordinary_practice', title: 'Practise 10 questions', href: '/dashboard?subject=accountancy&mode=quick&count=10' }, minutes: 10 };
  assert.equal(heroFromPlan(plan, { subject: 'accountancy', balance: 40, dailySet: 'free' })?.cost?.text, DAILY_FREE_LINE);
  assert.match(file('src/components/start/useStartSheet.js'), /useDailySet\(\{ userId: open \? userId : null, premium: pro, subject \}\)/);
});

const paperFx = (name) => JSON.parse(readFileSync(new URL(`fixtures/result_next_move/${name}.json`, import.meta.url), 'utf8'));
const movePaper = (name, over = {}) => { const { input } = paperFx(name); return nextMove({ ...input, analysis: analysisFromRows(input.rows), repaired: new Set(input.repaired), ...over }); };

test('the result and Review next moves: free says free and names no number; unread names none; priced is the shared fixture words; a mock is still 50', () => {
  for (const name of ['weak', 'zero_credits', 'blank']) {
    assert.equal(movePaper(name, { dailySet: 'priced' }).cost, 'This set uses 10 practice credits. You have 40.', name);
    assert.equal(movePaper(name).cost, 'This set uses 10 practice credits. You have 40.', `${name}: default is the shared fixture`);
    assert.equal(movePaper(name, { dailySet: 'free' }).cost, DAILY_FREE_LINE, name);
    assert.equal(movePaper(name, { dailySet: 'unknown' }).cost, PRICE_AT_START_LINE, name);
  }
  // Rule 1 on a mock: the full mock stays 50; the "or practise 10" alternative follows the allowance.
  assert.equal(movePaper('perfect').cost, 'A full mock uses 50 practice credits. You have 40. Need 10 more. A set level comes with Pro.');
  for (const state of ['free', 'unknown']) assert.equal(movePaper('perfect', { dailySet: state }).cost, 'A full mock uses 50 practice credits. You have 40. Need 10 more. A set level comes with Pro.', `a mock has no free set (${state})`);
  assert.equal(movePaper('perfect').alt.label, 'Or practise 10 in Accountancy, 10 practice credits');
  assert.equal(movePaper('perfect', { dailySet: 'free' }).alt.label, 'Or practise 10 in Accountancy, free today');
  assert.equal(movePaper('perfect', { dailySet: 'unknown' }).alt.label, 'Or practise 10 in Accountancy');
  // Rule 1 on a practice paper (a set, not a mock): no "Need N more" against a price that is not charged.
  const practice = (dailySet) => nextMove({ analysis: analysisFromRows([{ qid: 'a', chapter: 'A', verdict: 'correct' }, { qid: 'b', chapter: 'A', verdict: 'correct' }]), mode: 'quick', subject: 'accountancy', subjectName: 'Accountancy', practiceCredits: 4, dailySet });
  assert.equal(practice('priced').cost, 'This set uses 10 practice credits. You have 4. Need 6 more. A set level comes with Pro.');
  assert.equal(practice('free').cost, `${DAILY_FREE_LINE} A set level comes with Pro.`);
  assert.equal(practice('unknown').cost, `${PRICE_AT_START_LINE} A set level comes with Pro.`);
  assert.equal(practiceCostLine({ isPremium: true, dailySet: 'free' }), 'Pro covers this set.');
  // Review reads the same function through reviewInput.
  const record = JSON.parse(readFileSync(new URL('fixtures/review/student.json', import.meta.url), 'utf8'));
  assert.equal(reviewInput(record, { dailySet: 'free' })?.dailySet, 'free');
  assert.equal(Object.hasOwn(reviewInput(record) || {}, 'dailySet'), false, 'left out when not read: the shared fixtures are unchanged');
  assert.equal(chapterPracticeClause({ practiceCredits: 40 }), 'Uses 10 of your 40 credits.');
  assert.equal(chapterPracticeClause({ practiceCredits: 4 }), 'It uses 10 credits. You have 4.');
  assert.equal(chapterPracticeClause({ practiceCredits: null }), 'Uses 10 credits.');
  assert.equal(chapterPracticeClause({ practiceCredits: 40, dailySet: 'free' }), DAILY_FREE_LINE);
  assert.equal(chapterPracticeClause({ practiceCredits: 40, dailySet: 'unknown' }), PRICE_AT_START_LINE);
  assert.equal(chapterPracticeClause({ isPremium: true, dailySet: 'free' }), 'Pro covers this set.');
});

test('no surface says "uses 10 practice credits" when the allowance says the set is free: every builder, every state', () => {
  const lines = [];
  const asked = { premium: false, balance: 40, dailySet: 'free' };
  lines.push(priceLineOf({ id: 'weakest', key: { href: '/dashboard?mode=quick&count=10' } }, asked));
  lines.push(costLine('quick', { balance: 40, dailySet: 'free' }).text, costLine('quick', { balance: 40, dailySet: 'free', short: true }).text);
  lines.push(...startRows({ subjects: ['economics'], subject: 'economics', balance: 40, dailySet: 'free' }).rows.filter((r) => ['quick', 'chapter'].includes(r.id)).map((r) => r.cost.text));
  for (const name of ['weak', 'zero_credits', 'blank']) lines.push(movePaper(name, { dailySet: 'free' }).cost);
  lines.push(practiceCostLine({ practiceCredits: 40, dailySet: 'free' }), chapterPracticeClause({ practiceCredits: 40, dailySet: 'free' }), countHint('quick', 10, { dailySet: 'free' }));
  for (const line of lines) {
    assert.ok(line, 'a line');
    assert.doesNotMatch(line, /\b10\b|\b40\b/, `"${line}" prices a free set`);
  }
  // The same for an unread allowance: no number at all.
  const unread = [priceLineOf({ id: 'weakest', key: { href: '/dashboard?mode=quick&count=10' } }, { ...asked, dailySet: 'unknown' }), costLine('quick', { dailySet: 'unknown' }).text,
    movePaper('weak', { dailySet: 'unknown' }).cost, chapterPracticeClause({ practiceCredits: 40, dailySet: 'unknown' }), practiceCostLine({ dailySet: 'unknown' })];
  for (const line of unread) assert.doesNotMatch(line, /\d/, `"${line}" names a number before the allowance is read`);
});

test('every web surface that prices a 10-question set reads the allowance (wiring)', () => {
  const surfaces = {
    'src/app/(app)/today/page.jsx': /useMyDailySet\(\)/,
    'src/app/(app)/result/[id]/ResultPageClient.jsx': /isPremium: Boolean\(user\?\.isPremium\), dailySet,/,
    'src/components/review/ReviewPage.jsx': /reviewMove\(record, \{ dailySet \}\)/,
    'src/components/review/ReviewChapters.jsx': /practiseLine\(wallet, allRepaired, dailySet\)/,
    'src/components/revise/ReviseRun.jsx': /practiceCredits: null, dailySet \}/,
    'src/components/start/useStartSheet.js': /startRows\(\{[^}]*dailySet \}\)/,
    'src/app/(app)/dashboard/DashboardPageClient.jsx': /countHint\(mode\.id, n, \{ isPremium, dailySet: dailyNow \}\)/,
  };
  for (const [rel, pattern] of Object.entries(surfaces)) assert.match(file(rel), pattern, rel);
  assert.match(file('src/components/review/ReviewPage.jsx'), /<Empty wallet=\{body\.wallet\} dailySet=\{dailySet\} \/>/);
  // The Today reel builds the same next move but never renders its cost or its alternatives, so it reads nothing.
  const reel = file('src/components/today/TodayReel.jsx') + file('src/lib/today/paperReel.mjs') + file('data/replay.js');
  assert.doesNotMatch(reel, /move\.cost|move\.alt|\.alt\.label/, 'the reel shows no price');
  // The pure modules are the only place the words live: no screen builds "uses 10" itself.
  for (const rel of ['src/app/(app)/today/page.jsx', 'src/components/review/ReviewChapters.jsx', 'src/components/review/ReviewPage.jsx']) {
    assert.doesNotMatch(file(rel), /Uses \$\{n\}|It uses \$\{n\}|usesLine\(/, `${rel} builds no price line of its own`);
  }
});

// ---- the credits modal counts only what can be bought ---------------------------------------------------------------
test('the credits modal: a balance buys whole 5s of questions (37 credits = 35 questions, 3 = not enough for a 5-question set)', () => {
  assert.deepEqual([0, 3, 4, 5, 9, 10, 14, 37, 40, 100].map(quickQuestionsFor), [0, 0, 0, 5, 5, 10, 10, 35, 40, 100]);
  assert.equal(quickQuestionsFor(null), 0);
  assert.equal(quickQuestionsFor(NaN), 0);
  assert.equal(quickQuestionsFor(-5), 0);
  assert.equal(quickQuestionsFor('37'), 35);
  const modal = file('src/components/CreditsRemainingModal.jsx');
  assert.match(modal, /const quickQuestions = quickQuestionsFor\(safe\);/);
  assert.match(modal, /quickQuestions > 0 \? `\$\{quickQuestions\} questions` : `Not enough for a \$\{QUICK_MIN_SET\}-question set`/);
  assert.match(modal, /safe === 0 \? 'You are out of practice credits' : 'Not enough practice credits'/, 'a balance of 3 is not "out", and not "3 questions"');
  assert.doesNotMatch(modal, /Math\.floor\(safe \/ TEST_MODES\.quick\.creditPerQuestion\)/);
});

// ---- a set paid on the old code can be restarted after the deploy ---------------------------------------------------
test('a start paid as "attempt" before the deploy is recognised after it: one retry with the legacy action, only on that refusal, never a second charge', async () => {
  const calls = [];
  const conflict = Object.assign(new Error('credit reference already used for a different transaction'), { code: 'P0001' });
  const old = (rows) => async (user, action, reference) => { calls.push(action); const hit = rows.get(reference); if (hit && hit !== action) throw conflict; rows.set(reference, action); return true; };
  // Paid on the old code: the reference holds 'attempt'.
  const rows = new Map([['practice_abc', 'attempt']]);
  for (const action of ['attempt_5', 'attempt_10', 'attempt_15', 'attempt_20']) {
    calls.length = 0;
    assert.equal(await spendWithLegacyFallback(old(rows), 'u1', action, 'practice_abc'), true, action);
    assert.deepEqual(calls, [action, LEGACY_QUICK_ACTION], `${action}: refused once, then recognised as the same spend`);
  }
  assert.equal(rows.get('practice_abc'), 'attempt', 'no new row was written');
  // A fresh reference is a plain first call.
  calls.length = 0;
  assert.equal(await spendWithLegacyFallback(old(new Map()), 'u1', 'attempt_10', 'practice_new'), true);
  assert.deepEqual(calls, ['attempt_10']);
  // Not that refusal: no retry. Not a per-question action: no retry.
  for (const [action, error] of [['attempt_10', new Error('network down')], ['attempt_10', Object.assign(new Error('insufficient'), { code: '23514' })], ['attempt_full', conflict], ['generate', conflict], ['attempt', conflict]]) {
    calls.length = 0;
    await assert.rejects(spendWithLegacyFallback(async (u, a) => { calls.push(a); throw error; }, 'u1', action, 'practice_x'), (e) => e === error, action);
    assert.deepEqual(calls, [action], `${action}: one call only`);
  }
  // The legacy call refused too (the reference belongs to something else): the refusal is raised, not hidden.
  await assert.rejects(spendWithLegacyFallback(async () => { throw conflict; }, 'u1', 'attempt_10', 'practice_y'), /credit reference already used/);
  // A false (not enough credits) is passed through untouched.
  assert.equal(await spendWithLegacyFallback(async () => false, 'u1', 'attempt_15', 'practice_z'), false);
  const sessions = file('src/lib/server/practiceSessions.js');
  assert.match(sessions, /await spendWithLegacyFallback\(\(u, a, r\) => Database\.spendCredits\(u, a, r\), userId, charge\.creditAction, `practice_\$\{id\}`\)/);
});

test('on PGlite with the migration: a reference paid as "attempt" refuses attempt_10, the legacy retry is recognised, and the balance is charged once', async () => {
  const d = await database({ migrated: true });
  try {
    assert.equal(await spend(d, 'free', 'attempt', 'practice_resume'), true, 'paid on the old code');
    assert.equal(await balance(d, 'free'), 90);
    await assert.rejects(spend(d, 'free', 'attempt_10', 'practice_resume'), /credit reference already used for a different transaction/, 'the bug: refused without the fallback');
    const ledger = async (user, action, reference) => spend(d, user, action, reference);
    assert.equal(await spendWithLegacyFallback(ledger, 'free', 'attempt_10', 'practice_resume'), true, 'restarted after the deploy: recognised');
    assert.equal(await balance(d, 'free'), 90, 'not charged again');
    assert.equal(await spendWithLegacyFallback(ledger, 'free', 'attempt_15', 'practice_resume'), true, 'any per-question action: the old flat charge covers that start');
    assert.equal(await balance(d, 'free'), 90);
    await assert.rejects(spendWithLegacyFallback(ledger, 'pro', 'attempt_10', 'practice_resume'), /credit reference already used/, "another student's reference is still refused");
    assert.equal((await q(d, "select count(*)::int n from credit_transactions where reference='practice_resume'"))[0].n, 1);
  } finally { await d.close(); }
});

// ---- the migration files are LF on every checkout, so md5(prosrc) after the apply matches ---------------------------------
test('the migration and its undo are LF on disk and hash exactly as the deploy plan checks (911105fd... after, 7decd1ff... before)', () => {
  const md5 = (text) => createHash('md5').update(text).digest('hex');
  const body = (text) => /\$function\$([\s\S]*?)\$function\$/.exec(text)[1];
  const migration = RAW('supabase/migrations/20261018170000_practice_credit_per_question.sql');
  const undo = RAW('supabase/undo/20261018170000_practice_credit_per_question.undo.sql');
  assert.equal(migration.includes('\r'), false, 'no CR in the migration: a CRLF checkout hashed e7b4874c...');
  assert.equal(undo.includes('\r'), false, 'no CR in the undo: a CRLF checkout hashed 8ac89ba7...');
  assert.equal(md5(body(migration)), '911105fda93f7c1dcd687b08dd7c1059');
  assert.equal(body(migration).length, 1666);
  assert.equal(md5(body(undo)), PROD_MD5);
  assert.equal(body(undo).length, PROD_LEN);
  const attributes = RAW('.gitattributes').replace(/\r\n/g, '\n');
  assert.match(attributes, /^supabase\/\*\*\/\*\.sql text eol=lf$/m, 'git keeps every migration and undo LF, whatever core.autocrlf is');
});
