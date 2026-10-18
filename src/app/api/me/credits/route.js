import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { isPaidUser } from '@/services/credits/aiCreditWallet';
import { getUnifiedWallet } from '@/services/credits/unifiedWallet';
import { CREDITS_COPY, aiPoolBalance, creditsBody, loadHistory, parseCursor } from '@/lib/server/credits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'no-store' };

// The one credits balance (total) and its two stored parts, the plan and the history, in the fixed contract shared with the app
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
    // One credits balance (18 Oct 2026, D78): one read gives the wallet row and users.credit_balance together, so the two
    // parts and the one total always agree. Each history line states the one balance after it (this IST month).
    const unified = await getUnifiedWallet(user);
    const wallet = unified.wallet;
    const practiceBalance = wallet?.known && wallet.oneBalance !== false ? Math.trunc(Number(wallet.balanceCredits) || 0)
      : Number.isFinite(Number(user.creditBalance)) ? Math.trunc(Number(user.creditBalance)) : null;
    const { history, next } = await loadHistory({
      userId: user.id,
      practiceBalance,
      aiBalance: aiPoolBalance(wallet),
      total: unified.known ? unified.total : null,
      periodStart: wallet?.known ? wallet.periodStart : null,
      cursor,
    });
    return NextResponse.json(creditsBody({
      practiceBalance, wallet, paid: isPaidUser(user), premiumUntil: user.premiumUntil, history, next, unified,
    }), { headers: NO_STORE });
  } catch (e) {
    console.warn('[api/me/credits] GET failed:', e?.code || e?.message);
    return NextResponse.json({ error: 'unavailable', message: CREDITS_COPY.unavailable }, { status: 503, headers: NO_STORE });
  }
}
