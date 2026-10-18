import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { isPaidUser } from '@/services/credits/aiCreditWallet';
import { getUnifiedWallet } from '@/services/credits/unifiedWallet';
import { aiPoolBalance, loadHistory } from '@/lib/server/credits';
import { walletBody, WALLET_HISTORY_SIZE } from '@/lib/server/wallet';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'no-store' };

// GET /api/wallet: ONE credits balance (free credits left this month plus held credits), the reload packs (with commerce open or closed) and the last 20 history lines, for the Wallet
// page and the Android app (cookie or bearer, as /api/me/credits). Read-only: nothing here writes, spends, grants or orders.
// A history that cannot be read does not hide the balances: history is null and historyState is "unavailable".
export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized', message: 'Please sign in.' }, { status: 401, headers: NO_STORE });
  try {
    const user = await Database.getUserById(session.user.id);
    if (!user) return NextResponse.json({ error: 'unavailable', message: 'Your wallet could not be loaded. Try again shortly.' }, { status: 503, headers: NO_STORE });
    const unified = await getUnifiedWallet(user);
    const wallet = unified.wallet;
    // The same history read as GET /api/me/credits (the credits core): with the one total known, every line states the one balance
    // after it, and a line older than this month's free-credit reset states none (never a guessed number).
    const practiceBalance = wallet?.known && wallet.oneBalance !== false ? Math.trunc(Number(wallet.balanceCredits) || 0)
      : Number.isFinite(Number(user.creditBalance)) ? Math.trunc(Number(user.creditBalance)) : null;
    let history = null;
    try {
      history = (await loadHistory({
        userId: user.id,
        practiceBalance,
        aiBalance: aiPoolBalance(wallet),
        total: unified.known ? unified.total : null,
        periodStart: wallet?.known ? wallet.periodStart : null,
        pageSize: WALLET_HISTORY_SIZE,
      })).history;
    } catch (e) {
      console.warn('[api/wallet] history read failed:', e?.code || e?.message);
    }
    return NextResponse.json(walletBody({ unified, paid: isPaidUser(user), premiumUntil: user.premiumUntil, history, historyCounted: true, env: process.env }), { headers: NO_STORE });
  } catch (e) {
    console.warn('[api/wallet] GET failed:', e?.code || e?.message);
    return NextResponse.json({ error: 'unavailable', message: 'Your wallet could not be loaded. Try again shortly.' }, { status: 503, headers: NO_STORE });
  }
}
