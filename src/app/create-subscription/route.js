import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRazorpayClient, getRazorpayKeyId } from '@/lib/payments/razorpay';
import { getPaymentPlan, getRazorpayPlanId } from '@/lib/payments/plans';
import { resolveCreatorCode } from '@/lib/referrals/offers';
import { Database } from '@/../data/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RAZORPAY_TIMESTAMP_FIELDS = ['end_time', 'end_at', 'start_at', 'charge_at', 'expire_by'];
const RAZORPAY_MIN_TIMESTAMP = 946684800;
const RAZORPAY_MAX_TIMESTAMP = 4765046400;
const MILLISECOND_TIMESTAMP_THRESHOLD = 9999999999;

function assertRazorpayTimestampsAreSeconds(payload) {
  for (const field of RAZORPAY_TIMESTAMP_FIELDS) {
    const value = payload[field];
    if (value === undefined || value === null) continue;

    if (!Number.isInteger(value)) {
      throw new Error(`${field} must be a UNIX timestamp in seconds`);
    }

    if (value > MILLISECOND_TIMESTAMP_THRESHOLD) {
      throw new Error('Timestamp is in milliseconds, must be seconds');
    }

    if (value < RAZORPAY_MIN_TIMESTAMP || value > RAZORPAY_MAX_TIMESTAMP) {
      throw new Error(`${field} must be between ${RAZORPAY_MIN_TIMESTAMP} and ${RAZORPAY_MAX_TIMESTAMP}`);
    }
  }
}

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
      return NextResponse.json({ error: 'Cannot create subscription for another user' }, { status: 403 });
    }

    const plan = getPaymentPlan(planId);
    if (!plan) {
      return NextResponse.json({ error: 'Invalid planId' }, { status: 400 });
    }

    if (Number.isFinite(requestedAmount) && requestedAmount !== plan.amount) {
      return NextResponse.json({ error: 'Invalid amount for selected plan' }, { status: 400 });
    }

    const razorpayPlanId = getRazorpayPlanId(plan);
    if (!razorpayPlanId) {
      return NextResponse.json({
        error: `${plan.razorpayPlanIdEnv} is required for Razorpay subscriptions`,
      }, { status: 500 });
    }

    const user = await Database.getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.isPremium) {
      return NextResponse.json({ error: 'User is already subscribed to premium' }, { status: 409 });
    }

    // Razorpay only proves discounts when an offer_id exists. We still
    // persist first-party referral evidence for tracked-only, inactive,
    // and unknown codes so admin can see what users entered.
    const referral = rawCode ? await resolveCreatorCode(rawCode) : null;
    const attributedReferral = referral && ['offer_attached', 'tracked_no_offer'].includes(referral.status)
      ? referral
      : null;

    const subscriptionPayload = {
      plan_id: razorpayPlanId,
      total_count: 12,
      quantity: 1,
      customer_notify: 1,
      notes: {
        userId,
        planId: plan.id,
        ...(referral ? {
          referralCodeAttempted: referral.code,
          referralStatus: referral.status,
        } : {}),
        ...(attributedReferral ? {
          creatorCode: attributedReferral.code,
          creatorId: attributedReferral.creatorId || '',
        } : {}),
      },
      ...(attributedReferral?.offerId ? { offer_id: attributedReferral.offerId } : {}),
    };

    assertRazorpayTimestampsAreSeconds(subscriptionPayload);

    let subscription;
    try {
      subscription = await getRazorpayClient().subscriptions.create(subscriptionPayload);
    } catch (rzpError) {
      // Most common: offer_id expired or not applicable. Surface the
      // description so the UI can render something better than a generic 500.
      const description = extractRazorpayErrorMessage(rzpError);
      console.error('[create-subscription] Razorpay rejected:', description, rzpError);
      return NextResponse.json({
        error: description || 'Payment provider rejected the subscription',
        code: 'razorpay_rejected',
      }, { status: 400 });
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
      creatorCode: attributedReferral?.code || null,
      creatorId: attributedReferral?.creatorId || null,
      offerId: attributedReferral?.offerId || null,
      referralCodeAttempted: referral?.code || null,
      referralStatus: referral?.status || 'none',
      referralReason: referral?.reason || null,
    });

    return NextResponse.json({
      keyId: getRazorpayKeyId(),
      subscription,
      plan: {
        id: plan.id,
        name: plan.name,
        amount: plan.amount,
        currency: plan.currency,
      },
      // Tell the client what happened to the code so the UI can separate
      // gateway discounts from first-party referral tracking.
      applied: attributedReferral ? {
        code: attributedReferral.code,
        offerId: attributedReferral.offerId,
        status: attributedReferral.status,
        reason: attributedReferral.reason,
      } : null,
      referral: referral ? {
        code: referral.code,
        status: referral.status,
        reason: referral.reason,
      } : null,
    });
  } catch (error) {
    console.error('[create-subscription] failed:', error);
    return NextResponse.json({ error: 'Failed to create Razorpay subscription' }, { status: 500 });
  }
}
