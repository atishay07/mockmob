"use client";
// Review and Progress: the student's saved sessions and recovery evidence, in the same Arena
// language as Practice. Claims stay as before: reviewing an explanation is not evidence of
// understanding, and ordinary scores cannot certify a recovery episode.
// Review: the open-question count over what was answered (the anchor) and the one session to open first, the ways
// into Revise and Rules, then the sessions. Progress: this week out of the goal, the next step, then the record.
// No boxes inside boxes and no arrows on rows: the whole row is the control.
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import RecordGlimpse from './ai/RecordGlimpse';
import { MobTodayCard } from './mob/MobTodayCard';
import { useMobEnabled } from './mob/MobFlag';
import { useAuth } from './AuthProvider';
import { reviewChanges } from './recovery/reviewChanges';
import { paperStamp, clockTime } from '@/../data/repair_paper.mjs';
import { reviewModel } from '@/../data/review_mistakes.mjs';
import { useWalletSummary } from './useWalletSummary';
import { ReviewNextMove, ReviewReceipt, ReviewChapters } from './review/ReviewMistakes';
import { SUBJECTS } from '@/../data/subjects';
import './recovery/review-changes.css';
import './recovery/overview.css';

// Counts in words up to ten, the way the app says them ("Two sessions saved.").
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
// The Mob's ring and its one action on Progress (from Today). Off, it reads nothing.
function ProgressMob() {
  const on = useMobEnabled();
  const { user } = useAuth();
  return on && user?.id ? <MobTodayCard userId={user.id} /> : null;
}

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

// F17: a wrong answer that already holds a saved repair is done work, so it is not "to review" again.
const openOf = (a) => Math.max(0, (a.mistakes || 0) - (a.repaired || 0));

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

// W-035: Review's way into the Mistake Lab of the newest mock (a full or NTA paper; else the newest session). The Lab is
// the named group of folds on the result; /result/{id}#lab opens its first part there.
const isMockPaper = (a) => a?.mode === 'full' || a?.mode === 'nta' || /^Mock\b/.test(String(a?.source || ''));
function LabEntry({ review }) {
  const paper = review.find(isMockPaper) || review[0] || null;
  if (!paper) return null;
  const name = [paper.source, subjectLabel(paper.subject), when(paper.completedAt)].filter(Boolean).join(', ');
  return (
    <Link className="rb-entry rv-lab-entry" href={`/result/${paper.id}#lab`}>
      <span className="rb-entry__text">
        <b>Your Mistake Lab</b>
        <span>{name}: where the marks went, your time and changed answers, the topic mocks to do next and how others answered.</span>
      </span>
    </Link>
  );
}

function SessionRow({ a, fresh = false, index = 0 }) {
  const pct = a.total ? Math.round((a.correct / a.total) * 100) : 0;
  // "Mock 3, 16 Oct, 9:40 pm": which paper it was and when it was attempted (the subject is the title above it).
  const stamp = paperStamp({ source: a.source, at: a.completedAt }) || when(a.completedAt);
  const open = openOf(a);
  const repaired = a.repaired || 0;
  return (
    <li className="rv-item" data-fresh={fresh || undefined} style={fresh ? { '--ov-i': index } : undefined}>
      <Link className="rv-session" href={`/result/${a.id}`}>
        <span className="rv-session__art" aria-hidden="true"><SubjectObject id={a.subject} size={92} framed={false} /></span>
        <span className="rv-session__main">
          <b>{subjectLabel(a.subject)}{fresh ? <span className="ov-new">New since your last look</span> : null}</b>
          {stamp ? <span className="rv-session__paper">{stamp}</span> : null}
          <span>{a.correct} of {a.total} correct{repaired > 0 ? `, ${repaired} repaired` : ''}</span>
          <i className="ov-bar" aria-hidden="true"><em style={{ transform: `scaleX(${pct / 100})` }} /></i>
        </span>
        <span className="rv-session__state" data-tone={open > 0 ? 'open' : 'clear'}>
          {open > 0 ? <><b>{open}</b> to review</> : repaired > 0 ? 'All repaired' : 'All correct'}
        </span>
      </Link>
      {/* W-039: "Review again" opens this paper's mistakes from the first, with every saved repair opening free; the Lab
          link opens its Mistake Lab (W-035). Siblings of the row, never links inside a link. */}
      {(a.mistakes || 0) > 0 ? (
        <span className="rv-item__acts">
          <Link className="rv-act" href={`/result/${a.id}#mistakes`} aria-label={`Review again: ${subjectLabel(a.subject)}${stamp ? `, ${stamp}` : ''}`}>Review again</Link>
          <Link className="rv-act" href={`/result/${a.id}#lab`} aria-label={`Mistake Lab: ${subjectLabel(a.subject)}${stamp ? `, ${stamp}` : ''}`}>Mistake Lab</Link>
        </span>
      ) : null}
    </li>
  );
}

// Review (LEARN-REVIEW-1017, F15): "Review" with two views. Mistakes (the default): the one next move, a receipt of what is
// found, repaired and open, Revise, every open mistake by chapter across papers priced in marks, then the quiet rows.
// Papers: the record finding and trend, the figures and every paper with "Review again" and its Mistake Lab. The view is
// in the address (?view=papers) so a link or a reload keeps it. Today's plan card and the study record moved off Review
// (Today and Concepts carry them); nothing else left.
const readView = () => { try { return new URLSearchParams(window.location.search).get('view') === 'papers' ? 'papers' : 'mistakes'; } catch { return 'mistakes'; } };

function ReviewPage({ data, error, retry, review, answered, rightFigure, changes, noteList, wait }) {
  const { user } = useAuth();
  const wallet = useWalletSummary(user?.id, { reuseFresh: true });
  const aiCredits = wallet.wallet?.known ? wallet.wallet.total : null;
  const [tab, setTab] = useState('mistakes');
  useEffect(() => { const v = readView(); if (v !== 'mistakes') queueMicrotask(() => setTab(v)); }, []);
  const [triedAt, setTriedAt] = useState(null);
  useEffect(() => { if (error) queueMicrotask(() => setTriedAt(clockTime(Date.now()))); }, [error]);
  const model = useMemo(() => reviewModel(review, { aiCredits, isPremium: Boolean(user?.isPremium) }), [review, aiCredits, user?.isPremium]);
  const choose = (next) => {
    setTab(next);
    try { const url = new URL(window.location.href); if (next === 'papers') url.searchParams.set('view', 'papers'); else url.searchParams.delete('view'); window.history.replaceState(window.history.state, '', url); } catch { /* the view still switches */ }
  };
  const onKey = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = tab === 'mistakes' ? 'papers' : 'mistakes';
    choose(next);
    document.getElementById(`rv2-tab-${next}`)?.focus();
  };
  const blanksPaper = review.find((p) => (p.items || []).some((i) => i.state === 'blank')) || null;
  const firstBlank = blanksPaper ? blanksPaper.items.find((i) => i.state === 'blank') : null;
  const savedPaper = review.find((p) => (p.repaired || 0) > 0) || null;
  return (
    <section className="pr ov rv rv--review">
      <ArenaHead title="Review" lede="What is still open, what you already fixed, and the one mistake to do next." />
      {error ? (
        <ErrorState scene="unreachable" title="Your mistakes did not load" message={`Check your connection and try again. Your papers and repairs are safe.${triedAt ? ` Tried at ${triedAt}.` : ''}`} onRetry={retry} />
      ) : null}
      {!data && !error ? <div className="rv-skel" role="status" aria-label="Loading your mistakes"><i /><i /><i /></div> : null}
      {!data && !error ? <ArenaCompanion compact act={wait === 'long' ? 'loading' : 'idle'} pose="attentive" title="Opening your saved record.">Your mistakes and papers will appear here.</ArenaCompanion> : null}

      {data && review.length > 0 ? (
        <>
          <div className="rv2-seg" role="tablist" aria-label="Review">
            <button type="button" role="tab" id="rv2-tab-mistakes" aria-selected={tab === 'mistakes'} aria-controls="rv2-panel" tabIndex={tab === 'mistakes' ? 0 : -1} onClick={() => choose('mistakes')} onKeyDown={onKey}>
              Mistakes <small>{model.receipt.open} open</small>
            </button>
            <button type="button" role="tab" id="rv2-tab-papers" aria-selected={tab === 'papers'} aria-controls="rv2-panel" tabIndex={tab === 'papers' ? 0 : -1} onClick={() => choose('papers')} onKeyDown={onKey}>
              Papers <small>{review.length}</small>
            </button>
          </div>
          <div id="rv2-panel" role="tabpanel" aria-labelledby={`rv2-tab-${tab}`}>
            {tab === 'mistakes' ? (
              <div className="rv2-body" key="mistakes">
                <div className="rv2-main">
                  <ReviewNextMove move={model.move} />
                  {model.listed ? <ReviewChapters chapters={model.chapters} receipt={model.receipt} subjectName={subjectLabel} papers={review.length} /> : (
                    <section className="rv-sec" aria-labelledby="rv2-bypaper">
                      <div className="rv-sec__head"><h2 id="rv2-bypaper">Open mistakes by paper</h2><span>Newest first</span></div>
                      <ul className="ov-list rv-list">{review.filter((a) => openOf(a) > 0).map((a, i) => <SessionRow key={a.id} a={a} index={i} />)}</ul>
                    </section>
                  )}
                </div>
                <div className="rv2-side">
                  <ReviewReceipt receipt={model.receipt} />
                  <div className="ov-links rv-ways rv2-revise"><ReviseEntry /></div>
                  <section className="rv2-also" aria-labelledby="rv2-also-h">
                    <h2 id="rv2-also-h" className="rv2-also__h">Also in Review</h2>
                    <div className="ov-links rv-ways">
                      <LabEntry review={review} />
                      <RulesEntry />
                      {savedPaper ? <Link className="rv2-row" href={`/result/${savedPaper.id}#mistakes`}><b>{model.receipt.repaired} repaired</b><span>Each opens its saved repair, free. Newest: {[savedPaper.source, subjectLabel(savedPaper.subject), when(savedPaper.completedAt)].filter(Boolean).join(', ')}.</span></Link> : null}
                      {firstBlank ? <Link className="rv2-row" href={`/result/${blanksPaper.id}#q-${firstBlank.n}`}><b>Not attempted</b><span>{model.receipt.blank} left blank, {model.receipt.blank * 5} marks not earned. Try any of them again, free.</span></Link> : null}
                      <Link className="rv2-row" href="/saved"><b>Saved questions</b><span>Questions you bookmarked while practising.</span></Link>
                    </div>
                  </section>
                </div>
              </div>
            ) : (
              <div className="rv2-body rv2-body--papers" key="papers">
                <div className="rv2-side rv2-side--papers">
                  {noteList}
                  <div className="rv-record"><RecordGlimpse finding={false} /><p className="rv-record__more"><Link className="pr-link" href="/analytics">Which chapters cost the most marks, on Weak chapters</Link></p></div>
                </div>
                <div className="rv2-main">
                  <section className="rv-sec" aria-labelledby="ov-sessions">
                    <div className="rv-sec__head"><h2 id="ov-sessions">{review.length > 1 ? `Your ${review.length} papers` : 'Your paper'}</h2>{review.length > 1 ? <span>Newest first</span> : null}</div>
                    <Figures label="Review summary" items={[
                      { label: 'Papers', value: review.length, note: `${answered} questions answered` },
                      { label: 'Answered right', ...rightFigure },
                      { label: 'Last paper', value: when(review[0]?.completedAt) || 'None yet', note: review[0] ? subjectLabel(review[0].subject) : 'No paper yet' },
                    ]} />
                    <ul className="ov-list rv-list">{review.map((a, i) => <SessionRow key={a.id} a={a} fresh={changes?.fresh.has(a.id)} index={i} />)}</ul>
                  </section>
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}

      {data && review.length === 0 ? (
        <section className="rv-sec" aria-labelledby="rv2-empty-h">
          <div className="rv-empty rv-empty--room">
            <SceneVignette scene="nothingYet" interactive />
            <div className="rv2-empty__copy">
              <h2 id="rv2-empty-h">Your mistakes gather here</h2>
              <p>Every wrong answer lands here with its paper and time, priced in marks, with the one to fix first.</p>
              <div className="rv2-example" aria-label="Example of a mistake row">
                <span className="rv2-item__n" aria-hidden="true">4</span>
                <span className="rv2-example__text"><b>Partnership: goodwill brought in by a new partner</b><small>Example. Quick practice, today, 9:40 PM. You picked B</small></span>
              </div>
              <Link className="btn-volt md" data-page-primary="" href="/dashboard?mode=quick&count=10">Start 10 questions</Link>
            </div>
          </div>
          <div className="ov-links rv-ways"><ReviseEntry /><RulesEntry /></div>
        </section>
      ) : null}
      {data?.reviewState === 'unavailable' ? <div className="pr-alert" data-tone="warning" role="status"><StatusIcon kind="warning" />The review queue is being prepared. Your saved attempts remain available.</div> : null}
    </section>
  );
}

export default function RecoveryOverview({ view }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [retryCount, setRetryCount] = useState(0);
  const [changes, setChanges] = useState(null);
  const wait = useWaitStage(!data && !error);
  useEffect(() => { let alive = true; apiGet('/api/recovery').then(d => { if (!alive) return; if (view === 'review') { let storage = null; try { storage = window.localStorage; } catch { storage = null; } setChanges(reviewChanges((d?.ordinaryReview || []).map(a => ({ ...a, mistakes: openOf(a) })), storage)); } setData(d); }).catch(() => { if (alive) { setError('Your record did not load.'); } }); return () => { alive = false; }; }, [retryCount, view]);
  // Progress: the week and the plan load on their own; either failing joins the record's one error state.
  const [partFailed, setPartFailed] = useState(false);
  const partFail = useCallback(() => setPartFailed(true), []);
  const retry = () => { setData(null); setError(''); setPartFailed(false); setRetryCount(n => n + 1); };
  const review = data?.ordinaryReview || [];
  const toReview = review.reduce((s, a) => s + openOf(a), 0);
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
    return <ReviewPage data={data} error={error} retry={retry} review={review} answered={answered} rightFigure={rightFigure} changes={changes} noteList={noteList} wait={wait} />;
  }

  // Progress: this week (the anchor, out of the goal), the next step that earns a study day, then the evidence.
  return (
    <section className="pr ov rv rv--progress"><OneMobi>
      <ArenaHead title="Your study days and checks." lede="This week first, then what your sessions, recovery checks and playbook show." />
      {/* One failed read on this page (week, plan or record) is one page-level error with one retry that reloads all three. */}
      {partFailed && !error ? <ErrorState scene="unreachable" title="Your record did not load" message="Check your connection and try again. Your saved sessions are safe." onRetry={retry} /> : null}
      {!partFailed && !error ? <RhythmCard key={retryCount} onError={partFail} between={<LearningNextAction compact onError={partFail} />} /> : null}
      {/* The Mob card moved here from Today (TODAY-1017 section 7); only while MOB_ENABLED is on and you are in a Mob. */}
      <ProgressMob />
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
            <p className="rv-note rv-note--review"><b>{toReview ? `${count(toReview, 'open mistake')} in Review` : 'Nothing open in Review'}</b><span>{toReview ? `From ${count(review.length, 'saved session').toLowerCase()}. ` : review.some((x) => (x.repaired || 0) > 0) ? 'Every miss has a repair saved. ' : 'Every saved answer was right. '}<Link className="pr-link" href="/review">Open Review</Link></span></p>
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
