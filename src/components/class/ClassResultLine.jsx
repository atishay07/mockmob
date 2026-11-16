"use client";
// A Sunday Mock paper's result, once its answers are open: one line for the student's class, under the Sunday Mock's own row.
// "Your class: class average 142 of 250, 31 sat it." or the floor's line. Nothing while it is held, for a student in no class,
// for a subject the class does not follow, while it is off, or when the read fails (never a wrong number).
import Link from 'next/link';
import { School } from 'lucide-react';
import { CLASS_COPY, CLASS_FULL_MARKS } from '@/lib/classLeague/model.mjs';
import { useClassWeek } from './useClassLeague';
import { useClassLeaguesOn } from './ClassSwitch';
import './class.css';

function ClassResultLineOn({ week, subject }) {
  const out = useClassWeek(week, subject);
  const f = out?.figure;
  if (!f) return null;
  const line = f.enough ? `Class average ${f.average} of ${CLASS_FULL_MARKS}. ${f.sat} of your class sat it. Never who, never a rank.` : CLASS_COPY.floorLine;
  return (
    <section className="cls-res" aria-label="Your class">
      <span className="sun-mark" aria-hidden="true"><School size={22} strokeWidth={1.6} /></span>
      <span className="cls-res__text">
        <b>{`Your class: ${out.className}`}</b>
        <span>{line}</span>
        <Link className="cls-link" href="/sunday#class">See it on a ruler</Link>
      </span>
    </section>
  );
}

/** Mounts only while CLASS_LEAGUES_ENABLED is on (./ClassSwitch.jsx): off, nothing is read or drawn. */
export default function ClassResultLine(props) {
  return useClassLeaguesOn() ? <ClassResultLineOn {...props} /> : null;
}
