"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { practicePanel } from '@/../data/study/concepts_pick.mjs';
import { readCatalog } from '@/lib/catalogRead';
import { useReview } from '@/lib/reviewRead';
import './concepts.css';

// Practice's Concepts panel (LEARN-REVIEW-1017 5.11): personalised, so the lesson is offered where the student is choosing what to
// practise. It names the one lesson Concepts would put first (the same function), with its time and how many of the student's open
// mistakes are in its chapter, then "All concepts". While the two reads are in flight, or if either fails, it says what Concepts is
// and nothing it does not know.
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
  return <section className="pr-panel cpn" aria-labelledby="pr-concepts">
    <div className="pr-panel__head"><h2 id="pr-concepts">Concepts</h2></div>
    {personal ? <Link className="cpn__lesson" href={panel.href}><b>{panel.title}</b><span>{panel.line}</span></Link>
      : <p className="pr-panel__lead">{panel?.line || 'Short lessons on the ideas behind your mistakes.'}</p>}
    <Link href="/learn" className="pr-link pr-link--strong">All concepts</Link>
  </section>;
}
