// Version 13 money surfaces on the website (owner I6 and I9, 20 Oct 2026): the Pro page (/pricing) and the Wallet (/wallet).
// Presentation only: prices, plans, Razorpay logic and credit amounts are untouched, so these tests hold the words, the maths
// and the honesty rules, with no network and no database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CREDIT_PACKS } from '../../src/services/credits/creditPacks.mjs';
import { walletBody } from '../../src/lib/server/wallet.js';
import {
  WALLET_V13_COPY, walletFromResponse, balanceSplit, priceRows, packValue, packCards, proBridge, refillLine, packRows,
} from '../../src/components/wallet/walletModel.mjs';

const file = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const UNIFIED = { known: true, total: 108, freeLeft: 38, freeAllowance: 50, held: 70, resetAt: '2026-10-31T18:30:00.000Z', parts: { included: 38, bonus: 30, balance: 40 } };
const page = (over = {}) => walletFromResponse(walletBody({ unified: UNIFIED, paid: false, premiumUntil: null, history: [], env: {}, ...over }));
const PRICES = { question: 1, fullMock: 50, analysis: 3, reply: 1, firstMockFree: true };

test('best value is real maths: the cheapest per credit, with each saving rounded down against the dearest pack', () => {
  const data = page();
  const value = packValue(data.packs);
  assert.equal(value.bestId, 'credits_49_300');
  assert.deepEqual(value.savePercent, { credits_29_150: 3, credits_49_300: 18 });
  // The maths agrees with the catalog's featured pack today; if a price ever changes, the page follows the maths.
  assert.equal(CREDIT_PACKS.find((p) => p.featured).key, value.bestId);
  assert.deepEqual(packValue([{ packId: 'a', priceInr: 10, credits: 50 }, { packId: 'b', priceInr: 20, credits: 100 }]), { bestId: null, savePercent: {} }, 'equal packs mark nothing');
  assert.deepEqual(packValue([{ packId: 'a', priceInr: 10, credits: 50 }]), { bestId: null, savePercent: {} });
  assert.deepEqual(packValue(null), { bestId: null, savePercent: {} });
  const cards = packCards(data);
  assert.deepEqual(cards.map((c) => [c.packId, c.best, c.save]), [['credits_10_50', false, null], ['credits_29_150', false, 'Save 3%'], ['credits_49_300', true, 'Save 18%']]);
  // packCards only adds to packRows: every older field keeps its value.
  assert.deepEqual(cards.map(({ best, save, ...row }) => row), packRows(data));
});

test('the balance is split honestly: free this month with the refill date, kept credits, unknown never 0', () => {
  const split = balanceSplit(page());
  assert.equal(split.figure, '108');
  assert.equal(split.state, 'known');
  assert.equal(split.free.note, '38 of 50 free credits left this month. Refills on 1 November at 12:00 AM.');
  assert.equal(split.kept.text, '70');
  assert.equal(split.kept.note, 'Your welcome credits and any top-ups. They do not expire.');
  assert.ok(Math.abs(split.shares.free + split.shares.kept - 1) < 1e-9);
  assert.equal(refillLine('nope'), null);

  const unknown = balanceSplit(page({ unified: { total: null, parts: {} } }));
  assert.deepEqual([unknown.state, unknown.figure, unknown.free, unknown.kept, unknown.shares], ['unknown', null, null, null, null]);

  const zero = balanceSplit(page({ unified: { ...UNIFIED, total: 0, freeLeft: 0, held: 0 } }));
  assert.deepEqual([zero.state, zero.figure, zero.shares], ['zero', '0', null], 'an empty bar is not drawn');

  const noHeld = balanceSplit(page({ unified: { ...UNIFIED, held: null } }));
  assert.equal(noHeld.kept, null);
  assert.equal(noHeld.shares, null, 'no bar from a part that could not be read');
});

test('what credits buy: the price list, with practice included on Pro', () => {
  const free = priceRows(page(), PRICES);
  assert.deepEqual(free.map((r) => [r.what, r.cost, r.note]), [
    ['A practice question', '1 credit', null],
    ['A full mock', '50 credits', 'First one in each subject is free'],
    ['Deeper analysis', '3 credits', null],
    ['An Ask Mobi reply', '1 credit', null],
  ]);
  assert.equal(priceRows(page(), { ...PRICES, firstMockFree: false })[1].note, null, 'the free first mock is said only while its switch is on');
  const pro = priceRows(page({ paid: true, premiumUntil: '2027-07-31T18:29:59.000Z' }), PRICES);
  assert.deepEqual(pro.map((r) => r.cost), ['Included', 'Included', '3 credits', '1 credit']);
  // The wallet page reads its numbers from the one price list, never typed in.
  const client = file('src/app/(app)/wallet/WalletPageClient.jsx');
  assert.match(client, /question: PRACTICE_PRICE\.perQuestion, fullMock: PRACTICE_PRICE\.full, analysis: DEEP_AI_CREDITS/);
});

test('the bridge to Pro names what /pricing sells today, and Pro students never see it', () => {
  const data = page();
  assert.equal(proBridge(data, { rupees: 99, cycle: 'month', expires: null }).price, '₹99 a month. Cancel any time in Account.');
  assert.equal(proBridge(data, { rupees: 99, cycle: 'once', expires: '31 July 2027' }).price, '₹99 once, through 31 July 2027. It does not renew.');
  assert.equal(proBridge(data).price, '₹99 once, through 31 July 2027. It does not renew.', 'without the server offer: the wallet body’s one payment');
  assert.equal(proBridge({ ...data, proOffer: { rupees: 99, expires: null, planId: 'pro_monthly_99' } }).price, '₹99 a month. Cancel any time in Account.');
  assert.equal(proBridge({ ...data, plan: { name: 'Pro', until: '2027-07-31' } }), null);
  assert.equal(proBridge(null), null);
  assert.equal(proBridge(data).href, '/pricing');
  const server = file('src/app/(app)/wallet/page.js');
  assert.match(server, /publicOffer\(\)/);
  assert.match(server, /<WalletPageClient proOffer=\{proOfferNow\(\)\} \/>/);
});

test('copy rules: plain warm English, no exclamation, no arrows, no em dash, no hype', () => {
  const strings = [];
  const walk = (v) => { if (typeof v === 'string') strings.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  const data = page();
  walk(WALLET_V13_COPY); walk(balanceSplit(data)); walk(priceRows(data, PRICES)); walk(packCards(data)); walk(proBridge(data, { rupees: 99, cycle: 'month' }));
  const pricing = file('src/app/pricing/page.js');
  const outcomes = pricing.slice(pricing.indexOf('const PRO_OUTCOMES'), pricing.indexOf('function previewOverrides'));
  strings.push(outcomes);
  for (const t of strings) {
    assert.doesNotMatch(t, /!(?!=)/, t);
    assert.doesNotMatch(t, /—|·|→|->|⟶/, t);
    assert.doesNotMatch(t, /\b(amazing|unlock|boost|supercharge|incredible|limited time|hurry|last chance|ends soon|only today|selling fast)\b/i, t);
  }
  assert.doesNotMatch(outcomes, /₹\d/, 'the outcome rows name no price: the price comes from the offer');
});

test('the Pro page: one checkout, the price headline as h1, dev-only preview switches, honest checkout states', () => {
  const pricing = file('src/app/pricing/page.js');
  assert.equal((pricing.match(/<RazorpayPaymentButton/g) || []).length, 1, 'one checkout on the page');
  assert.match(pricing, /<h1 className="mm-h1">\{priceHeadline\(offer\)\}<\/h1>/);
  assert.match(pricing, /if \(process\.env\.NODE_ENV === 'production' \|\| !params\) return \{\};/, 'the preview switches never work in production');
  assert.match(pricing, /<div className="pro-hero__card" id="plans">/, 'the dock and the table key land on the checkout');
  assert.match(pricing, /Pro <span className="pro-cmp__price">\{PRO_PLAN\.price\} \{PRO_PLAN\.cycle\}<\/span>/, 'the table says plainly that Pro is paid');
  const css = file('src/app/pricing/pro-page.css');
  assert.doesNotMatch(css, /text-shadow|blur\(|backdrop-filter/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  const button = file('src/components/billing/RazorpayPaymentButton.jsx');
  assert.equal((button.match(/setMessage\('Checkout closed\. Nothing was charged\.'\)/g) || []).length, 2, 'both checkouts say nothing was charged when closed');
  assert.doesNotMatch(button, /Payment cancelled\./);
  assert.match(button, /codeOpen \|\| code \?/, 'a prefilled code opens the field by itself');
  assert.match(button, /setCodeOpen\(true\);\n\s+setCode\(event\.target\.value\);/, 'clearing a prefilled code never hides the field mid-edit');
});
