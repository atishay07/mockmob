"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/fetcher';
export default function MistakeLessonLink({subject,chapter,conceptIds=[]}) {
  const [unit,setUnit]=useState(null);
  const ids=conceptIds.join(',');
  useEffect(()=>{let live=true;apiGet(`/api/study/catalog?subject=${encodeURIComponent(subject)}`).then(data=>{const supported=data.units?.find(u=>ids.split(',').includes(u.conceptId) || u.chapter===chapter);if(live)setUnit(supported || null);}).catch(()=>{});return()=>{live=false;};},[subject,chapter,ids]);
  if(!unit) return null;
  return <p className="srl-muted">Study the distinction, then revisit it through recall. <Link className="pr-link" href={`/learn/${unit.id}`}>Learn {unit.title}</Link></p>;
}
