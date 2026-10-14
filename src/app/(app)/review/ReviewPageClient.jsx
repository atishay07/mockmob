"use client";

// Review (web redesign W2.4). The job: see what you missed, open it, repair it.
// One record thread (Found, Repaired, Checked, Holds; owner decision D9) is the one lit object;
// the dominant action opens the newest session that still has something to look at. Repairs
// happen on the result page, where the explanation lives; this page never claims a repair the
// server has not stored. Data: /api/recovery (saved sessions) and /api/me/repair-record (repairs).
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/fetcher';
import { PageHead } from '@/components/ui/PageHead';
import { Surface } from '@/components/ui/Card';
import { EmptyState, ErrorState, OfflineState } from '@/components/ui/Skeleton';
import StudyProgress from '@/components/study/StudyProgress';
import { recordTotals, repairLines, sessionsFrom, stageThread, threadCaption, plural, pageState } from './reviewModel.mjs';
import { RecordRow, RecordSection, RecordSkeleton, SessionList, StageThread, looksOffline } from './RecordParts';

const REPAIR_LIMIT = 100;

export default function ReviewPageClient() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [repairs, setRepairs] = useState(undefined); // undefined loading, null failed, [] rows
  const [attempt, setAttempt] = useState(0);
  const [repairAttempt, setRepairAttempt] = useState(0);
  const [showAllRepairs, setShowAllRepairs] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    apiGet('/api/recovery')
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive) setError({ offline: looksOffline(e) }); });
    return () => { alive = false; };
  }, [attempt]);

  useEffect(() => {
    let alive = true;
    apiGet(`/api/me/repair-record?limit=${REPAIR_LIMIT}`)
      .then((d) => { if (alive) setRepairs(Array.isArray(d?.repairs) ? d.repairs : null); })
      .catch(() => { if (alive) setRepairs(null); });
    return () => { alive = false; };
  }, [repairAttempt]);

  const retry = useCallback(() => { setError(null); setData(null); setAttempt((n) => n + 1); }, []);
  const retryRepairs = useCallback(() => { setRepairs(undefined); setRepairAttempt((n) => n + 1); }, []);

  const sessions = useMemo(() => sessionsFrom(data?.ordinaryReview), [data]);
  const totals = useMemo(() => recordTotals(sessions), [sessions]);
  const thread = useMemo(() => stageThread({ totals, repairs, repairLimit: REPAIR_LIMIT }), [totals, repairs]);
  const state = pageState({ data, error, offline: error?.offline });
  const nextOpen = sessions.find((s) => s.open > 0);

  const head = (
    <PageHead
      title="Review"
      lead="Every question you miss or leave blank lands here. Open the session to repair it with an explanation, then fresh questions check that it holds."
    />
  );

  if (state === 'loading') return <div className="rv-page">{head}<RecordSkeleton label="Loading your mistakes" /></div>;
  if (state === 'offline') return <div className="rv-page">{head}<OfflineState message="Your mistakes load again once you are back online. Nothing is lost." onRetry={retry} /></div>;
  if (state === 'error') return <div className="rv-page">{head}<ErrorState title="Your mistakes did not load" message="Your saved sessions are safe. Try again in a moment." onRetry={retry} /></div>;

  if (!sessions.length) {
    return (
      <div className="rv-page">
        {head}
        <EmptyState
          title="Your mistakes gather here"
          message="Finish a mock or a practice and every question you miss lands here, ready to repair."
          actionLabel="Start practice"
          onAction={() => router.push('/dashboard')}
        />
        <StudyProgress review />
      </div>
    );
  }

  const repairRows = Array.isArray(repairs) ? repairs : [];
  const shownRepairs = showAllRepairs ? repairRows : repairRows.slice(0, 5);

  return (
    <div className="rv-page">
      {head}

      <Surface level="focal" className="rv-focal">
        <StageThread thread={thread} caption={threadCaption(thread)} />
        <div className="rv-focal__action">
          {nextOpen ? (
            <>
              <Link className="ui-btn ui-btn--primary btn-volt" href={`/result/${encodeURIComponent(nextOpen.id)}`}>
                <span className="ui-btn__label">Open your latest misses</span>
              </Link>
              <p>{plural(nextOpen.open, 'question')} to look at from your newest session with misses.</p>
            </>
          ) : (
            <>
              <Link className="ui-btn ui-btn--primary btn-volt" href="/dashboard">
                <span className="ui-btn__label">Start practice</span>
              </Link>
              <p>Nothing is waiting. A short session finds the next mistake worth repairing.</p>
            </>
          )}
        </div>
      </Surface>

      <RecordSection id="rv-sessions" title="Your sessions" hint={`${plural(totals.sessions, 'session')}, newest first. Open one to see every answer with its explanation.`}>
        <SessionList sessions={sessions} now={now} />
      </RecordSection>

      <RecordSection id="rv-repairs" title="Repair record" hint="Each repair with when it was found and when it was repaired.">
        {repairs === undefined ? <RecordSkeleton label="Loading your repair record" rows={2} thread={false} /> : null}
        {repairs === null ? (
          <div className="rv-inline" role="status">
            <p>Your repair record did not load. Your sessions above are unaffected.</p>
            <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={retryRepairs}><span className="ui-btn__label">Try again</span></button>
          </div>
        ) : null}
        {Array.isArray(repairs) && repairs.length === 0 ? (
          <p className="rv-quiet">Nothing repaired yet. Open a session, choose a wrong answer and repair it. It shows here with when it was found and when it was repaired.</p>
        ) : null}
        {shownRepairs.length ? (
          <ul className="rv-items">
            {shownRepairs.map((row) => {
              const r = repairLines(row, now);
              return <RecordRow key={`${row.attemptId}-${row.questionId}`} title={r.title} lines={row.checkedState === 'not_available' ? [`${r.found} ${r.repaired}`] : [`${r.found} ${r.repaired}`, r.checked]} tag={r.stage === 'checked' ? 'Checked' : 'Repaired'} tone={r.stage === 'checked' ? 'good' : 'done'} />;
            })}
          </ul>
        ) : null}
        {repairRows.length > 5 ? (
          <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm rv-more" aria-expanded={showAllRepairs} onClick={() => setShowAllRepairs((v) => !v)}>
            <span className="ui-btn__label">{showAllRepairs ? 'Show fewer repairs' : `Show all ${plural(repairRows.length, 'repair')}`}</span>
          </button>
        ) : null}
      </RecordSection>

      <StudyProgress review />
    </div>
  );
}
