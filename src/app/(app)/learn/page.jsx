import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import StudyWorkspace from '@/components/study/StudyWorkspace';
export const metadata = { title: 'Learn — MockMob', description: 'Short CUET lessons: learn a concept, lock it in with recall, then apply it on practice questions.' };
export default async function Learn({ searchParams }) {
  const params = await searchParams;
  // Concept cards that are due are played in Revise now (LEARN-REVIEW-1017 5.8): one queue for everything to bring back. The old
  // /learn?recall=due link (Today's "Review due cards", saved bookmarks) still works and opens Revise on the cards alone.
  if (params.recall === 'due') redirect('/review/revise?source=cards');
  return <Suspense fallback={<p>Loading Learn…</p>}><StudyWorkspace subject={typeof params.subject === 'string' ? params.subject : null} /></Suspense>;
}
