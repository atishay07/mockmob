"use client";
// The plan, as the Mob shows it (SOCIAL-SPEC section 15). The switcher is for a student in several Mobs (Pro: up to 3);
// the Pro note is one quiet section for a free student, never a pop-up and never a count-down (T005, T009). What a plan
// may do is decided on the server; these only draw it.
import Link from 'next/link';
import { Plus } from 'lucide-react';

/** A row of the student's Mobs, one pressed. A Pro student below 3 Mobs also gets the way to start another. */
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
      {canStart ? <button type="button" className="mob-tab mob-tab--add" onClick={onStartAnother}><Plus size={16} aria-hidden="true" />Start another Mob</button> : null}
    </nav>
  );
}

const PRO_ITEMS = [
  'The full side-by-side every week: who picked what, who changed an answer, how long each question took.',
  'Your Mob\'s shared trap, with its repair.',
  'Past weeks of your Mob.',
  'Extra papers on a chapter and length you choose.',
  'Up to 3 Mobs at once.',
];

/** Free only. One section, near the end of the page, so the paper and the ring come first. */
export function ProNote({ data }) {
  if (data.plan.pro) return null;
  return (
    <section className="mob-card mob-plain" aria-labelledby="mob-pro-h">
      <h2 id="mob-pro-h" className="mob-h2">Included with Pro</h2>
      <p className="mob-note">The weekly paper, the ring and your own result are free. Pro adds:</p>
      <ul className="mob-promises">
        {PRO_ITEMS.map((t) => <li key={t}>{t}</li>)}
      </ul>
      <Link className="mob-key" href="/pricing" data-pro-feature="mob">See Pro</Link>
    </section>
  );
}
