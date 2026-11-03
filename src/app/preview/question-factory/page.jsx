import { notFound } from 'next/navigation';
import QuestionFactoryDashboard from '@/components/admin/QuestionFactoryDashboard';
import { loadFactoryPreview } from '@/lib/server/questionFactoryPreview';
export const dynamic='force-dynamic';
export default function FactoryPreview() {
  if(process.env.NODE_ENV==='production')notFound();
  return <QuestionFactoryDashboard preview initial={loadFactoryPreview()}/>;
}
