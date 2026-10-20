"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { AppIcon } from '@/components/ui/Glyph';
import { practicePanel } from '@/../data/study/concepts_pick.mjs';
import { readCatalog } from '@/lib/catalogRead';
import { useReview } from '@/lib/reviewRead';
import './concepts.css';

// Practice's Learn card (LEARN-REVIEW-1017 5.11; D126, owner H7: "Your paper and learn section should not be hidden ... It seems
// like something extra"). It sits beside Your papers right under the practice setup, named as the place is named everywhere else
// (the nav, the row of tabs, the Learn page). Personalised: it names the one lesson Learn would put first (the same function), with
// its time and how many of the student's open mistakes are in its chapter, then "All lessons". While the two reads are in flight,
// or if either fails, it says what Learn is and nothing it does not know. Drawn only while the lessons are on (page.js).
export default function ConceptsPanel() {
  const [catalog, setCatalog] = useState(undefined);
  const review = useReview();
  useEffect(() => {
    let live = true;
    readCatalog().then((data) => { if (live) setCatalog(data); });
    return () => { live = false; };
  }, []);
  const panel = catalog && review !== undefined ? practicePanel({ catalog, review }) : null;
  const personal = panel && panel.kind !== 'library';
  return <section className="pr-panel pr-door cpn" aria-labelledby="pr-concepts">
    <div className="pr-door__head">
      <span className="pr-door__ico" aria-hidden="true"><AppIcon name="learn" size={20} /></span>
      <div className="pr-door__title"><h2 id="pr-concepts">Learn</h2><p>Short lessons on the ideas behind your mistakes.</p></div>
    </div>
    {personal ? <Link className="cpn__lesson" href={panel.href}><small>Next lesson</small><b>{panel.title}</b><span>{panel.line}</span><ChevronRight className="cpn__chev" size={18} strokeWidth={2} aria-hidden="true" /></Link>
      : <p className="pr-panel__lead cpn__wait">{panel ? 'Open Learn to pick a lesson by chapter.' : ' '}</p>}
    <Link href="/learn" className="pr-link pr-link--strong pr-door__all">All lessons</Link>
  </section>;
}
