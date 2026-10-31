import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import LearnCardsView from '@/components/learn2/cards/CardsView';
import { chapterKeyOf, learn2On, one } from '../../../params';
export const metadata = { title: 'Key cards — MockMob', robots: { index: false, follow: false } };
// /learn/c/<chapterKey>/cards?f=: every Key card of the chapter, by section (the view checks the filter name itself).
// Learn v2 off: no such page.
export default async function LearnCards({ params, searchParams }) {
  const [{ chapterKey: raw }, query] = await Promise.all([params, searchParams]);
  const chapterKey = chapterKeyOf(raw);
  if (!learn2On() || !chapterKey) notFound();
  return <Suspense fallback={null}><LearnCardsView key={chapterKey} chapterKey={chapterKey} filter={one(query.f) || 'all'} /></Suspense>;
}
