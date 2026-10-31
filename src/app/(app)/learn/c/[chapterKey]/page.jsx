import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import LearnChapterPage from '@/components/learn2/chapter/ChapterPage';
import { chapterKeyOf, learn2On, minutesOf } from '../../params';
export const metadata = { title: 'Chapter — MockMob', robots: { index: false, follow: false } };
// /learn/c/<chapterKey>?min=: one chapter's page (its length choice, piles and shelves). Learn v2 off: no such page.
export default async function LearnChapter({ params, searchParams }) {
  const [{ chapterKey: raw }, query] = await Promise.all([params, searchParams]);
  const chapterKey = chapterKeyOf(raw);
  if (!learn2On() || !chapterKey) notFound();
  return <Suspense fallback={null}><LearnChapterPage key={chapterKey} chapterKey={chapterKey} minutes={minutesOf(query.min)} /></Suspense>;
}
