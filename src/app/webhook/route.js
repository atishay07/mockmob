import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getPaymentPlan, getPlanAccessUntil, getPlanCheckoutAmount, getRazorpayPlanId, isOneTimeAccessPlan } from '@/lib/payments/plans';
import { cancelMonthlyRenewal } from '@/lib/payments/cancel';
import { getRazorpayClient, verifyRazorpayWebhookSignature } from '@/lib/payments/razorpay';
import {
  amountMatchesPaymentRecord,
  hasPaidPaymentEvidence,
  isCapturedRazorpayPayment,
  isFutureIso,
  referralAttributionFromCheckout,
  REFUND_REVOKED_PREMIUM_ACTION,
  resolvePaidThrough,
} from '@/lib/payments/entitlements';
import { settleUserEntitlement, shrinkPremiumToOtherPaidAccess } from '@/lib/payments/settle';
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

// M4 (audit 15 Nov 2026): refunds made in the Razorpay dashboard and bank disputes. Only a processed refund changes access;
// a dispute is recorded for the owner and changes nothing by itself.
const REFUND_EVENTS = new Set(['refund.processed']);
const isDisputeEvent = (eventType) => typeof eventType === 'string' && eventType.startsWith('payment.dispute.');
const isMoneyBackEvent = (eventType) => REFUND_EVENTS.has(eventType) || isDisputeEvent(eventType);

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
    const moneyBackPaymentId = isMoneyBackEvent(eventType)
      ? (event?.payload?.refund?.entity?.payment_id || event?.payload?.dispute?.entity?.payment_id || payment?.id || null)
      : null;

    if (isMoneyBackEvent(eventType) ? !moneyBackPaymentId : (!HANDLED_EVENTS.has(eventType) || (!subscriptionId && !orderId && !payment?.invoice_id))) {
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

    if (moneyBackPaymentId) {
      const outcome = await processMoneyBackEvent({ eventId, eventType, event, paymentId: moneyBackPaymentId });
      await Database.markWebhookEventProcessed(eventId, outcome.note || null);
      return NextResponse.json({ ok: true, ...(outcome.ignored ? { ignored: true } : {}), ...(outcome.result ? { result: outcome.result } : {}) });
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
  // M8 (audit 15 Nov 2026): who and what is paid for comes only from the subscription's notes, which our server wrote when
  // it created the subscription. Checkout lets the payer set the payment's own notes, so those are never read here.
  const notes = subscription?.id === subscriptionId ? (subscription.notes || {}) : {};
  const userId = typeof notes.userId === 'string' ? notes.userId : null;
  const plan = getPaymentPlan(notes.planId);
  const razorpayPlanId = getRazorpayPlanId(plan);

  let reason = null;
  if (!userId) reason = 'no user in the subscription notes';
  else if (plan?.billingType !== 'subscription') reason = 'not a known monthly plan';
  else if (!razorpayPlanId || subscription.plan_id !== razorpayPlanId) reason = 'Razorpay plan does not match the configured plan';
  else if (payment.amount !== plan.amount) reason = 'amount does not match the plan';

  const user = reason ? null : await Database.getUserById(userId);
  if (!reason && !user) reason = 'user not found';
  if (reason) {
    // Grants nothing. Kept for the owner to look at, once per payment.
    console.warn('[webhook] unattributed subscription payment', { subscriptionId, paymentId: payment?.id, reason });
    await Database.recordPaymentEvent({
      action: 'billing.unattributed_subscription_payment',
      targetType: 'subscription',
      targetId: subscriptionId,
      key: `unattributed:${payment?.id || subscriptionId}`,
      metadata: { subscriptionId, paymentId: payment?.id || null, amount: payment?.amount ?? null, razorpayPlanId: subscription?.plan_id || null, reason },
    });
    return null;
  }

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
  if (hasOtherPaidAccess) {
    // Pro stays for the other access, but never on the refunded payment's own date.
    await shrinkPremiumToOtherPaidAccess({
      userId: paymentRecord.userId,
      excludingSubscriptionId: resolvedSubscriptionId,
      excludingPaymentId: resolvedPaymentId,
    });
    return;
  }

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
  if (hasOtherPaidAccess) {
    // Pro stays for the other access, but never on the refunded payment's own date.
    await shrinkPremiumToOtherPaidAccess({
      userId: paymentRecord.userId,
      excludingPaymentId: resolvedPaymentId,
    });
    return;
  }

  await Database.updateUser(paymentRecord.userId, {
    subscriptionStatus: 'cancelled',
    isPremium: false,
    premiumUntil: null,
    razorpaySubscriptionId: null,
  });
}

/**
 * M4 (audit 15 Nov 2026): a refund or a bank dispute made outside the site. Each one is recorded once against our payment
 * row (audit_logs, keyed by the refund or dispute id). A refund of the whole payment that grants the current access ends
 * that access now, through the same refund revocation every later verify and webhook already honours; a monthly plan is
 * also cancelled at Razorpay, so the family is not charged again. Credits a refunded pack bought are taken back only from
 * what is still unspent, never below zero, and the shortfall is kept. A partial refund, the refund of an earlier month and
 * a dispute are recorded and change no access.
 */
async function processMoneyBackEvent({ eventId, eventType, event, paymentId }) {
  const refund = event?.payload?.refund?.entity || null;
  const dispute = event?.payload?.dispute?.entity || null;
  let payment = event?.payload?.payment?.entity || null;
  if (!payment || payment.id !== paymentId) payment = await getRazorpayClient().payments.fetch(paymentId);

  const record = await findRecordForPayment({ paymentId, payment });
  if (!record) {
    console.warn('[webhook] refund or dispute for a payment with no row of ours', { eventType, paymentId });
    return { ignored: true, note: 'no matching payment record' };
  }

  const isRefund = REFUND_EVENTS.has(eventType);
  const amountRefunded = Number(payment?.amount_refunded) || 0;
  const fullRefund = isRefund && (payment?.refund_status === 'full' ||
    (Number.isInteger(payment?.amount) && payment.amount > 0 && amountRefunded >= payment.amount));
  // A subscription row keeps only its latest charge: the refund covers the current access only when it is that charge,
  // and only when that charge granted something (cancelled: an earlier delivery of this refund already ended it).
  const coversCurrentAccess = record.paymentId === paymentId && (hasPaidPaymentEvidence(record) || record.status === 'cancelled');

  await Database.recordPaymentEvent({
    action: isRefund ? 'billing.refund_processed' : 'billing.dispute',
    targetType: 'payment',
    targetId: record.id,
    key: refund?.id ? `refund:${refund.id}` : dispute?.id ? `${eventType}:${dispute.id}` : `${eventType}:${eventId}`,
    metadata: {
      event: eventType,
      eventId,
      userId: record.userId,
      paymentId,
      orderId: record.orderId || null,
      subscriptionId: record.subscriptionId || null,
      planId: record.planId,
      refundId: refund?.id || null,
      disputeId: dispute?.id || null,
      amount: refund?.amount ?? dispute?.amount ?? null,
      paymentAmount: payment?.amount ?? null,
      amountRefunded,
      fullRefund,
      coversCurrentAccess,
      disputeStatus: dispute?.status || null,
      reasonCode: dispute?.reason_code || null,
    },
  });

  if (!isRefund) return { note: `dispute recorded (${dispute?.status || eventType})`, result: 'dispute_recorded' };
  if (!fullRefund) return { note: 'partial refund recorded; access unchanged', result: 'partial_refund_recorded' };
  if (!coversCurrentAccess) return { note: 'refund of an earlier payment recorded; current access unchanged', result: 'refund_recorded' };

  const creditPack = getAICreditPack(record.planId);
  if (creditPack) {
    const takeBack = await Database.takeBackRefundedCredits({
      userId: record.userId,
      credits: creditPack.credits,
      reference: record.orderId || paymentId,
      idempotencyKey: `razorpay_refund:${paymentId}`,
      metadata: { source: 'razorpay_refund', paymentId, orderId: record.orderId || null, refundId: refund?.id || null, packKey: creditPack.key || null },
    });
    if (!takeBack.ok && takeBack.error !== 'rpc_missing') throw new Error(`credit take-back failed: ${takeBack.error}`);
    if (record.orderId) await Database.updatePaymentByOrderId(record.orderId, { status: 'cancelled', amountPaid: 0 });
    if (!takeBack.ok) {
      // Migration 20261115120000 is not applied yet: the owner takes the credits back by hand (REFUND-RUNBOOK.md).
      await Database.recordPaymentEvent({
        action: 'billing.refund_credits_manual',
        targetType: 'user',
        targetId: record.userId,
        key: `credits_manual:${paymentId}`,
        metadata: { paymentId, orderId: record.orderId || null, credits: creditPack.credits, runbook: 'REFUND-RUNBOOK.md' },
      });
      return { note: 'refund recorded; credit take-back needs the manual step (migration 20261115120000 not applied)', result: 'credits_manual' };
    }
    return { note: `refund took back ${takeBack.clawedBack} credits, shortfall ${takeBack.shortfall}`, result: 'credits_taken_back' };
  }

  const plan = getPaymentPlan(record.planId);
  if (!isOneTimeAccessPlan(plan) && plan?.billingType !== 'subscription') {
    return { note: 'refund recorded; not a Pro or credit payment', result: 'refund_recorded' };
  }

  // The revocation every verify and webhook reads (Database.hasRefundPremiumRevocation), for this payment only: a later
  // renewal the family pays for still grants its month.
  await Database.recordPaymentEvent({
    action: REFUND_REVOKED_PREMIUM_ACTION,
    targetType: 'user',
    targetId: record.userId,
    key: `revoked:${paymentId}`,
    metadata: { paymentId, refundId: refund?.id || null, source: 'razorpay_refund_webhook' },
  });

  if (isOneTimeAccessPlan(plan)) {
    await keepRefundRevokedOrder({ orderId: record.orderId, payment, paymentRecord: record });
    return { note: 'full refund: one-time access ended', result: 'access_ended' };
  }

  await keepRefundRevoked({ subscriptionId: record.subscriptionId, payment, subscription: null, paymentRecord: record });
  const subscriptions = getRazorpayClient().subscriptions;
  const current = await subscriptions.fetch(record.subscriptionId);
  if (!['cancelled', 'completed', 'expired'].includes(current?.status)) {
    await cancelMonthlyRenewal(subscriptions, record.subscriptionId, { atCycleEnd: false });
  }
  return { note: 'full refund: this month ended and the subscription cancelled', result: 'access_ended' };
}

async function findRecordForPayment({ paymentId, payment }) {
  const byPayment = await Database.getPaymentByPaymentId(paymentId);
  if (byPayment) return byPayment;
  // An earlier charge of a subscription: its row now holds a later payment id, so go through the invoice.
  if (payment?.invoice_id) {
    const invoice = await getRazorpayClient().invoices.fetch(payment.invoice_id);
    if (invoice?.subscription_id) {
      const bySubscription = await Database.getPaymentBySubscriptionId(invoice.subscription_id);
      if (bySubscription) return bySubscription;
    }
  }
  return payment?.order_id ? Database.getPaymentByOrderId(payment.order_id) : null;
}

async function processCreditPackWebhook({ eventType, payment, orderId, paymentRecord, creditPack }) {
  // M4: a refunded pack (marked cancelled by processMoneyBackEvent) is never marked paid again by a late event.
  if (paymentRecord?.status === 'cancelled') return;
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
