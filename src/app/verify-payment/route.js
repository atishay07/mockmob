import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRazorpayClient, verifyRazorpaySubscriptionSignature } from '@/lib/payments/razorpay';
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

    const razorpayPayment = await getRazorpayClient().payments.fetch(paymentId);
    const razorpaySubscription = await getRazorpayClient().subscriptions.fetch(subscriptionId);

    // Amount validation:
    //   - Without an offer: the payment must equal the plan's nominal amount.
    //   - With an offer: the payment may be lower than the nominal amount
    //     (discounted) but must be > 0. We can't predict the discounted
    //     amount here without re-fetching the offer, so the upper bound
    //     (<= nominal) is the strongest reasonable check.
    const hasOffer = Boolean(paymentRecord.offerId);
    const amountIsAcceptable = hasOffer
      ? Number.isInteger(razorpayPayment.amount)
        && razorpayPayment.amount > 0
        && razorpayPayment.amount <= paymentRecord.amount
      : razorpayPayment.amount === paymentRecord.amount;

    if (
      razorpaySubscription.id !== subscriptionId ||
      !amountIsAcceptable ||
      razorpayPayment.status !== 'captured'
    ) {
      await Database.updatePaymentBySubscriptionId(subscriptionId, {
        paymentId,
        status: 'failed',
        amountPaid: typeof razorpayPayment.amount === 'number' ? razorpayPayment.amount : null,
        rawPayment: razorpayPayment,
        rawSubscription: razorpaySubscription,
      });
      return NextResponse.json({ error: 'Payment details do not match subscription' }, { status: 400 });
    }

    await Database.updatePaymentBySubscriptionId(subscriptionId, {
      paymentId,
      status: 'captured',
      // amount_paid is the actually-charged paise amount post-offer, while
      // payments.amount stays at the plan's nominal price. The delta tells
      // us how much discount the creator's offer applied.
      amountPaid: typeof razorpayPayment.amount === 'number' ? razorpayPayment.amount : null,
      rawPayment: razorpayPayment,
      rawSubscription: razorpaySubscription,
    });

    const user = await Database.updateUser(userId, {
      subscriptionStatus: 'active',
      isPremium: true,
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
