"use client";
// Review and Progress: the student's saved sessions and recovery evidence, in the same Arena
// language as Practice. Claims stay as before: reviewing an explanation is not evidence of
// understanding, and ordinary scores cannot certify a recovery episode.
// Review: the open-question count over what was answered (the anchor) and the one session to open first, the ways
// into Revise and Rules, then the sessions. Progress: this week out of the goal, the next step, then the record.
// No boxes inside boxes and no arrows on rows: the whole row is the control.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/fetcher';
import LearningNextAction from './LearningNextAction';
import ArenaHead from './arena/ArenaHead';
import { StatusIcon } from './ui/Glyph';
import { ErrorState } from './ui/Skeleton';
import { SubjectObject } from './brand/SubjectObject';
import ArenaCompanion, { OneMobi } from './brand/ArenaCompanion';
import SceneVignette from './scenes/SceneVignette';
import { useWaitStage } from '@/lib/mobiHooks';
import StudyProgress from './study/StudyProgress';
import RulesEntry from './rules/RulesEntry';
import RhythmCard from './RhythmCard';
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
    <dl className="rv-figs" aria-label={label} data-n={items.length}>
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
  const wait = useWaitStage(!data && !error);
  useEffect(() => { let alive = true; apiGet('/api/recovery').then(d => { if (!alive) return; if (view === 'review') { let storage = null; try { storage = window.localStorage; } catch { storage = null; } setChanges(reviewChanges(d?.ordinaryReview || [], storage)); } setData(d); }).catch(() => { if (alive) { setError('Your record did not load.'); } }); return () => { alive = false; }; }, [retryCount, view]);
  // Progress: the week and the plan load on their own; either failing joins the record's one error state.
  const [partFailed, setPartFailed] = useState(false);
  const partFail = useCallback(() => setPartFailed(true), []);
  const retry = () => { setData(null); setError(''); setPartFailed(false); setRetryCount(n => n + 1); };
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

  // Review leads with what is open and the one session to open first: the newest session that still has misses.
  const openFirst = review.find((a) => (a.mistakes || 0) > 0) || null;
  const sessionName = (a) => [subjectLabel(a.subject), when(a.completedAt)].filter(Boolean).join(', ');
  // On Review the lead already opens the newest session, so the milestone that only points at the newest is not repeated.
  const notes = (data?.milestones || []).filter((m) => !(view === 'review' && m.kind === 'first_session' && review.length > 0));

  const status = (
    <>
      {/* A failed read is one shared state (the one used on Weak chapters): one figure, one sentence, one Try again. */}
      {error ? <ErrorState scene="unreachable" title="Your record did not load" message="Check your connection and try again. Your saved sessions are safe." onRetry={retry} /> : null}
      {!data && !error ? <div className="rv-skel" role="status" aria-label="Loading your record"><i /><i /><i /></div> : null}
      {!data && !error ? <ArenaCompanion compact act={wait === 'long' ? 'loading' : 'idle'} pose="attentive" title="Opening your saved record.">Your sessions and checks will appear here.</ArenaCompanion> : null}
    </>
  );
  const noteList = notes.length ? <div className="rv-notes" role="group" aria-label="Recorded milestones">{notes.map(m => { const line = milestoneLine(m); return <p key={m.kind} className="rv-note"><b>{line.title}</b><span>{line.detail ? <>{line.detail} </> : null}<Link className="pr-link" href={line.href}>{line.link}</Link></span></p>; })}</div> : null;

  if (view === 'review') {
    return (
      <section className="pr ov rv rv--review">
        <ArenaHead title="Review what mattered." lede="Open a session to see why each miss happened." />
        {status}
        {data && review.length > 0 ? (
          <section className="rv-lead" aria-labelledby="rv-lead-h">
            <p className="rv-lead__num" aria-hidden="true">{changes?.changed ? <RollNumber from={changes.fromToReview} to={toReview} /> : toReview}</p>
            <div className="rv-lead__body">
              <h2 id="rv-lead-h">{toReview ? <><span className="sr-only">{toReview} </span>{toReview === 1 ? 'question' : 'questions'} to review, of {answered} answered</> : `Nothing to review in ${answered} answers`}</h2>
              <p>{openFirst ? <>{openFirst === review[0] ? 'Your newest session' : 'Your newest session with misses'} has {openFirst.mistakes} of its {openFirst.total} {openFirst.total === 1 ? 'question' : 'questions'} to look at.</> : 'Every answer in your saved sessions was right.'}</p>
            </div>
            {openFirst ? <Link className="btn-volt md rv-lead__go mk-press" href={`/result/${openFirst.id}`}>Open {sessionName(openFirst)}</Link> : null}
          </section>
        ) : null}
        {noteList}
        {data && review.length > 0 ? <div className="ov-links rv-ways"><ReviseEntry /><RulesEntry /></div> : null}
        {data ? (
          <section className="rv-sec" aria-labelledby="ov-sessions">
            <div className="rv-sec__head"><h2 id="ov-sessions">{review.length > 1 ? `Your ${review.length} sessions` : review.length === 1 ? 'Your session' : 'Your sessions'}</h2>{review.length > 1 ? <span>Newest first</span> : null}</div>
            {review.length > 0 ? <Figures label="Review summary" items={[
              { label: 'Sessions saved', value: review.length, note: `${answered} questions answered` },
              { label: 'Answered right', ...rightFigure },
              { label: 'Last session', value: when(review[0]?.completedAt) || 'None yet', note: review[0] ? subjectLabel(review[0].subject) : 'No session yet' },
            ]} /> : null}
            {review.length ? <ul className="ov-list rv-list">{review.map((a, i) => <SessionRow key={a.id} a={a} fresh={changes?.fresh.has(a.id)} index={i} />)}</ul> : (
              <div className="rv-empty rv-empty--room"><SceneVignette scene="nothingYet" interactive /><ArenaCompanion mobi={false} title="Nothing to review yet">Finish a practice session and every miss lands here with its explanation.</ArenaCompanion><Link className="btn-volt md" href="/dashboard">Choose practice</Link></div>
            )}
          </section>
        ) : null}
        {data ? <LearningNextAction compact quiet={review.length === 0 || Boolean(openFirst)} /> : null}
        {data ? <StudyProgress review /> : null}
        {data?.reviewState === 'unavailable' ? <div className="pr-alert" data-tone="warning" role="status"><StatusIcon kind="warning" />The review queue is being prepared. Your saved attempts remain available.</div> : null}
        {data && review.length === 0 ? <div className="ov-links rv-ways"><ReviseEntry /><RulesEntry /></div> : null}
      </section>
    );
  }

  // Progress: this week (the anchor, out of the goal), the next step that earns a study day, then the evidence.
  return (
    <section className="pr ov rv rv--progress"><OneMobi>
      <ArenaHead title="Your study days and checks." lede="This week first, then what your sessions, recovery checks and playbook show." />
      {/* One failed read on this page (week, plan or record) is one page-level error with one retry that reloads all three. */}
      {partFailed && !error ? <ErrorState scene="unreachable" title="Your record did not load" message="Check your connection and try again. Your saved sessions are safe." onRetry={retry} /> : null}
      {!partFailed && !error ? <RhythmCard key={retryCount} onError={partFail} between={<LearningNextAction compact onError={partFail} />} /> : null}
      {status}
      {data ? (
        <section className="rv-sec" aria-labelledby="ov-record">
          <div className="rv-sec__head"><h2 id="ov-record">Your record so far</h2><span>From your saved sessions and results</span></div>
          {review.length > 0 || data.progress.length > 0 || data.playbook.length > 0 ? <Figures label="Progress summary" items={[
            { label: 'Practice sessions', value: review.length, note: `${answered} questions answered` },
            { label: 'Answered right', ...rightFigure },
            { label: 'Concept checks', value: data.progress.length, note: data.progress.length ? 'with delayed checks' : 'None completed yet' },
            { label: 'Playbook entries', value: data.playbook.length, note: data.playbook.length ? 'saved from results' : 'None saved yet' },
          ]} /> : <div className="rv-empty"><b>No saved session yet</b><p>Your first scored session starts this record. The next step above is the quickest way in.</p></div>}
          {review.length > 0 ? (
            <p className="rv-note rv-note--review"><b>{toReview ? `${count(toReview, 'question')} to look at in Review` : 'Nothing left to look at in Review'}</b><span>{toReview ? `From ${count(review.length, 'saved session').toLowerCase()}. ` : 'Every saved answer was right. '}<Link className="pr-link" href="/review">Open Review</Link></span></p>
          ) : null}
          {noteList}
        </section>
      ) : null}
      {data ? <StudyProgress /> : null}
      {data ? (
        <>
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
    </OneMobi></section>
  );
}
