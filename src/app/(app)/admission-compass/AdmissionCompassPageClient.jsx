"use client";

// Admission Compass: the student's subjects, a category and a score (or a what-if) against DU's own
// published eligibility rules and last year's cutoffs. The page opens already filled in from the
// student's profile. It never turns practice marks into an admission score or a chance; Compass Pro
// shows a clearly labelled practice projection beside, never instead of, the published history.
import Link from 'next/link';
import { CutoffCalculator } from '@/components/du/CutoffCalculator';
import CompassPro from '@/components/du/CompassPro';
import { DU_SOURCES } from '@/lib/du/sources';
import { useAuth } from '@/components/AuthProvider';
import { AppIcon, StatusIcon, SubjectIcon } from '@/components/ui/Glyph';
import { useInsights } from '@/components/ai/useInsights';

// Profile subject ids -> DU catalog ids (they match, except the aptitude test).
const toDuId = (id) => (id === 'general_test' ? 'gat' : id);

function PracticeBridge({ userId }) {
  const state = useInsights(userId);
  if (state.status !== 'ready') return null;
  const top = state.insights.chapters.ranked[0];
  if (!top) return null;
  return (
    <aside className="cmp-bridge" aria-label="From your practice">
      <span className="cmp-bridge__icon"><SubjectIcon id={top.subject} size={20} /></span>
      <div>
        <b>Your practice says: {top.chapter}</b>
        <p>{top.subjectName} has the most marks open in your record ({top.right} right, {top.wrong} wrong, {top.skip} blank over {top.n} questions). Cutoffs are history, but the subjects you drill are the ones you control.</p>
        <Link href={`/dashboard?subject=${encodeURIComponent(top.subject)}&mode=quick`}>Practise {top.subjectName}</Link>
      </div>
    </aside>
  );
}

export default function AdmissionCompassPageClient() {
  const { user } = useAuth();
  const seed = (user?.subjects || []).map(toDuId);
  return (
    <main className="cmp">
      <header className="cmp-head">
        <div>
          <div className="eyebrow">Admission Compass</div>
          <h1 className="display-md">Which DU courses can your subjects get?</h1>
          <p>
            {seed.length > 0
              ? 'Your subjects are already ticked below. Add a category and a score, or try a what-if, to check subject eligibility under the 2026 rules and compare published 2026 cutoffs.'
              : 'Tick your CUET subjects to check programme subject eligibility under the 2026 rules, then compare published 2026 cutoffs by category and round.'}
          </p>
        </div>
        <ol className="cmp-steps" aria-label="How it works">
          <li><AppIcon name="saved" size={16} /><span><b>1. Subjects</b>Checked against DU’s 2026 Bulletin rules</span></li>
          <li><AppIcon name="compass" size={16} /><span><b>2. Category and score</b>Real minimum allocation scores, Rounds I to III</span></li>
          <li><AppIcon name="progress" size={16} /><span><b>3. The gap</b>Compare the 2026 cutoff, college by college</span></li>
        </ol>
      </header>

      <div className="cmp-note" role="note">
        <StatusIcon kind="info" size={16} />
        <p>The calculator compares scores with published history. Compass Pro adds a projection from your own practice, labelled as such: it is not a prediction or a normalised CUET score. 2027 rules stay provisional until DU publishes them. Your choices are saved on this device.</p>
      </div>

      {user?.id ? <CompassPro userId={user.id} seedSubjects={seed} /> : null}
      {user?.id && !user?.isPremium ? <PracticeBridge userId={user.id} /> : null}

      <CutoffCalculator seedSubjects={seed} />

      <details className="cmp-sources">
        <summary>Official source documents</summary>
        <ul>{DU_SOURCES.map((s) => <li key={s.id}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> · {s.use}</li>)}</ul>
      </details>
    </main>
  );
}
