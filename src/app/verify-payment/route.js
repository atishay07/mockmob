import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getRazorpayClient,
  verifyRazorpayPaymentSignature,
  verifyRazorpaySubscriptionSignature,
} from '@/lib/payments/razorpay';
import {
  amountMatchesPaymentRecord,
  referralAttributionFromCheckout,
  resolvePaidThrough,
} from '@/lib/payments/entitlements';
import { getPaymentPlan, getPlanAccessUntil, isOneTimeAccessPlan } from '@/lib/payments/plans';
import { recordEarningIfApplicable } from '@/lib/payouts';
import { Database } from '@/../data/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const {
      razorpay_order_id: orderId,
      razorpay_subscription_id: subscriptionId,
    } = body || {};

    if (orderId) {
      return verifyOneTimeAccessPayment({ body, orderId, sessionUserId: session.user.id });
    }

    if (subscriptionId) {
      return verifyLegacySubscriptionPayment({ body, subscriptionId, sessionUserId: session.user.id });
    }

    return NextResponse.json({ error: 'Missing Razorpay order or subscription id' }, { status: 400 });
  } catch (error) {
    console.error('[verify-payment] failed:', error);
    return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 });
  }
}

async function verifyOneTimeAccessPayment({ body, orderId, sessionUserId }) {
  const {
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
    userId,
  } = body || {};

  if (!orderId || !paymentId || !signature || !userId) {
    return NextResponse.json({ error: 'Missing payment verification fields' }, { status: 400 });
  }

  if (userId !== sessionUserId) {
    return NextResponse.json({ error: 'Cannot verify payment for another user' }, { status: 403 });
  }

  const paymentRecord = await Database.getPaymentByOrderId(orderId);
  if (!paymentRecord || paymentRecord.userId !== userId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const plan = getPaymentPlan(paymentRecord.planId);
  if (!isOneTimeAccessPlan(plan)) {
    return NextResponse.json({ error: 'Payment is not a CUET 2026 one-time access order' }, { status: 400 });
  }

  const isSignatureValid = verifyRazorpayPaymentSignature({ orderId, paymentId, signature });
  if (!isSignatureValid) {
    await Database.updatePaymentByOrderId(orderId, {
      paymentId,
      status: 'failed',
    });
    return NextResponse.json({ error: 'Invalid Razorpay signature' }, { status: 400 });
  }

  if (await Database.hasRefundPremiumRevocation({ userId, paymentId })) {
    await keepRefundRevokedOrder({ orderId, paymentId, paymentRecord });
    return NextResponse.json({ error: 'This payment was refunded and CUET 2026 access has been revoked' }, { status: 409 });
  }

  const razorpayPayment = await getRazorpayClient().payments.fetch(paymentId);
  const amountMatches = razorpayPayment.order_id === orderId &&
    razorpayPayment.amount === plan.amount &&
    razorpayPayment.currency === plan.currency &&
    razorpayPayment.status === 'captured';

  if (!amountMatches) {
    await Database.updatePaymentByOrderId(orderId, {
      paymentId,
      status: 'failed',
      amountPaid: typeof razorpayPayment.amount === 'number' ? razorpayPayment.amount : null,
      accessUntil: null,
      rawPayment: razorpayPayment,
    });
    return NextResponse.json({ error: 'Payment details do not match CUET 2026 access order' }, { status: 400 });
  }

  const accessUntil = getPlanAccessUntil(plan);

  await Database.updatePaymentByOrderId(orderId, {
    paymentId,
    status: 'captured',
    amountPaid: razorpayPayment.amount,
    accessUntil,
    rawPayment: razorpayPayment,
    ...referralAttributionFromCheckout({
      paymentRecord,
      payment: razorpayPayment,
    }),
  });

  const user = await Database.updateUser(userId, {
    subscriptionStatus: 'active',
    isPremium: true,
    premiumUntil: accessUntil,
    razorpaySubscriptionId: null,
  });

  await recordEarningIfApplicable({ orderId });

  return NextResponse.json({
    ok: true,
    user,
    payment: {
      orderId,
      paymentId,
      amount: paymentRecord.amount,
      planId: paymentRecord.planId,
      status: razorpayPayment.status,
      accessUntil,
    },
  });
}

async function verifyLegacySubscriptionPayment({ body, subscriptionId, sessionUserId }) {
  const {
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
    userId,
  } = body || {};

  if (!subscriptionId || !paymentId || !signature || !userId) {
    return NextResponse.json({ error: 'Missing payment verification fields' }, { status: 400 });
  }

  if (userId !== sessionUserId) {
    return NextResponse.json({ error: 'Cannot verify payment for another user' }, { status: 403 });
  }

  const paymentRecord = await Database.getPaymentBySubscriptionId(subscriptionId);
  if (!paymentRecord || paymentRecord.userId !== userId) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  const isSignatureValid = verifyRazorpaySubscriptionSignature({
    subscriptionId,
    paymentId,
    signature,
  });

  if (!isSignatureValid) {
    await Database.updatePaymentBySubscriptionId(subscriptionId, {
      paymentId,
      status: 'failed',
    });
    return NextResponse.json({ error: 'Invalid Razorpay signature' }, { status: 400 });
  }

  if (await Database.hasRefundPremiumRevocation({ userId, subscriptionId, paymentId })) {
    await keepRefundRevokedSubscription({ subscriptionId, paymentId, paymentRecord });
    return NextResponse.json({ error: 'This payment was refunded and premium has been revoked' }, { status: 409 });
  }

  const razorpayPayment = await getRazorpayClient().payments.fetch(paymentId);
  const razorpaySubscription = await getRazorpayClient().subscriptions.fetch(subscriptionId);

  const amountIsAcceptable = amountMatchesPaymentRecord(razorpayPayment, paymentRecord, {
    subscription: razorpaySubscription,
  });

  if (
    razorpaySubscription.id !== subscriptionId ||
    !amountIsAcceptable ||
    razorpayPayment.status !== 'captured'
  ) {
    await Database.updatePaymentBySubscriptionId(subscriptionId, {
      paymentId,
      status: 'failed',
      amountPaid: null,
      accessUntil: null,
      rawPayment: razorpayPayment,
      rawSubscription: razorpaySubscription,
    });
    return NextResponse.json({ error: 'Payment details do not match subscription' }, { status: 400 });
  }

  const premiumUntil = resolvePaidThrough({
    subscription: razorpaySubscription,
    payment: razorpayPayment,
    existingPremiumUntil: paymentRecord.accessUntil,
  });

  await Database.updatePaymentBySubscriptionId(subscriptionId, {
    paymentId,
    status: 'captured',
    amountPaid: typeof razorpayPayment.amount === 'number' ? razorpayPayment.amount : null,
    accessUntil: premiumUntil,
    rawPayment: razorpayPayment,
    rawSubscription: razorpaySubscription,
    ...referralAttributionFromCheckout({
      paymentRecord,
      payment: razorpayPayment,
      subscription: razorpaySubscription,
    }),
  });

  const user = await Database.updateUser(userId, {
    subscriptionStatus: 'active',
    isPremium: true,
    premiumUntil,
    razorpaySubscriptionId: subscriptionId,
  });

  await recordEarningIfApplicable(subscriptionId);

  return NextResponse.json({
    ok: true,
    user,
    payment: {
      subscriptionId,
      paymentId,
      amount: paymentRecord.amount,
      planId: paymentRecord.planId,
      status: razorpaySubscription.status,
    },
  });
}

async function keepRefundRevokedOrder({ orderId, paymentId, paymentRecord }) {
  await Database.updatePaymentByOrderId(orderId, {
    paymentId,
    status: 'cancelled',
    amountPaid: 0,
    accessUntil: null,
  });

  const hasOtherPaidAccess = await Database.hasOtherPaidSubscriptionEvidence({
    userId: paymentRecord.userId,
    excludingPaymentId: paymentId,
  });
  if (hasOtherPaidAccess) return;

  await Database.updateUser(paymentRecord.userId, {
    subscriptionStatus: 'cancelled',
    isPremium: false,
    premiumUntil: null,
    razorpaySubscriptionId: null,
  });
}

async function keepRefundRevokedSubscription({ subscriptionId, paymentId, paymentRecord }) {
  await Database.updatePaymentBySubscriptionId(subscriptionId, {
    paymentId,
    status: 'cancelled',
    amountPaid: 0,
    accessUntil: null,
  });

  const hasOtherPaidAccess = await Database.hasOtherPaidSubscriptionEvidence({
    userId: paymentRecord.userId,
    excludingSubscriptionId: subscriptionId,
    excludingPaymentId: paymentId,
  });
  if (hasOtherPaidAccess) return;

  await Database.updateUser(paymentRecord.userId, {
    subscriptionStatus: 'cancelled',
    isPremium: false,
    premiumUntil: null,
    razorpaySubscriptionId: null,
  });
}
