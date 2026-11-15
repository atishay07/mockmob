import { getRazorpayClient } from '@/lib/payments/razorpay';
import { getRazorpayPlanId } from '@/lib/payments/plans';
import { resolveCreatorCode } from '@/lib/referrals/offers';
import { Database } from '@/../data/db';
import { parentLinkExpireBy, shareableOpenCheckout } from '@/lib/payments/parentPay';

// One way to open a monthly Pro checkout for a signed-in student, shared by Get Pro (/create-monthly-subscription) and
// "Ask a parent to pay" (/api/billing/parent-link), so both make the same subscription with the same server-set notes and the
// same webhook grants it. Moved here unchanged from the Get Pro route (15 Nov 2026); the parent link adds only `parentLink`.
// Each route counts the aggregate funnel's checkout_opened itself when a new subscription was made (result.reused false).

// M3: an unpaid checkout from the last day is handed back on the next tap instead of starting a second subscription.
export const OPEN_CHECKOUT_REUSE_MS = 24 * 60 * 60 * 1000;

function razorpayMessage(err) {
  return err?.error?.description || err?.response?.data?.error?.description || err?.message || null;
}

const refuse = (status, error, code) => ({ ok: false, status, error, ...(code ? { code } : {}) });

/**
 * @param {object} input
 * @param {object} input.user        the signed-in student's row (Database.getUserById), never one named by the client
 * @param {object} input.plan        a live monthly plan (isLiveMonthlyPlan), chosen by the caller
 * @param {string|null} input.rawCode a referral code: tracked for creator attribution, never a discount on monthly
 * @param {boolean} input.parentLink  true for a link sent to a parent: an open checkout is handed back only when its own link
 *                                   stops taking payments inside the day it is handed back for, and a new one is made with
 *                                   Razorpay's expire_by set to that (src/lib/payments/parentPay.js)
 * @returns {Promise<{ ok: false, status: number, error: string, code?: string }
 *   | { ok: true, reused: boolean, subscriptionId: string, subscription: object, referral: object|null }>}
 *   `subscription` is Razorpay's own entity (a fresh fetch when handed back), so it carries `short_url` and `expire_by`.
 */
export async function openMonthlyCheckout({ user, plan, rawCode = null, parentLink = false }) {
  const userId = user.id;
  if (user.isPremium) {
    // One-time Pro keeps its full term. It is never replaced by a subscription.
    const through = user.premiumUntil
      ? ` through ${new Date(user.premiumUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}`
      : '';
    return refuse(409, `Pro access is already active on this account${through}.`, 'already_active');
  }

  // A subscription Razorpay is still retrying must not be doubled by a second one.
  if (user.razorpaySubscriptionId) {
    let existing = null;
    try { existing = await getRazorpayClient().subscriptions.fetch(user.razorpaySubscriptionId); } catch { existing = null; }
    if (existing && ['active', 'pending', 'authenticated'].includes(existing.status)) {
      return refuse(409, 'Your earlier monthly plan is still open with Razorpay, so a second one was not started. Cancel it in Account first, or wait for it to end.', 'subscription_open');
    }
  }

  const razorpayPlanId = getRazorpayPlanId(plan);

  // M3 (audit 15 Nov 2026): the account's subscription id is only set once a payment is granted, so a second tap on Get
  // Pro while the first checkout was open, or its payment was still being confirmed, made a second Rs 99 subscription.
  // This student's own recent checkouts are read first: one still open is handed back, one that went through is never doubled.
  const recent = await Database.listSubscriptionPayments({
    userId,
    sinceIso: new Date(Date.now() - OPEN_CHECKOUT_REUSE_MS).toISOString(),
    statuses: ['created', 'authenticated', 'active', 'failed'],
    limit: 5,
  });
  for (const row of recent) {
    if (row.planId !== plan.id || (row.razorpayPlanId && row.razorpayPlanId !== razorpayPlanId)) continue;
    let earlier;
    try {
      earlier = await getRazorpayClient().subscriptions.fetch(row.subscriptionId);
    } catch {
      return refuse(503, 'We could not check your earlier checkout. Try again in a minute. Nothing was charged.', 'check_failed');
    }
    if (earlier?.status === 'created') {
      // A parent may pay hours later, outside our page. A checkout whose link never expires (Get Pro's today) is not sent out:
      // a day on, the next tap would start a second subscription while that link could still be paid. Get Pro's next tap
      // hands back the newer, expiring one instead, so there is still one checkout to pay.
      if (parentLink && !shareableOpenCheckout(earlier, { rowCreatedAt: row.createdAt, reuseWindowMs: OPEN_CHECKOUT_REUSE_MS })) continue;
      return {
        ok: true,
        reused: true,
        subscriptionId: row.subscriptionId,
        subscription: earlier,
        referral: row.referralCodeAttempted ? { code: row.referralCodeAttempted, status: row.referralStatus, reason: row.referralReason || null } : null,
      };
    }
    if (['active', 'authenticated'].includes(earlier?.status)) {
      return refuse(409, 'Your earlier payment for monthly Pro is being confirmed, so a second plan was not started. Pro turns on within a few minutes, and you do not need to pay again.', 'subscription_open');
    }
    if (earlier?.status === 'pending') {
      return refuse(409, 'Your earlier monthly plan is still open with Razorpay, so a second one was not started. Cancel it in Account first, or wait for it to end.', 'subscription_open');
    }
    // Cancelled, completed, expired or halted: that checkout can no longer be paid, so look further.
  }

  // Referral codes are tracked for creator attribution. They never change the monthly price.
  const referral = rawCode ? await resolveCreatorCode(rawCode) : null;
  const tracked = referral && ['offer_attached', 'tracked_no_offer'].includes(referral.status)
    ? { ...referral, offerId: null, status: 'tracked_no_offer', reason: 'Referral tracked for the monthly plan' }
    : null;

  const payload = {
    plan_id: razorpayPlanId,
    total_count: plan.totalCount || 24,
    quantity: 1,
    customer_notify: 1,
    ...(parentLink ? { expire_by: parentLinkExpireBy() } : {}),
    notes: {
      kind: plan.checkoutKind,
      userId,
      planId: plan.id,
      ...(referral ? { referralCodeAttempted: referral.code, referralStatus: tracked ? tracked.status : referral.status } : {}),
      ...(tracked ? { creatorCode: tracked.code, creatorId: tracked.creatorId || '' } : {}),
    },
  };

  let subscription;
  try {
    subscription = await getRazorpayClient().subscriptions.create(payload);
  } catch (rzpError) {
    const description = razorpayMessage(rzpError);
    console.error(`[${parentLink ? 'parent-link' : 'create-monthly-subscription'}] Razorpay rejected:`, description);
    return refuse(400, description || 'Payment provider rejected the subscription', 'razorpay_rejected');
  }

  await Database.createPayment({
    userId,
    subscriptionId: subscription.id,
    planId: plan.id,
    razorpayPlanId,
    amount: plan.amount,
    currency: plan.currency,
    status: subscription.status || 'created',
    rawSubscription: subscription,
    creatorCode: tracked?.code || null,
    creatorId: tracked?.creatorId || null,
    offerId: null,
    referralCodeAttempted: referral?.code || null,
    referralStatus: tracked?.status || referral?.status || 'none',
    referralReason: tracked?.reason || referral?.reason || null,
  });

  return {
    ok: true,
    reused: false,
    subscriptionId: subscription.id,
    subscription,
    referral: referral ? { code: referral.code, status: tracked ? tracked.status : referral.status, reason: referral.reason } : null,
  };
}
