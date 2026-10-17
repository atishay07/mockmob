import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/roles';
import { funnelEnabled, istDay, summariseFunnel, windowDays } from '@/lib/server/funnel';
import { loadFunnelRows } from '@/lib/server/funnelStore';
import FunnelSummary from '@/components/admin/FunnelSummary';
import MobMetricsBlock from '@/components/admin/MobMetricsBlock';
import { readMobMetrics } from '@/lib/server/mob/deps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'Landing funnel · MockMob', robots: { index: false, follow: false } };

const DAYS = 14;

export default async function FunnelPage() {
  const guard = await requireAdmin();
  if (!guard.ok) redirect(guard.status === 401 ? '/login' : '/dashboard');
  const today = istDay();
  const [{ rows, notSetUp, failed }, mob] = await Promise.all([loadFunnelRows(windowDays(today, DAYS)[0]), readMobMetrics()]);
  return (
    <FunnelSummary summary={summariseFunnel(rows, { today, days: DAYS })} enabled={funnelEnabled()} notSetUp={notSetUp} failed={failed}>
      <MobMetricsBlock result={mob} />
    </FunnelSummary>
  );
}
