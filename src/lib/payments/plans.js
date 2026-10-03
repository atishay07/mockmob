import { newOfferReleased } from '../../../data/capabilities.js';
export const PAYMENT_PLANS = {
  pro_cuet_2027_v2: {
    id: 'pro_cuet_2027_v2', name: 'MockMob CUET 2027', amount: 29900, currency: 'INR',
    billingType: 'one_time', status: 'not_released', accessUntil: '2027-07-31T18:29:59.999Z', checkoutKind: 'cuet_2027_access',
  },
  pro_cuet_2027: {
    id: 'pro_cuet_2027',
    name: 'MockMob CUET 2027 Access',
    amount: 9900,
    currency: 'INR',
    billingType: 'one_time',
    status: 'live',
    // Covers the full CUET 2027 cycle including result season and counselling.
    accessUntil: '2027-07-31T18:29:59.999Z',
    checkoutKind: 'cuet_2027_access',
  },
  // Legacy: CUET 2026 season pass. Kept so historical orders keep verifying;
  // status 'legacy' blocks new checkouts via isLiveOneTimeAccessPlan.
  pro_cuet_2026: {
    id: 'pro_cuet_2026',
    name: 'MockMob CUET 2026 Access',
    amount: 9900,
    currency: 'INR',
    billingType: 'one_time',
    status: 'legacy',
    accessUntil: '2026-12-31T18:29:59.999Z',
    checkoutKind: 'cuet_2026_access',
  },
  // Finalised pricing (owner decision, 2 Oct 2026): Pro is Rs 99 a month, auto-renewing and
  // cancellable. Checkout opens only when the Razorpay plan exists and its ID is configured.
  pro_monthly_99: {
    id: 'pro_monthly_99',
    name: 'MockMob Pro (monthly)',
    amount: 9900,
    currency: 'INR',
    interval: 'monthly',
    billingType: 'subscription',
    status: 'live_when_configured',
    razorpayPlanIdEnv: 'RAZORPAY_PLAN_ID_PRO_MONTHLY_99',
    checkoutKind: 'monthly_subscription',
    totalCount: 24,
  },
  pro_monthly: {
    id: 'pro_monthly',
    name: 'MockMob Pro',
    amount: 6900,
    currency: 'INR',
    interval: 'monthly',
    billingType: 'subscription',
    status: 'legacy',
    razorpayPlanIdEnv: 'RAZORPAY_PLAN_ID_PRO_MONTHLY',
  },
};

const OFFER_CHECKOUT_AMOUNTS = {
  offer_Sl0iH8LNWcFE7Y: 6900,
};
export function mappedPlanOffer(plan, offerId) {
  // Historical offers retain their original meaning. V2 needs a separately
  // approved mapping; it cannot inherit a hardcoded ₹69 checkout amount.
  return plan?.id === 'pro_cuet_2027' ? offerId || null : null;
}

export function getPaymentPlan(planId) {
  return PAYMENT_PLANS[planId] || null;
}

export function getRazorpayPlanId(plan) {
  if (!plan?.razorpayPlanIdEnv) return null;
  return process.env[plan.razorpayPlanIdEnv] || null;
}

export function isMonthlyBillingReady() {
  return Boolean(getRazorpayPlanId(PAYMENT_PLANS.pro_monthly_99));
}

export function isLiveMonthlyPlan(plan) {
  return plan?.id === 'pro_monthly_99' && plan.billingType === 'subscription' && Boolean(getRazorpayPlanId(plan));
}

export function isLiveOneTimeAccessPlan(plan) {
  if (plan?.id === 'pro_cuet_2027_v2') return newOfferReleased() && plan?.billingType === 'one_time';
  if (plan?.id === 'pro_cuet_2027' && newOfferReleased()) return false;
  // Once monthly billing is configured, the earlier one-time access is no longer sold.
  // Existing one-time purchases keep verifying and keep their expiry.
  if (plan?.id === 'pro_cuet_2027' && isMonthlyBillingReady()) return false;
  return plan?.status === 'live' && plan?.billingType === 'one_time';
}

export function isOneTimeAccessPlan(plan) {
  return plan?.billingType === 'one_time';
}

export function getPlanAccessUntil(plan) {
  return plan?.accessUntil || null;
}

export function getPlanCheckoutAmount(plan, offerId = null) {
  const nominalAmount = Number(plan?.amount);
  const discountedAmount = offerId && plan?.id === 'pro_cuet_2027' ? OFFER_CHECKOUT_AMOUNTS[offerId] : null;

  if (
    Number.isInteger(discountedAmount) &&
    discountedAmount > 0 &&
    discountedAmount < nominalAmount
  ) {
    return discountedAmount;
  }

  return nominalAmount;
}
