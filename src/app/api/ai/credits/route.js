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

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// One coherent, read-only wallet view. Reads the wallet exactly once and never writes.
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers });
  }

  const dbUser = await Database.getUserById(session.user.id).catch(() => null);
  if (!dbUser) {
    return NextResponse.json({ error: 'user_unavailable' }, { status: 503, headers });
  }

  const wallet = await readAIWallet(dbUser);
  const paid = isPaidUser(dbUser);
  const checkoutOpen = aiCommerceOpen();

  return NextResponse.json({
    ok: true,
    userId: dbUser.id,
    state: wallet.state,
    message: wallet.message,
    wallet,
    isPaid: paid,
    tier: paid ? 'paid' : 'free',
    creditCosts: CREDIT_COSTS,
    // Practice credits are a separate ledger from the PrepOS wallet.
    practiceCredits: { balance: dbUser.creditBalance || 0, label: 'Practice credits (Quick Practice and Full Mock)' },
    normalCreditBalance: dbUser.creditBalance || 0,
    budget: {
      freeMonthlyCredits: AI_FREE_MONTHLY_CREDITS,
      proMonthlyCredits: AI_PRO_INCLUDED_MONTHLY_CREDITS,
      freeBudgetInrCap: AI_FREE_BUDGET_INR_CAP,
    },
    checkout: { open: checkoutOpen, reason: checkoutOpen ? null : 'New PrepOS top-ups are paused. Existing wallets are preserved.' },
    buyPacks: AI_CREDIT_PACKS,
  }, { headers });
}
