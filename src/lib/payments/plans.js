export const PAYMENT_PLANS = {
  pro_monthly: {
    id: 'pro_monthly',
    name: 'MockMob Pro',
    amount: 6900,
    currency: 'INR',
    interval: 'monthly',
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
