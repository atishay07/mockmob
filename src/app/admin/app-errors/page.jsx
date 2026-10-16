import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/roles';
import { appErrorsEnabled, summariseTopErrors, TOP_DAYS } from '@/lib/server/appErrors';
import { loadTopAppErrors } from '@/lib/server/appErrorsStore';
import AppErrorsSummary from '@/components/admin/AppErrorsSummary';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'App errors', robots: { index: false, follow: false } };

export default async function AppErrorsPage() {
  const guard = await requireAdmin();
  if (!guard.ok) redirect(guard.status === 401 ? '/login' : '/dashboard');
  const { rows, notSetUp, failed } = await loadTopAppErrors();
  return <AppErrorsSummary summary={summariseTopErrors(rows)} days={TOP_DAYS} enabled={appErrorsEnabled()} notSetUp={notSetUp} failed={failed} />;
}
