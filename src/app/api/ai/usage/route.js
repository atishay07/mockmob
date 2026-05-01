import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { getUsageSnapshot } from '@/services/usage/getDailyUsage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Lightweight read-only endpoint for the UI to render limits + remaining. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const dbUser = await Database.getUserById(session.user.id);
  if (!dbUser) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  const snapshot = await getUsageSnapshot(dbUser);
  return NextResponse.json({
    ok: true,
    tier: snapshot.tier,
    isPaid: snapshot.isPaid,
    limits: {
      ...snapshot.limits,
      basicRivalBattles:
        snapshot.limits.basicRivalBattles === Infinity ? 'unlimited' : snapshot.limits.basicRivalBattles,
    },
    used: snapshot.used,
    monthly: snapshot.monthly,
    includedMonthlyAiCredits: snapshot.includedMonthlyAiCredits,
    includedAiCreditsRemaining: snapshot.includedAiCreditsRemaining,
    aiWallet: snapshot.aiWallet,
    aiCreditBalance: snapshot.aiCreditBalance,
    remaining: {
      ...snapshot.remaining,
      basicRivalBattles:
        snapshot.remaining.basicRivalBattles === Infinity ? 'unlimited' : snapshot.remaining.basicRivalBattles,
    },
    creditBalance: snapshot.creditBalance,
    normalCreditBalance: snapshot.normalCreditBalance,
    creditCosts: snapshot.creditCosts,
  });
}
