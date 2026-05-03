import assert from 'node:assert/strict';
import test from 'node:test';
import {
  amountMatchesPaymentRecord,
  effectivePremiumFromRow,
  hasPaidPaymentEvidence,
  isFutureIso,
  refundRevocationMatchesPayment,
  resolvePaidThrough,
} from '../../src/lib/payments/entitlements.js';

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

test('paid evidence is independent of subscription lifecycle status', () => {
  assert.equal(hasPaidPaymentEvidence({
    status: 'cancelled',
    paymentId: 'pay_123',
    amountPaid: 6800,
  }), true);
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
