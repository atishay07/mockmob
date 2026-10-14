"use client";

// Progress (web redesign W2.4). The job: see what the record says so far, without being told a
// score went up because of anything. Marks come from sessions; whether an idea holds comes only
// from fresh questions later, so the page keeps the two apart and says when there is too little to
// judge. Data: /api/recovery. Shared pieces and wording: ../review.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/fetcher';
import { PageHead } from '@/components/ui/PageHead';
import { EmptyState, ErrorState, OfflineState } from '@/components/ui/Skeleton';
import LearningNextAction from '@/components/LearningNextAction';
import StudyProgress from '@/components/study/StudyProgress';
import { checkRow, evidenceNote, pageState, plural, recordTotals, rightLine, sessionsFrom, shortDate, strategyName } from '../review/reviewModel.mjs';
import { RecordRow, RecordSection, RecordSkeleton, looksOffline } from '../review/RecordParts';

export default function ProgressPageClient() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    apiGet('/api/recovery')
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive) setError({ offline: looksOffline(e) }); });
    return () => { alive = false; };
  }, [attempt]);
  const retry = useCallback(() => { setError(null); setData(null); setAttempt((n) => n + 1); }, []);

  const totals = useMemo(() => recordTotals(sessionsFrom(data?.ordinaryReview)), [data]);
  const state = pageState({ data, error, offline: error?.offline });

  const head = <PageHead title="Progress" lead="What your practice has recorded so far. Marks come from your sessions. Whether an idea holds comes only from fresh questions later." />;

  if (state === 'loading') return <div className="rv-page">{head}<RecordSkeleton label="Loading your progress" thread={false} rows={5} /></div>;
  if (state === 'offline') return <div className="rv-page">{head}<OfflineState message="Your progress loads again once you are back online. Nothing is lost." onRetry={retry} /></div>;
  if (state === 'error') return <div className="rv-page">{head}<ErrorState title="Your progress did not load" message="Your saved sessions are safe. Try again in a moment." onRetry={retry} /></div>;

  const checks = (Array.isArray(data.progress) ? data.progress : []).filter((p) => Number(p?.sampleSize) > 0);
  const playbook = Array.isArray(data.playbook) ? data.playbook : [];
  const milestones = Array.isArray(data.milestones) ? data.milestones : [];
  const right = rightLine(totals);
  const note = evidenceNote(data);

  if (totals.sessions === 0 && !checks.length && !playbook.length) {
    return (
      <div className="rv-page">
        {head}
        <EmptyState
          title="Your record starts with one session"
          message="Finish a practice session and this page shows what you answered, what you missed and what to do next."
          actionLabel="Start practice"
          onAction={() => router.push('/dashboard')}
        />
        <StudyProgress />
      </div>
    );
  }

  return (
    <div className="rv-page">
      {head}

      <dl className="rv-facts" aria-label="Your record so far">
        <div><dt>Sessions saved</dt><dd>{totals.sessions}</dd><dd>{totals.lastAt ? `Last on ${shortDate(totals.lastAt, now)}` : 'None yet'}</dd></div>
        <div><dt>Answered right</dt><dd>{right.value}</dd><dd>{right.detail}</dd></div>
        <div><dt>Fresh checks</dt><dd>{checks.length}</dd><dd>{checks.length ? 'Concepts tested on unseen questions' : 'None yet'}</dd></div>
        <div><dt>Playbook</dt><dd>{playbook.length}</dd><dd>{playbook.length ? 'Strategies you saved' : 'Nothing saved yet'}</dd></div>
      </dl>

      <LearningNextAction compact />

      {milestones.length ? (
        <RecordSection id="pg-milestones" title="Recorded so far">
          <ul className="rv-items">
            {milestones.map((m) => (
              <li key={m.kind} className="rv-item">
                <div className="rv-item__main"><b>{m.title}</b><span>{m.detail}</span></div>
                {m.href ? <Link className="ui-btn ui-btn--quiet ui-btn--sm" href={m.href}><span className="ui-btn__label">Open</span></Link> : null}
              </li>
            ))}
          </ul>
        </RecordSection>
      ) : null}

      <StudyProgress />

      <RecordSection id="pg-checks" title="Fresh checks" hint="Concepts tested again on questions you had not seen. Repeats and assisted answers do not count.">
        {checks.length ? (
          <ul className="rv-items">
            {checks.map((p) => { const r = checkRow(p); return <RecordRow key={`${p.concept}-${r.tag}`} title={r.title} lines={[r.detail]} tag={r.tag} />; })}
          </ul>
        ) : (
          <p className="rv-quiet">No fresh checks yet. When a concept you practiced comes back on a question you have not seen, the result shows here.</p>
        )}
      </RecordSection>

      <RecordSection id="pg-playbook" title="Your exam playbook" hint="Strategies you saved from a result, with your own reasoning.">
        {playbook.length ? (
          <ul className="rv-items">
            {playbook.map((p) => <RecordRow key={p.id} title={strategyName(p.strategy)} lines={[p.reflection || 'No reflection written']} tag="Needs more sessions to judge" />)}
          </ul>
        ) : (
          <p className="rv-quiet">Your playbook is empty. On a session result, save the strategy you want to try next and why.</p>
        )}
      </RecordSection>

      {note ? <p className="rv-footnote">{note}</p> : null}
      {totals.found > 0 ? <p className="rv-footnote">{plural(totals.found, 'question')} missed or left blank across your sessions. <Link href="/review">Open them in Review</Link></p> : null}
    </div>
  );
}
