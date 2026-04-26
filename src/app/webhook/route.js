import { NextResponse } from 'next/server';
import { verifyRazorpayWebhookSignature } from '@/lib/payments/razorpay';
import { Database } from '@/../data/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'RAZORPAY_WEBHOOK_SECRET is required for webhooks' }, { status: 503 });
    }

    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    if (!verifyRazorpayWebhookSignature({ body, signature })) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    const event = JSON.parse(body);
    const eventType = event?.event;
    const payment = event?.payload?.payment?.entity;
    const subscription = event?.payload?.subscription?.entity;
    const subscriptionId = subscription?.id || payment?.subscription_id;

    if (!subscriptionId || ![
      'subscription.authenticated',
      'subscription.activated',
      'subscription.charged',
      'subscription.cancelled',
      'subscription.completed',
      'subscription.halted',
      'payment.captured',
      'payment.failed',
    ].includes(eventType)) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const paymentRecord = await Database.getPaymentBySubscriptionId(subscriptionId);
    if (!paymentRecord) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (['subscription.authenticated', 'subscription.activated', 'subscription.charged', 'payment.captured'].includes(eventType)) {
      const status = subscription?.status === 'authenticated'
        ? 'authenticated'
        : subscription?.status === 'active' || eventType === 'subscription.activated' || eventType === 'subscription.charged'
          ? 'active'
          : 'captured';

      await Database.updatePaymentBySubscriptionId(subscriptionId, {
        paymentId: payment?.id,
        status,
        rawPayment: payment,
        rawSubscription: subscription,
      });
      await Database.updateUser(paymentRecord.userId, {
        subscriptionStatus: 'active',
        isPremium: true,
      });
    }

    if (['payment.failed', 'subscription.halted'].includes(eventType)) {
      await Database.updatePaymentBySubscriptionId(subscriptionId, {
        paymentId: payment?.id,
        status: 'failed',
        rawPayment: payment,
        rawSubscription: subscription,
      });
    }

    if (['subscription.cancelled', 'subscription.completed'].includes(eventType)) {
      await Database.updatePaymentBySubscriptionId(subscriptionId, {
        status: eventType === 'subscription.cancelled' ? 'cancelled' : 'completed',
        rawSubscription: subscription,
      });
      await Database.updateUser(paymentRecord.userId, {
        subscriptionStatus: eventType === 'subscription.cancelled' ? 'cancelled' : 'free',
        isPremium: false,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[webhook] failed:', error);
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}
