import assert from 'node:assert/strict';
import test from 'node:test';
import {
  amountMatchesPaymentRecord,
  effectivePremiumFromRow,
  hasPaidPaymentEvidence,
  isFutureIso,
  referralAttributionFromCheckout,
  refundRevocationMatchesPayment,
  resolvePaidThrough,
} from '../../src/lib/payments/entitlements.js';
import {
  getPaymentPlan,
  getPlanCheckoutAmount,
  getPlanAccessUntil,
  isLiveOneTimeAccessPlan,
} from '../../src/lib/payments/plans.js';

test('paid-through date prefers Razorpay invoice billing end', () => {
  const paidThrough = resolvePaidThrough({
    invoice: { billing_end: 1798761600 },
    payment: { created_at: 1767225600 },
    nowMs: Date.parse('2026-01-01T00:00:00.000Z'),
  });

  assert.equal(paidThrough, '2027-01-01T00:00:00.000Z');
});

test('paid-through date falls back to a bounded paid period', () => {
  const paidThrough = resolvePaidThrough({
    payment: { created_at: 1767225600 },
    nowMs: Date.parse('2026-01-01T00:00:00.000Z'),
  });

  assert.equal(paidThrough, '2026-02-02T00:00:00.000Z');
});

test('effective premium survives cancellation inside paid-through window', () => {
  const row = {
    is_premium: true,
    subscription_status: 'cancelled',
    premium_until: '2026-02-02T00:00:00.000Z',
  };

  assert.equal(effectivePremiumFromRow(row, Date.parse('2026-01-15T00:00:00.000Z')), true);
  assert.equal(effectivePremiumFromRow(row, Date.parse('2026-02-03T00:00:00.000Z')), false);
});

test('paid evidence requires a captured payment record', () => {
  assert.equal(hasPaidPaymentEvidence({
    status: 'captured',
    paymentId: 'pay_123',
    amountPaid: 6800,
  }), true);

  assert.equal(hasPaidPaymentEvidence({
    status: 'failed',
    paymentId: 'pay_failed',
    amountPaid: 6800,
  }), false);
});

test('discounted creator payments can validate below nominal amount', () => {
  const payment = { status: 'captured', amount: 6800, currency: 'INR' };
  const paymentRecord = {
    amount: 6900,
    creatorCode: 'creator10',
  };

  assert.equal(amountMatchesPaymentRecord(payment, paymentRecord), true);
  assert.equal(isFutureIso('2026-02-02T00:00:00.000Z', Date.parse('2026-01-01T00:00:00.000Z')), true);
});

test('discounted payments can validate from Razorpay subscription offer metadata', () => {
  const payment = {
    status: 'captured',
    amount: 6800,
    currency: 'INR',
    notes: { creatorCode: 'radhika10' },
  };
  const paymentRecord = {
    amount: 6900,
    rawSubscription: {
      offer_id: 'offer_123',
      notes: {
        creatorCode: 'radhika10',
        creatorId: 'crt_123',
        referralStatus: 'offer_attached',
      },
    },
  };

  assert.equal(amountMatchesPaymentRecord(payment, paymentRecord), true);
  assert.deepEqual(referralAttributionFromCheckout({ paymentRecord, payment }), {
    creatorCode: 'radhika10',
    creatorId: 'crt_123',
    offerId: 'offer_123',
    referralCodeAttempted: 'radhika10',
    referralStatus: 'offer_attached',
  });
});

test('one-time access discounts require a Razorpay offer id on the payment record', () => {
  const payment = { status: 'captured', amount: 8900, currency: 'INR' };

  assert.equal(amountMatchesPaymentRecord(payment, {
    amount: 9900,
    offerId: 'offer_flash_1000',
  }), true);

  assert.equal(amountMatchesPaymentRecord(payment, {
    amount: 9900,
  }), false);
});

test('refund revocation audit only blocks matching payment identifiers', () => {
  const metadata = {
    subscriptionIds: ['sub_refunded'],
    paymentIds: ['pay_refunded'],
  };

  assert.equal(refundRevocationMatchesPayment(metadata, {
    subscriptionId: 'sub_refunded',
    paymentId: 'pay_refunded',
  }), true);
  assert.equal(refundRevocationMatchesPayment(metadata, {
    subscriptionId: 'sub_new_purchase',
    paymentId: 'pay_new_purchase',
  }), false);
});

test('CUET 2026 Pro checkout is a live one-time Rs 99 access plan', () => {
  const plan = getPaymentPlan('pro_cuet_2026');

  assert.equal(isLiveOneTimeAccessPlan(plan), true);
  assert.equal(plan.amount, 9900);
  assert.equal(plan.currency, 'INR');
  assert.equal(getPlanCheckoutAmount(plan), 9900);
  assert.equal(getPlanCheckoutAmount(plan, 'offer_Sl0iH8LNWcFE7Y'), 6900);
  assert.equal(getPlanAccessUntil(plan), '2026-12-31T18:29:59.999Z');
});

test('legacy monthly plan is not live for new checkout', () => {
  const plan = getPaymentPlan('pro_monthly');

  assert.equal(isLiveOneTimeAccessPlan(plan), false);
  assert.equal(plan.status, 'legacy');
});
