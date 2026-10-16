import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// RETIRED 16 Oct 2026 (security review item 7). This route used to be a second payment-granting path: a caller
// holding BILLING_WEBHOOK_SECRET (header x-mockmob-signature) could set subscription_status and is_premium on any
// user, by id or email, with no premium_until date and no Razorpay evidence. Nothing calls it:
//   - the real Razorpay webhook is /webhook (src/app/webhook/route.js, HMAC signature, amount and order checks);
//   - BILLING_WEBHOOK_SECRET appears only in this file's history and in docs/brain/RUNBOOK-MONTHLY-BILLING-2026-10-16.md,
//     which says to leave it unset (so the old route already answered 503 in production);
//   - no client, cron or script in the repository posts here.
// It now answers 410 Gone to every call and touches nothing. The old behaviour is in git history (this file before the
// commit "Retire the legacy billing webhook"); it is described in docs/brain/RUNBOOK-MONTHLY-BILLING-2026-10-16.md.
// To bring a generic webhook back, add a new route that records provider evidence and a paid-through date, never a
// bare is_premium flip.
export async function POST() {
  console.warn('[api/billing/webhook] 410: the legacy generic billing webhook is retired; a call reached it and was refused');
  return NextResponse.json({ error: 'This webhook is retired. Payments are confirmed at /webhook.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}
