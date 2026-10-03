import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRazorpayClient, getRazorpayKeyId } from '@/lib/payments/razorpay';
import { getPaymentPlan, getPlanCheckoutAmount, isLiveOneTimeAccessPlan, mappedPlanOffer } from '@/lib/payments/plans';
import { resolveCreatorCode } from '@/lib/referrals/offers';
import { Database } from '@/../data/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Razorpay errors arrive in different shapes depending on the SDK code path.
// Extract a user-presentable description if we can find one.
function extractRazorpayErrorMessage(err) {
  return (
    err?.error?.description
    || err?.response?.data?.error?.description
    || err?.message
    || null
  );
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, planId } = body || {};
    const requestedAmount = Number(body?.amount);
    const rawCode = typeof body?.code === 'string' ? body.code : null;

    if (!userId || !planId) {
      return NextResponse.json({ error: 'userId and planId are required' }, { status: 400 });
    }

    if (userId !== session.user.id) {
      return NextResponse.json({ error: 'Cannot create an order for another user' }, { status: 403 });
    }

    const plan = getPaymentPlan(planId);
    if (!plan) {
      return NextResponse.json({ error: 'Invalid planId' }, { status: 400 });
    }

    if (!isLiveOneTimeAccessPlan(plan)) {
      return NextResponse.json({ error: 'This plan is no longer available for checkout' }, { status: 400 });
    }

    if (Number.isFinite(requestedAmount) && requestedAmount !== plan.amount) {
      return NextResponse.json({ error: 'Invalid amount for selected plan' }, { status: 400 });
    }

    const user = await Database.getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.isPremium) {
      return NextResponse.json({ error: 'Pro access is already active on this account' }, { status: 409 });
    }

    const referral = rawCode ? await resolveCreatorCode(rawCode) : null;
    const attributedReferral = referral && ['offer_attached', 'tracked_no_offer'].includes(referral.status)
      ? referral
      : null;
    const mappedOfferId = mappedPlanOffer(plan, attributedReferral?.offerId);
    const hasDiscountOffer = Boolean(mappedOfferId);
    const checkoutAmount = getPlanCheckoutAmount(plan, mappedOfferId);

    const orderPayload = {
      amount: checkoutAmount,
      currency: plan.currency,
      receipt: `${plan.checkoutKind || 'mmpass'}_${userId}_${Date.now()}`.slice(0, 40),
      notes: {
        kind: plan.checkoutKind,
        userId,
        planId: plan.id,
        nominalAmount: String(plan.amount),
        checkoutAmount: String(checkoutAmount),
        accessUntil: plan.accessUntil || '',
        ...(referral ? {
          referralCodeAttempted: referral.code,
          referralStatus: attributedReferral ? attributedReferral.status : referral.status,
        } : {}),
        ...(attributedReferral ? {
          creatorCode: attributedReferral.code,
          creatorId: attributedReferral.creatorId || '',
          offerId: mappedOfferId || '',
        } : {}),
      },
      ...(hasDiscountOffer ? {
        offers: [mappedOfferId],
        force_offer: true,
      } : {}),
    };

    let order;
    try {
      order = await getRazorpayClient().orders.create(orderPayload);
    } catch (rzpError) {
      const description = extractRazorpayErrorMessage(rzpError);
      console.error('[create-order] Razorpay rejected:', description, rzpError);
      return NextResponse.json({
        error: description || 'Payment provider rejected the order',
        code: 'razorpay_rejected',
      }, { status: 400 });
    }

    await Database.createPayment({
      userId,
      orderId: order.id,
      planId: plan.id,
      amount: plan.amount,
      currency: plan.currency,
      status: order.status || 'created',
      rawOrder: order,
      creatorCode: attributedReferral?.code || null,
      creatorId: attributedReferral?.creatorId || null,
      offerId: attributedReferral?.offerId || null,
      referralCodeAttempted: referral?.code || null,
      referralStatus: attributedReferral?.status || referral?.status || 'none',
      referralReason: attributedReferral?.reason || referral?.reason || null,
    });

    return NextResponse.json({
      keyId: getRazorpayKeyId(),
      order,
      plan: {
        id: plan.id,
        name: plan.name,
        amount: checkoutAmount,
        nominalAmount: plan.amount,
        currency: plan.currency,
        accessUntil: plan.accessUntil || null,
      },
      applied: attributedReferral ? {
        code: attributedReferral.code,
        offerId: attributedReferral.offerId || null,
        status: attributedReferral.status,
        reason: attributedReferral.reason,
      } : null,
      referral: referral ? {
        code: referral.code,
        status: attributedReferral ? attributedReferral.status : referral.status,
        reason: referral.reason,
      } : null,
    });
  } catch (error) {
    console.error('[create-order] failed:', error);
    return NextResponse.json({ error: 'Failed to create Razorpay order' }, { status: 500 });
  }
}
