// The visual gate for the Rs 99 monthly plan (16 Oct 2026): honest money on /pricing, Account and the checkout button.
// These hold the words and states the browser pass found missing. Source-level on purpose: no server, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const pricing = read('src/app/pricing/page.js');
const card = read('src/components/billing/PlanCard.jsx');
const button = read('src/components/billing/RazorpayPaymentButton.jsx');
const refunds = read('src/app/refunds/page.js');
const css = read('src/app/globals.css');

test('/pricing never uses the retired names PrepOS, Radar or XP', () => {
  assert.doesNotMatch(pricing, /\b(PrepOS|Radar|XP)\b/);
});

test('the monthly card says what is charged, when, and how to stop it, above the button', () => {
  // v16 (owner, 20 Oct 11:20 pm): /pricing is rebuilt as the app's Pro page; the plan card says the renewal in one line, and the FAQ says when and how.
  assert.match(pricing, /renew: 'Renews every month\. Cancel any time\.'/);
  assert.match(pricing, /The first payment is taken when you start, and it renews on the same date each month until you cancel/);
  assert.match(pricing, /you keep Pro until the end of the month you already paid for/);
});

test('before monthly opens, /pricing leads with what the button charges and still names the monthly model', () => {
  // Owner, 15 Oct and 17 Oct 2026: the plan is presented as 99 a month; Razorpay is set up later. Release 9 (one framing
  // everywhere): the H1 and the Pro tag lead with what is charged today, one ₹99 payment through 31 July 2027 with no
  // renewal (priceHeadline / priceTag in src/lib/payments/offer.js), and the lead says monthly Pro at ₹99 opens soon.
  // It never pushes "pay now".
  assert.doesNotMatch(pricing, /Pay once now/);
  assert.match(pricing, /\{priceHeadline\(offer\)\}/);
  assert.match(pricing, /renew: `One payment, through \$\{offer\.oneTime\.expires\}\. It does not renew\.`/);
  assert.match(pricing, /soon: `Monthly Pro at ₹\$\{offer\.monthly\.rupees\} a month opens soon\.`/);
});

test('the comparison table has sentence-case labels and no thick coloured edge', () => {
  const cmp = css.slice(css.indexOf('/* ---------- Comparison ---------- */'), css.indexOf('/* ---------- AI credit packs ---------- */'));
  assert.doesNotMatch(cmp, /text-transform:\s*uppercase/);
  assert.doesNotMatch(cmp, /inset 3px/);
});

test('Account names the real rupees and the next payment for a renewing student', () => {
  assert.match(card, /MONTHLY_RUPEES/);
  assert.match(card, /The next payment is due then/);
  assert.match(card, /no further payment will be taken/);
});

test('Account has a lapsed state and a cancel that can be retried', () => {
  assert.match(card, /Your monthly Pro has ended and no further payment will be taken/);
  assert.match(card, /Try cancelling again/);
  assert.match(card, /phase === 'idle' \|\| phase === 'error'/);
});

test('a failed payment with Pro already off asks to cancel first and offers no second action', () => {
  assert.match(card, /Cancel renewal to stop it, then you can start Pro again/);
  assert.doesNotMatch(card, /!pro && paymentFailed && <Link/);
});

test('after the cancel is accepted the card says renewal is off at once, without waiting for a refresh', () => {
  assert.match(card, /const cancelledNow = phase === 'done'/);
  assert.match(card, /renewing = pro && hasSubscription && status === 'active' && !cancelledNow/);
});

test('checkout: the first payment confirmation survives, a pending payment locks the button, refusals do not say try again', () => {
  assert.match(button, /mm-checkout__done/);
  assert.match(button, /renews every month until you cancel in Account, where the date of your next payment is shown/);
  assert.match(button, /setStatus\('confirming'\)/);
  assert.match(button, /Confirming your payment/);
  assert.match(button, /NO_RETRY_CODES = new Set\(\['already_active', 'subscription_open'\]\)/);
  assert.match(button, /asSentence/);
});

test('the referral field does not promise a discount on the monthly plan', () => {
  assert.match(button, /billing === 'monthly' \? 'Referral code' : 'Referral or discount code'/);
  assert.match(button, /A referral code does not change the price/);
});

test('the refund page describes monthly cancelling only while monthly is on sale', () => {
  assert.match(refunds, /publicOffer\(\)\.purchasable === 'monthly'/);
  assert.match(refunds, /is not on sale yet/);
  assert.match(refunds, /export const dynamic = 'force-dynamic'/);
});
