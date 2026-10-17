// What a creator may see about a sale attributed to their code (security hotfix, 17 Oct 2026).
//
// GET /api/creator/me and the /creator page used to hand the creator every attributed
// payments row in full: the Razorpay payment object (buyer email, phone, VPA), the raw order
// and subscription, and the buyer's user id. A creator needs only when the sale happened, the
// plan, the amount, whether it was paid, what they earned and whether that was paid out.
// Nothing here identifies the buyer: `ref` is a short one-way hash of the payments row id,
// stable for a row (React keys, support questions) and useless for finding the person.
import { createHash } from 'node:crypto';

// Only these payments columns are read for a creator. No raw_* JSON, no user_id, no
// Razorpay order, subscription or payment ids.
export const CREATOR_SALE_COLUMNS =
  'id, plan_id, amount, amount_paid, currency, status, payment_id, creator_earning, payout_id, created_at';

const PAID_STATUSES = new Set(['captured', 'completed', 'paid']);

export function saleRef(rowId) {
  if (rowId == null || rowId === '') return null;
  return createHash('sha256').update(`mockmob-creator-sale:${rowId}`).digest('hex').slice(0, 12);
}

const toNumberOrNull = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function creatorSaleOut(row) {
  if (!row) return null;
  const amountPaid = toNumberOrNull(row.amount_paid);
  return {
    ref: saleRef(row.id),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
    planId: row.plan_id || null,
    amount: toNumberOrNull(row.amount),
    amountPaid,
    currency: row.currency || 'INR',
    status: row.status || null,
    paid: Boolean(row.payment_id) && PAID_STATUSES.has(row.status) && (amountPaid ?? 0) > 0,
    creatorEarning: toNumberOrNull(row.creator_earning),
    payoutStatus: row.payout_id ? 'paid' : 'pending',
  };
}
