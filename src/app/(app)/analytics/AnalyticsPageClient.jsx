"use client";

// Weak chapters (Radar): where the student's marks are going. The record view (ledger, leaks,
// chapters, changed answers, pace, week on week) is the same free, model-free analysis that Ask
// uses, so the two never disagree. Beside it, the score by session as plain bars (no chart
// library: it themes with the tokens and costs nothing on a budget phone) and the subjects.
// No invented composite scores; every figure names its sample. Web redesign W2.4.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/fetcher';
import { PageHead } from '@/components/ui/PageHead';
import { EmptyState, ErrorState, OfflineState } from '@/components/ui/Skeleton';
import RecordView from '@/components/ai/RecordView';
import { useInsights } from '@/components/ai/useInsights';
import { useAuth } from '@/components/AuthProvider';
import { AppIcon, StatusIcon, SubjectIcon } from '@/components/ui/Glyph';
import { RecordSkeleton, looksOffline } from '../review/RecordParts';
import { radarLead, radarStage, subjectLine, trendBars, trendCaption } from './radarModel.mjs';
import './radar.css';

function ScoreBars({ timeline, now }) {
  const bars = trendBars(timeline, { now });
  if (bars.length < 2) return <p className="rdr-quiet">{trendCaption(timeline)}</p>;
  return (
    <figure className="rdr-trend">
      <ol className="rdr-bars" aria-label="Score by session, oldest first">
        {bars.map((b) => (
          <li key={b.key} data-latest={b.latest ? 'true' : undefined} style={{ '--rdr-h': `${b.height}%` }}>
            <span className="rdr-bar" aria-hidden="true" title={`${b.label}: ${b.score}%`} />
            {b.latest ? <span className="rdr-bar__value" aria-hidden="true">{b.score}%</span> : null}
            <span className="sr-only">{b.label}: {b.score}%</span>
          </li>
        ))}
      </ol>
      <figcaption>{trendCaption(timeline)}</figcaption>
    </figure>
  );
}

export default function AnalyticsPageClient() {
  const router = useRouter();
  const { user, status: authStatus } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [now] = useState(() => Date.now());
  const record = useInsights(user?.id);
  const pro = Boolean(user?.isPremium);

  useEffect(() => {
    if (authStatus === 'loading' || !user?.id) return undefined;
    let alive = true;
    apiGet(`/api/analytics?userId=${encodeURIComponent(user.id)}`)
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive) setError({ offline: looksOffline(e) }); });
    return () => { alive = false; };
  }, [user, authStatus, retryCount]);

  const totals = data?.totals;
  const questions = totals ? (totals.correct || 0) + (totals.wrong || 0) + (totals.unattempted || 0) : 0;
  const sessions = data?.totalAttempts || 0;
  const stage = radarStage(sessions);
  const lead = useMemo(() => radarLead({ totalAttempts: sessions, questions, device: data?.scoring?.device || 0 }), [sessions, questions, data]);
  const retry = () => { setData(null); setError(null); setRetryCount((n) => n + 1); };

  const head = (
    <PageHead
      title="Weak chapters"
      lead={lead}
      actions={stage === 'cold' ? null : (
        <Link href="/mentor?tab=ask" className="ui-btn ui-btn--secondary btn-outline ui-btn--sm">
          <AppIcon name="prepos" size={18} /><span className="ui-btn__label">Ask about your record</span>
        </Link>
      )}
    />
  );

  if (error) {
    return (
      <div className="rdr">
        {head}
        {error.offline
          ? <OfflineState message="Your weak chapters load again once you are back online." onRetry={retry} />
          : <ErrorState title="Your record did not load" message="Your sessions are safe. Try again in a moment." onRetry={retry} />}
      </div>
    );
  }
  if (authStatus === 'loading' || !data) return <div className="rdr">{head}<RecordSkeleton label="Loading your weak chapters" rows={4} /></div>;

  if (stage === 'cold') {
    return (
      <div className="rdr">
        {head}
        <EmptyState
          title="Weak chapters show after your first session"
          message="Radar needs real answers to read. Finish one practice session and it starts showing where marks are being lost."
          actionLabel="Start practice"
          onAction={() => router.push('/dashboard')}
        />
      </div>
    );
  }

  const subjects = Array.isArray(data.subjects) ? data.subjects : [];

  return (
    <div className="rdr">
      {head}
      {stage === 'thin' ? (
        <p className="rdr-thin" role="note">
          <StatusIcon kind="info" size={16} />
          <span>{sessions === 1 ? 'One session is a start, not a pattern.' : 'Two sessions are a start, not a pattern.'} Chapters firm up after a few more sessions.</span>
        </p>
      ) : null}

      <div className="rdr-cols">
        <div className="pp-arena rdr-main">
          <RecordView state={record} pro={pro} onNavigate={(href) => router.push(href)} />
        </div>

        <aside className="rdr-side" aria-label="Scores and subjects">
          <section className="rdr-block" aria-labelledby="rdr-trend">
            <h2 id="rdr-trend">Score by session</h2>
            <ScoreBars timeline={data.timeline} now={now} />
          </section>

          {subjects.length > 0 ? (
            <section className="rdr-block" aria-labelledby="rdr-subjects">
              <h2 id="rdr-subjects">By subject</h2>
              <ul className="rdr-subjects">
                {subjects.map((s) => (
                  <li key={s.id}>
                    <span className="rdr-subjects__icon" aria-hidden="true"><SubjectIcon id={s.id} size={18} /></span>
                    <span className="rdr-subjects__name"><b>{s.name}</b><span>{subjectLine(s)}</span></span>
                    <span className="rdr-subjects__acc"><b>{s.accuracy}%</b><span>right</span></span>
                  </li>
                ))}
              </ul>
              <Link href="/admission-compass" className="rdr-link"><AppIcon name="compass" size={16} />See which DU courses these subjects open</Link>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
