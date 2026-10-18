import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { getRazorpayKeyId } from '@/lib/payments/razorpay';
import { createPackOrder } from '@/lib/server/walletCheckout';
import { walletDeps } from '@/lib/server/walletDeps';
import { getAICreditPack } from '@/services/credits/aiCreditWallet';
import { CAPABILITIES } from '@/../data/capabilities';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Cookie-only on purpose: the app does not sell in v1, so this payment route takes no bearer token.
export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (CAPABILITIES.aiTopUps.state !== 'available') return NextResponse.json({error:'PREPOS_TOPUPS_PAUSED',message:CAPABILITIES.aiTopUps.reason},{status:503});

    const body = await request.json().catch(() => ({}));
    const pack = getAICreditPack(body?.packKey);
    if (!pack || pack.status !== 'live') {
      return NextResponse.json({ error: 'Invalid PrepOS credit pack' }, { status: 400 });
    }

    const user = await Database.getUserById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // The same order step the wallet's own route uses (src/lib/server/walletCheckout.js).
    const { order } = await createPackOrder({ userId: session.user.id, pack, deps: walletDeps() });

    return NextResponse.json({
      ok: true,
      keyId: getRazorpayKeyId(),
      order,
      pack,
    });
  } catch (error) {
    console.error('[ai-credits/order] failed:', error);
    return NextResponse.json({ error: 'Failed to create the credit order' }, { status: 500 });
  }
}
