import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import ChapterDeck from '@/components/keycards/ChapterDeck';
import { learn2On } from '../../learn/params';
import { cardsDeckTarget } from '../redirects';

export const metadata = {
  title: 'Key cards | MockMob',
  description: "One chapter's Key cards: NCERT's exact lines with their page, to read, study or take a last look.",
};

// One chapter's deck (KEYCARDS-BUILD-SPEC.md section 3). The key is the chapter key from data/cuet_syllabus.js
// ('business_studies.nature-and-significance-of-management'); an unknown key shows "This chapter is not in Key cards".
export default async function ChapterCardsPage({ params, searchParams }) {
  const { chapter } = await params;
  const key = decodeURIComponent(String(chapter || ''));
  // Learn v2 on: the chapter's Key cards are Learn's (LK23); ?mode=study opens the chapter page, ?mode=last the Must-know view.
  if (learn2On()) redirect(cardsDeckTarget(key, await searchParams));
  return <div className="student-page student-page--cards"><Suspense fallback={null}><ChapterDeck key={key} chapterKey={key} /></Suspense></div>;
}
