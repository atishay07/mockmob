import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRazorpayClient, getRazorpayKeyId } from '@/lib/payments/razorpay';
import { getPaymentPlan, getRazorpayPlanId } from '@/lib/payments/plans';
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

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, planId } = body || {};
    const requestedAmount = Number(body?.amount);

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

    const subscriptionPayload = {
      plan_id: razorpayPlanId,
      total_count: 12,
      quantity: 1,
      customer_notify: 1,
      notes: {
        userId,
        planId: plan.id,
      },
    };

    assertRazorpayTimestampsAreSeconds(subscriptionPayload);

    const subscription = await getRazorpayClient().subscriptions.create(subscriptionPayload);

    await Database.createPayment({
      userId,
      subscriptionId: subscription.id,
      planId: plan.id,
      razorpayPlanId,
      amount: plan.amount,
      currency: plan.currency,
      status: subscription.status || 'created',
      rawSubscription: subscription,
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
    });
  } catch (error) {
    console.error('[create-subscription] failed:', error);
    return NextResponse.json({ error: 'Failed to create Razorpay subscription' }, { status: 500 });
  }
}
