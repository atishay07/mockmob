"use client";
// Review and Progress: the student's saved sessions and recovery evidence, in the same Arena
// language as Practice. Claims stay as before: reviewing an explanation is not evidence of
// understanding, and ordinary scores cannot certify a recovery episode.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/fetcher';
import { ArrowRight } from 'lucide-react';
import LearningNextAction from './LearningNextAction';
import ArenaHead, { ArenaStats } from './arena/ArenaHead';
import { AppIcon, StatusIcon, SubjectIcon } from './ui/Glyph';
import ArenaCompanion from './brand/ArenaCompanion';

const label = (id = '') => id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const when = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

function SessionCard({ a }) {
  const pct = a.total ? Math.round((a.correct / a.total) * 100) : 0;
  return (
    <li>
      <Link className="ov-session" href={`/result/${a.id}`}>
        <span className="ov-session__icon"><SubjectIcon id={a.subject} size={20} /></span>
        <span className="ov-session__main">
          <b>{label(a.subject)}</b>
          <span>{when(a.completedAt)}{when(a.completedAt) ? ' · ' : ''}{a.correct}/{a.total} correct</span>
          <i className="ov-bar" aria-hidden="true"><em style={{ transform: `scaleX(${pct / 100})` }} /></i>
        </span>
        <span className="ov-session__side">
          {a.mistakes > 0 ? <span className="pr-badge" data-tone="mid">{a.mistakes} to review</span> : <span className="pr-badge" data-tone="good">All correct</span>}
          <ArrowRight size={18} aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}

export default function RecoveryOverview({ view }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [retryCount, setRetryCount] = useState(0);
  useEffect(() => { let alive = true; apiGet('/api/recovery').then(d => { if (alive) setData(d); }).catch(() => { if (alive) setError('Your recovery record could not be loaded. Please try again.'); }); return () => { alive = false; }; }, [retryCount]);
  const retry = () => { setData(null); setError(''); setRetryCount(n => n + 1); };
  const review = data?.ordinaryReview || [];
  const toReview = review.reduce((s, a) => s + (a.mistakes || 0), 0);
  const answered = review.reduce((s, a) => s + (a.total || 0), 0);
  const correct = review.reduce((s, a) => s + (a.correct || 0), 0);

  return (
    <section className="pr ov">
      {view === 'review' ? (
        <ArenaHead eyebrow="Review" title="Review what mattered." lede="Open a session to read the explanation for every question you missed or left blank. Reading an explanation is review, not proof you have fixed it." />
      ) : (
        <ArenaHead eyebrow="Progress" title="Let fresh practice be your evidence." lede="Your saved sessions, your recovery checks and your exam playbook. Repeats, assisted work and ordinary scores cannot certify a recovery episode." />
      )}

      {error ? <div className="pr-alert" data-tone="error" role="alert"><StatusIcon kind="error" /><div>{error} <button type="button" className="pr-link" onClick={retry}>Try again</button></div></div> : null}
      {!data && !error ? <div className="na__skeleton" role="status" aria-label="Loading your record"><i /><i /><i /></div> : null}
      {!data ? <ArenaCompanion compact pose={error ? 'encouraging' : 'attentive'} title={error ? 'Your record can wait a moment.' : 'Opening your saved record.'}>{error ? 'Try again when you are ready.' : 'Your sessions and checks will appear here.'}</ArenaCompanion> : null}
      {data && review.length > 0 ? <ArenaCompanion compact pose="attentive" title="Practice, recorded.">Your saved sessions are ready to revisit. A recorded session is a step taken, not proof of mastery.</ArenaCompanion> : null}
      {data?.milestones?.length ? <section className="ov-section" aria-label="Recorded milestones">{data.milestones.map(m => <div key={m.kind}><b>{m.title}</b><p>{m.detail} <Link className="pr-link" href={m.href}>Open record</Link></p></div>)}</section> : null}

      {data && view === 'review' ? (
        <>
          <ArenaStats label="Review summary" items={[
            { icon: <AppIcon name="practice" size={15} />, label: 'Sessions saved', value: review.length },
            { icon: <AppIcon name="review" size={15} />, label: 'Questions to review', value: toReview },
            { icon: <AppIcon name="check" size={15} />, label: 'Answered right', value: answered ? `${Math.round((correct / answered) * 100)}%` : '—' },
            { icon: <AppIcon name="clock" size={15} />, label: 'Last session', value: when(review[0]?.completedAt) || '—' },
          ]} />
          <LearningNextAction compact />
          {data.reviewState === 'unavailable' ? <div className="pr-alert" data-tone="warning" role="status"><StatusIcon kind="warning" />The review queue is being prepared. Your saved attempts remain available.</div> : null}
          <section className="ov-section" aria-labelledby="ov-sessions">
            <div className="pr-step__head"><h2 id="ov-sessions">Your sessions</h2><span className="pr-hint">Newest first</span></div>
            {review.length ? <ul className="ov-list">{review.map(a => <SessionCard key={a.id} a={a} />)}</ul> : (
              <div className="ov-empty"><ArenaCompanion pose="attentive" title="Nothing to review yet">Finish a practice session and every miss lands here with its explanation.</ArenaCompanion><Link className="btn-volt md" href="/dashboard">Choose practice<ArrowRight size={16} aria-hidden="true" /></Link></div>
            )}
          </section>
        </>
      ) : null}

      {data && view === 'progress' ? (
        <>
          <ArenaStats label="Progress summary" items={[
            { icon: <AppIcon name="practice" size={15} />, label: 'Practice sessions', value: review.length },
            { icon: <AppIcon name="progress" size={15} />, label: 'Concept checks', value: data.progress.length },
            { icon: <AppIcon name="saved" size={15} />, label: 'Playbook entries', value: data.playbook.length },
            { icon: <AppIcon name="check" size={15} />, label: 'Answered right', value: answered ? `${Math.round((correct / answered) * 100)}%` : '—' },
          ]} />
          <LearningNextAction compact />
          <section className="ov-section" aria-labelledby="ov-checks">
            <div className="pr-step__head"><h2 id="ov-checks">Concept checks</h2><span className="pr-hint">Fresh, delayed questions only</span></div>
            {data.progress.length ? <ul className="ov-list">{data.progress.map(p => (
              <li key={p.concept} className="ov-row"><b>{label(p.concept)}</b><span>{p.evidenceLabel}</span><span className="pr-badge">{p.sampleSize} delayed check{p.sampleSize === 1 ? '' : 's'}</span></li>
            ))}</ul> : <div className="ov-empty"><AppIcon name="progress" size={22} /><b>No completed recovery checks yet</b><p>Ordinary practice is ready while recovery sources and calibration are being prepared.</p></div>}
          </section>
          <section className="ov-section" aria-labelledby="ov-playbook">
            <div className="pr-step__head"><h2 id="ov-playbook">Your exam playbook</h2><span className="pr-hint">Strategies you saved from results</span></div>
            {data.playbook.length ? <ul className="ov-list">{data.playbook.map(p => (
              <li key={p.id} className="ov-row"><b>{label(p.strategy)}</b><span>{p.reflection || 'No reflection yet'}</span><span className="pr-badge">Awaiting repeated evidence</span></li>
            ))}</ul> : <div className="ov-empty"><AppIcon name="saved" size={22} /><b>Your playbook is empty</b><p>Save a strategy and your reasoning from a session result to start it.</p></div>}
          </section>
          {data.note ? <p className="na__note">{data.note}</p> : null}
        </>
      ) : null}
    </section>
  );
}
