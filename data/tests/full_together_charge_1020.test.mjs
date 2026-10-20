// Full mock together's charge (owner D174, D175, 20 Oct 2026): a Free member pays 50 credits to sit it, exactly once per
// game, through the solo Full mock's own charge; Pro sits free; no free first full mock. The pure rule (practiceCharge,
// mockPrice.mjs) and the real ledger on PGlite: spend_credits for a device-held start, start_learning_session for a
// durable one. No network, no Supabase.
// Run: node --test data/tests/full_together_charge_1020.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { practiceCharge, spendWithLegacyFallback, MOB_GAME_SIT_ACTION } from '../practice_charge.js';
import { practiceCreditAction, practiceCreditCost } from '../test_modes.js';
import { firstFullMockApplies } from '../first_full_mock.js';
import { MOCK_SIT_ACTION, MOCK_SIT_CREDITS, mockGamePrice, mockSitAction, mockStartView } from '../../src/lib/mob/mockPrice.mjs';
import { ledger, ledgerDatabase, ledgerUser, spendCredits, spendable } from './helpers/credits_ledger.mjs';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const GAME = { mobId: 'mob-1', weekStart: '2026-10-19', gameId: 'game-1', questions: [] };
const charge = (over = {}) => practiceCharge({ isPremium: false, modeId: 'full', creditAction: practiceCreditAction('full', 50), count: 50, subject: 'accountancy', ...over });

test('the price is the solo Full mock price, and only Pro is free', () => {
  assert.equal(MOCK_SIT_ACTION, 'attempt_full');
  assert.equal(MOCK_SIT_ACTION, MOB_GAME_SIT_ACTION);
  assert.equal(MOCK_SIT_CREDITS, 50);
  assert.equal(MOCK_SIT_CREDITS, practiceCreditCost('full', 50));
  // The database prices the action the same (spend_credits, one-balance migration).
  assert.match(read('supabase/migrations/20261018210000_one_credits_balance.sql'), /WHEN 'attempt_full'\s+THEN 50/);
  assert.equal(mockSitAction({ pro: true }), null);
  assert.equal(mockSitAction({ pro: false }), 'attempt_full');
  assert.equal(mockSitAction({}), 'attempt_full', 'an unknown plan is Free: the safe side');
  assert.deepEqual(mockStartView({ pro: false }), { costCredits: 50, sitCredits: 50, proRequiredToStart: true, canStart: false, proSitsFree: true });
  assert.deepEqual(mockStartView({ pro: true }), { costCredits: 0, sitCredits: 50, proRequiredToStart: true, canStart: true, proSitsFree: true });
  assert.equal(mockGamePrice({ pro: false, run: 'none' }).costCredits, 50);
  assert.equal(mockGamePrice({ pro: false, run: 'playing' }).costCredits, 0, 'a resume is never charged again');
  assert.equal(mockGamePrice({ pro: true, run: 'none' }).costCredits, 0);
});

test('practiceCharge: a Free sitting of a Mob game is charged as a Full mock; Pro, weekly and extra papers, and anything else are not', () => {
  assert.deepEqual(charge({ mobPaper: { ...GAME, creditAction: 'attempt_full' } }), { creditAction: 'attempt_full', quota: null });
  assert.deepEqual(charge({ isPremium: true, mobPaper: { ...GAME, creditAction: 'attempt_full' } }), { creditAction: null, quota: null }, 'Pro sits free even if asked');
  assert.deepEqual(charge({ mobPaper: { ...GAME, creditAction: null } }), { creditAction: null, quota: null }, 'the Mob service said Pro');
  assert.deepEqual(charge({ mobPaper: { ...GAME, gameId: undefined, creditAction: 'attempt_full' } }), { creditAction: null, quota: null }, 'a weekly paper is never charged');
  assert.deepEqual(charge({ mobPaper: { ...GAME, gameId: undefined, extraId: 'x1', creditAction: 'attempt_full' } }), { creditAction: null, quota: null }, 'an extra paper is never charged');
  assert.deepEqual(charge({ mobPaper: { ...GAME, creditAction: 'attempt_20' } }), { creditAction: null, quota: null }, 'no other action on a Mob paper');
  assert.deepEqual(charge({ modeId: 'quick', count: 10, creditAction: 'attempt_10', mobPaper: { ...GAME, creditAction: 'attempt_full' } }), { creditAction: null, quota: null }, 'only a full paper');
  // No free first full mock on a Mob game (and the switch is off in production, D175).
  assert.equal(firstFullMockApplies({ isPremium: false, modeId: 'full', mobPaper: GAME }), false);
  assert.equal(charge({ mobPaper: { ...GAME, creditAction: 'attempt_full' }, firstFullMock: 'available' }).firstFullMock, undefined);
  // The solo Full mock is unchanged.
  assert.equal(charge({}).creditAction, 'attempt_full');
  assert.deepEqual(charge({ isPremium: true }), { creditAction: null, quota: null });
});

test('the practice start charges the Mob sitting on the solo path: after the paper is built, under practice_<id> or inside start_learning_session', () => {
  const src = read('src/lib/server/practiceSessions.js');
  assert.match(src, /practiceCharge\(\{ isPremium: user\?\.isPremium, mobPaper, modeId: mode\.id, creditAction: practiceCreditAction\(mode\.id, count\)/);
  assert.match(src, /start_learning_session', \{ p_row: \{ \.\.\.row, request_key: input\.generationKey, state: 'active' \}, p_credit_action: charge\.creditAction/);
  assert.match(src, /spendWithLegacyFallback\(\(u, a, r\) => Database\.spendCredits\(u, a, r\), userId, charge\.creditAction, `practice_\$\{id\}`\)/);
  // The device-held charge is the last step: after the set is built and sealed.
  assert.ok(src.indexOf('const ticket = sealPractice(row, secret());') < src.indexOf('if (charge.creditAction) {'));
  // The id (and so the reference) comes from the key and the game, never from the plan or the price.
  assert.match(src, /\.\.\.\(mobPaper\.gameId \? \['game', mobPaper\.gameId\] : \[\]\)/);
  // The Mob service's key is fixed per game and member.
  assert.match(read('src/lib/server/mob/service.js'), /update\(`game:\$\{g\.id\}:\$\{userId\}`\)/);
});

test('device-held start on the real ledger: 50 once per game, a retry is free, short credits charge nothing, Pro never pays', async () => {
  const d = await ledgerDatabase();
  try {
    await ledgerUser(d, 'free', { balance: 70 });
    await ledgerUser(d, 'pro', { balance: 5 });
    const spend = spendCredits(d);
    // What practiceSessions.js does for a device-held start, from the charge on.
    const sit = async (userId, isPremium, sessionId) => {
      const c = practiceCharge({ isPremium, mobPaper: { ...GAME, creditAction: mockSitAction({ pro: isPremium }) }, modeId: 'full', creditAction: practiceCreditAction('full', 50), count: 50, subject: 'accountancy' });
      if (!c.creditAction) return 'free';
      const paid = await spendWithLegacyFallback(spend, userId, c.creditAction, `practice_${sessionId}`);
      if (!paid) throw new Error('INSUFFICIENT_CREDITS');
      return 'paid';
    };
    assert.equal(await sit('free', false, 'practice_game1_free'), 'paid');
    assert.equal(await spendable(d, 'free'), 20);
    assert.equal(await sit('free', false, 'practice_game1_free'), 'paid', 'a retry finds the same reference');
    assert.equal(await spendable(d, 'free'), 20, 'not charged twice');
    assert.deepEqual(await ledger(d, 'free'), [{ reference: 'practice_practice_game1_free', action: 'attempt_full', credit_delta: -50 }]);
    // A second game with 20 left: refused, nothing taken.
    await assert.rejects(sit('free', false, 'practice_game2_free'), /INSUFFICIENT_CREDITS/);
    assert.equal(await spendable(d, 'free'), 20);
    assert.equal((await ledger(d, 'free')).length, 1);
    // Pro with 5 credits sits free.
    assert.equal(await sit('pro', true, 'practice_game1_pro'), 'free');
    assert.equal(await spendable(d, 'pro'), 5);
    assert.deepEqual(await ledger(d, 'pro'), []);
  } finally { await d.close(); }
});

test('durable start on the real ledger: start_learning_session charges once with the session, and a failed start takes nothing', async () => {
  const d = await ledgerDatabase();
  try {
    await ledgerUser(d, 'free', { balance: 60 });
    await ledgerUser(d, 'poor', { balance: 30 });
    const row = (userId, id, key) => ({ id, user_id: userId, request_key: key, subject: 'accountancy', mode: 'full', state: 'active',
      questions: [{ id: 'q1' }], selection_meta: { mobPaper: { mobId: 'mob-1', gameId: 'game-1' } }, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3600_000).toISOString() });
    const start = (r) => d.query('select public.start_learning_session($1::jsonb, $2, null, null) r', [JSON.stringify(r), 'attempt_full']);
    await start(row('free', 's1', 'mob_key_game1_free'));
    await start(row('free', 's1', 'mob_key_game1_free')); // the retry
    assert.equal(await spendable(d, 'free'), 10);
    assert.deepEqual(await ledger(d, 'free'), [{ reference: 'recovery:s1', action: 'attempt_full', credit_delta: -50 }]);
    assert.equal((await d.query("select count(*)::int n from recovery_sessions where user_id = 'free'")).rows[0].n, 1);
    // Too few credits: refused, no session, nothing taken (practiceSessions maps it to INSUFFICIENT_CREDITS).
    await assert.rejects(start(row('poor', 's2', 'mob_key_game1_poor')), /insufficient credits/);
    assert.equal(await spendable(d, 'poor'), 30);
    assert.deepEqual(await ledger(d, 'poor'), []);
    assert.equal((await d.query("select count(*)::int n from recovery_sessions where user_id = 'poor'")).rows[0].n, 0);
    // A start that fails after the charge (the session row cannot be written) rolls the charge back with it.
    await ledgerUser(d, 'broken', { balance: 80 });
    const bad = { ...row('broken', 's3', 'mob_key_game1_broken'), state: 'not-a-state' };
    await assert.rejects(start(bad));
    assert.equal(await spendable(d, 'broken'), 80, 'the failed start took nothing');
    assert.deepEqual(await ledger(d, 'broken'), []);
  } finally { await d.close(); }
});
