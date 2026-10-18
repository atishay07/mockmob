import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createWalletOrder } from '@/lib/server/walletCheckout';
import { walletDeps } from '@/lib/server/walletDeps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/wallet/order { packId }: the one order route for every reload pack, Practice and AI. The pack id is checked on the
// server and the price comes from src/lib/wallet/walletPacks.mjs, never from the request. While WALLET_COMMERCE_OPEN is not
// "true" it answers 503 WALLET_COMMERCE_CLOSED and creates nothing. Cookie-only on purpose: the app does not sell credits in v1.
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const { status, body: out } = await createWalletOrder({ userId: session.user.id, packId: body?.packId, deps: walletDeps(), env: process.env });
    return NextResponse.json(out, { status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[wallet/order] failed:', error);
    return NextResponse.json({ error: 'Failed to create the credit order' }, { status: 500 });
  }
}
