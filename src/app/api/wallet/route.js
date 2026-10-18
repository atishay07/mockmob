import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { isPaidUser } from '@/services/credits/aiCreditWallet';
import { getUnifiedWallet } from '@/services/credits/unifiedWallet';
import { loadHistory } from '@/lib/server/credits';
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
    const practiceBalance = Number.isFinite(Number(user.creditBalance)) ? Math.trunc(Number(user.creditBalance)) : null;
    let history = null;
    try {
      history = (await loadHistory({ userId: user.id, practiceBalance, aiBalance: unified.parts.included === null || unified.parts.bonus === null ? null : unified.parts.included + unified.parts.bonus, pageSize: WALLET_HISTORY_SIZE })).history;
    } catch (e) {
      console.warn('[api/wallet] history read failed:', e?.code || e?.message);
    }
    return NextResponse.json(walletBody({ unified, paid: isPaidUser(user), premiumUntil: user.premiumUntil, history, env: process.env }), { headers: NO_STORE });
  } catch (e) {
    console.warn('[api/wallet] GET failed:', e?.code || e?.message);
    return NextResponse.json({ error: 'unavailable', message: 'Your wallet could not be loaded. Try again shortly.' }, { status: 503, headers: NO_STORE });
  }
}
