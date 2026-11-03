"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/fetcher';
import './study.css';
export default function StudyProgress({review=false}) {
  const [record,setRecord]=useState(null);
  useEffect(()=>{let live=true;apiGet('/api/study/catalog').then(data=>{if(live)setRecord(data);}).catch(()=>{});return()=>{live=false;};},[]);
  if(!record || record.state!=='ready') return null;
  return <section className="study-record" aria-label={review?'Recall to revisit':'Study progress'}><h2>{review?'Revisit what you’re learning':'Your study record'}</h2><div className="study-facts"><span><b>{record.progress.lessonsRead}</b> lessons completed</span><span><b>{record.progress.recallReviews}</b> recall responses</span><span><b>{record.queue.dueCount}</b> cards due</span></div><p>Reading, recall responses and assessed performance are recorded separately. A card rating schedules review; it does not certify mastery.</p><Link className="study-button" href={review && record.queue.availableCount?'/learn?recall=due':'/learn'}>{review && record.queue.availableCount?'Review due cards':'Open Learn'}</Link>{record.active && <Link className="study-button" href={`/study/${record.active.id}`}>Resume saved study</Link>}</section>;
}
