import 'server-only';
import { Database } from '@/../data/db';

const PAID_SALE_STATES = new Set(['captured', 'completed', 'paid']);

function isPaidSale(payment) {
  return Boolean(payment?.paymentId) &&
    PAID_SALE_STATES.has(payment?.status) &&
    Number(payment?.amountPaid) > 0;
}

/**
 * Record creator_earning on a payment row IFF:
 *   - the payment is now in a success state
 *   - the payment is attributed to a creator (DB-backed; static-only
 *     codes don't earn until the admin creates a `creators` row)
 *   - the creator is active
 *   - the payment hasn't already been bundled into a payout
 *
 * Always best-effort — never throws back into the caller's flow. Earnings
 * are inserted later by /api/admin/payouts/mark-paid if missed here.
 */
export async function recordEarningIfApplicable(paymentLookup) {
  if (!paymentLookup) return;

  try {
    const payment = typeof paymentLookup === 'object' && paymentLookup.orderId
      ? await Database.getPaymentByOrderId(paymentLookup.orderId)
      : await Database.getPaymentBySubscriptionId(
        typeof paymentLookup === 'object' ? paymentLookup.subscriptionId : paymentLookup
      );
    if (!payment) return;
    if (!isPaidSale(payment)) return;
    if (payment.payoutId) return;          // already paid out — never overwrite
    if (!payment.creatorId) return;        // attribution requires a DB creator

    const creator = await Database.getCreatorById(payment.creatorId);
    if (!creator || !creator.isActive) return;

    const earning = Math.max(0, Math.round(Number(creator.payoutPerSale) || 0));
    if (earning === 0) return;

    // setPaymentEarning's WHERE includes payout_id IS NULL, so this is
    // a no-op once the payment has been paid out.
    await Database.setPaymentEarning(payment.id, earning);
  } catch (e) {
    console.error('[payouts] failed to record earning', { paymentLookup, error: e?.message });
  }
}
