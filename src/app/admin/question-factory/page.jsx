import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/roles';
import { factoryOverview } from '@/lib/server/questionFactory';
import QuestionFactoryDashboard from '@/components/admin/QuestionFactoryDashboard';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const metadata={title:'Question factory · MockMob',robots:{index:false,follow:false}};
export default async function QuestionFactoryPage() {
  const guard=await requireAdmin();if(!guard.ok)redirect(guard.status===401?'/login':'/dashboard');
  return <QuestionFactoryDashboard initial={await factoryOverview()} />;
}
