import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRazorpayClient } from '@/lib/payments/razorpay';
import { getPaymentPlan } from '@/lib/payments/plans';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { Database } from '@/../data/db';
import { cancelMonthlyRenewal } from '@/lib/payments/cancel';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    const subscriptionId = user?.razorpaySubscriptionId;
    if (!subscriptionId) {
      return NextResponse.json({ error: 'There is no monthly subscription on this account to cancel.', code: 'no_subscription' }, { status: 404 });
    }

    const record = await Database.getPaymentBySubscriptionId(subscriptionId);
    const plan = record ? getPaymentPlan(record.planId) : null;
    if (!record || record.userId !== session.user.id || plan?.billingType !== 'subscription') {
      return NextResponse.json({ error: 'That subscription could not be matched to your account.', code: 'not_matched' }, { status: 404 });
    }

    try {
      await cancelMonthlyRenewal(getRazorpayClient().subscriptions, subscriptionId);
    } catch (rzpError) {
      const description = rzpError?.error?.description || rzpError?.message || '';
      console.error('[billing/cancel] Razorpay rejected:', description);
      return NextResponse.json({ error: 'Cancellation could not be confirmed. Try again or write to support.', code: 'razorpay_rejected' }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      message: user.premiumUntil
        ? `Renewals are cancelled. Pro stays active until ${new Date(user.premiumUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`
        : 'Renewals are cancelled.',
      premiumUntil: user.premiumUntil || null,
    });
  } catch (error) {
    console.error('[billing/cancel] failed:', error);
    return NextResponse.json({ error: 'Cancellation failed. Nothing was changed.' }, { status: 500 });
  }
}
