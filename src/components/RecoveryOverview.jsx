"use client";
// The recovery record behind /progress: concept checks and the exam playbook. The Review hub
// (src/app/(app)/review) replaced this component's old review view in the web IA work, so what was
// here for Review is gone; /progress itself moves into You (IA7), and this stays only for the
// parts of it that page still reads. Claims stay as before: reviewing an explanation is not evidence
// of understanding, and ordinary scores cannot certify a recovery episode.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/fetcher';
import ArenaHead, { ArenaStats } from './arena/ArenaHead';
import { AppIcon, StatusIcon } from './ui/Glyph';
import ArenaCompanion, { OneMobi } from './brand/ArenaCompanion';
import { useWaitStage } from '@/lib/mobiHooks';
import { oopsRun } from '@/lib/mobiRation';
import StudyProgress from './study/StudyProgress';

const label = (id = '') => id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function RecoveryOverview() {
  const [data, setData] = useState(null), [error, setError] = useState(''), [retryCount, setRetryCount] = useState(0);
  const [shrug, setShrug] = useState(false); // a failed read shrugs once per run, not on every retry
  const wait = useWaitStage(!data && !error);
  useEffect(() => { let alive = true; apiGet('/api/recovery').then((d) => { if (alive) setData(d); }).catch(() => { if (alive) { setError('Your record could not be loaded. Please try again.'); setShrug(oopsRun('record:progress')); } }); return () => { alive = false; }; }, [retryCount]);
  const retry = () => { setData(null); setError(''); setRetryCount((n) => n + 1); };
  const review = data?.ordinaryReview || [];
  const answered = review.reduce((s, a) => s + (a.total || 0), 0);
  const correct = review.reduce((s, a) => s + (a.correct || 0), 0);

  return (
    <section className="pr ov"><OneMobi>
      <ArenaHead title="Let fresh practice be your evidence." lede="Your saved sessions, your concept checks and your exam playbook. Repeats, assisted work and ordinary scores cannot certify a recovery episode." />

      {error ? <div className="pr-alert" data-tone="error" role="alert"><StatusIcon kind="error" /><div>{error} <button type="button" className="pr-link" onClick={retry}>Try again</button></div></div> : null}
      {!data && !error ? <div className="na__skeleton" role="status" aria-label="Loading your record"><i /><i /><i /></div> : null}
      {!data ? <ArenaCompanion compact act={error ? (shrug ? 'oops' : 'idle') : wait === 'long' ? 'loading' : 'idle'} pose={error ? 'encouraging' : 'attentive'} title={error ? 'Your record can wait a moment.' : 'Opening your saved record.'}>{error ? 'Try again when you are ready.' : 'Your sessions and checks will appear here.'}</ArenaCompanion> : null}
      {data?.milestones?.length ? <section className="ov-section" aria-label="Recorded milestones">{data.milestones.map((m) => <div key={m.kind}><b>{m.title}</b><p>{m.detail} <Link className="pr-link" href={m.href}>Open record</Link></p></div>)}</section> : null}

      {data ? (
        <>
          <ArenaStats label="Progress summary" items={[
            { icon: <AppIcon name="practice" size={15} />, label: 'Practice sessions', value: review.length },
            { icon: <AppIcon name="progress" size={15} />, label: 'Concept checks', value: data.progress.length },
            { icon: <AppIcon name="saved" size={15} />, label: 'Playbook entries', value: data.playbook.length },
            { icon: <AppIcon name="check" size={15} />, label: 'Answered right', value: answered ? `${Math.round((correct / answered) * 100)}%` : '—' },
          ]} />
          <StudyProgress />
          {data.progress.length ? (
            <section className="ov-section" aria-labelledby="ov-checks">
              <div className="pr-step__head"><h2 id="ov-checks">Concept checks</h2><span className="pr-hint">Fresh, delayed questions only</span></div>
              <ul className="ov-list">{data.progress.map((p) => (
                <li key={p.concept} className="ov-row"><b>{label(p.concept)}</b><span>{p.evidenceLabel}</span><span className="pr-badge">{p.sampleSize} delayed check{p.sampleSize === 1 ? '' : 's'}</span></li>
              ))}</ul>
            </section>
          ) : null}
          <section className="ov-section" aria-labelledby="ov-playbook">
            <div className="pr-step__head"><h2 id="ov-playbook">Your exam playbook</h2><span className="pr-hint">Strategies you saved from results</span></div>
            {data.playbook.length ? <ul className="ov-list">{data.playbook.map((p) => (
              <li key={p.id} className="ov-row"><b>{label(p.strategy)}</b><span>{p.reflection || 'No reflection yet'}</span><span className="pr-badge">Not yet checked</span></li>
            ))}</ul> : <div className="ov-empty"><AppIcon name="saved" size={22} /><b>Your playbook is empty</b><p>Save a strategy and your reasoning from a session result to start it.</p></div>}
          </section>
          {data.note ? <p className="na__note">{data.note}</p> : null}
        </>
      ) : null}
    </OneMobi></section>
  );
}
