import 'server-only';
import { Database } from '@/../data/db';
import { getRazorpayClient, getRazorpayKeyId, verifyRazorpayPaymentSignature } from '@/lib/payments/razorpay';
import { grantPurchasedAICredits } from '@/services/credits/aiCreditWallet';
import { grantPurchasedPracticeCredits } from '@/services/credits/practiceCreditWallet';

// The real Razorpay, payments table and grant paths, in the shape src/lib/server/walletCheckout.js takes.
export function walletDeps() {
  return {
    createRazorpayOrder: (params) => getRazorpayClient().orders.create(params),
    createPayment: (row) => Database.createPayment(row),
    userExists: async (id) => Boolean(await Database.getUserById(id)),
    keyId: () => getRazorpayKeyId(),
    getPaymentByOrderId: (id) => Database.getPaymentByOrderId(id),
    updatePaymentByOrderId: (id, patch) => Database.updatePaymentByOrderId(id, patch),
    verifySignature: (input) => verifyRazorpayPaymentSignature(input),
    fetchPayment: (id) => getRazorpayClient().payments.fetch(id),
    grant: ({ pack, userId, paymentId, orderId }) => (pack.pool === 'practice'
      ? grantPurchasedPracticeCredits({ userId, credits: pack.credits, packId: pack.packId, paymentId })
      : grantPurchasedAICredits({
        userId, credits: pack.credits, packKey: pack.key, paymentId, orderId,
        idempotencyKey: `ai_topup:${orderId}:${paymentId}`,
        metadata: { amountPaise: pack.amountPaise, amountInr: pack.amountInr, source: 'frontend_verify' },
      })),
  };
}
