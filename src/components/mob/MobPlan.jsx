"use client";
// The plan, as the Mob shows it (SOCIAL-SPEC section 15). The switcher is for a student in several Mobs (any plan joins
// any number; free starts 1, Pro starts up to 3); the Pro note is one quiet line for a free student. What a plan may do
// is decided on the server; these only draw it.
import Link from 'next/link';
import { Plus } from 'lucide-react';

/** A row of the student's Mobs, one pressed, and the way to start one when the plan still allows it. */
export function MobSwitcher({ data, onSelect, onStartAnother, busy = false }) {
  const mobs = data.mobs || [];
  const canStart = data.plan.canStartAnother;
  if (mobs.length < 2 && !canStart) return null;
  const labels = mobs.map((m, i) => (mobs.filter((x) => x.subjectName === m.subjectName).length > 1 ? `${m.subjectName} ${mobs.slice(0, i + 1).filter((x) => x.subjectName === m.subjectName).length}` : m.subjectName));
  return (
    <nav className="mob-switch" aria-label="Your Mobs">
      {mobs.map((m, i) => (
        <button key={m.id} type="button" className="mob-tab" aria-current={m.active ? 'true' : undefined} onClick={() => { if (!m.active) onSelect(m.id); }} disabled={busy}>
          {labels[i]}
        </button>
      ))}
      {canStart ? <button type="button" className="mob-tab mob-tab--add" onClick={onStartAnother}><Plus size={16} aria-hidden="true" />{data.plan.started ? 'Start another Mob' : 'Start your own Mob'}</button> : null}
    </nav>
  );
}

/**
 * Free only: one quiet line near the end of the page, so the paper and the ring come first. What Pro adds, in one
 * sentence, and the way to see it. Never a block of bullets, never a pop-up, never a count-down (T005, T009).
 */
export function ProNote({ data }) {
  if (data.plan.pro) return null;
  return (
    <p className="mob-pro-line">
      <span>Pro adds the full side-by-side every week, past weeks, extra papers on a chapter you choose, and up to 3 Mobs you start.</span>{' '}
      <Link className="mob-link" href="/pricing" data-pro-feature="mob">See Pro</Link>
    </p>
  );
}
