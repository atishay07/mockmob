import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { isPaidUser, readAIWallet } from '@/services/credits/aiCreditWallet';
import { CREDITS_COPY, creditsBody, loadHistory, parseCursor } from '@/lib/server/credits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'no-store' };

// Both credit pools, the plan and the history, in the fixed contract shared with the app
// (data/tests/fixtures/credits/contract_credits_v1.json). Read-only over the two existing ledgers.
// ?cursor= pages the history, 30 lines at a time, newest first.
export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized', message: 'Please sign in.' }, { status: 401, headers: NO_STORE });

  const cursor = parseCursor(new URL(request.url).searchParams.get('cursor'));
  if (cursor === undefined) return NextResponse.json({ error: 'invalid_request', message: CREDITS_COPY.badCursor }, { status: 422, headers: NO_STORE });

  try {
    const user = await Database.getUserById(session.user.id);
    if (!user) return NextResponse.json({ error: 'unavailable', message: CREDITS_COPY.unavailable }, { status: 503, headers: NO_STORE });
    const wallet = await readAIWallet(user);
    const practiceBalance = Number.isFinite(Number(user.creditBalance)) ? Math.trunc(Number(user.creditBalance)) : null;
    const { history, next } = await loadHistory({
      userId: user.id,
      practiceBalance,
      aiBalance: wallet?.known ? wallet.total : null,
      cursor,
    });
    return NextResponse.json(creditsBody({
      practiceBalance, wallet, paid: isPaidUser(user), premiumUntil: user.premiumUntil, history, next,
    }), { headers: NO_STORE });
  } catch (e) {
    console.warn('[api/me/credits] GET failed:', e?.code || e?.message);
    return NextResponse.json({ error: 'unavailable', message: CREDITS_COPY.unavailable }, { status: 503, headers: NO_STORE });
  }
}
