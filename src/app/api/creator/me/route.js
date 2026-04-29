import { NextResponse } from 'next/server';
import { requireCreator } from '@/lib/admin/roles';
import { Database } from '@/../data/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const guard = await requireCreator();
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: guard.status });

  const userId = guard.session.user.id;
  const userEmail = guard.session.user.email;

  // Prefer linked user_id; fall back to email match (auto-link trigger
  // runs after the user is created, so this is the safety net).
  let creator = await Database.getCreatorByUserId(userId);
  if (!creator && userEmail) creator = await Database.getCreatorByEmail(userEmail);
  if (!creator) {
    return NextResponse.json({ error: 'No creator profile linked to this account' }, { status: 404 });
  }
  if (!creator.isActive) {
    return NextResponse.json({ error: 'Creator account is disabled' }, { status: 403 });
  }

  const [stats, orders, payouts] = await Promise.all([
    Database.getCreatorStats(creator.id),
    Database.listOrders({ creatorId: creator.id, limit: 100 }),
    Database.listPayouts({ creatorId: creator.id, limit: 50 }),
  ]);

  return NextResponse.json({
    creator,
    stats: stats[0] || {
      creatorId: creator.id,
      totalSales: 0,
      totalRevenuePaise: 0,
      totalEarningsPaise: 0,
      pendingPayoutPaise: 0,
      paidPayoutPaise: 0,
    },
    orders,
    payouts,
  });
}
