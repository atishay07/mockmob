import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { getRazorpayClient, verifyRazorpayPaymentSignature } from '@/lib/payments/razorpay';
import { getAICreditPack, grantPurchasedAICredits } from '@/services/credits/aiCreditWallet';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = body || {};

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json({ error: 'Missing payment verification fields' }, { status: 400 });
    }

    const paymentRecord = await Database.getPaymentByOrderId(orderId);
    if (!paymentRecord || paymentRecord.userId !== session.user.id) {
      return NextResponse.json({ error: 'Credit order not found' }, { status: 404 });
    }

    const pack = getAICreditPack(paymentRecord.planId);
    if (!pack) {
      return NextResponse.json({ error: 'Payment is not a PrepOS credit pack' }, { status: 400 });
    }

    const isSignatureValid = verifyRazorpayPaymentSignature({ orderId, paymentId, signature });
    if (!isSignatureValid) {
      await Database.updatePaymentByOrderId(orderId, {
        paymentId,
        status: 'failed',
      });
      return NextResponse.json({ error: 'Invalid Razorpay signature' }, { status: 400 });
    }

    const razorpayPayment = await getRazorpayClient().payments.fetch(paymentId);
    const amountMatches = razorpayPayment.order_id === orderId &&
      razorpayPayment.amount === pack.amountPaise &&
      razorpayPayment.currency === 'INR' &&
      razorpayPayment.status === 'captured';

    if (!amountMatches) {
      await Database.updatePaymentByOrderId(orderId, {
        paymentId,
        status: 'failed',
        amountPaid: typeof razorpayPayment.amount === 'number' ? razorpayPayment.amount : null,
        rawPayment: razorpayPayment,
      });
      return NextResponse.json({ error: 'Payment details do not match credit pack' }, { status: 400 });
    }

    const grant = await grantPurchasedAICredits({
      userId: session.user.id,
      credits: pack.credits,
      packKey: pack.key,
      paymentId,
      orderId,
      idempotencyKey: `ai_topup:${orderId}:${paymentId}`,
      metadata: {
        amountPaise: pack.amountPaise,
        amountInr: pack.amountInr,
        source: 'frontend_verify',
      },
    });

    if (!grant.ok) {
      return NextResponse.json({ error: grant.error || 'Failed to grant PrepOS credits' }, { status: grant.status || 500 });
    }

    await Database.updatePaymentByOrderId(orderId, {
      paymentId,
      status: 'captured',
      amountPaid: razorpayPayment.amount,
      rawPayment: razorpayPayment,
    });

    return NextResponse.json({
      ok: true,
      pack,
      granted: grant.granted,
      balance: grant.balance,
      idempotent: grant.idempotent,
    });
  } catch (error) {
    console.error('[ai-credits/verify] failed:', error);
    return NextResponse.json({ error: 'Failed to verify PrepOS credit purchase' }, { status: 500 });
  }
}
