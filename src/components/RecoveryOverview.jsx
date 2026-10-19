"use client";
// Progress: the student's study days, recovery checks and playbook, in the same Arena language as Practice. Claims stay as
// before: reviewing an explanation is not evidence of understanding, and ordinary scores cannot certify a recovery episode.
// Progress: this week out of the goal, the next step, then the record. Review (view="review") is review/ReviewPage.jsx.
// No boxes inside boxes and no arrows on rows: the whole row is the control.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/fetcher';
import LearningNextAction from './LearningNextAction';
import ArenaHead from './arena/ArenaHead';
import { ErrorState } from './ui/Skeleton';
import ArenaCompanion, { OneMobi } from './brand/ArenaCompanion';
import { useWaitStage } from '@/lib/mobiHooks';
import StudyProgress from './study/StudyProgress';
import RhythmCard from './RhythmCard';
import ReviewPage from './review/ReviewPage';
import StudyBadges from './StudyBadges';
import { MobTodayCard } from './mob/MobTodayCard';
import { useMobEnabled } from './mob/MobFlag';
import { useAuth } from './AuthProvider';
import { SUBJECTS } from '@/../data/subjects';
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

/** Four ruled figures. Every figure carries what it is out of, so none stands alone. They rise in order, 45 ms apart
 * (mk-stagger, owner G31): the lit build's stat strip entrance. */
function Figures({ label, items }) {
  return (
    <dl className="rv-figs mk-stagger" aria-label={label} data-n={items.length}>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}<small>{item.note}</small></dd>
        </div>
      ))}
    </dl>
  );
}

// Review (view="review") is the pass 1017 Mistakes page (LEARN-REVIEW-1017 packet P-LR1, review/ReviewPage.jsx); Progress keeps
// this component. `tabParam` names the URL parameter that holds Review's view (the preview's own `view` picks the page).
export default function RecoveryOverview({ view, tabParam }) {
  return view === 'review' ? <ReviewPage tabParam={tabParam} /> : <ProgressOverview view={view} />;
}

function ProgressOverview({ view }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [retryCount, setRetryCount] = useState(0);
  const wait = useWaitStage(!data && !error);
  useEffect(() => { let alive = true; apiGet('/api/recovery').then(d => { if (!alive) return; setData(d); }).catch(() => { if (alive) { setError('Your record did not load.'); } }); return () => { alive = false; }; }, [retryCount, view]);
  // Progress: the week and the plan load on their own; either failing joins the record's one error state.
  const [partFailed, setPartFailed] = useState(false);
  const partFail = useCallback(() => setPartFailed(true), []);
  // The week the card read is handed up: the badges below the record need its time zone and goal, and it is read once.
  const [rhythm, setRhythm] = useState(null);
  const retry = () => { setData(null); setError(''); setPartFailed(false); setRhythm(null); setRetryCount(n => n + 1); };
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

  const notes = data?.milestones || [];

  const status = (
    <>
      {/* A failed read is one shared state (the one used on Weak chapters): one figure, one sentence, one Try again. */}
      {error ? <ErrorState scene="unreachable" title="Your record did not load" message="Check your connection and try again. Your saved sessions are safe." onRetry={retry} /> : null}
      {!data && !error ? <div className="rv-skel" role="status" aria-label="Loading your record"><i /><i /><i /></div> : null}
      {!data && !error ? <ArenaCompanion compact act={wait === 'long' ? 'loading' : 'idle'} pose="attentive" title="Opening your saved record.">Your sessions and checks will appear here.</ArenaCompanion> : null}
    </>
  );
  const noteList = notes.length ? <div className="rv-notes" role="group" aria-label="Recorded milestones">{notes.map(m => { const line = milestoneLine(m); return <p key={m.kind} className="rv-note"><b>{line.title}</b><span>{line.detail ? <>{line.detail} </> : null}<Link className="pr-link" href={line.href}>{line.link}</Link></span></p>; })}</div> : null;

  // Progress: this week (the anchor, out of the goal), the next step that earns a study day, then the evidence.
  return (
    <section className="pr ov rv rv--progress"><OneMobi>
      <ArenaHead title="Your study days and checks." lede="This week first, then what your sessions, recovery checks and playbook show." />
      {/* One failed read on this page (week, plan or record) is one page-level error with one retry that reloads all three. */}
      {partFailed && !error ? <ErrorState scene="unreachable" title="Your record did not load" message="Check your connection and try again. Your saved sessions are safe." onRetry={retry} /> : null}
      {!partFailed && !error ? <RhythmCard key={retryCount} onError={partFail} onLoad={setRhythm} between={<LearningNextAction compact onError={partFail} />} /> : null}
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
            <p className="rv-note rv-note--review"><b>{toReview ? `${count(toReview, 'question')} to look at in Review` : 'Nothing left to look at in Review'}</b><span>{toReview ? `From ${count(review.length, 'saved session').toLowerCase()}. ` : review.some((x) => (x.repaired || 0) > 0) ? 'Every miss has a repair saved. ' : 'Every saved answer was right. '}<Link className="pr-link" href="/review">Open Review</Link></span></p>
          ) : null}
          {noteList}
        </section>
      ) : null}
      {data ? <StudyProgress /> : null}
      {/* The badges and the personal bests: their own section, right after the record (BADGES-REFINE-1018). */}
      {data ? <StudyBadges key={`badges-${retryCount}`} rhythm={rhythm} rhythmFailed={partFailed} /> : null}
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
