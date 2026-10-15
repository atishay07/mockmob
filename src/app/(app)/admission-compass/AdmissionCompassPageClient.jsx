"use client";

// Cutoff calculator (You > CUET tools; the URL stays /admission-compass). The student's subjects, a category
// and a score (or a what-if) against DU's own published eligibility rules and last year's cutoffs. The page
// opens with the tool, already filled in from the student's sheet: the long how-it-works preamble is gone.
// It never turns practice marks into an admission score or a chance. "Your gap to each college" (Pro) shows a
// clearly labelled practice projection below the tool, never instead of the published history.
import Link from 'next/link';
import { CutoffCalculator } from '@/components/du/CutoffCalculator';
import CompassPro from '@/components/du/CompassPro';
import { DU_SOURCES } from '@/lib/du/sources';
import { useAuth } from '@/components/AuthProvider';
import { SubjectIcon } from '@/components/ui/Glyph';
import { useInsights } from '@/components/ai/useInsights';
import { APPROVED } from '@/../data/glossary.mjs';
import '@/components/profile/you.css';

// Profile subject ids -> DU catalog ids (they match, except the aptitude test).
const toDuId = (id) => (id === 'general_test' ? 'gat' : id);

function PracticeBridge({ userId }) {
  const state = useInsights(userId);
  if (state.status !== 'ready') return null;
  const top = state.insights.chapters.ranked[0];
  if (!top) return null;
  return (
    <aside className="cmpx-bridge" aria-label="From your practice">
      <span className="cmpx-bridge__icon"><SubjectIcon id={top.subject} size={20} /></span>
      <div>
        <b>Your practice says: {top.chapter}</b>
        <p>{top.subjectName} has the most marks open in your record: {top.right} right, {top.wrong} wrong and {top.skip} blank over {top.n} questions. Cutoffs are history. The chapters you practise are the ones you control.</p>
        <Link className="you-link" href={`/dashboard?subject=${encodeURIComponent(top.subject)}&mode=quick`}>Practise {top.subjectName}</Link>
      </div>
    </aside>
  );
}

export default function AdmissionCompassPageClient() {
  const { user } = useAuth();
  const seed = (user?.subjects || []).map(toDuId);
  return (
    <main className="cmp">
      <header className="cmpx-head">
        <h1>{APPROVED.cutoffTool}</h1>
        <p>
          {seed.length > 0
            ? 'Your subjects are already ticked. Add a category and a score, or try a what-if, to see which DU courses they open and how last year’s cutoffs compare.'
            : 'Tick your CUET subjects to see which DU courses they open. Then add a category and a score to compare last year’s cutoffs by round.'}
        </p>
      </header>

      <CutoffCalculator seedSubjects={seed} />

      {user?.id ? <CompassPro userId={user.id} seedSubjects={seed} /> : null}
      {user?.id && !user?.isPremium ? <PracticeBridge userId={user.id} /> : null}

      <p className="cmpx-note">Cutoffs and eligibility are DU’s published 2026 figures. The 2027 rules stay provisional until DU publishes them. {APPROVED.cutoffToolPro} is a projection from your own practice, labelled as one: it is not a prediction or a normalised CUET score. Your choices are saved on this device.</p>

      <details className="cmpx-sources">
        <summary>Official source documents</summary>
        <ul>{DU_SOURCES.map((s) => <li key={s.id}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> ({s.use})</li>)}</ul>
      </details>
    </main>
  );
}
