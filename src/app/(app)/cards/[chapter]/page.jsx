import { Suspense } from 'react';
import ChapterDeck from '@/components/keycards/ChapterDeck';

export const metadata = {
  title: 'Key cards | MockMob',
  description: "One chapter's Key cards: NCERT's exact lines with their page, to read, study or take a last look.",
};

// One chapter's deck (KEYCARDS-BUILD-SPEC.md section 3). The key is the chapter key from data/cuet_syllabus.js
// ('business_studies.nature-and-significance-of-management'); an unknown key shows "This chapter is not in Key cards".
export default async function ChapterCardsPage({ params }) {
  const { chapter } = await params;
  const key = decodeURIComponent(String(chapter || ''));
  return <div className="student-page student-page--cards"><Suspense fallback={null}><ChapterDeck key={key} chapterKey={key} /></Suspense></div>;
}
