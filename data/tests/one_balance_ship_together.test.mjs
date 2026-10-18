// One credits balance, C-core review fixes (18 Oct 2026):
//  - code and database ship together: on a database without 20261018210000_one_credits_balance.sql the web keeps the old
//    figures (practice against users.credit_balance, AI against free + bonus) instead of quoting the one total;
//  - Ask Mobi's model sees one balance with its parts and no second balance beside it (no double count of held credits).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { oneBalanceLive, resetOneBalanceProbe, projectWallet, unifiedFromWallet, walletWindow } from '../../src/services/credits/aiWalletState.js';
import { oneBalanceForModel, ONE_BALANCE_NOTE } from '../../src/services/ai/creditsForModel.js';
import { aiPoolBalance } from '../../src/lib/server/credits.js';

const file = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const fakeDb = (result) => { const calls = []; return { calls, rpc: async (name, args) => { calls.push([name, args]); if (result instanceof Error) throw result; return result; } }; };

test('the probe: the migration\'s mm_wallet_window answering means live (cached for good); a missing function means the old database (cached a minute); anything else is not live and probed again', async () => {
  resetOneBalanceProbe();
  const live = fakeDb({ data: [{}], error: null });
  assert.equal(await oneBalanceLive(live, { now: 1000 }), true);
  assert.equal(await oneBalanceLive(live, { now: 999999999 }), true);
  assert.equal(live.calls.length, 1, 'a yes is cached');
  assert.equal(live.calls[0][0], 'mm_wallet_window');

  resetOneBalanceProbe();
  const old = fakeDb({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.mm_wallet_window in the schema cache' } });
  assert.equal(await oneBalanceLive(old, { now: 0 }), false);
  assert.equal(await oneBalanceLive(old, { now: 59_000 }), false);
  assert.equal(old.calls.length, 1, 'a no is cached for a minute');
  assert.equal(await oneBalanceLive(old, { now: 61_000 }), false);
  assert.equal(old.calls.length, 2, 'then probed again (the migration may have landed)');

  resetOneBalanceProbe();
  const flaky = fakeDb({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } });
  assert.equal(await oneBalanceLive(flaky, { now: 0 }), false, 'unknown is treated like the old database for this request');
  assert.equal(await oneBalanceLive(flaky, { now: 1 }), false);
  assert.equal(flaky.calls.length, 2, 'and not cached');
  resetOneBalanceProbe();
  assert.equal(await oneBalanceLive(fakeDb(new Error('fetch failed')), { now: 0 }), false);
  resetOneBalanceProbe();
});

test('readAIWallet: on the old database AI cannot spend users.credit_balance, so the AI wallet is the old one and oneBalance is false', () => {
  const src = file('src/services/credits/aiCreditWallet.js');
  assert.match(src, /oneBalanceLive\(db\)/);
  assert.match(src, /practiceBalance: live \? held\.data\.credit_balance : 0/);
  assert.match(src, /oneBalance: live/);
  const w = walletWindow(new Date('2026-10-18T10:00:00Z'));
  const row = { included_monthly_credits: 50, included_credits_used: 20, bonus_credits: 5, period_start: w.periodStart, reset_at: w.resetAt };
  const opts = { paid: false, includedMonthlyCredits: 50, paidAiOpen: true, now: new Date('2026-10-18T10:00:00Z') };
  const oldDb = { ...projectWallet(row, { ...opts, practiceBalance: 0 }), oneBalance: false };
  assert.equal(oldDb.total, 35, 'free 30 + bonus 5, as production computes it');
  assert.equal(aiPoolBalance(oldDb), 35, '/api/me/credits ai.balance unchanged');
  const newDb = { ...projectWallet(row, { ...opts, practiceBalance: 40 }), oneBalance: true };
  assert.equal(newDb.total, 75);
  assert.equal(aiPoolBalance(newDb), 35);
});

test('getUnifiedWallet and every caller fall back to the old figures on the old database', () => {
  const unified = file('src/services/credits/unifiedWallet.js');
  assert.match(unified, /wallet\.oneBalance !== false/);
  // Unknown one total: auth/me and the practice quote then use users.credit_balance, exactly what the old spend_credits takes.
  assert.equal(unifiedFromWallet({ known: true, includedRemaining: 30, bonusCredits: 5, includedMonthlyCredits: 50 }, null).known, false);
  assert.match(file('src/app/api/auth/me/route.js'), /creditBalance: credits\?\.known \? credits\.total : \(dbUser\.creditBalance \|\| 0\)/);
  assert.match(file('src/app/api/practice/quote/route.js'), /const creditBalance = credits\?\.known \? credits\.total : user\.creditBalance;/);
  assert.match(file('src/app/api/me/credits/route.js'), /wallet\?\.known && wallet\.oneBalance !== false \? Math\.trunc\(Number\(wallet\.balanceCredits\) \|\| 0\)/);
  assert.match(file('src/app/api/ai/credits/route.js'), /wallet\.known && wallet\.oneBalance !== false \? wallet\.balanceCredits : null/);
  const review = file('src/app/api/me/review/route.js');
  assert.match(review, /credits\.wallet\.oneBalance === false/);
  assert.match(review, /practiceCredits: Number\.isFinite\(held\) \? Math\.trunc\(held\) : null/);
});

test('Ask Mobi\'s context: one total with its parts, and no second balance the model could add to it', () => {
  const ctx = oneBalanceForModel({ aiWallet: { total: 75, includedRemaining: 30, bonusCredits: 5, balanceCredits: 40, resetAt: '2026-10-31T18:30:00.000Z', state: 'available' } });
  assert.deepEqual(ctx, { total: 75, includedRemaining: 30, bonusCredits: 5, heldCredits: 40, resetAt: '2026-10-31T18:30:00.000Z', state: 'available', note: ONE_BALANCE_NOTE });
  assert.equal(ctx.includedRemaining + ctx.bonusCredits + ctx.heldCredits, ctx.total, 'the parts sum to the total');
  assert.match(ONE_BALANCE_NOTE, /never add them to total/);
  assert.equal(oneBalanceForModel(null).total, 0);
  const src = file('src/services/ai/getStudentAIContext.js');
  assert.doesNotMatch(src, /normalCreditBalance/, 'the raw users.credit_balance is no longer sent beside the total');
  assert.match(src, /aiCredits: oneBalanceForModel\(usageSnapshot\)/);
  // The client route keeps the legacy key for older readers, from the same read.
  assert.match(file('src/app/api/ai/context/route.js'), /normalCreditBalance: context\.aiCredits\?\.heldCredits \?\? 0/);
});
