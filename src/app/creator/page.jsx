import { redirect } from 'next/navigation';
import { requireCreator } from '@/lib/admin/roles';
import { Database } from '@/../data/db';
import CreatorDashboardClient from './CreatorDashboardClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function CreatorPage() {
  const guard = await requireCreator();
  if (!guard.ok) {
    if (guard.status === 401) redirect('/login');
    redirect('/dashboard');
  }

  const user = guard.session.user;

  // Find their creator profile by user_id (auto-linked) or email (safety net).
  let creator = await Database.getCreatorByUserId(user.id);
  if (!creator && user.email) {
    creator = await Database.getCreatorByEmail(user.email);
  }

  if (!creator) {
    return (
      <div className="min-h-screen bg-[#07070b] p-6 text-white">
        <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <h1 className="font-display text-xl font-bold">No creator profile</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Your account isn&apos;t linked to a creator profile. Contact the admin
            to be added.
          </p>
          <a href="/dashboard" className="mt-4 inline-block text-sm text-volt hover:underline">Back to dashboard</a>
        </div>
      </div>
    );
  }

  if (!creator.isActive) {
    return (
      <div className="min-h-screen bg-[#07070b] p-6 text-white">
        <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <h1 className="font-display text-xl font-bold">Account disabled</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Your creator account has been disabled. Contact the admin if you
            believe this is a mistake.
          </p>
        </div>
      </div>
    );
  }

  const [stats, orders, payouts] = await Promise.all([
    Database.getCreatorStats(creator.id),
    Database.listOrders({ creatorId: creator.id, limit: 100 }),
    Database.listPayouts({ creatorId: creator.id, limit: 50 }),
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  return (
    <CreatorDashboardClient
      creator={creator}
      stats={stats[0] || {
        creatorId: creator.id,
        totalSales: 0,
        totalRevenuePaise: 0,
        totalEarningsPaise: 0,
        pendingPayoutPaise: 0,
        paidPayoutPaise: 0,
      }}
      orders={orders}
      payouts={payouts}
      baseUrl={baseUrl}
    />
  );
}
