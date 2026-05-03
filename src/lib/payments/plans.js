export const PAYMENT_PLANS = {
  pro_cuet_2026: {
    id: 'pro_cuet_2026',
    name: 'MockMob CUET 2026 Access',
    amount: 9900,
    currency: 'INR',
    billingType: 'one_time',
    status: 'live',
    accessUntil: '2026-12-31T18:29:59.999Z',
    checkoutKind: 'cuet_2026_access',
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

export function getPaymentPlan(planId) {
  return PAYMENT_PLANS[planId] || null;
}

export function getRazorpayPlanId(plan) {
  if (!plan?.razorpayPlanIdEnv) return null;
  return process.env[plan.razorpayPlanIdEnv] || null;
}

export function isLiveOneTimeAccessPlan(plan) {
  return plan?.status === 'live' && plan?.billingType === 'one_time';
}

export function isOneTimeAccessPlan(plan) {
  return plan?.billingType === 'one_time';
}

export function getPlanAccessUntil(plan) {
  return plan?.accessUntil || null;
}
