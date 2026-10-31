import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import LearnChapterFeed from '@/components/learn2/feed/ChapterFeed';
import { chapterKeyOf, learn2On, minutesOf, one, runIdOf } from '../../learn/params';
export const metadata = { title: 'Explore — MockMob', robots: { index: false, follow: false } };
// /explore/run: one chapter's feed, a focus route (no sidebar, top bar or dock: AppLayoutClient, FOCUS_PATHS).
//   ?chapter=<key>&min=10      a new feed (or the day's unfinished one, which the service resumes)
//   ?run=<id>                  a feed the page reloads
//   ?run=<id>&end=1            that feed's end screen
// Learn v2 off: no such page.
export default async function ExploreRun({ searchParams }) {
  if (!learn2On()) notFound();
  const q = await searchParams;
  const chapterKey = chapterKeyOf(q.chapter) || null;
  const runId = runIdOf(q.run) || null;
  if (!chapterKey && !runId) notFound();
  const minutes = minutesOf(q.min, 10);
  const end = one(q.end) === '1';
  return (
    <Suspense fallback={null}>
      <LearnChapterFeed key={`${runId || ''}-${chapterKey || ''}-${minutes}`} chapterKey={chapterKey} minutes={minutes} runId={runId} end={end} />
    </Suspense>
  );
}
