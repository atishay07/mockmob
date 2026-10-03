import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRazorpayClient, getRazorpayKeyId } from '@/lib/payments/razorpay';
import { getPaymentPlan, getRazorpayPlanId, isLiveMonthlyPlan } from '@/lib/payments/plans';
import { resolveCreatorCode } from '@/lib/referrals/offers';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { Database } from '@/../data/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
      return NextResponse.json({ error: 'Pro access is already active on this account.', code: 'already_active' }, { status: 409 });
    }

    // Referral codes are tracked for creator attribution. They never change the monthly price.
    const referral = rawCode ? await resolveCreatorCode(rawCode) : null;
    const tracked = referral && ['offer_attached', 'tracked_no_offer'].includes(referral.status)
      ? { ...referral, offerId: null, status: 'tracked_no_offer', reason: 'Referral tracked for the monthly plan' }
      : null;

    const razorpayPlanId = getRazorpayPlanId(plan);
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
