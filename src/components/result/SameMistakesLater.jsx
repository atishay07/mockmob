"use client";
// "Same mistakes later" in the Lab's Prove step (spec tmp/mistake-lab-v4/SPEC.md 4.8, F1's Revise rules): which of this
// paper's wrong answers come back, and when, with the one honest difference between this and Prove's fresh questions
// ("Same questions, so this checks memory. Fresh questions check the idea."). The sentences come finished from the server
// (lab.prove.later, data/revise.js buildLater, contract_later_v1.json). Revise costs no credits, writes no attempts row and
// is in no accuracy number; the fine line says so. The button appears once questions are ready, and opens Revise, which is
// a separate page and never part of a paper.
import Link from 'next/link';
import { CalendarClock, ArrowRight } from 'lucide-react';
import './traps-later.css';

export default function SameMistakesLater({ later }) {
  if (!later || later.state !== 'scheduled' || !later.line) return null;
  return (
    <section className="sml" aria-labelledby="sml-title">
      <span className="sml__icon" aria-hidden="true"><CalendarClock size={20} strokeWidth={2} /></span>
      <div className="sml__main">
        <h4 className="sml__title" id="sml-title">{later.title}</h4>
        <p className="sml__line">{later.line}</p>
        <p className="sml__note">{later.note}</p>
        {later.when === 'now' && later.href ? (
          <Link className="sml__open" href={later.href}>{later.open}<ArrowRight size={16} strokeWidth={2.1} aria-hidden="true" /></Link>
        ) : null}
        {later.fine ? <p className="sml__fine">{later.fine}</p> : null}
      </div>
    </section>
  );
}
