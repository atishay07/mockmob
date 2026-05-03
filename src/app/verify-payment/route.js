import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRazorpayClient, verifyRazorpaySubscriptionSignature } from '@/lib/payments/razorpay';
import { amountMatchesPaymentRecord, referralAttributionFromCheckout, resolvePaidThrough } from '@/lib/payments/entitlements';
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
      razorpay_subscription_id: subscriptionId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      userId,
    } = body || {};

    if (!subscriptionId || !paymentId || !signature || !userId) {
      return NextResponse.json({ error: 'Missing payment verification fields' }, { status: 400 });
    }

    if (userId !== session.user.id) {
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
      await keepRefundRevoked({ subscriptionId, paymentId, paymentRecord });
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
      // amount_paid is the actually-charged paise amount post-offer, while
      // payments.amount stays at the plan's nominal price. The delta tells
      // us how much discount the creator's offer applied.
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

    // Lock in creator earnings now that the payment is confirmed.
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
  } catch (error) {
    console.error('[verify-payment] failed:', error);
    return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 });
  }
}

async function keepRefundRevoked({ subscriptionId, paymentId, paymentRecord }) {
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
