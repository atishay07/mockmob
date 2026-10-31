import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import LearnRunPlayer from '@/components/learn2/run/RunPlayer';
import { chapterKeyOf, learn2On, list, minutesOf, one, runIdOf } from '../params';
export const metadata = { title: 'Learn — MockMob', robots: { index: false, follow: false } };
// /learn/run: the chapter run player, a focus route (no sidebar, top bar or dock: AppLayoutClient, FOCUS_PATHS).
//   ?chapter=<key>&min=10&kind=mix|recap|cards|level&out=lesson,mistakes&cards=<id,id>   a new run
//   ?run=<id>                                                                          a run the page reloads or resumes
//   ?run=<id>&end=1                                                                    that run's end screen
//   ?resume=<id>                                                                       the unfinished run a suggestion names
// A start needs a chapter, cards or a level; a link with none of them is not a page. Learn v2 off: no such page.
const KINDS = ['mix', 'recap', 'cards', 'level'];
export default async function LearnRun({ searchParams }) {
  const q = await searchParams;
  if (!learn2On()) notFound();
  const chapterKey = chapterKeyOf(q.chapter) || null;
  const cardIds = list(q.cards);
  const runId = runIdOf(q.run) || null;
  const resume = runIdOf(q.resume) || null;
  const kind = KINDS.includes(one(q.kind)) ? one(q.kind) : 'mix';
  if (!chapterKey && !cardIds.length && !runId && !resume && kind !== 'level') notFound();
  const minutes = minutesOf(q.min, 10);
  const leaveOut = list(q.out, 8);
  const end = one(q.end) === '1';
  return (
    <Suspense fallback={null}>
      <LearnRunPlayer key={`${runId || resume || ''}-${chapterKey || ''}-${minutes}-${kind}-${cardIds.join(',')}`}
        chapterKey={chapterKey} minutes={minutes} kind={kind} leaveOut={leaveOut} cardIds={cardIds} runId={runId} resume={resume} end={end} />
    </Suspense>
  );
}
