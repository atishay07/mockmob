import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPaymentPlan, isLiveMonthlyPlan } from '@/lib/payments/plans';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { Database } from '@/../data/db';
import { openMonthlyCheckout } from '@/lib/payments/monthlyCheckout';
import { countStepOnce } from '@/lib/server/funnelOnceStore';
import { PARENT_LINK_LIMIT, PARENT_PAY_PLAN_ID, hostedLinkOf, linkExpiresAt, parentPayEnabled } from '@/lib/payments/parentPay';
import { shownFirstName } from '@/lib/displayName.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = { 'Cache-Control': 'no-store' };
const reply = (body, status = 200) => NextResponse.json(body, { status, headers: noStore });

/**
 * "Ask a parent to pay" (lane F-B, 15 Nov 2026): the signed-in student's monthly Pro checkout, as Razorpay's own hosted link
 * (the subscription's short_url) to send to a parent, who pays on their own phone without signing in to anything of ours.
 *
 * - The checkout is the one Get Pro opens (src/lib/payments/monthlyCheckout.js): the same plan, the same server-set notes
 *   (userId, planId), our payment row for it, and M3's one open checkout per student. Pro is granted by the existing webhook
 *   (subscription.charged / payment.captured, matched by subscription id to that row), never by this route.
 * - Nothing in the request is read: not a plan, an amount, an account or a code. The plan is PARENT_PAY_PLAN_ID and the account
 *   is the session's.
 * - A link stops taking payments within the day its checkout is handed back for (Razorpay's expire_by), so a late payment can
 *   never land on a subscription the student has already replaced.
 */
export async function POST(request) {
  try {
    if (!parentPayEnabled()) return reply({ error: 'Asking a parent to pay is not open right now. Nothing was charged.', code: 'parent_pay_off' }, 404);

    const session = await auth();
    if (!session?.user?.id) return reply({ error: 'Sign in to make a link for your account.', code: 'signed_out' }, 401);
    const userId = session.user.id;

    if (!(await checkPersistentRateLimit(request, { ...PARENT_LINK_LIMIT, keyParts: [userId] })).allowed) {
      return reply({ error: 'Too many links asked for. Wait a few minutes and try again. Nothing was charged.', code: 'rate_limited' }, 429);
    }

    const plan = getPaymentPlan(PARENT_PAY_PLAN_ID);
    if (!isLiveMonthlyPlan(plan)) {
      return reply({ error: 'Monthly Pro is not on sale right now, so there is no link to send. Nothing was charged.', code: 'monthly_not_ready' }, 409);
    }

    const user = await Database.getUserById(userId);
    if (!user) return reply({ error: 'We could not find your account. Sign in again.', code: 'no_user' }, 404);

    const opened = await openMonthlyCheckout({ user, plan, parentLink: true });
    if (!opened.ok) return reply({ error: opened.error, ...(opened.code ? { code: opened.code } : {}) }, opened.status);
    // Aggregate funnel: a checkout was opened for this student (once per person; no-op while FUNNEL_ENABLED is off).
    if (!opened.reused) countStepOnce(userId, 'checkout_opened', request.headers);

    const url = hostedLinkOf(opened.subscription);
    if (!url) {
      console.error('[parent-link] Razorpay gave no hosted link', { subscriptionId: opened.subscriptionId });
      return reply({ error: 'Razorpay did not give us a link this time. Try again in a minute. Nothing was charged.', code: 'link_missing' }, 502);
    }

    return reply({
      url,
      expiresAt: linkExpiresAt(opened.subscription),
      amount: plan.amount,
      currency: plan.currency,
      interval: 'month',
      // Only a name the student gave (never the email's local part or a handle), for the message to the parent.
      firstName: shownFirstName(user.name, user.email),
      reused: opened.reused,
    });
  } catch (error) {
    console.error('[parent-link] failed:', error);
    return reply({ error: 'We could not make the link. Try again in a minute. Nothing was charged.', code: 'failed' }, 500);
  }
}
