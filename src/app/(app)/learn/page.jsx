import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import StudyWorkspace from '@/components/study/StudyWorkspace';
import LearnHome from '@/components/learn2/home/LearnHome';
import { learn2On, one } from './params';
export const metadata = { title: 'Learn — MockMob', description: 'Short CUET lessons: learn a concept, lock it in with recall, then apply it on practice questions.' };
export default async function Learn({ searchParams }) {
  const params = await searchParams;
  // Concept cards that are due are played in Revise now (LEARN-REVIEW-1017 5.8): one queue for everything to bring back. The old
  // /learn?recall=due link (Today's "Review due cards", saved bookmarks) still works and opens Revise on the cards alone.
  if (params.recall === 'due') redirect('/review/revise?source=cards');
  // Learn v2 (BUILD-1101): the home with the chapter map and Find, on only while NEXT_PUBLIC_LEARN2 is 'on'. Off, this page is exactly
  // what it was. ?find=1 opens Find first (?lv=find is the preview's own spelling and works too).
  if (learn2On()) {
    const find = one(params.find) === '1' || one(params.lv) === 'find';
    return <Suspense fallback={null}><LearnHome subject={one(params.subject) || null} initialView={find ? 'find' : 'chapters'} /></Suspense>;
  }
  return <Suspense fallback={<p>Loading Concepts…</p>}><StudyWorkspace subject={typeof params.subject === 'string' ? params.subject : null} /></Suspense>;
}
