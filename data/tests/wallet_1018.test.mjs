// The credits wallet (owner D76 and D78, 18 Oct 2026): ONE credits balance on the website's Wallet page, one read, one order route,
// one verify route and one set of reload packs, behind WALLET_COMMERCE_OPEN. No network, no Razorpay, no database: the checkout
// steps run with injected fakes and the words run as pure functions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { CREDIT_PACKS, LEGACY_AI_PACKS, PLAY_PRODUCT_IDS, findCreditPack, findBuyableCreditPack } from '../../src/services/credits/creditPacks.mjs';
import { previewChipCredits } from '../../src/app/preview/arena/previewChip.js';
import { packViews, walletCommerceOpen, perCreditInr, creditsLabel } from '../../src/lib/wallet/walletPacks.mjs';
import { createWalletOrder, createPackOrder, verifyWalletPayment } from '../../src/lib/server/walletCheckout.js';
import { walletBody, unifyHistory, creditsBuyLine } from '../../src/lib/server/wallet.js';
import { buildHistory } from '../../src/lib/server/credits.js';
import { startWalletPurchase, PURCHASE_COPY } from '../../src/lib/wallet/startWalletPurchase.js';
import {
  WALLET_COPY, balanceTile, packRows, historyRow, proRow, walletFromResponse, resetLabel, whenParts,
} from '../../src/components/wallet/walletModel.mjs';

const file = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const OPEN = { WALLET_COMMERCE_OPEN: 'true' };

// ---- the catalog -----------------------------------------------------------------------------------------------------
test('pack catalog: one set, usable for everything: Rs 10 for 50, Rs 29 for 150, Rs 49 for 300 (featured)', () => {
  assert.deepEqual(CREDIT_PACKS.map((p) => [p.key, p.amountInr, p.credits, Boolean(p.featured)]), [
    ['credits_10_50', 10, 50, false], ['credits_29_150', 29, 150, false], ['credits_49_300', 49, 300, true],
  ]);
  assert.equal(CREDIT_PACKS.filter((p) => p.featured).length, 1);
  for (const p of CREDIT_PACKS) {
    assert.equal(p.planId, p.key);
    assert.equal(p.amountPaise, p.amountInr * 100);
    assert.equal(creditsLabel(p), `${p.credits} credits`);
  }
  assert.equal(perCreditInr(CREDIT_PACKS[0]), '0.20');
  assert.equal(perCreditInr(CREDIT_PACKS[2]), '0.16');
  assert.deepEqual(packViews().map((p) => Object.keys(p)), CREDIT_PACKS.map(() => ['packId', 'label', 'credits', 'priceInr', 'pricePaise', 'perCreditInr', 'fullMocks', 'featured']));
  assert.equal(CREDIT_PACKS.some((p) => /practice/.test(p.key)), false, 'no separate practice packs');
});

test('retired AI packs cannot be ordered but a payment already taken for one still settles', () => {
  assert.deepEqual(LEGACY_AI_PACKS.map((p) => p.planId), ['ai_credits_prepos_10_50', 'ai_credits_prepos_20_150', 'ai_credits_prepos_50_400']);
  for (const p of LEGACY_AI_PACKS) {
    assert.equal(findBuyableCreditPack(p.planId), null);
    assert.equal(findBuyableCreditPack(p.key), null);
    assert.equal(findCreditPack(p.planId).credits, p.credits);
  }
  assert.equal(findCreditPack('credits_29_150').amountPaise, 2900);
  assert.equal(findCreditPack('pro_monthly_99'), null);
  assert.equal(findCreditPack(''), null);
});

test('the AI wallet service builds its packs from the one catalog and grants any pack into the held balance', () => {
  const svc = file('src/services/credits/aiCreditWallet.js');
  assert.match(svc, /from '\.\/creditPacks\.mjs'/);
  assert.doesNotMatch(svc, /PrepOS top-up/);
  assert.match(file('src/lib/server/walletDeps.js'), /grantPurchasedAICredits/);
  assert.doesNotMatch(file('src/lib/server/walletDeps.js'), /practice/i);
});

test('compat with the credits core: the wallet reads only the core catalog names and the unified wallet keeps the core shape', () => {
  // On the release merge the core's creditPacks.mjs and unifiedWallet.js replace these two files. Every wallet file may import only
  // names the core exports, and the wallet only reads key, planId, amountInr, amountPaise, credits, featured and legacy from a pack.
  const CORE_NAMES = ['CREDIT_PACKS', 'LEGACY_AI_PACKS', 'PLAY_PRODUCT_IDS', 'findCreditPack', 'findBuyableCreditPack'];
  const importers = ['src/lib/wallet/walletPacks.mjs', 'src/lib/server/walletCheckout.js', 'src/services/credits/aiCreditWallet.js', 'data/tests/wallet_1018.test.mjs'];
  for (const rel of importers) {
    const matches = [...file(rel).matchAll(/import \{([^}]*)\} from '[^']*creditPacks\.mjs'/g)];
    assert.ok(matches.length > 0, `${rel} imports the catalog`);
    for (const m of matches) {
      for (const name of m[1].split(',').map((n) => n.trim()).filter(Boolean)) assert.ok(CORE_NAMES.includes(name), `${rel} imports ${name}, which the core does not export`);
    }
  }
  assert.deepEqual(Object.keys(PLAY_PRODUCT_IDS).sort(), CREDIT_PACKS.map((p) => p.key).sort());
  for (const p of CREDIT_PACKS) assert.ok(findBuyableCreditPack(p.key) && findCreditPack(p.planId));
  assert.match(file('src/services/credits/unifiedWallet.js'), /known,\n\s+total/);
  assert.doesNotMatch(file('src/lib/wallet/walletPacks.mjs') + file('src/lib/server/walletCheckout.js'), /\.packId\b|getCreditPack\b|LEGACY_PACKS/, 'no pack.packId: the core catalog names a pack by key');
});

test('the flag is closed unless WALLET_COMMERCE_OPEN is exactly true', () => {
  assert.equal(walletCommerceOpen({}), false);
  for (const v of ['', 'false', '1', 'yes', 'on', 'truee']) assert.equal(walletCommerceOpen({ WALLET_COMMERCE_OPEN: v }), false, v);
  assert.equal(walletCommerceOpen(OPEN), true);
  assert.equal(walletCommerceOpen({ WALLET_COMMERCE_OPEN: ' TRUE ' }), true);
});

// ---- ordering ---------------------------------------------------------------------------------------------------------
function fakeDeps(over = {}) {
  const calls = { orders: [], payments: [], updates: [], grants: [] };
  return {
    calls,
    now: () => 1700000000000,
    createRazorpayOrder: async (params) => { calls.orders.push(params); return { id: 'order_1', status: 'created', amount: params.amount }; },
    createPayment: async (row) => { calls.payments.push(row); },
    userExists: async () => true,
    keyId: () => 'rzp_test_x',
    getPaymentByOrderId: async () => null,
    updatePaymentByOrderId: async (id, patch) => { calls.updates.push([id, patch]); },
    verifySignature: () => true,
    fetchPayment: async () => ({ order_id: 'order_1', amount: 2900, currency: 'INR', status: 'captured' }),
    grant: async (g) => { calls.grants.push(g); return { ok: true, granted: g.pack.credits, balance: 190, idempotent: false }; },
    ...over,
  };
}

test('closed flag: no order, no payment row, no Razorpay call, for every pack', async () => {
  for (const env of [{}, { WALLET_COMMERCE_OPEN: 'false' }]) {
    for (const pack of CREDIT_PACKS) {
      const deps = fakeDeps();
      const r = await createWalletOrder({ userId: 'u1', packId: pack.key, deps, env });
      assert.equal(r.status, 503);
      assert.equal(r.body.error, 'WALLET_COMMERCE_CLOSED');
      assert.equal(r.body.message, 'Top-ups open soon.');
      assert.equal(deps.calls.orders.length, 0);
      assert.equal(deps.calls.payments.length, 0);
    }
  }
});

test('server-side price validation: the amount always comes from the catalog, never from the request', async () => {
  const deps = fakeDeps();
  const r = await createWalletOrder({ userId: 'u1', packId: 'credits_29_150', deps, env: OPEN, price: 1, amount: 100 });
  assert.equal(r.status, 200);
  assert.equal(deps.calls.orders[0].amount, 2900);
  assert.equal(deps.calls.orders[0].currency, 'INR');
  assert.equal(deps.calls.orders[0].notes.credits, '150');
  assert.ok(deps.calls.orders[0].receipt.length <= 40);
  assert.equal(deps.calls.payments[0].planId, 'credits_29_150');
  assert.equal(deps.calls.payments[0].amount, 2900);
  assert.equal(r.body.keyId, 'rzp_test_x');
  assert.deepEqual(r.body.pack, { packId: 'credits_29_150', label: '150 credits', credits: 150, priceInr: 29, pricePaise: 2900 });
});

test('an unknown, empty, tampered or retired pack id creates nothing; a missing user is refused', async () => {
  for (const packId of ['', undefined, null, 'credits_1_50', 'credits_10_300', '../credits_10_50', 'ai_credits_prepos_10_50', 'practice_credits_19_100', { a: 1 }]) {
    const deps = fakeDeps();
    const r = await createWalletOrder({ userId: 'u1', packId, deps, env: OPEN });
    assert.equal(r.status, 400, String(packId));
    assert.equal(deps.calls.orders.length, 0);
  }
  assert.equal((await createWalletOrder({ userId: null, packId: 'credits_10_50', deps: fakeDeps(), env: OPEN })).status, 401);
  assert.equal((await createWalletOrder({ userId: 'u1', packId: 'credits_10_50', deps: fakeDeps({ userExists: async () => false }), env: OPEN })).status, 404);
});

test('the older AI order route and the wallet route make an order the same way (createPackOrder)', async () => {
  assert.match(file('src/app/api/ai/credits/order/route.js'), /createPackOrder/);
  const deps = fakeDeps();
  const out = await createPackOrder({ userId: 'u1', pack: CREDIT_PACKS[0], deps });
  assert.equal(out.order.id, 'order_1');
  assert.equal(deps.calls.orders[0].amount, 1000);
});

// ---- verifying ---------------------------------------------------------------------------------------------------------
const record = (over = {}) => ({ userId: 'u1', planId: 'credits_29_150', status: 'created', ...over });
const input = { razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig' };

test('verify: a bad signature is refused, marks the order failed and grants nothing', async () => {
  const deps = fakeDeps({ getPaymentByOrderId: async () => record(), verifySignature: () => false });
  const r = await verifyWalletPayment({ userId: 'u1', input, deps });
  assert.equal(r.status, 400);
  assert.equal(deps.calls.grants.length, 0);
  assert.equal(deps.calls.updates[0][1].status, 'failed');
});

test('verify: a bad signature or a mismatched payment replayed on an already captured order does not flip the row to failed', async () => {
  const captured = () => record({ status: 'captured', paymentId: 'pay_1', amountPaid: 2900 });
  const badSig = fakeDeps({ getPaymentByOrderId: async () => captured(), verifySignature: () => false });
  const r1 = await verifyWalletPayment({ userId: 'u1', input, deps: badSig });
  assert.deepEqual([r1.status, badSig.calls.updates.length, badSig.calls.grants.length], [400, 0, 0]);
  const wrong = fakeDeps({ getPaymentByOrderId: async () => captured(), fetchPayment: async () => ({ order_id: 'order_1', amount: 100, currency: 'INR', status: 'captured' }) });
  const r2 = await verifyWalletPayment({ userId: 'u1', input, deps: wrong });
  assert.deepEqual([r2.status, wrong.calls.updates.length, wrong.calls.grants.length], [400, 0, 0]);
  // an order that is not captured yet still goes to failed
  const fresh = fakeDeps({ getPaymentByOrderId: async () => record(), verifySignature: () => false });
  await verifyWalletPayment({ userId: 'u1', input, deps: fresh });
  assert.equal(fresh.calls.updates[0][1].status, 'failed');
  // the older verify route carries the same guard
  const legacy = file('src/app/api/ai/credits/verify/route.js');
  assert.match(legacy, /const settled = paymentRecord\.status === 'captured'/);
  assert.equal((legacy.match(/if \(!settled\)/g) || []).length, 2);
});

test('the older order route honours the wallet flag too: closed flag means no order even if aiCommerce is opened', () => {
  const route = file('src/app/api/ai/credits/order/route.js');
  assert.match(route, /walletCommerceOpen\(\)/);
  assert.ok(route.indexOf('walletCommerceOpen()') < route.indexOf('createPackOrder({'), 'the flag is checked before any order is created');
  assert.match(file('docs/brain/WALLET-RAZORPAY.md'), /governs both order routes/);
});

test('the preview shell chip shows the wallet total on the wallet fixture', () => {
  assert.equal(previewChipCredits(new URLSearchParams('view=wallet'), 40), 108);
  assert.equal(previewChipCredits(new URLSearchParams('view=wallet&wallet=zero'), 40), 0);
  assert.equal(previewChipCredits(new URLSearchParams('view=today'), 40), 40);
});

test('verify uses the real Razorpay signature rule (HMAC of order|payment)', () => {
  assert.match(file('src/lib/server/walletDeps.js'), /verifyRazorpayPaymentSignature/);
  assert.match(file('src/lib/payments/razorpay.js'), /createHmac\('sha256', process\.env\.RAZORPAY_KEY_SECRET\)\s*\.update\(`\$\{orderId\}\|\$\{paymentId\}`\)/);
});

test('verify: another student, an unknown order, an unrelated plan, missing fields and a wrong payment all refuse without a grant', async () => {
  const pay = (over) => async () => ({ order_id: 'order_1', amount: 2900, currency: 'INR', status: 'captured', ...over });
  const cases = [
    [{ input: { razorpay_order_id: 'o' } }, 400],
    [{ deps: { getPaymentByOrderId: async () => null } }, 404],
    [{ deps: { getPaymentByOrderId: async () => record({ userId: 'someone_else' }) } }, 404],
    [{ deps: { getPaymentByOrderId: async () => record({ planId: 'pro_monthly_99' }) } }, 400],
    [{ deps: { getPaymentByOrderId: async () => record(), fetchPayment: pay({ amount: 100 }) } }, 400],
    [{ deps: { getPaymentByOrderId: async () => record(), fetchPayment: pay({ status: 'authorized' }) } }, 400],
    [{ deps: { getPaymentByOrderId: async () => record(), fetchPayment: pay({ order_id: 'order_2' }) } }, 400],
    [{ deps: { getPaymentByOrderId: async () => record(), fetchPayment: pay({ currency: 'USD' }) } }, 400],
  ];
  for (const [c, status] of cases) {
    const deps = fakeDeps(c.deps);
    assert.equal((await verifyWalletPayment({ userId: 'u1', input: c.input || input, deps })).status, status);
    assert.equal(deps.calls.grants.length, 0);
  }
});

test('verify: a good payment grants once and marks the order captured; a repeat grants nothing; a retired pack still settles', async () => {
  const deps = fakeDeps({ getPaymentByOrderId: async () => record() });
  const r = await verifyWalletPayment({ userId: 'u1', input, deps });
  assert.equal(r.status, 200);
  assert.equal(r.body.granted, 150);
  assert.equal(deps.calls.grants.length, 1);
  assert.equal(deps.calls.grants[0].paymentId, 'pay_1');
  assert.equal(deps.calls.updates.at(-1)[1].status, 'captured');

  const again = fakeDeps({ getPaymentByOrderId: async () => record({ status: 'captured', paymentId: 'pay_1', amountPaid: 2900 }) });
  const r2 = await verifyWalletPayment({ userId: 'u1', input, deps: again });
  assert.deepEqual([r2.status, r2.body.idempotent, r2.body.granted, again.calls.grants.length], [200, true, 0, 0]);

  const old = fakeDeps({ getPaymentByOrderId: async () => record({ planId: 'ai_credits_prepos_50_400' }), fetchPayment: async () => ({ order_id: 'order_1', amount: 5000, currency: 'INR', status: 'captured' }) });
  const r3 = await verifyWalletPayment({ userId: 'u1', input, deps: old });
  assert.deepEqual([r3.status, r3.body.granted], [200, 400]);
});

test('the grant key is the one the webhook uses, so a verify and a webhook for one payment add credits once; verify is not gated by the flag', () => {
  assert.match(file('src/lib/server/walletDeps.js'), /idempotencyKey: `ai_topup:\$\{orderId\}:\$\{paymentId\}`/);
  assert.match(file('src/app/webhook/route.js'), /idempotencyKey: `ai_topup:\$\{orderId\}:\$\{payment\?\.id\}`/);
  assert.match(file('src/app/webhook/route.js'), /getAICreditPack\(paymentRecord\.planId\)/);
  assert.equal(file('src/app/api/wallet/verify/route.js').includes('walletCommerceOpen('), false);
});

// ---- the read: body shape and history order ------------------------------------------------------------------------------
const UNIFIED = { total: 108, freeLeft: 38, freeAllowance: 50, held: 70, resetAt: '2026-10-31T18:30:00.000Z', parts: { included: 38, bonus: 30, balance: 40 } };

test('GET /api/wallet body: ONE credits balance, the stable field names, the packs, the flag and the plan', () => {
  const body = walletBody({ unified: UNIFIED, paid: false, premiumUntil: null, history: [], env: {} });
  assert.deepEqual(Object.keys(body), ['ok', 'credits', 'plan', 'proOffer', 'packs', 'commerce', 'history', 'historyState']);
  assert.deepEqual(Object.keys(body.credits), ['total', 'freeLeft', 'freeAllowance', 'held', 'resetAt', 'renewsOn', 'parts', 'label', 'buys']);
  assert.equal(body.credits.total, 108);
  assert.equal(body.credits.total, body.credits.freeLeft + body.credits.held, 'one number: free left plus held');
  assert.deepEqual(body.credits.parts, { included: 38, bonus: 30, balance: 40 });
  assert.equal(body.credits.renewsOn, '2026-11-01');
  assert.equal(body.credits.label, 'Credits');
  assert.equal(body.credits.buys, '1 credit = 1 question or 1 Ask Mobi reply. A full mock is 50.');
  assert.equal('practice' in body, false);
  assert.equal('ai' in body, false);
  assert.deepEqual(body.plan, { name: 'Free', until: null });
  assert.equal(body.proOffer.rupees, 99);
  assert.equal(body.packs.length, 3);
  assert.deepEqual(body.commerce, { open: false, message: 'Top-ups open soon.' });
  assert.equal(body.historyState, 'ready');
  assert.deepEqual(walletBody({ unified: UNIFIED, paid: false, history: [], env: OPEN }).commerce, { open: true, message: null });
  assert.equal(creditsBuyLine(), body.credits.buys);
});

test('GET /api/wallet: an unreadable balance is null, never 0; Pro has no offer; a failed history is null with a state', () => {
  const unified = { total: null, freeLeft: null, freeAllowance: null, held: null, resetAt: null, parts: { included: null, bonus: null, balance: null } };
  const body = walletBody({ unified, paid: true, premiumUntil: '2027-07-31T18:29:59.000Z', history: null, env: {} });
  for (const k of ['total', 'freeLeft', 'freeAllowance', 'held', 'resetAt', 'renewsOn']) assert.equal(body.credits[k], null, k);
  assert.deepEqual(body.credits.parts, { included: null, bonus: null, balance: null });
  assert.equal(body.proOffer, null);
  assert.deepEqual(body.plan, { name: 'Pro', until: '2027-07-31' });
  assert.equal(body.history, null);
  assert.equal(body.historyState, 'unavailable');
  assert.equal(walletBody({ unified: undefined, paid: false, history: [], env: {} }).credits.total, null);
});

test('history: both ledgers merged newest first, 20 lines, ONE running balance counted back from today\'s total, wording in credit terms', () => {
  const practiceRows = [
    { id: 'aaaaaaaa-0000-0000-0000-000000000002', created_at: '2026-10-16T10:00:00Z', amount: -10, credit_delta: -10, action: 'attempt_10', reference: 'x' },
  ];
  const aiRows = [
    { id: 'bbbbbbbb-0000-0000-0000-000000000001', created_at: '2026-10-17T10:00:00Z', amount: -1, reason: 'ai_spend', feature: 'prepos_mentor', balance_after: 67, reference: 'r' },
    { id: 'bbbbbbbb-0000-0000-0000-000000000002', created_at: '2026-10-15T10:00:00Z', amount: 150, reason: 'pack_purchase', feature: 'ai_credit_purchase', balance_after: 150, reference: 'r2' },
  ];
  const { history } = buildHistory({ practiceRows, aiRows, practiceBalance: 40, aiBalance: 67, pageSize: 20 });
  const lines = unifyHistory(history, 108);
  assert.deepEqual(lines.map((l) => l.what), ['Ask Mobi', 'Practice set', 'Credits added']);
  assert.deepEqual(lines.map((l) => l.delta), [-1, -10, 150]);
  assert.deepEqual(lines.map((l) => l.balanceAfter), [108, 109, 119]);
  assert.ok(lines.every((l, i) => i === 0 || Date.parse(lines[i - 1].at) >= Date.parse(l.at)));
  assert.deepEqual(unifyHistory(history, null).map((l) => l.balanceAfter), [null, null, null], 'unknown is never counted from 0');
  assert.equal(unifyHistory(null, 5), null);
  assert.equal(unifyHistory([{ at: 'x', pool: 'ai', what: 'Monthly AI credits', delta: 50 }], 50)[0].what, 'Free credits for the month');
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `cccccccc-0000-0000-0000-${String(i).padStart(12, '0')}`, created_at: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(), amount: -1, credit_delta: -1, action: 'attempt_5', reference: `m${i}` }));
  assert.equal(buildHistory({ practiceRows: many, aiRows: [], practiceBalance: 70, aiBalance: null, pageSize: 20 }).history.length, 20);
});

test('the route reads the unified wallet and 20 lines, survives a failed history read, and takes cookie or bearer', () => {
  const route = file('src/app/api/wallet/route.js');
  assert.match(route, /getUnifiedWallet\(user\)/);
  assert.match(route, /pageSize: WALLET_HISTORY_SIZE/);
  assert.match(route, /history = null/);
  assert.match(route, /auth\(request\)/);
  assert.equal(file('src/lib/server/wallet.js').match(/WALLET_HISTORY_SIZE = (\d+)/)[1], '20');
  assert.match(file('src/services/credits/unifiedWallet.js'), /export async function getUnifiedWallet/);
});

// ---- the page's words --------------------------------------------------------------------------------------------------
const bodyOf = (over = {}) => walletFromResponse(walletBody({
  unified: UNIFIED, paid: false, premiumUntil: null, env: {},
  history: [{ at: '2026-10-18T10:10:00.000Z', pool: 'practice', what: 'Practice set', delta: -10 }, { at: '2026-10-15T18:00:00.000Z', pool: 'ai', what: 'AI credits added', delta: 150 }],
  ...over,
}));
const PAGE = bodyOf();

test('the wallet reads its own body and refuses anything that is not it', () => {
  assert.ok(PAGE);
  for (const bad of [null, {}, { ok: true }, { ok: false }, 'x', { ok: true, credits: {}, packs: [] }, { ok: true, practice: {}, ai: {}, packs: [], commerce: {} }]) assert.equal(walletFromResponse(bad), null);
});

test('the balance: one figure, what a credit buys, the free allowance with its reset date (12-hour), the held credits; unknown never 0', () => {
  const t = balanceTile(PAGE);
  assert.equal(t.figure, '108');
  assert.deepEqual(t.lines, [
    '1 credit = 1 question or 1 Ask Mobi reply. A full mock is 50.',
    'Free credits this month: 38 of 50 left, reset on 1 November, 12:00 AM.',
    'Credits you hold: 70. They do not expire.',
  ]);
  assert.equal(resetLabel('2026-10-31T18:30:00.000Z'), '1 November, 12:00 AM');
  assert.deepEqual(whenParts('2026-10-18T10:10:00.000Z'), { date: '18 Oct', time: '3:40 PM' });
  assert.deepEqual(whenParts('2026-10-18T18:30:00.000Z'), { date: '19 Oct', time: '12:00 AM' });
  assert.equal(whenParts('nope'), null);

  const unknown = balanceTile(bodyOf({ unified: { total: null, parts: {} } }));
  assert.equal(unknown.figure, null);
  assert.equal(unknown.state, 'unknown');
  assert.ok(unknown.lines.includes(WALLET_COPY.unknownLine));

  const zero = balanceTile(bodyOf({ unified: { total: 0, freeLeft: 0, freeAllowance: 50, held: 0, resetAt: '2026-10-31T18:30:00.000Z', parts: {} } }));
  assert.deepEqual([zero.figure, zero.state, zero.lines[0]], ['0', 'zero', WALLET_COPY.zeroLine]);

  const pro = balanceTile(bodyOf({ paid: true, premiumUntil: '2027-07-31T18:29:59.000Z' }));
  assert.ok(pro.lines.includes('Practice is included with your Pro plan until 31 July 2027, so your credits go to Ask Mobi replies.'));
});

test('packs: price, size and value per credit; closed keys say Top-ups open soon, open keys say Add for; the featured pack is marked', () => {
  const closed = packRows(PAGE);
  assert.deepEqual(closed.map((r) => [r.title, r.price, r.value, r.perCredit, r.key, r.disabled, r.featured]), [
    ['50 credits', '₹10', '1 full mock, or 50 questions', '₹0.20 a credit', 'Top-ups open soon', true, false],
    ['150 credits', '₹29', '3 full mocks, or 150 questions', '₹0.19 a credit', 'Top-ups open soon', true, false],
    ['300 credits', '₹49', '6 full mocks, or 300 questions', '₹0.16 a credit', 'Top-ups open soon', true, true],
  ]);
  // An older server without the mock count still reads: the value falls back to the per-credit price.
  assert.equal(packRows({ ...PAGE, packs: [{ ...PAGE.packs[0], fullMocks: undefined }] })[0].value, '₹0.20 a credit');
  const open = packRows({ ...PAGE, commerce: { open: true } });
  assert.deepEqual(open.map((r) => [r.key, r.disabled]), [['Add for ₹10', false], ['Add for ₹29', false], ['Add for ₹49', false]]);
  assert.equal(packRows({ ...PAGE, commerce: { open: true } }, { credits_10_50: { status: 'working' } })[0].disabled, true);
});

test('the Pro row shows for Free students only, in one quiet line', () => {
  assert.equal(proRow(PAGE).text, 'Get unlimited mocks: with Pro, practice never uses a credit. ₹99 through 31 July 2027.');
  assert.equal(proRow({ ...PAGE, plan: { name: 'Pro', until: '2027-07-31' } }), null);
  assert.equal(proRow(null), null);
});

test('history rows: date, 12-hour time, what, signed change and balance after', () => {
  const rows = [{ at: '2026-10-18T10:10:00.000Z', what: 'Practice set', delta: -10, balanceAfter: 108 }, { at: '2026-10-15T18:00:00.000Z', what: 'Credits added', delta: 150, balanceAfter: 118 }].map(historyRow);
  assert.deepEqual([rows[0].date, rows[0].time, rows[0].what, rows[0].changeText, rows[0].after], ['18 Oct', '3:40 PM', 'Practice set', '−10', 'Balance 108']);
  assert.equal(rows[1].changeText, '+150');
  assert.equal(historyRow({ delta: 'x' }).changeText, '0');
  assert.equal(historyRow({ delta: 5, balanceAfter: null }).after, null);
});

test('copy rules: sentence case, no exclamation mark, no em dash, no middle dot, no emoji, no hype, one name', () => {
  const strings = [];
  const walk = (v) => { if (typeof v === 'string') strings.push(v); else if (typeof v === 'function') strings.push(v({ rupees: 99, expires: '31 July 2027' }), v('2027-07-31')); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk(WALLET_COPY); walk(PURCHASE_COPY); walk(balanceTile(PAGE)); walk(packRows(PAGE)); walk(PAGE.history.map(historyRow)); walk(proRow(PAGE)); walk(creditsBuyLine());
  for (const t of strings) {
    assert.doesNotMatch(t, /!/, t);
    assert.doesNotMatch(t, /—|·/, t);
    assert.doesNotMatch(t, /\p{Extended_Pictographic}/u, t);
    assert.doesNotMatch(t, /\b(amazing|unlock|boost|supercharge|incredible|limited time|hurry|last chance|ends soon|only today|selling fast|countdown)\b/i, t);
    assert.doesNotMatch(t, /PrepOS|practice credits|AI credits/i, t);
  }
});

test('the page: no lime, no glow, 44 px keys, tabular numerals; nav, chips and the old surfaces point at /wallet', () => {
  const css = file('src/app/(app)/wallet/wallet.css');
  assert.doesNotMatch(css, /volt|box-shadow|text-shadow|blur\(/i);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /tabular-nums/);
  const page = file('src/app/(app)/wallet/WalletPageClient.jsx');
  assert.match(page, /startWalletPurchase\(/);
  assert.doesNotMatch(page, /\/api\/wallet\/order/, 'the page never talks to the order route directly');
  assert.match(page, /WALLET_COPY\.retry/);
  assert.match(file('src/lib/arenaNavigation.js'), /label: 'Account', items: \[item\('profile', 'Account', 'account'\), item\('wallet', 'Wallet', 'wallet'\)/);
  const shell = file('src/app/(app)/AppLayoutClient.jsx');
  assert.equal((shell.match(/previewLinks\?\.wallet \|\| '\/wallet'/g) || []).length, 2, 'both top-bar chips open the wallet');
  assert.doesNotMatch(shell, /href="\/pricing\/ai-credits"/);
  assert.match(file('src/components/CreditsRemainingModal.jsx'), /router\.push\('\/wallet'\)/);
  assert.match(file('src/components/billing/PlanCard.jsx'), /href="\/wallet"/);
  assert.match(file('src/components/profile/CreditsSection.jsx'), /href="\/wallet"/);
  assert.match(file('src/app/pricing/ai-credits/page.js'), /Open your wallet/);
  assert.match(file('src/app/(app)/dashboard/DashboardPageClient.jsx'), /Open your wallet/);
  assert.ok(existsSync(new URL('../../src/app/pricing/ai-credits/page.js', import.meta.url)), 'the AI credits page stays');
  assert.match(file('docs/brain/WALLET-RAZORPAY.md'), /WALLET_COMMERCE_OPEN/);
  assert.match(file('src/app/robots.js'), /'\/wallet'/);
});

// ---- the one client purchase function --------------------------------------------------------------------------------
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('startWalletPurchase: closed top-ups stop at the order route with no checkout, and only the pack id is sent', async () => {
  const seen = [];
  const out = await startWalletPurchase({ packId: 'credits_10_50' }, {
    fetchImpl: async (url, init) => { seen.push([url, JSON.parse(init.body)]); return res(503, { error: 'WALLET_COMMERCE_CLOSED', message: 'Top-ups open soon.' }); },
    loadCheckout: async () => { throw new Error('checkout must not load'); },
  });
  assert.equal(out.status, 'closed');
  assert.deepEqual(seen, [['/api/wallet/order', { packId: 'credits_10_50' }]]);
});

test('startWalletPurchase: order, checkout, verify, paid; a dismissed checkout, a failed payment and a failed verify say so', async () => {
  const order = { order: { id: 'order_1', amount: 2900 }, keyId: 'rzp_test_x', pack: { packId: 'credits_29_150', label: '150 credits', credits: 150, pricePaise: 2900 } };
  const run = (verifyStatus, behaviour) => startWalletPurchase({ packId: 'credits_29_150' }, {
    fetchImpl: async (url) => (url === '/api/wallet/order' ? res(200, order) : res(verifyStatus, verifyStatus === 200 ? { ok: true, granted: 150, balance: 190 } : { error: 'x' })),
    loadCheckout: async () => true,
    openCheckout: (config, on) => { assert.equal(config.order_id, 'order_1'); assert.equal(config.amount, 2900); behaviour(config, on); },
  });
  const paid = await run(200, (c) => c.handler({ razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 's' }));
  assert.deepEqual([paid.status, paid.granted, paid.message], ['paid', 150, '150 credits added.']);
  assert.equal((await run(200, (c) => c.modal.ondismiss())).status, 'dismissed');
  assert.equal((await run(200, (c, on) => on.failed('Card declined'))).message, 'Card declined');
  const bad = await run(400, (c) => c.handler({ razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 's' }));
  assert.deepEqual([bad.status, bad.message], ['failed', PURCHASE_COPY.verifyFailed]);
});

test('startWalletPurchase never throws: a network failure and a signed-out session are plain results', async () => {
  assert.equal((await startWalletPurchase({ packId: 'x' }, { fetchImpl: async () => { throw new Error('offline'); } })).status, 'failed');
  assert.equal((await startWalletPurchase({ packId: 'x' }, { fetchImpl: async () => res(401, {}) })).status, 'signin');
  assert.equal((await startWalletPurchase({})).status, 'failed');
});
