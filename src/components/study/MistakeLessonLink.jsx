"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpenText } from 'lucide-react';
import { apiGet } from '@/lib/fetcher';

// After a practice result: point each chapter with mistakes to its published lesson, if one exists.
// It never claims the lesson fixes the mistake; it offers the idea behind it plus recall.
export default function MistakeLessonLink({ subject, chapter, chapters = [], conceptIds = [] }) {
  const [units, setUnits] = useState(null);
  const wanted = chapters.length ? chapters : chapter ? [{ chapter, count: 0 }] : [];
  const key = `${subject}|${wanted.map(c => c.chapter).join('|')}|${conceptIds.join(',')}`;
  useEffect(() => {
    let live = true;
    apiGet(`/api/study/catalog?subject=${encodeURIComponent(subject)}`).then(data => {
      if (!live) return;
      const chapterList = wanted.map(c => c.chapter);
      const matches = (data.units || []).filter(u => chapterList.includes(u.chapter) || conceptIds.includes(u.conceptId));
      setUnits(matches);
    }).catch(() => { if (live) setUnits([]); });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!units?.length) return null;
  const shown = units;
  return <div className="srl-lessons">
    <p className="srl-muted">Lessons cover the ideas behind {shown.length === 1 ? 'this chapter' : 'these chapters'}. Read one, lock it in with recall, then practise the chapter again.</p>
    <ul>{shown.map(u => { const c = wanted.find(w => w.chapter === u.chapter); return <li key={u.id}><Link className="pr-link" href={`/learn/${u.id}`}><BookOpenText size={16} aria-hidden="true" />{u.title}</Link><small>{u.chapter}{c?.count ? ` · ${c.count} ${c.count === 1 ? 'mistake' : 'mistakes'} here` : ''} · {u.estimatedMinutes} min{u.read ? ' · read' : ''}</small></li>; })}</ul>
  </div>;
}
