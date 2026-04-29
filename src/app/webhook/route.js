import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { verifyRazorpayWebhookSignature } from '@/lib/payments/razorpay';
import { recordEarningIfApplicable } from '@/lib/payouts';
import { Database } from '@/../data/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HANDLED_EVENTS = new Set([
  'subscription.authenticated',
  'subscription.activated',
  'subscription.charged',
  'subscription.cancelled',
  'subscription.completed',
  'subscription.halted',
  'payment.captured',
  'payment.failed',
]);
const PAID_SALE_STATES = new Set(['captured', 'completed', 'paid']);

export async function POST(request) {
  let eventId = null;

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

    if (!subscriptionId || !HANDLED_EVENTS.has(eventType)) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Idempotency: prefer Razorpay's own event id (header) when present;
    // fall back to a deterministic hash of the body so a missing/changed
    // header still dedupes identical re-deliveries.
    eventId = request.headers.get('x-razorpay-event-id')
      || crypto.createHash('sha256').update(body).digest('hex');

    const isFirstSeen = await Database.claimWebhookEvent({
      eventId,
      eventType,
      payload: event,
    });

    if (!isFirstSeen) {
      return NextResponse.json({ ok: true, deduped: true });
    }

    const paymentRecord = await Database.getPaymentBySubscriptionId(subscriptionId);
    if (!paymentRecord) {
      await Database.markWebhookEventProcessed(eventId, 'no matching payment record');
      return NextResponse.json({ ok: true, ignored: true });
    }

    const hasCapturedPayment = payment?.status === 'captured' && typeof payment?.amount === 'number' && payment.amount > 0;

    if (eventType === 'payment.captured' || (eventType === 'subscription.charged' && hasCapturedPayment)) {
      await Database.updatePaymentBySubscriptionId(subscriptionId, {
        paymentId: payment?.id,
        status: 'captured',
        amountPaid: payment.amount,
        rawPayment: payment,
        rawSubscription: subscription,
      });
      await Database.updateUser(paymentRecord.userId, {
        subscriptionStatus: 'active',
        isPremium: true,
      });

      await recordEarningIfApplicable(subscriptionId);
    }

    if (
      ['subscription.authenticated', 'subscription.activated'].includes(eventType) &&
      !PAID_SALE_STATES.has(paymentRecord.status)
    ) {
      await Database.updatePaymentBySubscriptionId(subscriptionId, {
        status: subscription?.status === 'active' ? 'active' : 'authenticated',
        rawSubscription: subscription,
      });
    }

    if (['payment.failed', 'subscription.halted'].includes(eventType)) {
      await Database.updatePaymentBySubscriptionId(subscriptionId, {
        paymentId: payment?.id,
        status: 'failed',
        amountPaid: typeof payment?.amount === 'number' ? payment.amount : undefined,
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

    await Database.markWebhookEventProcessed(eventId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[webhook] failed:', error);
    if (eventId) {
      // Mark the event with the error, but DON'T return 200 — Razorpay needs
      // a non-2xx so it retries. The PRIMARY KEY guarantees the next attempt
      // will see the row already exists and re-enter as a deduped no-op...
      // unless we also clear it. Strategy: we let the row sit and Razorpay's
      // retry will hit the dedupe branch. If processing genuinely needs to
      // re-run, an admin can delete the webhook_events row.
      try {
        await Database.markWebhookEventProcessed(eventId, error?.message || 'unknown error');
      } catch {}
    }
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}
