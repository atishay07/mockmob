"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/fetcher';
import { useInView } from '@/lib/motion';
import './study.css';
// A ring of lessons read out of lessons available. It fills once it is on screen; the counts beside
// it are the same real numbers, so nothing depends on the picture.
function ReadRing({ read, total }) {
  const [ref, seen] = useInView({ threshold: 0.5 });
  const f = total > 0 ? Math.max(0, Math.min(1, read / total)) : 0;
  return <span ref={ref} className="study-ring" data-in={seen ? 'true' : 'false'} aria-hidden="true" style={{ '--to': f }}>
    <svg viewBox="0 0 44 44" width="44" height="44"><circle className="study-ring__track" cx="22" cy="22" r="18" /><circle className="study-ring__arc" cx="22" cy="22" r="18" pathLength="1" transform="rotate(-90 22 22)" /></svg>
  </span>;
}
// Shown on Review and Progress. Study activity is kept apart from marks on purpose.
export default function StudyProgress({ review = false }) {
  const [record, setRecord] = useState(null);
  useEffect(() => { let live = true; apiGet('/api/study/catalog').then(data => { if (live) setRecord(data); }).catch(() => {}); return () => { live = false; }; }, []);
  if (!record || record.state !== 'ready') return null;
  const due = record.queue.dueCount;
  return <section className="study-record" aria-label={review ? 'Cards to review' : 'Study record'}>
    <h2>{review ? (due ? `${due} ${due === 1 ? 'card is' : 'cards are'} due for review` : 'Your lessons and reviews') : 'Your study record'}</h2>
    <div className="study-facts"><span className="study-facts__read"><ReadRing read={record.progress.lessonsRead} total={record.progress.lessonsAvailable} /><span><b>{record.progress.lessonsRead}</b> of {record.progress.lessonsAvailable} lessons read</span></span><span><b>{record.progress.cardsStarted}</b> cards in review</span><span><b>{record.progress.recallReviews}</b> recall answers</span></div>
    <p>Lessons and recall keep ideas fresh. Marks come only from practice and mocks, so they are recorded separately; a recall rating schedules the next review and does not certify mastery.</p>
    {record.active ? <Link className="study-button" href={`/study/${record.active.id}`}>Continue your saved {record.active.mode === 'learn' ? 'lesson' : 'review'}</Link> : null}
    {review
      ? <Link className="study-button" href={record.queue.availableCount ? '/learn?recall=due' : '/learn'}>{record.queue.availableCount ? (due ? 'Review due cards' : 'Lock in new cards') : 'Open Learn'}</Link>
      // Progress is a record, so it leads to Learn itself (D20): the Learn page names the due cards and starts them from its first
      // block, with Learn marked as the place you are, instead of dropping a student into a card run from here.
      : <>{due ? <p className="study-record__due"><b>{due}</b> {due === 1 ? 'card is' : 'cards are'} due for review in Learn.</p> : null}<Link className="study-button" href="/learn">Open Learn</Link></>}
  </section>;
}
