import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPaymentPlan, isLiveMonthlyPlan, isLiveOneTimeAccessPlan, isMonthlyBillingReady, isOneTimeAccessPlan, getRazorpayPlanId,
} from '../../src/lib/payments/plans.js';
import { publicOffer, priceLine } from '../../src/lib/payments/offer.js';

const ENV = 'RAZORPAY_PLAN_ID_PRO_MONTHLY_99';
function withEnv(value, fn) {
  const before = process.env[ENV];
  if (value === undefined) delete process.env[ENV]; else process.env[ENV] = value;
  try { return fn(); } finally { if (before === undefined) delete process.env[ENV]; else process.env[ENV] = before; }
}

test('monthly Pro is Rs 99, recurring and closed until its Razorpay plan ID exists', () => {
  withEnv(undefined, () => {
    const plan = getPaymentPlan('pro_monthly_99');
    assert.equal(plan.amount, 9900);
    assert.equal(plan.billingType, 'subscription');
    assert.equal(plan.interval, 'monthly');
    assert.equal(isMonthlyBillingReady(), false);
    assert.equal(isLiveMonthlyPlan(plan), false, 'no plan ID, no checkout');
    assert.equal(getRazorpayPlanId(plan), null);
  });
});

test('before monthly opens, the existing Rs 99 one-time access is the only thing on sale and the copy says so', () => {
  withEnv(undefined, () => {
    const offer = publicOffer();
    assert.equal(offer.purchasable, 'one_time');
    assert.equal(offer.oneTime.onSale, true);
    assert.equal(isLiveOneTimeAccessPlan(getPaymentPlan('pro_cuet_2027')), true);
    assert.match(priceLine(offer), /₹99 once, through 31 July 2027/);
  });
});

test('once the plan ID is configured, monthly is sold and one-time stops being sold', () => {
  withEnv('plan_TestMonthly99', () => {
    const offer = publicOffer();
    assert.equal(offer.purchasable, 'monthly');
    assert.equal(offer.oneTime.onSale, false);
    assert.equal(isLiveMonthlyPlan(getPaymentPlan('pro_monthly_99')), true);
    assert.equal(isLiveOneTimeAccessPlan(getPaymentPlan('pro_cuet_2027')), false, 'new one-time checkouts close');
    assert.equal(priceLine(offer), 'Pro ₹99 a month');
  });
});

test('historical plans still resolve, so old orders keep verifying and keep their expiry', () => {
  withEnv('plan_TestMonthly99', () => {
    const oneTime = getPaymentPlan('pro_cuet_2027');
    assert.equal(isOneTimeAccessPlan(oneTime), true);
    assert.equal(oneTime.accessUntil, '2027-07-31T18:29:59.999Z');
    assert.equal(getPaymentPlan('pro_cuet_2026').status, 'legacy');
    assert.equal(getPaymentPlan('pro_monthly').amount, 6900, 'the legacy Rs 69 plan is untouched');
    assert.equal(isLiveMonthlyPlan(getPaymentPlan('pro_monthly')), false, 'the legacy plan is never sold');
  });
});

test('the future Rs 299 plan stays unreleased regardless of monthly billing', () => {
  withEnv('plan_TestMonthly99', () => {
    assert.equal(isLiveOneTimeAccessPlan(getPaymentPlan('pro_cuet_2027_v2')), false);
  });
});
