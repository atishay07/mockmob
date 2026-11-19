"use client";

// Radar: where the student's marks are going. The record view (ledger, leaks, chapters, changed
// answers, pace, week on week) is the same free, model-free analysis PrepOS uses, so the two never
// disagree. The score trend keeps the attempt-level chart. No invented composite scores.
// "Across your mocks" (spec tmp/mistake-lab-v4/SPEC.md 4.9): the same component and the same server sentences as the end
// of the Mistake Lab (GET /api/me/rules), open here, with the way into the Rule book. Pass 2 (16 Oct): the marks lead
// (the ledger is the anchor), Across sits after What stands out, and on narrow screens the trend and subjects follow
// the marks instead of closing a 3,500 px page.
// Lane insight (18 Nov 2026): the page is an analysis desk. From 1100 px two columns (RecordView `desk`, as Progress and the
// result: src/lib/stickySide.mjs): the left keeps the marks, Score by session and the way to Your papers in view; the right
// scrolls through Your chapters (the anchor), Your pace, Where your marks go, By subject and the rest of the record. A phone
// reads one column in that order. Each block that GET /api/analytics feeds waits, fails and retries on its own, sized like
// itself, so nothing jumps when the answer lands.
import { isPlainClick, openAskMobi } from '@/components/ai/askMobi.mjs';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { apiGet } from '@/lib/fetcher';
import RecordView from '@/components/ai/RecordView';
import { useInsights } from '@/components/ai/useInsights';
import { useAuth } from '@/components/AuthProvider';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { useInView } from '@/lib/motion';
import TrendScrub from './TrendScrub';
import YourChapters from './YourChapters';
import YourPace from './YourPace';
import WhereMarksGo from './WhereMarksGo';
import AcrossMocks from '@/components/result/AcrossMocks';
import { useRuleBook } from '@/components/rules/useRuleBook';
import FirstTimedMock from '@/components/timed/FirstTimedMock';
import { useFirstTimedMock } from '@/components/timed/useFirstTimedMock';
import { FAILED, TRY_AGAIN } from '@/lib/insight/words.mjs';
import './analytics.css';

// A thin bar that inks in when its row scrolls into view. The figure beside it carries the number.
function SubjectBar({ pct, delay = 0 }) {
  const [ref, seen] = useInView({ threshold: 0.5 });
  return <span className="rd-bar" ref={ref} data-in={seen ? 'true' : 'false'} style={{ '--w': Math.max(0, Math.min(100, pct)) / 100, '--rd-delay': `${delay}ms` }} aria-hidden="true"><i /></span>;
}

// The chart is SVG drawn from the live Arena tokens; re-read when the theme switches.
function useChartColors() {
  const [colors, setColors] = useState({ ink: '#a09989', line: 'rgba(244,240,230,0.08)', accent: '#d2f000' });
  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      const pick = (name, fallback) => s.getPropertyValue(name).trim() || fallback;
      setColors({ ink: pick('--a-ink-3', '#a09989'), line: pick('--a-line', 'rgba(244,240,230,0.08)'), accent: pick('--a-accent-text', '#d2f000') });
    };
    const t = window.setTimeout(read, 0);
    window.addEventListener('mm-theme', read);
    return () => { window.clearTimeout(t); window.removeEventListener('mm-theme', read); };
  }, []);
  return colors;
}

/** A block whose read failed: the page's own retry line (as Across your mocks'). */
function Failed({ onRetry }) {
  return <p className="ins-fail" role="status">{FAILED} <button type="button" onClick={onRetry}><RefreshCw size={14} strokeWidth={2.2} aria-hidden="true" />{TRY_AGAIN}</button></p>;
}

export default function AnalyticsPageClient() {
  const { user, status: authStatus } = useAuth();
  const [read, setRead] = useState({ status: 'loading', data: null });
  const [retryCount, setRetryCount] = useState(0);
  const record = useInsights(user?.id);
  const colors = useChartColors();
  const pro = Boolean(user?.isPremium);
  const rules = useRuleBook({ enabled: authStatus !== 'loading' && Boolean(user?.id) });
  // The Lab's empty block (Across your mocks, no timed mock yet) gets the one key into a timed mock (data/first_timed_mock.js).
  const firstTimed = useFirstTimedMock('radar');

  useEffect(() => {
    if (authStatus === 'loading' || !user?.id) return undefined;
    let alive = true;
    apiGet(`/api/analytics?userId=${user.id}`)
      .then((d) => { if (alive) setRead({ status: 'ready', data: d }); })
      .catch(() => { if (alive) setRead({ status: 'error', data: null }); });
    return () => { alive = false; };
  }, [user, authStatus, retryCount]);
  const retry = () => { setRead({ status: 'loading', data: null }); setRetryCount((count) => count + 1); };

  const status = authStatus === 'loading' ? 'loading' : read.status;
  const data = status === 'ready' ? read.data : null;
  const insight = data?.insight || { state: 'error' };
  const { timeline = [], subjects = [], totalAttempts = 0, totals = { correct: 0, wrong: 0, unattempted: 0 } } = data || {};
  const totalQ = totals.correct + totals.wrong + totals.unattempted;
  // Your pace is Pro's (the server sends Free no pace rows). Free is told so once, by the record's own "Changed answers and
  // pace" row (RecordView oneLock), so the block is not drawn for Free at all: no second Pro row, and no waiting shape that
  // would vanish when the answer lands. The server's plan wins when it says Pro.
  const showPace = pro || insight.plan === 'pro';

  const across = rules.state === 'ready' && rules.data?.acrossMocks ? (
    <AcrossMocks across={rules.data.acrossMocks} defaultOpen surface="card" footer={<>
      {rules.data.acrossMocks.state === 'none' ? <FirstTimedMock prompt={firstTimed} /> : null}
      {/* U5: the way into the Rule book waits for its first rule; an empty book is not a feature to visit ("Your rules (0)").
          Your papers keeps its own entry to it. */}
      {rules.data.book?.countLabel && rules.data.book.count > 0 ? <Link href="/review/rules" className="rd-rules">{rules.data.book.countLabel}</Link> : null}
    </>} />
  ) : rules.state === 'error' ? (
    <p className="rd-across-fail" role="status">{rules.message} <button type="button" onClick={rules.retry}><RefreshCw size={14} strokeWidth={2.2} aria-hidden="true" />Try again</button></p>
  ) : rules.state === 'loading' ? <div className="rd-across-wait skeleton" aria-hidden="true" /> : null;

  // The left column: Score by session under the marks.
  const side = (
    <section className="rd-card rd-trend" aria-labelledby="rd-trend">
      <h2 id="rd-trend">Score by session</h2>
      <div className="rd-chart rd-chart--scrub">
        {status === 'loading' ? <div className="skeleton rd-trend__wait" aria-hidden="true" />
          : status === 'error' ? <Failed onRetry={retry} />
            : timeline.length > 1
              ? <TrendScrub timeline={timeline} colors={colors} />
              : <p className="pr-empty">{timeline.length === 0 ? 'Finish a session to start your trend.' : 'One more session and the trend line appears.'}</p>}
      </div>
      {status === 'ready' && timeline.length > 1 && <p className="rd-foot">{timeline[0].score}% to {timeline[timeline.length - 1].score}% over {timeline.length} sessions.</p>}
    </section>
  );

  // The right column, before the rest of the record (phones: the same order, under the trend).
  const main = (
    <>
      <YourChapters status={status} map={insight.chapters} onRetry={retry} />
      {showPace ? <YourPace status={status} pace={insight.pace} onRetry={retry} /> : null}
      <WhereMarksGo status={status} marks={insight.marks} onRetry={retry} />
      {status === 'loading' ? (
        <section className="rd-card" aria-labelledby="rd-subj" aria-busy="true">
          <h2 id="rd-subj">By subject</h2>
          <div className="skeleton rd-subj__wait" aria-hidden="true" />
        </section>
      ) : status === 'error' ? (
        <section className="rd-card" aria-labelledby="rd-subj">
          <h2 id="rd-subj">By subject</h2>
          <Failed onRetry={retry} />
        </section>
      ) : subjects.length > 0 && (
        <section className="rd-card" aria-labelledby="rd-subj">
          <h2 id="rd-subj">By subject</h2>
          <ul className="rd-subjects">
            {subjects.map((s, i) => (
              <li key={s.id}>
                <span className="rd-subjects__obj"><SubjectObject id={s.id} size={44} framed={false} /></span>
                <span className="rd-subjects__name"><b>{s.name}</b><i>{s.tests} session{s.tests === 1 ? '' : 's'}, mean session score {s.avg}%</i></span>
                <span className="rd-subjects__acc"><b>{s.accuracy}%</b><small>of answers right</small></span>
                <SubjectBar pct={s.accuracy} delay={i * 80} />
                {/* Wide lane (owner, 19 Nov 2026, "a bit more interactive"): with a mouse the whole row leads to practice in that
                    subject, the route Colleges' "Practise <subject>" already uses (a quick set of that subject's questions, the
                    Practice page's own price shown before it starts), with a small arrow on hover. Touch screens keep today's row. */}
                <Link className="rd-subjects__go" href={`/dashboard?subject=${encodeURIComponent(s.id)}&mode=quick`} aria-label={`Practise ${s.name}`}>
                  <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/admission-compass" className="rd-link">Where can these subjects take you?</Link>
        </section>
      )}
    </>
  );

  // While the record loads, its place holds the range line and the marks at their own size.
  const wait = (
    <div className="rd-ledger-wait" aria-hidden="true">
      <span className="skeleton rd-ledger-wait__note" />
      <span className="skeleton rd-ledger-wait__marks" />
    </div>
  );

  return (
    <div className="rd view" aria-busy={status === 'loading' || undefined}>
      <header className="rd-head">
        <div>
          <h1 className="display-md">Where your marks are going</h1>
          {/* U5: a fresh account reads one plain line, not "0 sessions, 0 questions answered." */}
          {status === 'loading' ? <p role="status">Reading your sessions…</p>
            : status === 'ready' ? <p>{totalAttempts === 0 ? 'No sessions yet.' : `${totalAttempts} session${totalAttempts === 1 ? '' : 's'}, ${totalQ} question${totalQ === 1 ? '' : 's'} answered.`}{data.scoring?.device > 0 ? ` Includes ${data.scoring.device} earlier attempt${data.scoring.device === 1 ? '' : 's'} scored in your browser before server scoring.` : ''}</p>
              : null}
        </div>
        <Link href="/mentor?tab=ask" className="rd-ask" onClick={(event) => { if (isPlainClick(event) && openAskMobi({ tab: 'ask', from: event.currentTarget })) event.preventDefault(); }}>Ask Mobi</Link>
      </header>

      <div className="pp-arena rd-desk">
        {/* U5: an empty record carries the page's one key, the first set (RecordView, src/lib/firstSet.mjs). */}
        <RecordView state={record} pro={pro} oneLock chaptersFirst chaptersInReview desk={{ side, main, wait }} afterFindings={across} onNavigate={(href) => { window.location.assign(href); }} />
      </div>
    </div>
  );
}
