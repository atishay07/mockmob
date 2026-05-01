import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { getRazorpayClient, getRazorpayKeyId } from '@/lib/payments/razorpay';
import { getAICreditPack } from '@/services/credits/aiCreditWallet';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const pack = getAICreditPack(body?.packKey);
    if (!pack || pack.status !== 'live') {
      return NextResponse.json({ error: 'Invalid PrepOS credit pack' }, { status: 400 });
    }

    const user = await Database.getUserById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const order = await getRazorpayClient().orders.create({
      amount: pack.amountPaise,
      currency: 'INR',
      receipt: `prepos_${session.user.id}_${Date.now()}`.slice(0, 40),
      notes: {
        kind: 'ai_credit_topup',
        userId: session.user.id,
        packKey: pack.key,
        credits: String(pack.credits),
      },
    });

    await Database.createPayment({
      userId: session.user.id,
      orderId: order.id,
      planId: pack.planId,
      amount: pack.amountPaise,
      currency: 'INR',
      status: order.status || 'created',
      rawOrder: order,
    });

    return NextResponse.json({
      ok: true,
      keyId: getRazorpayKeyId(),
      order,
      pack,
    });
  } catch (error) {
    console.error('[ai-credits/order] failed:', error);
    return NextResponse.json({ error: 'Failed to create PrepOS credit order' }, { status: 500 });
  }
}
