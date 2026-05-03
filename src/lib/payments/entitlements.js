const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_PAID_PERIOD_DAYS = 32;
const RAZORPAY_MIN_SECONDS = 946684800;
const RAZORPAY_MAX_SECONDS = 4765046400;

export const PAID_PAYMENT_RECORD_STATUSES = new Set(['captured', 'completed', 'paid']);
export const REFUND_REVOKED_PREMIUM_ACTION = 'billing.refund_revoked_premium';

function unixLikeToMs(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  if (numeric > 9999999999) {
    return numeric;
  }

  if (numeric < RAZORPAY_MIN_SECONDS || numeric > RAZORPAY_MAX_SECONDS) {
    return null;
  }

  return numeric * 1000;
}

function isoFromMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString();
}

function isoToMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function isFutureIso(value, nowMs = Date.now()) {
  const ms = isoToMs(value);
  return Number.isFinite(ms) && ms > nowMs;
}

export function hasPaidPaymentEvidence(paymentRecord) {
  return Boolean(paymentRecord?.paymentId || paymentRecord?.payment_id) &&
    Number(paymentRecord?.amountPaid ?? paymentRecord?.amount_paid) > 0 &&
    PAID_PAYMENT_RECORD_STATUSES.has(paymentRecord?.status);
}

function stringSetFromValues(...values) {
  const flattened = values.flatMap((value) => Array.isArray(value) ? value : [value]);
  return new Set(flattened
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map((value) => String(value)));
}

export function refundRevocationMatchesPayment(metadata, { subscriptionId = null, paymentId = null } = {}) {
  if (!metadata || typeof metadata !== 'object') return false;

  const requestedSubscriptionIds = stringSetFromValues(subscriptionId);
  const requestedPaymentIds = stringSetFromValues(paymentId);
  if (requestedSubscriptionIds.size === 0 && requestedPaymentIds.size === 0) return false;

  const refundedSubscriptionIds = stringSetFromValues(
    metadata.subscriptionId,
    metadata.subscriptionIds,
    metadata.razorpaySubscriptionId,
    metadata.razorpaySubscriptionIds,
  );
  const refundedPaymentIds = stringSetFromValues(
    metadata.paymentId,
    metadata.paymentIds,
    metadata.razorpayPaymentId,
    metadata.razorpayPaymentIds,
  );

  for (const id of requestedSubscriptionIds) {
    if (refundedSubscriptionIds.has(id)) return true;
  }
  for (const id of requestedPaymentIds) {
    if (refundedPaymentIds.has(id)) return true;
  }
  return false;
}

export function isPaidSaleRecord(paymentRecord) {
  return hasPaidPaymentEvidence(paymentRecord);
}

export function isCapturedRazorpayPayment(payment) {
  return payment?.status === 'captured' &&
    Number.isInteger(payment?.amount) &&
    payment.amount > 0 &&
    payment.currency === 'INR';
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function referralAttributionFromCheckout({
  paymentRecord = null,
  payment = null,
  subscription = null,
  invoice = null,
} = {}) {
  const rawPayment = paymentRecord?.rawPayment || paymentRecord?.raw_payment || {};
  const rawSubscription = paymentRecord?.rawSubscription || paymentRecord?.raw_subscription || {};
  const notes = {
    ...(rawSubscription?.notes || {}),
    ...(rawPayment?.notes || {}),
    ...(subscription?.notes || {}),
    ...(invoice?.notes || {}),
    ...(payment?.notes || {}),
  };

  const offerId = firstString(
    paymentRecord?.offerId,
    paymentRecord?.offer_id,
    rawSubscription?.offer_id,
    rawSubscription?.offerId,
    subscription?.offer_id,
    subscription?.offerId,
    invoice?.offer_id,
    invoice?.offerId,
    payment?.offer_id,
    payment?.offerId,
    notes.offerId,
    notes.offer_id,
  );
  const creatorCode = firstString(
    paymentRecord?.creatorCode,
    paymentRecord?.creator_code,
    notes.creatorCode,
    notes.creator_code,
  );
  const creatorId = firstString(
    paymentRecord?.creatorId,
    paymentRecord?.creator_id,
    notes.creatorId,
    notes.creator_id,
  );
  const referralCodeAttempted = firstString(
    paymentRecord?.referralCodeAttempted,
    paymentRecord?.referral_code_attempted,
    notes.referralCodeAttempted,
    notes.referral_code_attempted,
    creatorCode,
  );
  const referralStatus = firstString(
    paymentRecord?.referralStatus,
    paymentRecord?.referral_status,
    notes.referralStatus,
    notes.referral_status,
    offerId ? 'offer_attached' : null,
    creatorCode ? 'tracked_no_offer' : null,
  );

  return {
    creatorCode,
    creatorId,
    offerId,
    referralCodeAttempted,
    referralStatus,
  };
}

function hasDiscountEvidence(paymentRecord, context = {}) {
  const attribution = referralAttributionFromCheckout({
    paymentRecord,
    ...context,
  });
  return Boolean(
    attribution.offerId ||
    attribution.creatorCode ||
    attribution.referralStatus === 'offer_attached'
  );
}

export function amountMatchesPaymentRecord(payment, paymentRecord, context = {}) {
  if (!isCapturedRazorpayPayment(payment) || !paymentRecord?.amount) return false;

  const nominalAmount = Number(paymentRecord.amount);
  if (!Number.isInteger(nominalAmount) || nominalAmount <= 0) return false;

  if (hasDiscountEvidence(paymentRecord, { payment, ...context })) {
    return payment.amount > 0 && payment.amount <= nominalAmount;
  }

  return payment.amount === nominalAmount;
}

export function resolvePaidThrough({
  subscription = null,
  invoice = null,
  payment = null,
  existingPremiumUntil = null,
  nowMs = Date.now(),
} = {}) {
  const candidates = [
    unixLikeToMs(subscription?.current_end),
    unixLikeToMs(invoice?.billing_end),
    unixLikeToMs(invoice?.period_end),
    isoToMs(existingPremiumUntil),
  ].filter((ms) => Number.isFinite(ms));

  const paidAtMs =
    unixLikeToMs(invoice?.paid_at) ||
    unixLikeToMs(payment?.created_at) ||
    nowMs;

  candidates.push(paidAtMs + (DEFAULT_PAID_PERIOD_DAYS * MS_PER_DAY));

  return isoFromMs(Math.max(...candidates));
}

export function effectivePremiumFromRow(row, nowMs = Date.now()) {
  const statusIsActive = row?.subscription_status === 'active';
  const paidThroughActive = isFutureIso(row?.premium_until, nowMs);
  const legacyPremiumWithoutExpiry = Boolean(row?.is_premium) && !row?.premium_until;
  return statusIsActive || paidThroughActive || legacyPremiumWithoutExpiry;
}
