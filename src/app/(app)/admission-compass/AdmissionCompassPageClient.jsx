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
import FirstTime from '@/components/arena/FirstTime';
import './compass.css';

// The CUET tools that answer the questions around this one (W-050): which subjects to put on the form, the real past
// papers, and a full mock for a score of your own. Plain links in one ruled row; none is a second primary.
const TOOLS = [
  { href: '/cuet-subject-combination', title: 'Plan your subjects', short: 'Plan subjects', line: 'Combo Planner: the CUET subjects that open the courses you want' },
  { href: '/cuet-previous-year-questions', title: 'Past CUET papers', short: 'Past papers', line: 'Real questions from earlier years, by subject' },
  { href: '/dashboard?mode=full', title: 'Get a score of your own', short: 'Get a score', line: 'A full mock gives Compass a practice score to set beside the cutoffs' },
];

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
  const pro = Boolean(user?.id && user?.isPremium);
  return (
    <main className="cmp">
      <header className="cmp-head">
        <div>
          {/* One name for this place everywhere (W-067): the dock, the sidebar, the More sheet and the app call it Colleges. */}
          <h1 className="display-md">Colleges</h1>
          <p className="cmp-lede">
            {seed.length > 0
              ? 'Your subjects are ticked. A score is optional: see every course they open, with 2026 cutoffs.'
              : 'Tick your CUET subjects. A score is optional: see every course they open, with 2026 cutoffs.'}
          </p>
        </div>
      </header>

      {user?.id ? <FirstTime id="compass">Open a course for its colleges and 2026 cutoffs, then Add to my colleges. The first shows on Today.</FirstTime> : null}

      <nav className="cmp-tools" aria-label="CUET tools">
        <ul>
          {TOOLS.map((t) => (
            <li key={t.href}><Link href={t.href} aria-label={`${t.title}. ${t.line}`}><b data-short={t.short}>{t.title}</b><span>{t.line}</span></Link></li>
          ))}
        </ul>
      </nav>

      {/* The Pro page is long: one row of in-page jumps to its three parts. */}
      {pro ? (
        <nav className="cmp-jump" aria-label="On this page">
          <a href="#cmp-pro">Your projection</a><a href="#cmp-courses">Courses and cutoffs</a><a href="#cmp-sources">Sources</a>
        </nav>
      ) : null}

      {/* The tool comes first. Pro students get their projection and colleges above it; everyone else gets one
          quiet line about Compass Pro after the results (CompassPro renders the locked row). */}
      {pro ? <div id="cmp-pro" className="cmp-anchor"><CompassPro userId={user.id} seedSubjects={seed} /></div> : null}

      <div id="cmp-courses" className="cmp-anchor"><CutoffCalculator seedSubjects={seed} /></div>

      {user?.id && !user?.isPremium ? <PracticeBridge userId={user.id} /> : null}
      {user?.id && !user?.isPremium ? <CompassPro userId={user.id} seedSubjects={seed} /> : null}

      <div id="cmp-sources" className="cmp-anchor">
        <SmoothDetails className="cmp-sources" chevron summary="Official source documents">
          <ul>{DU_SOURCES.map((s) => <li key={s.id}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>. {s.use}</li>)}</ul>
        </SmoothDetails>
      </div>

    </main>
  );
}
