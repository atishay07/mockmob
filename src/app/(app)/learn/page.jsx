import { Suspense } from 'react';
import StudyWorkspace from '@/components/study/StudyWorkspace';
export const metadata = { title: 'Learn — MockMob', description: 'Short CUET lessons: learn a concept, lock it in with recall, then apply it on practice questions.' };
export default async function Learn({ searchParams }) {
  const params = await searchParams;
  return <Suspense fallback={<p>Loading Learn…</p>}><StudyWorkspace autoRecall={params.recall === 'due'} subject={typeof params.subject === 'string' ? params.subject : null} /></Suspense>;
}
