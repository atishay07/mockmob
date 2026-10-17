"use client";

// Radar: where the student's marks are going. The record view (ledger, leaks, chapters, changed
// answers, pace, week on week) is the same free, model-free analysis PrepOS uses, so the two never
// disagree. The score trend keeps the attempt-level chart. No invented composite scores.
// "Across your mocks" (spec tmp/mistake-lab-v4/SPEC.md 4.9): the same component and the same server sentences as the end
// of the Mistake Lab (GET /api/me/rules), open here, with the way into the Rule book. Pass 2 (16 Oct): the marks lead
// (the ledger is the anchor), Across sits after What stands out, and on narrow screens the trend and subjects follow
// the marks instead of closing a 3,500 px page.
import { isPlainClick, openAskMobi } from '@/components/ai/askMobi.mjs';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { SkeletonCard, ErrorState } from '@/components/ui/Skeleton';
import { apiGet } from '@/lib/fetcher';
import RecordView from '@/components/ai/RecordView';
import { useInsights } from '@/components/ai/useInsights';
import { useAuth } from '@/components/AuthProvider';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { useInView } from '@/lib/motion';
import TrendScrub from './TrendScrub';
import AcrossMocks from '@/components/result/AcrossMocks';
import { useRuleBook } from '@/components/rules/useRuleBook';
import FirstTimedMock from '@/components/timed/FirstTimedMock';
import { useFirstTimedMock } from '@/components/timed/useFirstTimedMock';
import './analytics.css';

// A thin bar that inks in when its row scrolls into view. The figure beside it carries the number.
function SubjectBar({ pct, delay = 0 }) {
  const [ref, seen] = useInView({ threshold: 0.5 });
  return <span className="rd-bar" ref={ref} data-in={seen ? 'true' : 'false'} style={{ '--w': Math.max(0, Math.min(100, pct)) / 100, '--rd-delay': `${delay}ms` }} aria-hidden="true"><i /></span>;
}

// Chart.js paints on a canvas, so it cannot read CSS variables. Read the live Arena tokens and
// re-read when the theme switches.
// Two columns from 1100 px. Below that the trend and subjects are placed right after the marks inside the record.
const WIDE = '(min-width: 1100px)';
const wideSubscribe = (onChange) => {
  let query;
  try { query = window.matchMedia(WIDE); } catch { return () => {}; }
  query.addEventListener?.('change', onChange);
  return () => query.removeEventListener?.('change', onChange);
};
const wideSnapshot = () => { try { return window.matchMedia(WIDE).matches; } catch { return true; } };
// null on the server: neither layout is assumed until the browser answers.
function useWide() {
  return useSyncExternalStore(wideSubscribe, wideSnapshot, () => null);
}

function useChartColors() {
  const [colors, setColors] = useState({ ink: '#93a08f', line: 'rgba(244,245,240,0.08)', accent: '#d2f000' });
  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      const pick = (name, fallback) => s.getPropertyValue(name).trim() || fallback;
      setColors({ ink: pick('--a-ink-3', '#93a08f'), line: pick('--a-line', 'rgba(244,245,240,0.08)'), accent: pick('--a-accent-text', '#d2f000') });
    };
    const t = window.setTimeout(read, 0);
    window.addEventListener('mm-theme', read);
    return () => { window.clearTimeout(t); window.removeEventListener('mm-theme', read); };
  }, []);
  return colors;
}

export default function AnalyticsPageClient() {
  const { user, status: authStatus } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const record = useInsights(user?.id);
  const colors = useChartColors();
  const pro = Boolean(user?.isPremium);
  const rules = useRuleBook({ enabled: authStatus !== 'loading' && Boolean(user?.id) });
  const wide = useWide();
  // The Lab's empty block (Across your mocks, no timed mock yet) gets the one key into a timed mock (data/first_timed_mock.js).
  const firstTimed = useFirstTimedMock('radar');

  useEffect(() => {
    if (authStatus === 'loading' || !user?.id) return undefined;
    let alive = true;
    apiGet(`/api/analytics?userId=${user.id}`).then((d) => { if (alive) setData(d); }).catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [user, authStatus, retryCount]);

  if (error) return <div className="container-std pt-8"><ErrorState scene="unreachable" title="Your record did not load" message="Check your connection and try again." onRetry={() => { setData(null); setError(null); setRetryCount((count) => count + 1); }} /></div>;
  if (authStatus === 'loading' || !data) {
    return (
      <div className="rd view" aria-busy="true">
        <header className="rd-head">
          <div>
            <h1 className="display-md">Where your marks are going</h1>
            <p role="status">Reading your sessions…</p>
          </div>
        </header>
        <SkeletonCard className="h-[200px]" lines={5} />
      </div>
    );
  }

  const { timeline, subjects, totalAttempts, totals } = data;
  const totalQ = totals.correct + totals.wrong + totals.unattempted;

  return (
    <div className="rd view">
      <header className="rd-head">
        <div>
          <h1 className="display-md">Where your marks are going</h1>
          <p>{totalAttempts} session{totalAttempts === 1 ? '' : 's'}, {totalQ} question{totalQ === 1 ? '' : 's'} answered.{data.scoring?.device > 0 ? ` Includes ${data.scoring.device} earlier attempt${data.scoring.device === 1 ? '' : 's'} scored in your browser before server scoring.` : ''}</p>
        </div>
        <Link href="/mentor?tab=ask" className="rd-ask" onClick={(event) => { if (isPlainClick(event) && openAskMobi({ tab: 'ask', from: event.currentTarget })) event.preventDefault(); }}>Ask Mobi</Link>
      </header>

      {(() => {
        const across = rules.state === 'ready' && rules.data?.acrossMocks ? (
          <AcrossMocks across={rules.data.acrossMocks} defaultOpen surface="card" footer={<>
            {rules.data.acrossMocks.state === 'none' ? <FirstTimedMock prompt={firstTimed} /> : null}
            {rules.data.book?.countLabel ? <Link href="/review/rules" className="rd-rules">{rules.data.book.countLabel}</Link> : null}
          </>} />
        ) : rules.state === 'error' ? (
          <p className="rd-across-fail" role="status">{rules.message} <button type="button" onClick={rules.retry}><RefreshCw size={14} strokeWidth={2.2} aria-hidden="true" />Try again</button></p>
        ) : rules.state === 'loading' ? <div className="rd-across-wait skeleton" aria-hidden="true" /> : null;
        const side = (
          <>
            <section className="rd-card" aria-labelledby="rd-trend">
              <h2 id="rd-trend">Score by session</h2>
              <div className="rd-chart rd-chart--scrub">
                {timeline.length > 1
                  ? <TrendScrub timeline={timeline} colors={colors} />
                  : <p className="pr-empty">{timeline.length === 0 ? 'Finish a session to start your trend.' : 'One more session and the trend line appears.'}</p>}
              </div>
              {timeline.length > 1 && <p className="rd-foot">{timeline[0].score}% to {timeline[timeline.length - 1].score}% over {timeline.length} sessions.</p>}
            </section>

            {subjects.length > 0 && (
              <section className="rd-card" aria-labelledby="rd-subj">
                <h2 id="rd-subj">By subject</h2>
                <ul className="rd-subjects">
                  {subjects.map((s, i) => (
                    <li key={s.id}>
                      <span className="rd-subjects__obj"><SubjectObject id={s.id} size={44} framed={false} /></span>
                      <span className="rd-subjects__name"><b>{s.name}</b><i>{s.tests} session{s.tests === 1 ? '' : 's'}, mean session score {s.avg}%</i></span>
                      <span className="rd-subjects__acc"><b>{s.accuracy}%</b><small>of answers right</small></span>
                      <SubjectBar pct={s.accuracy} delay={i * 80} />
                    </li>
                  ))}
                </ul>
                <Link href="/admission-compass" className="rd-link">Where can these subjects take you?</Link>
              </section>
            )}
          </>
        );
        // Inline only when the record is ready to carry it; otherwise the column follows the page as before.
        const inline = wide === false && record.status === 'ready';
        const narrowSide = inline ? <div className="rd-side rd-side--inline">{side}</div> : null;
        return (
          <div className="rd-cols">
            <div className="pp-arena rd-main">
              <RecordView state={record} pro={pro} oneLock chaptersFirst chaptersInReview emptyAction={false} afterLedger={narrowSide} afterFindings={across} onNavigate={(href) => { window.location.assign(href); }} />
              {record.status !== 'ready' ? across : null}
            </div>
            {!inline ? <aside className="rd-side" aria-label="Score by session and by subject">{side}</aside> : null}
          </div>
        );
      })()}
    </div>
  );
}
