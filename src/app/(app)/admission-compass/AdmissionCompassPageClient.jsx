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
import { SubjectObject } from '@/components/brand/SubjectObject';
import { useInsights } from '@/components/ai/useInsights';
import { SmoothDetails } from '@/components/ui/controls/SmoothDetails';
import './compass.css';

// Profile subject ids -> DU catalog ids (they match, except the aptitude test).
const toDuId = (id) => (id === 'general_test' ? 'gat' : id);

function PracticeBridge({ userId }) {
  const state = useInsights(userId);
  if (state.status !== 'ready') return null;
  const top = state.insights.chapters.ranked[0];
  if (!top) return null;
  return (
    <aside className="cmp-bridge" aria-label="From your practice">
      <span className="cmp-bridge__obj" aria-hidden="true"><SubjectObject id={top.subject} size={56} framed={false} /></span>
      <div>
        <b>Most marks open: {top.subjectName}</b>
        <p>Cutoffs are history, but the subjects you drill are the ones you control. <Link href="/analytics">See the chapters on Weak chapters</Link></p>
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
          <h1 className="display-md">Which DU courses can your subjects get?</h1>
          <p>
            {seed.length > 0
              ? 'Your subjects are already ticked below. Add your category and a score to see which programmes your subjects open under DU’s 2026 rules, and the 2026 cutoff college by college.'
              : 'Tick your CUET subjects, then add your category and a score to see which programmes they open under DU’s 2026 rules, and the 2026 cutoff college by college.'}
          </p>
        </div>
      </header>

      {/* The tool comes first. Pro students get their projection and colleges above it; everyone else gets one
          quiet line about Compass Pro after the results (CompassPro renders the locked row). */}
      {user?.id && user?.isPremium ? <CompassPro userId={user.id} seedSubjects={seed} /> : null}

      <CutoffCalculator seedSubjects={seed} />

      {user?.id && !user?.isPremium ? <PracticeBridge userId={user.id} /> : null}
      {user?.id && !user?.isPremium ? <CompassPro userId={user.id} seedSubjects={seed} /> : null}

      <SmoothDetails className="cmp-sources" chevron summary="Official source documents">
        <ul>{DU_SOURCES.map((s) => <li key={s.id}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>. {s.use}</li>)}</ul>
      </SmoothDetails>
    </main>
  );
}
