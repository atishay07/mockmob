import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getPaymentPlan, getPlanAccessUntil, getPlanCheckoutAmount, isOneTimeAccessPlan } from '@/lib/payments/plans';
import { getRazorpayClient, verifyRazorpayWebhookSignature } from '@/lib/payments/razorpay';
import {
  amountMatchesPaymentRecord,
  hasPaidPaymentEvidence,
  isCapturedRazorpayPayment,
  isFutureIso,
  referralAttributionFromCheckout,
  resolvePaidThrough,
} from '@/lib/payments/entitlements';
import { settleUserEntitlement } from '@/lib/payments/settle';
import { recordEarningIfApplicable } from '@/lib/payouts';
import { Database } from '@/../data/db';
import { countStepOnce } from '@/lib/server/funnelOnceStore';
import { getAICreditPack, grantPurchasedAICredits } from '@/services/credits/aiCreditWallet';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HANDLED_EVENTS = new Set([
  'subscription.authenticated',
  'subscription.activated',
  'subscription.charged',
  'subscription.pending',
  'subscription.paused',
  'subscription.resumed',
  'subscription.cancelled',
  'subscription.completed',
  'subscription.halted',
  'payment.captured',
  'payment.failed',
]);

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
    let payment = event?.payload?.payment?.entity || null;
    let subscription = event?.payload?.subscription?.entity || null;
    let invoice = null;
    let subscriptionId = subscription?.id || payment?.subscription_id || null;
    const orderId = payment?.order_id || null;

    if (!HANDLED_EVENTS.has(eventType) || (!subscriptionId && !orderId && !payment?.invoice_id)) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    eventId = request.headers.get('x-razorpay-event-id')
      || crypto.createHash('sha256').update(body).digest('hex');

    const shouldProcess = await Database.claimWebhookEvent({
      eventId,
      eventType,
      payload: event,
    });

    // Another delivery of this event is still being processed (lease in webhook_events.claimed_at): answer 503 so
    // Razorpay retries it later. By then the first one has finished (the retry is a duplicate, 200) or crashed (it runs).
    if (shouldProcess === 'in_flight') {
      console.warn('[webhook] duplicate delivery while the first is still processing; asked the sender to retry', eventType);
      return NextResponse.json({ ok: false, retry: true }, { status: 503, headers: { 'Retry-After': '30' } });
    }

    if (!shouldProcess) {
      return NextResponse.json({ ok: true, deduped: true });
    }

    if (payment?.invoice_id) {
      invoice = await getRazorpayClient().invoices.fetch(payment.invoice_id);
      subscriptionId = subscriptionId || invoice?.subscription_id || null;
    }

    if (subscriptionId && !subscription) {
      subscription = await getRazorpayClient().subscriptions.fetch(subscriptionId);
    }

    let paymentRecord = subscriptionId
      ? await Database.getPaymentBySubscriptionId(subscriptionId)
      : await Database.getPaymentByOrderId(orderId);

    if (!paymentRecord && subscriptionId && isCapturedRazorpayPayment(payment)) {
      paymentRecord = await createMissingSubscriptionPaymentRecord({
        payment,
        subscription,
        invoice,
        subscriptionId,
      });
    }

    if (!paymentRecord) {
      await Database.markWebhookEventProcessed(eventId, 'no matching payment record');
      return NextResponse.json({ ok: true, ignored: true });
    }

    const creditPack = getAICreditPack(paymentRecord.planId);
    if (creditPack) {
      await processCreditPackWebhook({ eventType, payment, orderId, paymentRecord, creditPack });
      await Database.markWebhookEventProcessed(eventId);
      return NextResponse.json({ ok: true });
    }

    const oneTimePlan = getPaymentPlan(paymentRecord.planId);
    if (isOneTimeAccessPlan(oneTimePlan)) {
      await processOneTimeAccessWebhook({ eventType, payment, orderId, paymentRecord, plan: oneTimePlan });
      await Database.markWebhookEventProcessed(eventId);
      return NextResponse.json({ ok: true });
    }

    if (await Database.hasRefundPremiumRevocation({
      userId: paymentRecord.userId,
      subscriptionId: subscriptionId || paymentRecord.subscriptionId,
      paymentId: payment?.id || paymentRecord.paymentId,
    })) {
      await keepRefundRevoked({
        subscriptionId: subscriptionId || paymentRecord.subscriptionId,
        payment,
        subscription,
        paymentRecord,
      });
      await Database.markWebhookEventProcessed(eventId, 'refunded subscription ignored');
      return NextResponse.json({ ok: true, ignored: true, reason: 'refunded_subscription' });
    }

    if (eventType === 'payment.captured' || eventType === 'subscription.charged') {
      if (!isCapturedRazorpayPayment(payment) || !amountMatchesPaymentRecord(payment, paymentRecord, { subscription, invoice })) {
        // A charge that is not a captured payment of the right amount never grants access. It also
        // never takes back access an earlier captured charge already paid for.
        if (hasPaidPaymentEvidence(paymentRecord)) {
          await Database.markWebhookEventProcessed(eventId, 'subscription payment not captured or amount mismatch; paid access kept');
          return NextResponse.json({ ok: true, ignored: true });
        }
        await updateUnpaidSubscriptionPayment({ subscriptionId, payment, subscription, paymentRecord });
        await Database.markWebhookEventProcessed(eventId, 'subscription payment amount mismatch');
        return NextResponse.json({ ok: true, ignored: true });
      }

      await grantPaidSubscriptionAccess({
        subscriptionId,
        payment,
        subscription,
        invoice,
        paymentRecord,
      });
      await Database.markWebhookEventProcessed(eventId);
      return NextResponse.json({ ok: true });
    }

    if (['subscription.authenticated', 'subscription.activated'].includes(eventType)) {
      if (!hasPaidPaymentEvidence(paymentRecord)) {
        await Database.updatePaymentBySubscriptionId(subscriptionId, {
          status: subscription?.status === 'active' ? 'active' : 'authenticated',
          rawSubscription: subscription,
        });
      } else if (subscription) {
        await Database.updatePaymentBySubscriptionId(subscriptionId, {
          rawSubscription: subscription,
        });
      }
    }

    if (['payment.failed', 'subscription.halted', 'subscription.pending', 'subscription.paused'].includes(eventType)) {
      await handleFailedSubscriptionPayment({
        eventType,
        subscriptionId,
        payment,
        subscription,
        paymentRecord,
      });
    }

    if (eventType === 'subscription.resumed' && subscription) {
      // Nothing to grant yet: the next captured charge restores renewing status.
      await Database.updatePaymentBySubscriptionId(subscriptionId, { rawSubscription: subscription });
    }

    if (['subscription.cancelled', 'subscription.completed'].includes(eventType)) {
      await handleSubscriptionEnd({
        eventType,
        subscriptionId,
        payment,
        subscription,
        invoice,
        paymentRecord,
      });
    }

    await Database.markWebhookEventProcessed(eventId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[webhook] failed:', error);
    if (eventId) {
      try {
        await Database.markWebhookEventFailed(eventId, error?.message || 'unknown error');
      } catch {}
    }
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}

async function createMissingSubscriptionPaymentRecord({ payment, subscription, invoice, subscriptionId }) {
  const notes = {
    ...(subscription?.notes || {}),
    ...(invoice?.notes || {}),
    ...(payment?.notes || {}),
  };
  const userId = notes.userId;
  const planId = notes.planId;
  const plan = getPaymentPlan(planId);

  if (!userId || !plan || payment.amount <= 0 || payment.amount > plan.amount) {
    return null;
  }

  const user = await Database.getUserById(userId);
  if (!user) return null;

  const accessUntil = resolvePaidThrough({ subscription, invoice, payment });

  return Database.createPayment({
    userId,
    subscriptionId,
    paymentId: payment.id,
    planId: plan.id,
    amount: plan.amount,
    amountPaid: payment.amount,
    currency: plan.currency,
    status: 'captured',
    rawSubscription: subscription || {},
    rawPayment: payment,
    accessUntil,
    creatorCode: notes.creatorCode || null,
    creatorId: notes.creatorId || null,
    offerId: subscription?.offer_id || notes.offerId || null,
    referralCodeAttempted: notes.referralCodeAttempted || notes.creatorCode || null,
    referralStatus: notes.referralStatus || (subscription?.offer_id ? 'offer_attached' : null),
  });
}

async function grantPaidSubscriptionAccess({ subscriptionId, payment, subscription, invoice, paymentRecord }) {
  const accessUntil = resolvePaidThrough({
    subscription,
    invoice,
    payment,
    existingPremiumUntil: paymentRecord.accessUntil,
  });

  await Database.updatePaymentBySubscriptionId(subscriptionId, {
    paymentId: payment?.id,
    status: 'captured',
    amountPaid: payment.amount,
    accessUntil,
    rawPayment: payment,
    rawSubscription: subscription,
    ...referralAttributionFromCheckout({
      paymentRecord,
      payment,
      subscription,
      invoice,
    }),
  });

  // A late charge event for a subscription the student already cancelled must not turn renewals back on.
  const user = await Database.getUserById(paymentRecord.userId);
  const cancelledByUser = user?.subscriptionStatus === 'cancelled' && user?.razorpaySubscriptionId === subscriptionId;
  await settleUserEntitlement({
    userId: paymentRecord.userId,
    ownStatus: cancelledByUser ? 'cancelled' : 'active',
    ownAccessUntil: accessUntil,
    subscriptionId,
    paymentId: payment?.id,
    ownPaid: true,
    forceOwnId: true,
  });

  await recordEarningIfApplicable(subscriptionId);
  // Aggregate funnel: first captured payment of this student. The webhook is Razorpay's request, not the
  // student's device, so it counts under the platform "other" (null headers).
  countStepOnce(paymentRecord.userId, 'payment_captured', null);
}

async function keepRefundRevoked({ subscriptionId, payment, subscription, paymentRecord }) {
  const resolvedSubscriptionId = subscriptionId || paymentRecord.subscriptionId;
  const resolvedPaymentId = payment?.id || paymentRecord.paymentId;

  if (resolvedSubscriptionId) {
    await Database.updatePaymentBySubscriptionId(resolvedSubscriptionId, {
      paymentId: resolvedPaymentId,
      status: 'cancelled',
      amountPaid: 0,
      accessUntil: null,
      rawPayment: payment || paymentRecord.rawPayment,
      rawSubscription: subscription || paymentRecord.rawSubscription,
    });
  }

  const hasOtherPaidAccess = await Database.hasOtherPaidSubscriptionEvidence({
    userId: paymentRecord.userId,
    excludingSubscriptionId: resolvedSubscriptionId,
    excludingPaymentId: resolvedPaymentId,
  });
  if (hasOtherPaidAccess) return;

  await Database.updateUser(paymentRecord.userId, {
    subscriptionStatus: 'cancelled',
    isPremium: false,
    premiumUntil: null,
    razorpaySubscriptionId: null,
  });
}

async function handleFailedSubscriptionPayment({ eventType, subscriptionId, payment, subscription, paymentRecord }) {
  if (hasPaidPaymentEvidence(paymentRecord)) {
    // A payment.failed that arrives after the subscription recovered (it is active again) is
    // history, not a new problem. Razorpay marks a subscription "pending" while a charge is failing.
    if (eventType === 'payment.failed' && subscription?.status === 'active') {
      await Database.updatePaymentBySubscriptionId(subscriptionId, { rawSubscription: subscription });
      return;
    }
    const accessUntil = paymentRecord.accessUntil || resolvePaidThrough({
      subscription,
      payment,
      existingPremiumUntil: paymentRecord.accessUntil,
      nowMs: Number(paymentRecord.createdAt) || Date.now(),
    });
    await Database.updatePaymentBySubscriptionId(subscriptionId, {
      accessUntil,
      rawSubscription: subscription,
    });
    // Pro stays on to the end of the month already paid for; then the date ends it.
    await settleUserEntitlement({
      userId: paymentRecord.userId,
      ownStatus: 'past_due',
      ownAccessUntil: accessUntil,
      subscriptionId,
      paymentId: payment?.id,
      ownPaid: true,
    });
    return;
  }

  await updateUnpaidSubscriptionPayment({ subscriptionId, payment, subscription, paymentRecord });
}

async function handleSubscriptionEnd({ eventType, subscriptionId, payment, subscription, invoice, paymentRecord }) {
  const paid = hasPaidPaymentEvidence(paymentRecord);
  const accessUntil = resolvePaidThrough({
    subscription,
    invoice,
    payment,
    existingPremiumUntil: paymentRecord.accessUntil,
    nowMs: Number(paymentRecord.createdAt) || Date.now(),
  });
  const keepPaidAccess = paid && isFutureIso(accessUntil);

  if (paid) {
    await Database.updatePaymentBySubscriptionId(subscriptionId, {
      accessUntil,
      rawSubscription: subscription,
    });
  } else {
    await Database.updatePaymentBySubscriptionId(subscriptionId, {
      status: eventType === 'subscription.cancelled' ? 'cancelled' : 'completed',
      accessUntil: null,
      rawSubscription: subscription,
    });
  }

  await settleUserEntitlement({
    userId: paymentRecord.userId,
    ownStatus: eventType === 'subscription.cancelled' ? 'cancelled' : 'free',
    ownAccessUntil: keepPaidAccess ? accessUntil : null,
    subscriptionId,
    paymentId: payment?.id,
    ownPaid: keepPaidAccess,
  });
}

async function updateUnpaidSubscriptionPayment({ subscriptionId, payment, subscription, paymentRecord }) {
  await Database.updatePaymentBySubscriptionId(subscriptionId, {
    paymentId: payment?.id,
    status: 'failed',
    amountPaid: null,
    accessUntil: null,
    rawPayment: payment,
    rawSubscription: subscription,
  });

  // This subscription never paid. Whatever else the user holds is left as it is.
  await settleUserEntitlement({
    userId: paymentRecord.userId,
    ownStatus: 'past_due',
    ownAccessUntil: null,
    subscriptionId,
    paymentId: payment?.id,
    ownPaid: false,
  });
}

async function processOneTimeAccessWebhook({ eventType, payment, orderId, paymentRecord, plan }) {
  const resolvedOrderId = orderId || payment?.order_id || paymentRecord.orderId;
  const resolvedPaymentId = payment?.id || paymentRecord.paymentId;

  if (!resolvedOrderId) return;

  if (await Database.hasRefundPremiumRevocation({
    userId: paymentRecord.userId,
    paymentId: resolvedPaymentId,
  })) {
    await keepRefundRevokedOrder({ orderId: resolvedOrderId, payment, paymentRecord });
    return;
  }

  if (eventType === 'payment.captured') {
    const expectedOrderAmount = Number(paymentRecord.rawOrder?.amount || plan.amount);
    const discountIsAllowed = expectedOrderAmount === plan.amount ||
      (Boolean(paymentRecord.offerId) &&
        expectedOrderAmount === getPlanCheckoutAmount(plan, paymentRecord.offerId) &&
        amountMatchesPaymentRecord(payment, paymentRecord));
    const isExpectedPayment = isCapturedRazorpayPayment(payment) &&
      payment.order_id === resolvedOrderId &&
      payment.amount === expectedOrderAmount &&
      discountIsAllowed &&
      payment.currency === plan.currency;

    if (!isExpectedPayment) {
      if (!hasPaidPaymentEvidence(paymentRecord)) {
        await Database.updatePaymentByOrderId(resolvedOrderId, {
          paymentId: resolvedPaymentId,
          status: 'failed',
          amountPaid: typeof payment?.amount === 'number' ? payment.amount : null,
          accessUntil: null,
          rawPayment: payment,
        });
      }
      return;
    }

    if (paymentRecord.status === 'captured' &&
      paymentRecord.paymentId === payment.id &&
      Number(paymentRecord.amountPaid) === Number(plan.amount)) {
      return;
    }

    const accessUntil = getPlanAccessUntil(plan);
    await Database.updatePaymentByOrderId(resolvedOrderId, {
      paymentId: payment.id,
      status: 'captured',
      amountPaid: payment.amount,
      accessUntil,
      rawPayment: payment,
      ...referralAttributionFromCheckout({
        paymentRecord,
        payment,
      }),
    });

    await Database.updateUser(paymentRecord.userId, {
      subscriptionStatus: 'active',
      isPremium: true,
      premiumUntil: accessUntil,
      razorpaySubscriptionId: null,
    });

    await recordEarningIfApplicable({ orderId: resolvedOrderId });
    // Aggregate funnel: first captured payment of this student. The webhook is Razorpay's request, not the
    // student's device, so it counts under the platform "other" (null headers).
    countStepOnce(paymentRecord.userId, 'payment_captured', null);
  }

  if (eventType === 'payment.failed' && !hasPaidPaymentEvidence(paymentRecord)) {
    await Database.updatePaymentByOrderId(resolvedOrderId, {
      paymentId: resolvedPaymentId,
      status: 'failed',
      amountPaid: typeof payment?.amount === 'number' ? payment.amount : undefined,
      rawPayment: payment,
    });
  }
}

async function keepRefundRevokedOrder({ orderId, payment, paymentRecord }) {
  const resolvedPaymentId = payment?.id || paymentRecord.paymentId;

  await Database.updatePaymentByOrderId(orderId, {
    paymentId: resolvedPaymentId,
    status: 'cancelled',
    amountPaid: 0,
    accessUntil: null,
    rawPayment: payment || paymentRecord.rawPayment,
  });

  const hasOtherPaidAccess = await Database.hasOtherPaidSubscriptionEvidence({
    userId: paymentRecord.userId,
    excludingPaymentId: resolvedPaymentId,
  });
  if (hasOtherPaidAccess) return;

  await Database.updateUser(paymentRecord.userId, {
    subscriptionStatus: 'cancelled',
    isPremium: false,
    premiumUntil: null,
    razorpaySubscriptionId: null,
  });
}

async function processCreditPackWebhook({ eventType, payment, orderId, paymentRecord, creditPack }) {
  const hasCapturedPayment = isCapturedRazorpayPayment(payment);
  // A row already captured is never downgraded to 'failed' by a replayed or late event (same rule as both verify paths).
  const settled = paymentRecord?.status === 'captured';

  if (eventType === 'payment.captured' && hasCapturedPayment) {
    if (payment.amount !== creditPack.amountPaise) {
      if (settled) return;
      await Database.updatePaymentByOrderId(orderId, {
        paymentId: payment?.id,
        status: 'failed',
        amountPaid: typeof payment?.amount === 'number' ? payment.amount : undefined,
        rawPayment: payment,
      });
      return;
    }

    if (isAlreadyCapturedCreditPayment(paymentRecord, { paymentId: payment?.id, amountPaise: creditPack.amountPaise })) {
      return;
    }

    const grant = await grantPurchasedAICredits({
      userId: paymentRecord.userId,
      credits: creditPack.credits,
      packKey: creditPack.key,
      paymentId: payment?.id,
      orderId,
      idempotencyKey: `ai_topup:${orderId}:${payment?.id}`,
      metadata: {
        amountPaise: creditPack.amountPaise,
        amountInr: creditPack.amountInr,
        source: 'razorpay_webhook',
      },
    });

    if (!grant.ok) {
      throw new Error(grant.error || 'ai_credit_webhook_grant_failed');
    }

    await Database.updatePaymentByOrderId(orderId, {
      paymentId: payment?.id,
      status: 'captured',
      amountPaid: payment.amount,
      rawPayment: payment,
    });
  }

  if (eventType === 'payment.failed' && !settled) {
    await Database.updatePaymentByOrderId(orderId, {
      paymentId: payment?.id,
      status: 'failed',
      amountPaid: typeof payment?.amount === 'number' ? payment.amount : undefined,
      rawPayment: payment,
    });
  }
}

function isAlreadyCapturedCreditPayment(paymentRecord, { paymentId, amountPaise }) {
  return paymentRecord?.status === 'captured' &&
    paymentRecord.paymentId === paymentId &&
    Number(paymentRecord.amountPaid) === Number(amountPaise);
}
