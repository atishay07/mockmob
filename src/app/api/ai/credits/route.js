import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { AI_CREDIT_PACKS, AI_FREE_BUDGET_INR_CAP, AI_FREE_MONTHLY_CREDITS, AI_PRO_INCLUDED_MONTHLY_CREDITS, getAIWallet } from '@/services/credits/aiCreditWallet';
import { getUsageSnapshot } from '@/services/usage/getDailyUsage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const dbUser = await Database.getUserById(session.user.id);
  if (!dbUser) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  const [wallet, snapshot] = await Promise.all([
    getAIWallet(dbUser),
    getUsageSnapshot(dbUser),
  ]);

  return NextResponse.json({
    ok: true,
    isPaid: snapshot.isPaid,
    tier: snapshot.tier,
    wallet,
    creditCosts: snapshot.creditCosts,
    normalCreditBalance: snapshot.normalCreditBalance,
    budget: {
      freeMonthlyCredits: AI_FREE_MONTHLY_CREDITS,
      proMonthlyCredits: AI_PRO_INCLUDED_MONTHLY_CREDITS,
      freeBudgetInrCap: AI_FREE_BUDGET_INR_CAP,
    },
    buyPacks: AI_CREDIT_PACKS,
  });
}
