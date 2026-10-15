"use client";
// Review and Progress: the student's saved sessions and recovery evidence, in the same Arena
// language as Practice. Claims stay as before: reviewing an explanation is not evidence of
// understanding, and ordinary scores cannot certify a recovery episode.
import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/fetcher';
import { ArrowRight } from 'lucide-react';
import LearningNextAction from './LearningNextAction';
import ArenaHead, { ArenaStats } from './arena/ArenaHead';
import { AppIcon, StatusIcon } from './ui/Glyph';
import { SubjectObject } from './brand/SubjectObject';
import ArenaCompanion, { OneMobi } from './brand/ArenaCompanion';
import SceneVignette from './scenes/SceneVignette';
import { useWaitStage } from '@/lib/mobiHooks';
import { oopsRun } from '@/lib/mobiRation';
import StudyProgress from './study/StudyProgress';
import { reviewChanges } from './recovery/reviewChanges';
import './recovery/review-changes.css';

// Counts in words up to ten, the way the app says them ("Two sessions saved.").
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const count = (n, word) => `${n <= 10 ? WORDS[n] : n} ${word}${n === 1 ? '' : 's'}`;
// Milestones the record names, said plainly; anything new falls back to the record's own words.
const MILESTONES = {
  first_session: { title: 'Your first session is on the record.', link: 'Open it' },
  first_fresh_check: { title: 'A fresh delayed check passed.', link: 'See the check' },
};
const label = (id = '') => id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const when = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const reducedMotion = () => {
  try { return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
};
// Rolls from the count at the last look to the count now, once. Reduced motion shows the new number at once.
function RollNumber({ from, to }) {
  const [shown, setShown] = useState(from === to || reducedMotion() ? to : from);
  useEffect(() => {
    if (from === to || reducedMotion()) return undefined;
    let raf; let start;
    const step = (t) => { start ??= t; const p = Math.min((t - start) / 700, 1); setShown(Math.round(from + (to - from) * (1 - (1 - p) ** 3))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to]);
  return <span className="ov-roll">{shown}</span>;
}

function SessionCard({ a, fresh = false, index = 0 }) {
  const pct = a.total ? Math.round((a.correct / a.total) * 100) : 0;
  return (
    <li data-fresh={fresh || undefined} style={fresh ? { '--ov-i': index } : undefined}>
      <Link className="ov-session" href={`/result/${a.id}`}>
        <span className="ov-session__icon ov-session__icon--obj" aria-hidden="true"><SubjectObject id={a.subject} size={68} framed={false} /></span>
        <span className="ov-session__main">
          <b>{label(a.subject)}{fresh ? <> <span className="ov-new">New since your last look</span></> : null}</b>
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
  const [changes, setChanges] = useState(null);
  const [shrug, setShrug] = useState(false); // a failed read shrugs once per run, not on every retry
  const wait = useWaitStage(!data && !error);
  useEffect(() => { let alive = true; apiGet('/api/recovery').then(d => { if (!alive) return; if (view === 'review') { let storage = null; try { storage = window.localStorage; } catch { storage = null; } setChanges(reviewChanges(d?.ordinaryReview || [], storage)); } setData(d); }).catch(() => { if (alive) { setError('Your recovery record could not be loaded. Please try again.'); setShrug(oopsRun(`record:${view}`)); } }); return () => { alive = false; }; }, [retryCount, view]);
  const retry = () => { setData(null); setError(''); setRetryCount(n => n + 1); };
  const review = data?.ordinaryReview || [];
  const toReview = review.reduce((s, a) => s + (a.mistakes || 0), 0);
  const answered = review.reduce((s, a) => s + (a.total || 0), 0);
  const correct = review.reduce((s, a) => s + (a.correct || 0), 0);
  // "Your first session is on the record." is true only while there is one. With more saved, the same
  // card points at the newest instead, so it never argues with Mobi's count above it.
  const newest = review[0] || null;
  const milestoneLine = (m) => {
    if (m.kind === 'first_session' && review.length > 1 && newest) {
      return { title: `Newest: ${[label(newest.subject), when(newest.completedAt)].filter(Boolean).join(', ')}`, detail: null, link: 'Open it', href: `/result/${newest.id}` };
    }
    const said = MILESTONES[m.kind];
    return { title: said?.title || m.title, detail: said ? null : m.detail, link: said?.link || 'Open record', href: m.href };
  };

  const Mobis = view === 'progress' ? OneMobi : Fragment;
  return (
    <section className="pr ov"><Mobis>
      {view === 'review' ? (
        <ArenaHead eyebrow="Review" title="Review what mattered." lede="Open a session to see why each miss happened." />
      ) : (
        <ArenaHead eyebrow="Progress" title="Let fresh practice be your evidence." lede="Your saved sessions, your recovery checks and your exam playbook, in one place." />
      )}

      {error ? <div className="pr-alert" data-tone="error" role="alert"><StatusIcon kind="error" /><div>{error} <button type="button" className="pr-link" onClick={retry}>Try again</button></div></div> : null}
      {!data && !error ? <div className="na__skeleton" role="status" aria-label="Loading your record"><i /><i /><i /></div> : null}
      {!data ? <ArenaCompanion compact act={error ? (shrug ? 'oops' : 'idle') : wait === 'long' ? 'loading' : 'idle'} pose={error ? 'encouraging' : 'attentive'} title={error ? 'Your record can wait a moment.' : 'Opening your saved record.'}>{error ? 'Try again when you are ready.' : 'Your sessions and checks will appear here.'}</ArenaCompanion> : null}
      {data && review.length > 0 ? <ArenaCompanion compact act="read" pose="attentive" title={`${count(review.length, 'session')} saved.`}>{toReview ? `${count(toReview, 'question')} to look at.` : 'Nothing left to look at. Every answer was right.'}</ArenaCompanion> : null}
      {data?.milestones?.length ? <section className="ov-section" aria-label="Recorded milestones">{data.milestones.map(m => { const line = milestoneLine(m); return <div key={m.kind}><b>{line.title}</b><p>{line.detail ? <>{line.detail} </> : null}<Link className="pr-link" href={line.href}>{line.link}</Link></p></div>; })}</section> : null}

      {data && view === 'review' ? (
        <>
          <ArenaStats label="Review summary" items={[
            { icon: <AppIcon name="practice" size={15} />, label: 'Sessions saved', value: review.length },
            { icon: <AppIcon name="review" size={15} />, label: 'Questions to review', value: changes?.changed ? <RollNumber from={changes.fromToReview} to={toReview} /> : toReview },
            { icon: <AppIcon name="check" size={15} />, label: 'Answered right', value: answered ? `${Math.round((correct / answered) * 100)}%` : '—' },
            { icon: <AppIcon name="clock" size={15} />, label: 'Last session', value: when(review[0]?.completedAt) || '—' },
          ]} />
          <LearningNextAction compact />
          <StudyProgress review />
          {data.reviewState === 'unavailable' ? <div className="pr-alert" data-tone="warning" role="status"><StatusIcon kind="warning" />The review queue is being prepared. Your saved attempts remain available.</div> : null}
          <section className="ov-section" aria-labelledby="ov-sessions">
            <div className="pr-step__head"><h2 id="ov-sessions">Your sessions</h2><span className="pr-hint">Newest first</span></div>
            {review.length ? <ul className="ov-list">{review.map(a => <SessionCard key={a.id} a={a} fresh={changes?.fresh.has(a.id)} index={review.indexOf(a)} />)}</ul> : (
              <div className="ov-empty"><SceneVignette scene="nothingYet" interactive /><ArenaCompanion mobi={false} title="Nothing to review yet">Finish a practice session and every miss lands here with its explanation.</ArenaCompanion><Link className="btn-volt md" href="/dashboard">Choose practice<ArrowRight size={16} aria-hidden="true" /></Link></div>
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
          <StudyProgress />
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
    </Mobis></section>
  );
}
