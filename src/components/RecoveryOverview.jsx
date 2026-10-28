"use client";
// Review and Progress: the student's saved sessions and recovery evidence, in the same Arena
// language as Practice. Claims stay as before: reviewing an explanation is not evidence of
// understanding, and ordinary scores cannot certify a recovery episode.
// Layout: a title, one line from Mobi, ruled figures with their denominators, then ruled lists.
// No boxes inside boxes and no arrows on rows: the whole row is the control.
import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/fetcher';
import LearningNextAction from './LearningNextAction';
import ArenaHead from './arena/ArenaHead';
import { StatusIcon } from './ui/Glyph';
import { SubjectObject } from './brand/SubjectObject';
import ArenaCompanion, { OneMobi } from './brand/ArenaCompanion';
import SceneVignette from './scenes/SceneVignette';
import { useWaitStage } from '@/lib/mobiHooks';
import { oopsRun } from '@/lib/mobiRation';
import StudyProgress from './study/StudyProgress';
import RulesEntry from './rules/RulesEntry';
import ReviseEntry from './revise/ReviseEntry';
import { reviewChanges } from './recovery/reviewChanges';
import { SUBJECTS } from '@/../data/subjects';
import './recovery/review-changes.css';
import './recovery/overview.css';

// Counts in words up to ten, the way the app says them ("Two sessions saved.").
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const count = (n, word) => `${n <= 10 ? WORDS[n] : n} ${word}${n === 1 ? '' : 's'}`;
// Milestones the record names, said plainly; anything new falls back to the record's own words.
const MILESTONES = {
  first_session: { title: 'Your first session is on the record.', link: 'Open it' },
  first_fresh_check: { title: 'A fresh delayed check passed.', link: 'See the check' },
};
// Sentence case, the way the rest of the arena writes: "Two pass", "Business studies".
const sentence = (id = '') => {
  const text = String(id).replace(/_/g, ' ').trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};
const subjectLabel = (id = '') => SUBJECTS.find((s) => s.id === id)?.name || sentence(id);
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

/** Four ruled figures. Every figure carries what it is out of, so none stands alone. */
function Figures({ label, items }) {
  return (
    <dl className="rv-figs" aria-label={label}>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}<small>{item.note}</small></dd>
        </div>
      ))}
    </dl>
  );
}

function SessionRow({ a, fresh = false, index = 0 }) {
  const pct = a.total ? Math.round((a.correct / a.total) * 100) : 0;
  const date = when(a.completedAt);
  return (
    <li data-fresh={fresh || undefined} style={fresh ? { '--ov-i': index } : undefined}>
      <Link className="rv-session" href={`/result/${a.id}`}>
        <span className="rv-session__art" aria-hidden="true"><SubjectObject id={a.subject} size={68} framed={false} /></span>
        <span className="rv-session__main">
          <b>{subjectLabel(a.subject)}{fresh ? <span className="ov-new">New since your last look</span> : null}</b>
          <span>{date ? `${date}, ` : ''}{a.correct} of {a.total} correct</span>
          <i className="ov-bar" aria-hidden="true"><em style={{ transform: `scaleX(${pct / 100})` }} /></i>
        </span>
        <span className="rv-session__state" data-tone={a.mistakes > 0 ? 'open' : 'clear'}>
          {a.mistakes > 0 ? <><b>{a.mistakes}</b> to review</> : 'All correct'}
        </span>
      </Link>
    </li>
  );
}

export default function RecoveryOverview({ view }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [retryCount, setRetryCount] = useState(0);
  const [changes, setChanges] = useState(null);
  const [shown, setShown] = useState(20); // a long record shows its newest 20 sessions, then more on request
  const [shrug, setShrug] = useState(false); // a failed read shrugs once per run, not on every retry
  const wait = useWaitStage(!data && !error);
  useEffect(() => { let alive = true; apiGet('/api/recovery').then(d => { if (!alive) return; if (view === 'review') { let storage = null; try { storage = window.localStorage; } catch { storage = null; } setChanges(reviewChanges(d?.ordinaryReview || [], storage)); } setData(d); }).catch(() => { if (alive) { setError('Your record did not load.'); setShrug(oopsRun(`record:${view}`)); } }); return () => { alive = false; }; }, [retryCount, view]);
  const retry = () => { setData(null); setError(''); setRetryCount(n => n + 1); };
  const review = data?.ordinaryReview || [];
  const toReview = review.reduce((s, a) => s + (a.mistakes || 0), 0);
  const answered = review.reduce((s, a) => s + (a.total || 0), 0);
  const correct = review.reduce((s, a) => s + (a.correct || 0), 0);
  const rightFigure = answered
    ? { value: `${Math.round((correct / answered) * 100)}%`, note: `${correct} of ${answered} answers` }
    : { value: 'None yet', note: 'No answers recorded' };
  // "Your first session is on the record." is true only while there is one. With more saved, the same
  // line points at the newest instead, so it never argues with Mobi's count above it.
  const newest = review[0] || null;
  const milestoneLine = (m) => {
    if (m.kind === 'first_session' && review.length > 1 && newest) {
      return { title: `Newest: ${[subjectLabel(newest.subject), when(newest.completedAt)].filter(Boolean).join(', ')}`, detail: null, link: `Open ${[subjectLabel(newest.subject), when(newest.completedAt)].filter(Boolean).join(', ')}`, href: `/result/${newest.id}` };
    }
    const said = MILESTONES[m.kind];
    return { title: said?.title || m.title, detail: said ? null : m.detail, link: said?.link || 'Open record', href: m.href };
  };

  const Mobis = view === 'progress' ? OneMobi : Fragment;
  return (
    <section className="pr ov rv"><Mobis>
      {view === 'review' ? (
        <ArenaHead title="Review what mattered." lede="Open a session to see why each miss happened." />
      ) : (
        <ArenaHead title="Your study days and checks." lede="Your saved sessions, your recovery checks and your exam playbook, in one place." />
      )}

      {error ? <div className="pr-alert" data-tone="error" role="alert"><StatusIcon kind="error" /><div>{error} <button type="button" className="pr-link" onClick={retry}>Try again</button></div></div> : null}
      {!data && !error ? <div className="rv-skel" role="status" aria-label="Loading your record"><i /><i /><i /></div> : null}
      {!data ? <ArenaCompanion compact act={error ? (shrug ? 'oops' : 'idle') : wait === 'long' ? 'loading' : 'idle'} pose={error ? 'encouraging' : 'attentive'} title={error ? 'Your record can wait a moment.' : 'Opening your saved record.'}>{error ? 'Try again when you are ready.' : 'Your sessions and checks will appear here.'}</ArenaCompanion> : null}
      {/* Review's figures below say the same counts, so Mobi's count line is kept to Progress. */}
      {data && review.length > 0 && view !== 'review' ? <ArenaCompanion compact act="read" pose="attentive" title={`${count(review.length, 'session')} saved.`}>{toReview ? `${count(toReview, 'question')} to look at.` : 'Nothing left to look at. Every answer was right.'}</ArenaCompanion> : null}
      {data?.milestones?.length ? <div className="rv-notes" role="group" aria-label="Recorded milestones">{data.milestones.map(m => { const line = milestoneLine(m); return <p key={m.kind} className="rv-note"><b>{line.title}</b><span>{line.detail ? <>{line.detail} </> : null}<Link className="pr-link" href={line.href}>{line.link}</Link></span></p>; })}</div> : null}

      {data && view === 'review' ? (
        <>
          {review.length > 0 ? <Figures label="Review summary" items={[
            { label: 'Sessions saved', value: review.length, note: `${answered} questions answered` },
            { label: 'Questions to review', value: changes?.changed ? <RollNumber from={changes.fromToReview} to={toReview} /> : toReview, note: answered ? `of ${answered} answered` : 'Nothing answered yet' },
            { label: 'Answered right', ...rightFigure },
            { label: 'Last session', value: when(review[0]?.completedAt) || 'None yet', note: review[0] ? subjectLabel(review[0].subject) : 'No session yet' },
          ]} /> : null}
          <section className="rv-sec" aria-labelledby="ov-sessions">
            <div className="rv-sec__head"><h2 id="ov-sessions">Your sessions</h2>{review.length > 1 ? <span>Newest first</span> : null}</div>
            {review.length ? <ul className="ov-list rv-list">{review.slice(0, shown).map((a, i) => <SessionRow key={a.id} a={a} fresh={changes?.fresh.has(a.id)} index={i} />)}</ul> : (
              <div className="rv-empty rv-empty--room"><SceneVignette scene="nothingYet" interactive /><ArenaCompanion mobi={false} title="Nothing to review yet">Finish a practice session and every miss lands here with its explanation.</ArenaCompanion><Link className="btn-volt md" href="/dashboard">Choose practice</Link></div>
            )}
            {review.length > shown ? <button type="button" className="pr-link" onClick={() => setShown((n) => n + 20)}>{`Show ${Math.min(20, review.length - shown)} more of ${review.length.toLocaleString('en-IN')}`}</button> : null}
          </section>
          <LearningNextAction compact />
          <StudyProgress review />
          {data.reviewState === 'unavailable' ? <div className="pr-alert" data-tone="warning" role="status"><StatusIcon kind="warning" />The review queue is being prepared. Your saved attempts remain available.</div> : null}
          <div className="ov-links"><ReviseEntry /><RulesEntry /></div>
        </>
      ) : null}

      {data && view === 'progress' ? (
        <>
          {review.length > 0 || data.progress.length > 0 || data.playbook.length > 0 ? <Figures label="Progress summary" items={[
            { label: 'Practice sessions', value: review.length, note: `${answered} questions answered` },
            { label: 'Concept checks', value: data.progress.length, note: data.progress.length ? 'with delayed checks' : 'None completed yet' },
            { label: 'Playbook entries', value: data.playbook.length, note: data.playbook.length ? 'saved from results' : 'None saved yet' },
            { label: 'Answered right', ...rightFigure },
          ]} /> : null}
          <LearningNextAction compact />
          <StudyProgress />
          <section className="rv-sec" aria-labelledby="ov-checks">
            <div className="rv-sec__head"><h2 id="ov-checks">Concept checks</h2><span>Fresh, delayed questions only</span></div>
            {data.progress.length ? <ul className="rv-rows">{data.progress.map(p => (
              <li key={p.concept}><b>{sentence(p.concept)}</b><span>{p.evidenceLabel}</span><small>{p.sampleSize} delayed check{p.sampleSize === 1 ? '' : 's'}</small></li>
            ))}</ul> : <div className="rv-empty"><b>No delayed checks yet</b><p>After you repair a mistake, a fresh question on the same idea comes back later. Its result lands here.</p></div>}
          </section>
          <section className="rv-sec" aria-labelledby="ov-playbook">
            <div className="rv-sec__head"><h2 id="ov-playbook">Your exam playbook</h2><span>Strategies you saved from results</span></div>
            {data.playbook.length ? <ul className="rv-rows">{data.playbook.map(p => (
              <li key={p.id}><b>{sentence(p.strategy)}</b><span>{p.reflection || 'No reflection yet'}</span><small>Awaiting repeated evidence</small></li>
            ))}</ul> : <div className="rv-empty"><b>Your playbook is empty</b><p>The rule you keep for your next mock is chosen in <Link className="pr-link" href="/review/rules">Your rules</Link>.</p></div>}
          </section>
          {data.note ? <p className="rv-foot">{data.note}</p> : null}
        </>
      ) : null}
    </Mobis></section>
  );
}
