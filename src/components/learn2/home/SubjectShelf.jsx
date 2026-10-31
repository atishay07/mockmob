'use client';
// The subjects loop, reused from Practice (its markup and its practice.css rules, so the lamp-lit objects, the chosen
// subject's lamp and rule, the stepped-back others and the sideways peek are the same ones the owner praised). The student's
// own subjects, in their own order. Learn and Practice keep one subject between them (the page remembers it per device).
import { useLayoutEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { useRailCue, reducedMotion as railReduced } from '@/components/start/railCue';
import { displayTitle } from './homeModel.mjs';
import '@/app/(app)/dashboard/practice.css';

/** The loop has room for one short name: "Economics / Business Economics" reads as "Economics" under its object (the whole name is its label and the heading below). */
const shortName = (name) => displayTitle(String(name || '').split(' / ')[0]);

// `line`: the chosen subject's counts, drawn under its name from 640 px up (on a phone the page draws the same line under the loop).
export default function SubjectShelf({ subjects, current, onPick, busy = false, line = '' }) {
  const shelfRef = useRef(null);
  const hintRef = useRef(null);
  const { edges } = useRailCue(shelfRef, { active: subjects.length > 1, items: '.pr-subject', min: 92, max: 132, endInset: 16, nudgeKey: 'mm:cue:learn-shelf:v1', nudgeDelay: 900, hintRef, count: subjects.length });
  // The chosen subject is brought to the middle of a phone's sideways row: before the first paint on arrival (nothing jumps, A8 F21),
  // smoothly after a pick.
  const first = useRef(true);
  useLayoutEffect(() => {
    const row = shelfRef.current;
    const on = row?.querySelector('[aria-pressed="true"]');
    if (!row || !on) return;
    if (row.scrollWidth <= row.clientWidth + 2) { first.current = false; return; }
    const left = Math.max(0, on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2);
    row.scrollTo({ left, behavior: first.current || railReduced() ? 'auto' : 'smooth' });
    first.current = false;
  }, [current, subjects.length]);
  if (!subjects.length) return null;
  return (
    <div className="pr lh-shelf" data-long={subjects.some((s) => shortName(s.name).length > 12) || undefined}>
      <div className="pr-shelf" data-overflow={edges.overflow || undefined} data-at-end={edges.end || undefined}>
        <div className="pr-subjects" role="group" aria-label="Subject" data-count={Math.min(subjects.length, 6)} ref={shelfRef}>
          {subjects.map((subject) => (
            <button key={subject.id} type="button" aria-pressed={subject.id === current} aria-label={subject.name} className="pr-subject" data-busy={busy || undefined} onClick={() => onPick(subject.id)}>
              <SubjectObject id={subject.id} size={132} life lit className="pr-subject__obj" />
              <span className="pr-subject__name">{shortName(subject.name)}</span>
              <span className="lh-shelf__line" aria-hidden="true">{subject.id === current ? line : ''}</span>
            </button>
          ))}
        </div>
        <button ref={hintRef} type="button" className="pr-shelf__hint" tabIndex={-1} aria-hidden="true"
          onClick={() => { const el = shelfRef.current; const first = el?.querySelector('.pr-subject'); if (el) el.scrollBy({ left: (first?.offsetWidth || 104) * 2, behavior: railReduced() ? 'auto' : 'smooth' }); }}>
          <span className="pr-shelf__disc"><ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" /></span>
        </button>
      </div>
    </div>
  );
}
