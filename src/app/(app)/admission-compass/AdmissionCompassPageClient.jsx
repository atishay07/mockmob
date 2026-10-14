"use client";

// DU Compass: the student's subjects, a category and a score (or a what-if) against DU's own
// published eligibility rules and last year's cutoffs. The page opens already filled in from the
// student's profile. It never turns practice marks into an admission score or a chance; Compass Pro
// shows a clearly labelled practice projection beside, never instead of, the published history.
// Web redesign W2.4: the page head, the plain three-part guide and the one note that prevents a
// wrong impression. The calculator and Compass Pro keep their own files.
import Link from 'next/link';
import { CutoffCalculator } from '@/components/du/CutoffCalculator';
import CompassPro from '@/components/du/CompassPro';
import { DU_SOURCES } from '@/lib/du/sources';
import { useAuth } from '@/components/AuthProvider';
import { PageHead } from '@/components/ui/PageHead';
import { AppIcon, StatusIcon, SubjectIcon } from '@/components/ui/Glyph';
import { useInsights } from '@/components/ai/useInsights';
import './compass.css';

// Profile subject ids -> DU catalog ids (they match, except the aptitude test).
const toDuId = (id) => (id === 'general_test' ? 'gat' : id);

function PracticeBridge({ userId }) {
  const state = useInsights(userId);
  if (state.status !== 'ready') return null;
  const top = state.insights.chapters.ranked[0];
  if (!top) return null;
  return (
    <aside className="cmp-bridge cmpx-bridge" aria-label="From your practice">
      <span className="cmp-bridge__icon"><SubjectIcon id={top.subject} size={20} /></span>
      <div>
        <b>From your practice: {top.chapter}</b>
        <p>{top.subjectName} has the most marks open in your record: {top.right} right, {top.wrong} wrong and {top.skip} blank over {top.n} questions. Cutoffs are history; the subjects you practice are the part you control.</p>
        <Link href={`/dashboard?subject=${encodeURIComponent(top.subject)}&mode=quick`}>Practice {top.subjectName}</Link>
      </div>
    </aside>
  );
}

const GUIDE = [
  { icon: 'saved', title: 'Your subjects', detail: 'Checked against the eligibility rules in DU’s 2026 bulletin' },
  { icon: 'compass', title: 'Your category and score', detail: 'Compared with the published minimum scores, rounds I to III' },
  { icon: 'progress', title: 'The gap', detail: 'College by college, against the 2026 cutoff' },
];

export default function AdmissionCompassPageClient() {
  const { user } = useAuth();
  const seed = (user?.subjects || []).map(toDuId);
  return (
    <main className="cmp cmpx">
      <div className="cmpx-head">
        <PageHead
          title="DU Compass"
          lead={seed.length > 0
            ? 'Which DU courses your subjects can get you into. Your subjects are already ticked below. Add a category and a score, or try a what-if.'
            : 'Which DU courses your subjects can get you into. Tick your CUET subjects, then compare published cutoffs by category and round.'}
        />
        <ul className="cmpx-guide" aria-label="What Compass checks">
          {GUIDE.map((g) => (
            <li key={g.title}><AppIcon name={g.icon} size={18} /><span><b>{g.title}</b>{g.detail}</span></li>
          ))}
        </ul>
      </div>

      <p className="cmpx-note" role="note">
        <StatusIcon kind="info" size={16} />
        <span>Cutoffs here are DU’s published 2026 history, not a prediction. Rules for 2027 stay provisional until DU publishes them. Your choices are saved on this device.</span>
      </p>

      {user?.id ? <CompassPro userId={user.id} seedSubjects={seed} /> : null}
      {user?.id && !user?.isPremium ? <PracticeBridge userId={user.id} /> : null}

      <CutoffCalculator seedSubjects={seed} />

      <details className="cmp-sources cmpx-sources">
        <summary>Official source documents</summary>
        <ul>
          {DU_SOURCES.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
              <span>Used for {s.use.charAt(0).toLowerCase() + s.use.slice(1)}</span>
            </li>
          ))}
        </ul>
      </details>
    </main>
  );
}
