import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRazorpayClient, getRazorpayKeyId } from '@/lib/payments/razorpay';
import { getPaymentPlan, getRazorpayPlanId, isLiveMonthlyPlan } from '@/lib/payments/plans';
import { resolveCreatorCode } from '@/lib/referrals/offers';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { Database } from '@/../data/db';
import { countStepOnce } from '@/lib/server/funnelOnceStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// M3: an unpaid checkout from the last day is handed back on the next tap instead of starting a second subscription.
const OPEN_CHECKOUT_REUSE_MS = 24 * 60 * 60 * 1000;

function razorpayMessage(err) {
  return err?.error?.description || err?.response?.data?.error?.description || err?.message || null;
}

// Creates a Razorpay subscription for the monthly plan. It sells nothing unless the Razorpay
// plan ID is configured, and it never touches the one-time access orders.
export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (!(await checkPersistentRateLimit(request, { route: '/create-monthly-subscription', limit: 10, keyParts: [session.user.id] })).allowed) {
      return NextResponse.json({ error: 'Too many attempts. Wait a minute and try again.' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const { userId, planId } = body || {};
    const rawCode = typeof body?.code === 'string' ? body.code : null;
    if (!userId || !planId) return NextResponse.json({ error: 'userId and planId are required' }, { status: 400 });
    if (userId !== session.user.id) return NextResponse.json({ error: 'Cannot create a subscription for another user' }, { status: 403 });

    const plan = getPaymentPlan(planId);
    if (!plan || !isLiveMonthlyPlan(plan)) {
      return NextResponse.json({ error: 'Monthly billing is not open yet. Nothing was charged.', code: 'monthly_not_ready' }, { status: 409 });
    }
    if (Number.isFinite(Number(body?.amount)) && Number(body.amount) !== plan.amount) {
      return NextResponse.json({ error: 'Invalid amount for selected plan' }, { status: 400 });
    }

    const user = await Database.getUserById(userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (user.isPremium) {
      // One-time Pro keeps its full term. It is never replaced by a subscription.
      const through = user.premiumUntil
        ? ` through ${new Date(user.premiumUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}`
        : '';
      return NextResponse.json({ error: `Pro access is already active on this account${through}.`, code: 'already_active' }, { status: 409 });
    }

    // A subscription Razorpay is still retrying must not be doubled by a second one.
    if (user.razorpaySubscriptionId) {
      let existing = null;
      try { existing = await getRazorpayClient().subscriptions.fetch(user.razorpaySubscriptionId); } catch { existing = null; }
      if (existing && ['active', 'pending', 'authenticated'].includes(existing.status)) {
        return NextResponse.json({
          error: 'Your earlier monthly plan is still open with Razorpay, so a second one was not started. Cancel it in Account first, or wait for it to end.',
          code: 'subscription_open',
        }, { status: 409 });
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
        return NextResponse.json({ error: 'We could not check your earlier checkout. Try again in a minute. Nothing was charged.', code: 'check_failed' }, { status: 503 });
      }
      if (earlier?.status === 'created') {
        return NextResponse.json({
          keyId: getRazorpayKeyId(),
          subscription: { id: row.subscriptionId, status: earlier.status },
          plan: { id: plan.id, name: plan.name, amount: plan.amount, currency: plan.currency, interval: 'month' },
          referral: row.referralCodeAttempted ? { code: row.referralCodeAttempted, status: row.referralStatus, reason: row.referralReason || null } : null,
          reused: true,
        });
      }
      if (['active', 'authenticated'].includes(earlier?.status)) {
        return NextResponse.json({
          error: 'Your earlier payment for monthly Pro is being confirmed, so a second plan was not started. Pro turns on within a few minutes, and you do not need to pay again.',
          code: 'subscription_open',
        }, { status: 409 });
      }
      if (earlier?.status === 'pending') {
        return NextResponse.json({
          error: 'Your earlier monthly plan is still open with Razorpay, so a second one was not started. Cancel it in Account first, or wait for it to end.',
          code: 'subscription_open',
        }, { status: 409 });
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
      console.error('[create-monthly-subscription] Razorpay rejected:', description);
      return NextResponse.json({ error: description || 'Payment provider rejected the subscription', code: 'razorpay_rejected' }, { status: 400 });
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

    // Aggregate funnel: this student opened checkout (once per person; no-op while FUNNEL_ENABLED is off).
    countStepOnce(userId, 'checkout_opened', request.headers);

    return NextResponse.json({
      keyId: getRazorpayKeyId(),
      subscription: { id: subscription.id, status: subscription.status },
      plan: { id: plan.id, name: plan.name, amount: plan.amount, currency: plan.currency, interval: 'month' },
      referral: referral ? { code: referral.code, status: tracked ? tracked.status : referral.status, reason: referral.reason } : null,
    });
  } catch (error) {
    console.error('[create-monthly-subscription] failed:', error);
    return NextResponse.json({ error: 'Failed to start monthly billing. Nothing was charged.' }, { status: 500 });
  }
}
