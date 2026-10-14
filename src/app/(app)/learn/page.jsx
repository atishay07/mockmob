import { Suspense } from 'react';
import StudyWorkspace from '@/components/study/StudyWorkspace';
import { LoadingState } from '@/components/ui/Skeleton';

export const metadata = { title: 'Learn | MockMob', description: 'Short CUET lessons: learn a concept, lock it in with recall, then apply it on practice questions.' };

export default async function Learn({ searchParams }) {
  const params = await searchParams;
  return (
    <Suspense fallback={<LoadingState label="Loading your lessons" lines={4} className="sx" />}>
      <StudyWorkspace autoRecall={params.recall === 'due'} subject={typeof params.subject === 'string' ? params.subject : null} />
    </Suspense>
  );
}
