// Monthly Pro: the entitlement rules (pure) and the words students read about it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACTIVE_STATUS_GRACE_MS, effectivePremiumFromRow, laterIso, resolveUserEntitlement,
} from '../../src/lib/payments/entitlements.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const NOW = Date.parse('2026-11-10T00:00:00.000Z');
const DAY = 86400_000;
const iso = (ms) => new Date(ms).toISOString();

test('an active status ends with the date it was paid through, after a short grace for a late webhook', () => {
  const row = (until) => ({ subscription_status: 'active', is_premium: true, premium_until: until });
  assert.equal(effectivePremiumFromRow(row(iso(NOW + DAY)), NOW), true, 'inside the paid month');
  assert.equal(effectivePremiumFromRow(row(iso(NOW - DAY)), NOW), true, 'one day late is inside the grace');
  assert.equal(effectivePremiumFromRow(row(iso(NOW - ACTIVE_STATUS_GRACE_MS - 1000)), NOW), false, 'a missed cancel webhook cannot keep Pro on for good');
  assert.equal(effectivePremiumFromRow(row(null), NOW), true, 'an old account with no date keeps its status');
  assert.equal(effectivePremiumFromRow({ subscription_status: 'active', is_premium: true, premium_until: '2026-12-31T18:29:59.999Z' }, Date.parse('2027-01-05T00:00:00.000Z')), false, 'the 2026 pass ends when it says it does');
});

test('cancelled, halted and failed accounts keep Pro only to the paid date', () => {
  for (const status of ['cancelled', 'past_due', 'free']) {
    assert.equal(effectivePremiumFromRow({ subscription_status: status, is_premium: true, premium_until: iso(NOW + 5 * DAY) }, NOW), true, `${status}: paid month`);
    assert.equal(effectivePremiumFromRow({ subscription_status: status, is_premium: true, premium_until: iso(NOW - DAY) }, NOW), false, `${status}: after the paid month`);
  }
});

test('laterIso picks the latest valid date and ignores empty or broken ones', () => {
  assert.equal(laterIso('2026-11-01T00:00:00.000Z', null, 'not a date', '2027-07-31T18:29:59.999Z'), '2027-07-31T18:29:59.999Z');
  assert.equal(laterIso(null, undefined, ''), null);
});

test('resolveUserEntitlement: a failed or ended subscription never shortens another paid plan', () => {
  const oneTime = '2027-07-31T18:29:59.999Z';
  const out = resolveUserEntitlement({
    ownStatus: 'cancelled', ownAccessUntil: null, otherAccessUntil: oneTime, hasOtherPaid: true, userPremiumUntil: oneTime, nowMs: NOW,
  });
  assert.deepEqual(out, { subscriptionStatus: 'active', isPremium: true, premiumUntil: oneTime, ownWins: false });
});

test('resolveUserEntitlement: a paid subscription with nothing else gets exactly its own date and status', () => {
  const until = iso(NOW + 20 * DAY);
  assert.deepEqual(
    resolveUserEntitlement({ ownStatus: 'past_due', ownAccessUntil: until, nowMs: NOW }),
    { subscriptionStatus: 'past_due', isPremium: true, premiumUntil: until, ownWins: true },
  );
  assert.deepEqual(
    resolveUserEntitlement({ ownStatus: 'cancelled', ownAccessUntil: iso(NOW - DAY), nowMs: NOW }),
    { subscriptionStatus: 'cancelled', isPremium: false, premiumUntil: null, ownWins: true },
    'a lapsed paid month leaves no premium date behind',
  );
});

test('resolveUserEntitlement: the longer of two paid plans wins', () => {
  const shortOwn = iso(NOW + 5 * DAY);
  const longOther = iso(NOW + 200 * DAY);
  assert.equal(resolveUserEntitlement({ ownStatus: 'active', ownAccessUntil: shortOwn, otherAccessUntil: longOther, hasOtherPaid: true, nowMs: NOW }).premiumUntil, longOther);
  const longOwn = iso(NOW + 30 * DAY);
  const shortOther = iso(NOW + 3 * DAY);
  const r = resolveUserEntitlement({ ownStatus: 'active', ownAccessUntil: longOwn, otherAccessUntil: shortOther, hasOtherPaid: true, nowMs: NOW });
  assert.equal(r.premiumUntil, longOwn);
  assert.equal(r.ownWins, true);
});

test('resolveUserEntitlement: an unpaid subscription alone grants nothing', () => {
  assert.deepEqual(
    resolveUserEntitlement({ ownStatus: 'past_due', ownAccessUntil: null, nowMs: NOW }),
    { subscriptionStatus: 'past_due', isPremium: false, premiumUntil: null, ownWins: false },
  );
});

// ---------------------------------------------------------------- words

const BILLING_FILES = [
  'src/components/billing/PlanCard.jsx',
  'src/components/billing/RazorpayPaymentButton.jsx',
  'src/app/refunds/page.js',
  'src/app/create-monthly-subscription/route.js',
  'src/app/api/billing/cancel/route.js',
  'src/app/verify-payment/route.js',
];

test('billing copy uses plain sentence-case words: no exclamation mark, em dash or middle dot in what a student reads', () => {
  for (const file of BILLING_FILES) {
    const src = read(file);
    assert.doesNotMatch(src, /[—·]/, `${file}: em dash or middle dot`);
    // Strings and JSX text only: an exclamation mark inside a quote, template or JSX text node.
    assert.doesNotMatch(src, /['"`>][^'"`<>\n]*\w![ '"`<]/, `${file}: exclamation mark in copy`);
  }
});

test('the refund policy covers monthly Pro: how to cancel, what is kept, failed renewals, and the one-time pass', () => {
  const page = read('src/app/refunds/page.js');
  for (const needle of [
    'Monthly Pro and cancelling',
    'Cancel renewal',
    'until the end of the month you already paid for',
    'A month that has been charged is not refunded',
    'If a renewal payment fails',
    'retries it a few times',
    'ends 31 July 2027',
    'keeps its full term',
  ]) assert.ok(page.includes(needle), `missing: ${needle}`);
  assert.doesNotMatch(page, /Historical recurring subscriptions/, 'the old "historical only" wording is gone');
});

test('Account says what a student has in each monthly state, including a failed payment', () => {
  const card = read('src/components/billing/PlanCard.jsx');
  for (const needle of [
    'Pro renews every month',
    'Renewal is off, so no further payment will be taken',
    'Your last monthly payment did not go through',
    'does not renew, so there is nothing to cancel',
    "status === 'cancelled'",
    "status === 'past_due'",
  ]) assert.ok(card.includes(needle), `missing: ${needle}`);
  assert.doesNotMatch(card, /Pro renews every month[^.]*\.\s*<\/>\s*:/, 'no unconditional renewing line');
});

test('pricing answers the two monthly questions a one-time buyer and a worried payer ask', () => {
  const pricing = read('src/app/pricing/page.js');
  assert.match(pricing, /What if a renewal payment fails\?/);
  assert.match(pricing, /already paid .*once\. What happens to it\?/);
  assert.match(pricing, /Nothing changes\. Your access runs through/);
});

test('after a payment has been taken, an error never tells the student that nothing was charged', () => {
  const button = read('src/components/billing/RazorpayPaymentButton.jsx');
  assert.match(button, /If money left your account, do not pay again/);
  assert.match(button, /verified\?\.pending/, 'a payment still being confirmed is shown as such');
});
