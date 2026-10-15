"use client";

// Review: the hub (web IA plan 2.2 and 5.3), in the app's words and order.
//   1. Mistakes to repair   tonight's paper, by chapter, with "Repair these 4". The Review badge shows this count.
//   2. Where your marks go  one finding from the record, and a row that opens Your record
//   3. Past results         each opens its result
//   4. Saved questions      one row
//   5. Repair record        Found, Repaired, Checked, Holds
// A header key opens Ask Mobi. One filled button on the page: the repair key. One Mobi, beside the first card.
// Every part reads on its own and says so when it could not: a failed read never blanks the rest of the page,
// and an unreadable number is left out, never shown as 0. The numbers come from src/app/(app)/review/reviewModel.mjs.
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bookmark, ChevronDown, ChevronRight, MessageCircle } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useInsights } from '@/components/ai/useInsights';
import MobiReact from '@/components/brand/MobiReact';
import { SubjectIcon } from '@/components/ui/Glyph';
import { useShrug, useMobiGate } from '@/lib/mobiHooks';
import { greeting } from '@/lib/mobiRation';
import { mobiMoment } from '@/lib/mobiMoments';
import { useInView } from '@/lib/motion';
import { ASK_HREF, RECORD_HREF } from '@/lib/navigation';
import { publishTonightRepair } from '@/components/shell/shellSignals';
import { useReviewData } from './useReviewData';
import {
  CHAPTERS_VISIBLE, CLEAR_COPY, EMPTY_COPY, ERROR_COPY, LIFE_CAPTION, OFFLINE_COPY, PAST_VISIBLE, RECORD_EMPTY, STAGES,
  costLine, marksLine, minutesLine, mistakesHeadline, mistakesSection, oneFinding, paperTitle, pastResults, questionsLine,
  repairKey, repairLabel, repairRecordView,
} from './reviewModel.mjs';
import './review.css';

const PRACTICE_HREF = '/dashboard';
const QUICK_TEN_HREF = '/dashboard?mode=quick&count=10';

function Skeleton({ lines = 3 }) {
  return (
    <div className="rv-sk" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => <i key={i} data-w={i === 0 ? 'wide' : i === lines - 1 ? 'short' : 'mid'} />)}
    </div>
  );
}

/** Mobi beside the first card. He reads while there is something to read, rests when it is all repaired, shrugs once on a failed read. */
function ReviewMobi({ kind }) {
  const entrance = useMobiGate(() => greeting('review', 'read'), 'read');
  const shrug = useShrug(kind === 'error', 'review');
  const act = kind === 'error' ? (shrug ? 'oops' : 'idle') : kind === 'clear' ? mobiMoment('allClear') : entrance;
  return <MobiReact act={act} size={96} interactive label="Mobi" />;
}

// ---------------------------------------------------------------------------------------------
// 1. Mistakes to repair

function StateCard({ copy, kind, href = null, onAction = null, secondary = null }) {
  return (
    <section className="rv-card rv-card--state" aria-labelledby="rv-state-title" data-kind={kind}>
      <div className="rv-card__body">
        <div className="rv-card__main">
          <h3 id="rv-state-title" className="rv-card__title">{copy.title}</h3>
          <p className="rv-card__text" role={kind === 'error' || kind === 'offline' ? 'alert' : undefined}>{copy.body}</p>
          <div className="rv-actions">
            {href ? <Link className="btn-volt md mk-press rv-key" href={href}>{copy.action}</Link> : <button type="button" className="btn-volt md mk-press rv-key" onClick={onAction}>{copy.action}</button>}
            {secondary}
          </div>
        </div>
        <div className="rv-card__aside"><ReviewMobi kind={kind === 'offline' ? 'error' : kind} /></div>
      </div>
    </section>
  );
}

function MistakesCard({ section, paper, aiBalance, now }) {
  const [all, setAll] = useState(false);
  const { chapters, count, attemptId } = section;
  const shown = all ? chapters : chapters.slice(0, CHAPTERS_VISIBLE);
  const more = chapters.length - shown.length;
  return (
    <section className="rv-card" aria-labelledby="rv-tonight-title" data-kind="open">
      <div className="rv-card__body">
        <div className="rv-card__main">
          <p className="rv-card__label">{repairLabel(now)}</p>
          <h3 id="rv-tonight-title" className="rv-card__title">{mistakesHeadline(count, chapters.length)}</h3>
          <p className="rv-card__text">{[paper.subject, paper.source, paper.date].filter(Boolean).join(', ')}</p>
        </div>
        <div className="rv-card__aside"><ReviewMobi kind="open" /></div>
      </div>

      {section.listFailed ? (
        <p className="rv-card__text rv-fine" role="status">The chapter list did not load. The repair key still opens this paper.</p>
      ) : (
        <>
          <ul className="rv-chapters" aria-label="Chapters with mistakes to repair">
            {shown.map((c) => (
              <li key={c.chapter}>
                <span className="rv-chapters__name"><b>{c.chapter}</b>{c.numbers.length ? <small>{questionsLine(c.numbers)}</small> : null}</span>
                <span className="rv-chapters__n">{c.count} {c.count === 1 ? 'mistake' : 'mistakes'}</span>
              </li>
            ))}
          </ul>
          {chapters.length > CHAPTERS_VISIBLE ? (
            <button type="button" className="rv-toggle" aria-expanded={all} onClick={() => setAll((v) => !v)}>
              {all ? 'Show fewer chapters' : `Show ${more} more ${more === 1 ? 'chapter' : 'chapters'}`}
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          ) : null}
        </>
      )}

      <div className="rv-actions rv-actions--foot">
        <Link className="btn-volt md mk-press rv-key" href={`/result/${encodeURIComponent(attemptId)}`}>{repairKey(count)}</Link>
        <p className="rv-fine"><span>{minutesLine(count)}</span><span>{costLine(aiBalance)}</span></p>
      </div>
    </section>
  );
}

function MistakesSection({ data, section, now }) {
  let body;
  if (data.status === 'loading' || section.state === 'loading-list') {
    body = <section className="rv-card rv-card--loading" aria-busy="true" aria-label="Loading your mistakes"><Skeleton lines={4} /></section>;
  } else if (data.offline) {
    body = <StateCard kind="offline" copy={OFFLINE_COPY} onAction={data.retry} />;
  } else if (section.state === 'error') {
    body = <StateCard kind="error" copy={ERROR_COPY} onAction={data.retry} secondary={<Link className="rv-alt" href={PRACTICE_HREF}>Choose practice</Link>} />;
  } else if (section.state === 'empty') {
    body = <StateCard kind="empty" copy={EMPTY_COPY} href={PRACTICE_HREF} />;
  } else if (section.state === 'clear') {
    body = <StateCard kind="clear" copy={CLEAR_COPY} href={QUICK_TEN_HREF} />;
  } else {
    body = <MistakesCard section={section} paper={paperTitle(section.paper, data.summary || [], { complete: data.complete })} aiBalance={data.aiBalance} now={now} />;
  }
  return (
    <section className="rv-section" id="mistakes" aria-labelledby="rv-h-mistakes">
      <h2 id="rv-h-mistakes" className="rv-h">Mistakes to repair</h2>
      {body}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// 2. Where your marks go

function MarksSection({ insights }) {
  const finding = oneFinding(insights.findings);
  return (
    <section className="rv-section" id="record" aria-labelledby="rv-h-record">
      <h2 id="rv-h-record" className="rv-h">Where your marks go</h2>
      {insights.status === 'loading' ? <Skeleton lines={3} /> : null}
      {finding ? (
        <div className="rv-find">
          <b>{finding.headline}</b>
          <p>{finding.detail}</p>
          {finding.n ? <small>Based on {finding.n} {finding.n === 1 ? 'question' : 'questions'}</small> : null}
        </div>
      ) : null}
      {insights.status === 'empty' ? <p className="rv-quiet">Take a practice session and the biggest leak in your marks shows here.</p> : null}
      {insights.status === 'unavailable' ? <p className="rv-quiet" role="status">We could not read your record just now. Your record page still opens.</p> : null}
      <Link className="rv-row" href={RECORD_HREF}>
        <span className="rv-row__main"><b>See your record</b><small>Chapters, changed answers, pace and your weeks</small></span>
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// 3. Past results

function ResultRow({ row, fresh }) {
  return (
    <li>
      <Link className="rv-result" href={row.href}>
        <span className="rv-result__icon"><SubjectIcon id={row.subject} size={20} /></span>
        <span className="rv-result__main">
          <b>{row.subjectLabel}{fresh ? <span className="rv-new">New since your last look</span> : null}</b>
          <small>{row.source}{row.date ? `, ${row.date}` : ''}</small>
        </span>
        <span className="rv-result__side">
          <b>{marksLine(row)}</b>
          <small>{row.wrongLine}</small>
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
    </li>
  );
}

function ResultsSection({ data, rows }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, PAST_VISIBLE);
  return (
    <section className="rv-section" id="results" aria-labelledby="rv-h-results">
      <h2 id="rv-h-results" className="rv-h">Past results</h2>
      {data.status === 'loading' ? <Skeleton lines={5} /> : null}
      {data.status === 'ready' && data.summaryFailed ? (
        <p className="rv-quiet" role="alert">We could not load your past results. <button type="button" className="rv-link" onClick={data.retry}>Try again</button></p>
      ) : null}
      {data.status === 'ready' && !data.summaryFailed && rows.length === 0 ? <p className="rv-quiet">Your finished practice and mocks show here, newest first.</p> : null}
      {rows.length > 0 ? (
        <>
          <ul className="rv-list">{shown.map((row) => <ResultRow key={row.id} row={row} fresh={data.fresh.has(row.id)} />)}</ul>
          {rows.length > PAST_VISIBLE ? (
            <button type="button" className="rv-toggle" aria-expanded={all} onClick={() => setAll((v) => !v)}>
              {all ? 'Show fewer results' : `Show all ${rows.length} results`}
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// 4. Saved questions

function SavedSection() {
  return (
    <section className="rv-section" id="saved" aria-labelledby="rv-h-saved">
      <h2 id="rv-h-saved" className="rv-h">Saved questions</h2>
      <Link className="rv-row" href="/saved">
        <span className="rv-row__icon"><Bookmark size={18} aria-hidden="true" /></span>
        <span className="rv-row__main"><b>Questions you saved</b><small>Saved from the question stream, ready to revise</small></span>
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// 5. Repair record

function Life({ view }) {
  const [ref, seen] = useInView({ threshold: 0.4 });
  const stages = [view.found, view.repairedText, view.checkedText, view.holdsText];
  return (
    <div ref={ref} className="rv-life-wrap" data-in={seen ? 'true' : 'false'}>
      <ol className="rv-life" aria-label="Repair stages">
        {STAGES.map((name, i) => (
          <li key={name} data-soon={i >= 2 && (i === 2 ? view.checked === null : true) ? 'true' : undefined}>
            <span>{name}</span>
            <b>{stages[i]}</b>
          </li>
        ))}
      </ol>
      {view.ratio !== null ? (
        <>
          <i className="rv-meter" role="img" aria-label={view.progress || `${view.repaired} repaired of ${view.found} found`}><em style={{ transform: `scaleX(${Math.min(1, view.ratio)})` }} /></i>
          <p className="rv-fine">{view.progress ? `${view.progress}.` : `${view.found} found ${view.scope}.`}</p>
        </>
      ) : null}
    </div>
  );
}

function RecordSection({ data }) {
  const view = useMemo(() => (data.repairRows && data.summary ? repairRecordView({ rows: data.repairRows, attempts: data.summary, complete: data.complete }) : null),
    [data.repairRows, data.summary, data.complete]);
  return (
    <section className="rv-section" id="repair-record" aria-labelledby="rv-h-repairs">
      <h2 id="rv-h-repairs" className="rv-h">Repair record</h2>
      {data.status === 'loading' ? <Skeleton lines={3} /> : null}
      {data.status === 'ready' && data.repairFailed ? (
        <p className="rv-quiet" role="alert">Your repair record could not be loaded. <button type="button" className="rv-link" onClick={data.retry}>Try again</button></p>
      ) : null}
      {data.status === 'ready' && !data.repairFailed && !view ? <p className="rv-quiet">{RECORD_EMPTY}</p> : null}
      {view ? (
        <>
          <Life view={view} />
          {view.latest.length ? (
            <ul className="rv-latest" aria-label="Latest repairs">
              {view.latest.map((r) => (
                <li key={r.key}><b>{r.chapter}</b><small>{r.subjectLabel}. {r.line}</small></li>
              ))}
            </ul>
          ) : <p className="rv-quiet">{RECORD_EMPTY}</p>}
          <p className="rv-fine">{LIFE_CAPTION}</p>
        </>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------

export default function ReviewHub() {
  const { user } = useAuth();
  const userId = user?.id;
  const data = useReviewData(userId);
  const insights = useInsights(userId);
  const now = useMemo(() => new Date(), []);
  const rows = useMemo(() => (data.summary ? pastResults(data.summary, { complete: data.complete }) : []), [data.summary, data.complete]);

  // The badge on the Review tab says exactly what this page says, so the page hands it its count.
  const section = useMemo(() => mistakesSection({
    moveFacts: data.moveFacts, repairRows: data.repairRows, attempt: data.attempt, attemptFailed: data.attemptFailed,
    attempts: data.summary || data.moveFacts?.attempts || [],
  }), [data.moveFacts, data.repairRows, data.attempt, data.attemptFailed, data.summary]);
  const publishedCount = section.state === 'open' ? section.count : section.state === 'clear' || section.state === 'empty' ? 0 : null;
  const publishedAttempt = section.state === 'open' ? section.attemptId : null;
  useEffect(() => {
    if (!userId || data.status !== 'ready' || publishedCount === null) return;
    publishTonightRepair(userId, publishedCount > 0 ? { count: publishedCount, attemptId: publishedAttempt } : null);
  }, [userId, data.status, publishedCount, publishedAttempt]);

  return (
    <div className="student-page student-page--review rv">
      <header className="rv-head">
        <div>
          <h1 className="rv-title">Review</h1>
          <p className="rv-lede">Repair your mistakes, see where your marks go and reopen your past results.</p>
        </div>
        <Link className="rv-ask mk-press" href={ASK_HREF}><MessageCircle size={18} aria-hidden="true" />Ask Mobi</Link>
      </header>

      <MistakesSection data={data} section={section} now={now} />

      <div className="rv-grid">
        <div className="rv-col">
          <MarksSection insights={insights} />
          {data.offline ? null : <ResultsSection data={data} rows={rows} />}
        </div>
        <div className="rv-col">
          <SavedSection />
          {data.offline ? null : <RecordSection data={data} />}
        </div>
      </div>
    </div>
  );
}
