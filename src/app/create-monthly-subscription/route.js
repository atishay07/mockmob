import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRazorpayKeyId } from '@/lib/payments/razorpay';
import { getPaymentPlan, isLiveMonthlyPlan } from '@/lib/payments/plans';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { Database } from '@/../data/db';
import { openMonthlyCheckout } from '@/lib/payments/monthlyCheckout';
import { countStepOnce } from '@/lib/server/funnelOnceStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Creates a Razorpay subscription for the monthly plan. It sells nothing unless the Razorpay
// plan ID is configured, and it never touches the one-time access orders.
// The checkout itself (already Pro, an open plan, M3's handed-back checkout, the referral, the subscription and its row) is
// src/lib/payments/monthlyCheckout.js, shared with "Ask a parent to pay" (/api/billing/parent-link).
export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (!(await checkPersistentRateLimit(request, { route: '/create-monthly-subscription', limit: 10, keyParts: [session.user.id] })).allowed) {
      return NextResponse.json({ error: 'Too many attempts. Wait a minute and try again.' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const { userId, planId } = body || {};
    const rawCode = typeof body?.code === 'string' ? body.code : null;
    if (!userId || !planId) return NextResponse.json({ error: 'userId and planId are required' }, { status: 400 });
    if (userId !== session.user.id) return NextResponse.json({ error: 'Cannot create a subscription for another user' }, { status: 403 });

    const plan = getPaymentPlan(planId);
    if (!plan || !isLiveMonthlyPlan(plan)) {
      return NextResponse.json({ error: 'Monthly billing is not open yet. Nothing was charged.', code: 'monthly_not_ready' }, { status: 409 });
    }
    if (Number.isFinite(Number(body?.amount)) && Number(body.amount) !== plan.amount) {
      return NextResponse.json({ error: 'Invalid amount for selected plan' }, { status: 400 });
    }

    const user = await Database.getUserById(userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const opened = await openMonthlyCheckout({ user, plan, rawCode });
    if (!opened.ok) {
      return NextResponse.json({ error: opened.error, ...(opened.code ? { code: opened.code } : {}) }, { status: opened.status });
    }
    // Aggregate funnel: this student opened checkout, once the subscription and its row exist (Database.createPayment in
    // monthlyCheckout.js). Once per person; no-op while FUNNEL_ENABLED is off.
    if (!opened.reused) countStepOnce(userId, 'checkout_opened', request.headers);

    return NextResponse.json({
      keyId: getRazorpayKeyId(),
      subscription: { id: opened.subscriptionId, status: opened.subscription.status },
      plan: { id: plan.id, name: plan.name, amount: plan.amount, currency: plan.currency, interval: 'month' },
      referral: opened.referral,
      ...(opened.reused ? { reused: true } : {}),
    });
  } catch (error) {
    console.error('[create-monthly-subscription] failed:', error);
    return NextResponse.json({ error: 'Failed to start monthly billing. Nothing was charged.' }, { status: 500 });
  }
}
