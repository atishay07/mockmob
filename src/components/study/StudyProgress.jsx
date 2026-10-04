"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/fetcher';
import './study.css';
// Shown on Review and Progress. Study activity is kept apart from marks on purpose.
export default function StudyProgress({ review = false }) {
  const [record, setRecord] = useState(null);
  useEffect(() => { let live = true; apiGet('/api/study/catalog').then(data => { if (live) setRecord(data); }).catch(() => {}); return () => { live = false; }; }, []);
  if (!record || record.state !== 'ready') return null;
  const due = record.queue.dueCount;
  return <section className="study-record" aria-label={review ? 'Cards to review' : 'Study record'}>
    <h2>{review ? (due ? `${due} ${due === 1 ? 'card is' : 'cards are'} due for review` : 'Your lessons and reviews') : 'Your study record'}</h2>
    <div className="study-facts"><span><b>{record.progress.lessonsRead}</b> of {record.progress.lessonsAvailable} lessons read</span><span><b>{record.progress.cardsStarted}</b> cards in review</span><span><b>{record.progress.recallReviews}</b> recall answers</span></div>
    <p>Lessons and recall keep ideas fresh. Marks come only from practice and mocks, so they are recorded separately; a recall rating schedules the next review and does not certify mastery.</p>
    {record.active ? <Link className="study-button" href={`/study/${record.active.id}`}>Continue your saved {record.active.mode === 'learn' ? 'lesson' : 'review'}</Link> : null}
    <Link className="study-button" href={record.queue.availableCount ? '/learn?recall=due' : '/learn'}>{record.queue.availableCount ? (due ? 'Review due cards' : 'Lock in new cards') : 'Open Learn'}</Link>
  </section>;
}
