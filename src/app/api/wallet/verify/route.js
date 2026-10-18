import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { verifyWalletPayment } from '@/lib/server/walletCheckout';
import { walletDeps } from '@/lib/server/walletDeps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/wallet/verify { razorpay_order_id, razorpay_payment_id, razorpay_signature }: checks the signature and Razorpay's own
// record of the payment, then grants the pack once (idempotent on the payment id; the webhook uses the same key). Not gated by
// WALLET_COMMERCE_OPEN: a payment already taken is always settled. Cookie-only on purpose.
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const input = await request.json().catch(() => ({}));
  try {
    const { status, body } = await verifyWalletPayment({ userId: session.user.id, input, deps: walletDeps() });
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[wallet/verify] failed:', error);
    return NextResponse.json({ error: 'Failed to verify the credit purchase' }, { status: 500 });
  }
}
