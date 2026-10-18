import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import {
  AI_CREDIT_PACKS,
  AI_FREE_BUDGET_INR_CAP,
  AI_FREE_MONTHLY_CREDITS,
  AI_PRO_INCLUDED_MONTHLY_CREDITS,
  isPaidUser,
  aiCommerceOpen,
  readAIWallet,
} from '@/services/credits/aiCreditWallet';
import { CREDIT_COSTS } from '@/services/usage/getDailyUsage';
import { unifiedFromWallet } from '@/services/credits/aiWalletState';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// One coherent, read-only wallet view. Reads the wallet exactly once and never writes.
export async function GET(request) {
  const headers = { 'Cache-Control': 'no-store' };
  const session = await auth(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers });
  }

  const dbUser = await Database.getUserById(session.user.id).catch(() => null);
  if (!dbUser) {
    return NextResponse.json({ error: 'user_unavailable' }, { status: 503, headers });
  }

  const wallet = await readAIWallet(dbUser);
  // One credits balance (18 Oct 2026): wallet.total is the one total (free this month + bonus + users.credit_balance).
  const credits = unifiedFromWallet(wallet, wallet.known ? wallet.balanceCredits : null);
  const paid = isPaidUser(dbUser);
  const checkoutOpen = aiCommerceOpen();

  return NextResponse.json({
    ok: true,
    userId: dbUser.id,
    state: wallet.state,
    message: wallet.message,
    wallet,
    credits,
    isPaid: paid,
    tier: paid ? 'paid' : 'free',
    creditCosts: CREDIT_COSTS,
    // Kept for older readers: users.credit_balance, now one part of the one credits balance (credits.parts.balance).
    practiceCredits: { balance: dbUser.creditBalance || 0, label: 'Credits held (part of your one balance)' },
    normalCreditBalance: dbUser.creditBalance || 0,
    budget: {
      freeMonthlyCredits: AI_FREE_MONTHLY_CREDITS,
      proMonthlyCredits: AI_PRO_INCLUDED_MONTHLY_CREDITS,
      freeBudgetInrCap: AI_FREE_BUDGET_INR_CAP,
    },
    checkout: { open: checkoutOpen, reason: checkoutOpen ? null : 'New credit packs are paused. Your credits are kept.' },
    buyPacks: AI_CREDIT_PACKS,
  }, { headers });
}
