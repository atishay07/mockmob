"use client";
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { lessonFor, lessonHref } from '@/../data/study/lesson_map.mjs';
import { readCatalog } from '@/lib/catalogRead';
import './concepts.css';

// "Learn the idea first" (LEARN-REVIEW-1017 5.11): the lesson for the idea behind a mistake, offered where the mistake is. It names
// the lesson, its time (Learn plus Lock it in) and that it is free, and it never claims the lesson fixes the mistake. The lesson is
// found by data/study/lesson_map.mjs lessonFor (the mistake's concept first, then its chapter), the same rule on every surface:
// the result page, Review's opened chapter and the repair entry. With no lesson it draws nothing (a failed read is not "no lesson").
//   subject, chapter, conceptId     one mistake or one chapter
//   chapters [{ chapter, count }]   several chapters (the result's Repair step); conceptIds the mistakes' concepts
//   from                            where the student is: { kind: 'q', attemptId, number } | { kind: 'chapter', subject, chapter }
export default function MistakeLessonLink({ subject, chapter, conceptId = null, chapters = [], conceptIds = [], from = null }) {
  const [catalog, setCatalog] = useState(null);
  useEffect(() => {
    let live = true;
    readCatalog({ subject }).then((data) => { if (live) setCatalog(data); });
    return () => { live = false; };
  }, [subject]);
  const wanted = useMemo(() => (chapters.length ? chapters : chapter ? [{ chapter, count: 0, conceptId }] : []), [chapters, chapter, conceptId]);
  const concepts = conceptIds.join(',');
  const found = useMemo(() => {
    if (!catalog) return [];
    const units = catalog.units || [];
    const seen = new Set();
    const out = [];
    const add = (lesson, count) => { if (lesson && !seen.has(lesson.id)) { seen.add(lesson.id); out.push({ lesson, count }); } };
    for (const w of wanted) add(lessonFor({ subject, chapter: w.chapter, conceptId: w.conceptId ?? null }, units), w.count);
    for (const id of concepts ? concepts.split(',') : []) add(lessonFor({ subject, conceptId: id }, units), 0);
    return out;
  }, [catalog, wanted, subject, concepts]);
  if (!found.length) return null;
  const detail = ({ lesson, count }) => `${lesson.title}, ${lesson.minutes ? `${lesson.minutes}-minute lesson` : 'lesson'}, free${lesson.read ? ', read' : ''}${count ? `. ${count} ${count === 1 ? 'mistake' : 'mistakes'} in ${lesson.chapter}` : ''}`;
  // One lesson reads as one link; several (the result's Repair step spans chapters) read as a short list under the same words.
  if (found.length === 1) return <div className="mll"><Link className="mll__link" href={lessonHref(found[0].lesson, from)}><u>Learn the idea first</u><small>{detail(found[0])}</small></Link></div>;
  return <div className="mll">
    <p className="mll__head">Learn the idea first</p>
    <ul>{found.map((item) => <li key={item.lesson.id}><Link className="mll__link" href={lessonHref(item.lesson, from)}><u>{item.lesson.title}</u><small>{detail(item).slice(item.lesson.title.length + 2)}</small></Link></li>)}</ul>
  </div>;
}
