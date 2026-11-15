import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRazorpayClient } from '@/lib/payments/razorpay';
import { getPaymentPlan } from '@/lib/payments/plans';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { Database } from '@/../data/db';
import { cancelMonthlyRenewal } from '@/lib/payments/cancel';
import { isFutureIso } from '@/lib/payments/entitlements';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Razorpay states in which a subscription can still take a payment (the same set create-monthly-subscription treats as open).
const MAY_CHARGE = new Set(['active', 'pending', 'authenticated']);

/**
 * M3: this student's other Razorpay subscriptions that may still charge. Our rows say which subscriptions exist; Razorpay
 * says which are live. One Razorpay cannot be asked about counts as unknown, so the student is told rather than reassured.
 */
async function otherRenewingSubscriptions({ userId, exceptId }) {
  const rows = await Database.listSubscriptionPayments({ userId });
  const ids = [...new Set(rows
    .filter((row) => row.subscriptionId && row.subscriptionId !== exceptId && row.userId === userId &&
      getPaymentPlan(row.planId)?.billingType === 'subscription' && !['cancelled', 'completed'].includes(row.status))
    .map((row) => row.subscriptionId))];
  const live = [];
  let unknown = 0;
  for (const id of ids) {
    try {
      const subscription = await getRazorpayClient().subscriptions.fetch(id);
      if (MAY_CHARGE.has(subscription?.status)) live.push(id);
    } catch (error) {
      // An id Razorpay does not know (400 or 404: a stale or test-mode row) can never charge, so it is not "unknown":
      // counting it would answer 502 on every cancel for ever (review, 15 Nov 2026).
      const status = Number(error?.statusCode ?? error?.status ?? error?.error?.statusCode);
      if (status !== 400 && status !== 404) unknown += 1;
    }
  }
  return { ids: live, unknown };
}

// Cookie-only on purpose: the app does not sell in v1, so this payment route takes no bearer token.
// Stops future renewals at the end of the paid month. Access already paid for is kept; the
// webhook (subscription.cancelled) records the final state. One-time access has nothing to cancel.
export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (!(await checkPersistentRateLimit(request, { route: '/api/billing/cancel', limit: 5, keyParts: [session.user.id] })).allowed) {
      return NextResponse.json({ error: 'Too many attempts. Try again in a minute.' }, { status: 429 });
    }

    const user = await Database.getUserById(session.user.id);
    const subscriptionId = user?.razorpaySubscriptionId || null;

    if (subscriptionId) {
      const record = await Database.getPaymentBySubscriptionId(subscriptionId);
      const plan = record ? getPaymentPlan(record.planId) : null;
      if (!record || record.userId !== session.user.id || plan?.billingType !== 'subscription') {
        return NextResponse.json({ error: 'That subscription could not be matched to your account.', code: 'not_matched' }, { status: 404 });
      }
    }

    // M3 (audit 15 Nov 2026): two open checkouts could both be paid, and cancel used to stop only the account's current
    // subscription. Every other subscription of this student that Razorpay may still charge is stopped too.
    const others = user ? await otherRenewingSubscriptions({ userId: user.id, exceptId: subscriptionId }) : { ids: [], unknown: 0 };
    if (!subscriptionId && !others.ids.length && !others.unknown) {
      return NextResponse.json({ error: 'There is no monthly subscription on this account to cancel.', code: 'no_subscription' }, { status: 404 });
    }

    const untilText = user.premiumUntil
      ? new Date(user.premiumUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
      : null;
    const stillPaid = isFutureIso(user.premiumUntil);

    // Asking twice is fine: renewals are already off, so there is nothing to send to Razorpay.
    const cancelCurrent = Boolean(subscriptionId) && user.subscriptionStatus !== 'cancelled';
    if (!cancelCurrent && !others.ids.length && !others.unknown) {
      return NextResponse.json({
        ok: true,
        alreadyCancelled: true,
        message: untilText && stillPaid ? `Renewals are already cancelled. Pro stays active until ${untilText}.` : 'Renewals are already cancelled.',
        premiumUntil: user.premiumUntil || null,
      });
    }

    let currentStopped = false;
    if (cancelCurrent) {
      try {
        await cancelMonthlyRenewal(getRazorpayClient().subscriptions, subscriptionId);
        currentStopped = true;
      } catch (rzpError) {
        const description = rzpError?.error?.description || rzpError?.message || '';
        console.error('[billing/cancel] Razorpay rejected:', description);
        return NextResponse.json({ error: 'Cancellation could not be confirmed. Try again or write to support.', code: 'razorpay_rejected' }, { status: 502 });
      }
      // Razorpay ends the subscription at the close of the paid month and sends subscription.cancelled
      // then. Until then, mark the account so Account says renewals are off while Pro stays on.
      await Database.updateUser(user.id, { subscriptionStatus: 'cancelled' });
    }

    let othersStopped = 0;
    let othersFailed = others.unknown;
    for (const id of others.ids) {
      try {
        await cancelMonthlyRenewal(getRazorpayClient().subscriptions, id);
        othersStopped += 1;
      } catch (rzpError) {
        othersFailed += 1;
        console.error('[billing/cancel] Razorpay rejected a second subscription:', rzpError?.error?.description || rzpError?.message || '');
      }
    }

    const stopped = (currentStopped ? 1 : 0) + othersStopped;
    if (othersFailed) {
      return NextResponse.json({
        error: stopped
          ? `Renewals are cancelled for ${stopped} of your monthly plans, but ${othersFailed === 1 ? 'one more' : `${othersFailed} more`} could not be confirmed. Try again or write to support.`
          : 'Cancellation could not be confirmed. Try again or write to support.',
        code: 'razorpay_rejected',
        stopped,
      }, { status: 502 });
    }

    const lead = stopped > 1 ? `Renewals are cancelled for ${stopped} monthly plans.` : 'Renewals are cancelled.';
    return NextResponse.json({
      ok: true,
      stopped,
      message: untilText && stillPaid ? `${lead} Pro stays active until ${untilText}.` : lead,
      premiumUntil: user.premiumUntil || null,
    });
  } catch (error) {
    console.error('[billing/cancel] failed:', error);
    return NextResponse.json({ error: 'Cancellation failed. Nothing was changed.' }, { status: 500 });
  }
}
