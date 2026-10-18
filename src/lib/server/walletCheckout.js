// The wallet's two payment steps as plain functions with their dependencies passed in, so a test runs them with no network and
// no database (data/tests/wallet_1018.test.mjs). The routes (api/wallet/order, api/wallet/verify, api/ai/credits/order and the
// webhook) wire in Razorpay, the payments table and the two grant paths.
//
//   createPackOrder: one Razorpay order for a pack the server already validated. Both the AI order route and the wallet order
//     route end here, so an order is made one way.
//   createWalletOrder: the wallet route's own steps: flag, then the pack (by id, price from the server catalog, never from the
//     client), then createPackOrder. Closed flag = no order, no payment row, no Razorpay call.
//   verifyWalletPayment: signature, then Razorpay's own record of the payment (amount, currency, captured), then one grant,
//     idempotent on the payment id. Not gated by the flag: a payment already taken is always settled.
import { getCreditPack, getCreditPackByPlanId } from '../../services/credits/creditPacks.mjs';
import { walletCommerceOpen, WALLET_COMMERCE_CLOSED_MESSAGE } from '../wallet/walletPacks.mjs';

/** One Razorpay order and its payment row for a validated pack. Returns { order, pack }. */
export async function createPackOrder({ userId, pack, deps }) {
  const order = await deps.createRazorpayOrder({
    amount: pack.amountPaise,
    currency: 'INR',
    receipt: `credits_${userId}_${(deps.now || Date.now)()}`.slice(0, 40),
    notes: { kind: 'credit_topup', userId, packKey: pack.key, packId: pack.packId, credits: String(pack.credits) },
  });
  await deps.createPayment({
    userId,
    orderId: order.id,
    planId: pack.planId,
    amount: pack.amountPaise,
    currency: 'INR',
    status: order.status || 'created',
    rawOrder: order,
  });
  return { order, pack };
}

/** POST /api/wallet/order. Returns { status, body }. */
export async function createWalletOrder({ userId, packId, deps, env }) {
  if (!userId) return { status: 401, body: { error: 'Authentication required' } };
  // Closed: nothing is created. The packs still show their prices; the button says "Top-ups open soon".
  if (!walletCommerceOpen(env)) {
    return { status: 503, body: { error: 'WALLET_COMMERCE_CLOSED', message: WALLET_COMMERCE_CLOSED_MESSAGE } };
  }
  const pack = getCreditPack(packId);
  if (!pack) return { status: 400, body: { error: 'Invalid credit pack' } };
  if (!(await deps.userExists(userId))) return { status: 404, body: { error: 'User not found' } };
  const { order } = await createPackOrder({ userId, pack, deps });
  return {
    status: 200,
    body: {
      ok: true,
      keyId: deps.keyId(),
      order,
      pack: { packId: pack.packId, label: pack.label, credits: pack.credits, priceInr: pack.amountInr, pricePaise: pack.amountPaise },
    },
  };
}

const sameCapturedPayment = (record, paymentId, amountPaise) => record?.status === 'captured'
  && record.paymentId === paymentId
  && Number(record.amountPaid) === Number(amountPaise);

/** POST /api/wallet/verify. Returns { status, body }. */
export async function verifyWalletPayment({ userId, input, deps }) {
  if (!userId) return { status: 401, body: { error: 'Authentication required' } };
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = input || {};
  if (!orderId || !paymentId || !signature) return { status: 400, body: { error: 'Missing payment verification fields' } };

  const record = await deps.getPaymentByOrderId(orderId);
  if (!record || record.userId !== userId) return { status: 404, body: { error: 'Credit order not found' } };
  const pack = getCreditPackByPlanId(record.planId);
  if (!pack) return { status: 400, body: { error: 'Payment is not a credit pack' } };

  if (!deps.verifySignature({ orderId, paymentId, signature })) {
    await deps.updatePaymentByOrderId(orderId, { paymentId, status: 'failed' });
    return { status: 400, body: { error: 'Invalid Razorpay signature' } };
  }

  const payment = await deps.fetchPayment(paymentId);
  const matches = payment?.order_id === orderId && payment.amount === pack.amountPaise && payment.currency === 'INR' && payment.status === 'captured';
  if (!matches) {
    await deps.updatePaymentByOrderId(orderId, {
      paymentId, status: 'failed', amountPaid: typeof payment?.amount === 'number' ? payment.amount : null, rawPayment: payment,
    });
    return { status: 400, body: { error: 'Payment details do not match credit pack' } };
  }

  if (sameCapturedPayment(record, paymentId, pack.amountPaise)) {
    return { status: 200, body: { ok: true, pack: pack.packId, granted: 0, balance: null, idempotent: true, alreadyCaptured: true } };
  }

  const grant = await deps.grant({ pack, userId, paymentId, orderId });
  if (!grant.ok) return { status: grant.status || 500, body: { error: grant.error || 'Failed to grant credits' } };

  await deps.updatePaymentByOrderId(orderId, { paymentId, status: 'captured', amountPaid: payment.amount, rawPayment: payment });
  return { status: 200, body: { ok: true, pack: pack.packId, granted: grant.granted, balance: grant.balance, idempotent: Boolean(grant.idempotent) } };
}
