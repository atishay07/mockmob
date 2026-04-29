import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { requireAdmin } from '@/lib/admin/roles';
import { Database } from '@/../data/db';
import AdminDashboardClient from './AdminDashboardClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const emptyStats = (creatorId) => ({
  creatorId,
  totalSales: 0,
  totalRevenuePaise: 0,
  totalEarningsPaise: 0,
  pendingPayoutPaise: 0,
  paidPayoutPaise: 0,
});

export default async function AdminPage() {
  let user = null;

  try {
    const session = await auth();
    user = session?.user || null;
  } catch (error) {
    console.error('[admin] failed to resolve user:', error);
  }

  const safeUser = user ? { ...user, role: user?.role ?? 'student' } : null;
  if (!safeUser) redirect('/login');
  if (!requireAdmin(safeUser)) redirect('/dashboard');

  const [overview, creators, stats, orders, payoutsData] = await Promise.all([
    Database.getPlatformOverview(),
    Database.listCreators(),
    Database.getCreatorStats(),
    Database.listOrders({ limit: 100 }),
    Database.listPayouts({ limit: 100 }),
  ]);

  const statsById = new Map(stats.map((row) => [row.creatorId, row]));
  const enrichedCreators = creators.map((creator) => ({
    ...creator,
    stats: statsById.get(creator.id) || emptyStats(creator.id),
  }));

  const creatorsById = new Map(creators.map((creator) => [creator.id, creator]));
  const pendingPayouts = stats
    .filter((row) => row.pendingPayoutPaise > 0)
    .map((row) => ({
      creatorId: row.creatorId,
      creator: creatorsById.get(row.creatorId) || null,
      pendingPaise: row.pendingPayoutPaise,
      paidPaise: row.paidPayoutPaise,
    }))
    .sort((a, b) => b.pendingPaise - a.pendingPaise);

  return (
    <AdminDashboardClient
      adminEmail={safeUser.email}
      initialData={{
        overview,
        creators: enrichedCreators,
        orders,
        pendingPayouts,
        payoutHistory: payoutsData.map((payout) => ({
          ...payout,
          creator: creatorsById.get(payout.creatorId) || null,
        })),
      }}
    />
  );
}
