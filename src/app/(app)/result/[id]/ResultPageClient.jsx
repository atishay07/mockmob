"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageSpinner, ErrorState } from '@/components/ui/Skeleton';
import { apiGet, apiPost } from '@/lib/fetcher';
import ScoreRecoveryLab from '@/components/ScoreRecoveryLab';
import MistakeRepair from '@/components/recovery/MistakeRepair';
import { analyseSession, formatDuration } from '@/../data/session_recovery';
import { AppIcon } from '@/components/ui/Glyph';
import { Mascot } from '@/components/brand/Mascot';
import '@/components/recovery/result.css';

function displayValue(value, fallback = '') {
  if (value == null) return fallback;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') return value.text ?? value.label ?? value.name ?? value.key ?? fallback;
  return String(value);
}

const LETTERS = 'ABCDEFGH';

// The headline number counts up once on arrival; reduced motion shows it at once.
function CountUp({ value }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !value) return undefined;
    let raf; let start;
    const step = (t) => { start ??= t; const p = Math.min((t - start) / 750, 1); setShown(Math.round(value * (1 - (1 - p) ** 3))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}
const subjectName = (s) => String(s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

function verdictLine({ marks }) {
  if (!marks.gap) return 'Every question right. Nothing to repair; take a harder set next.';
  if (marks.wrong && marks.gapWrong >= marks.gapBlank) return `${marks.wrong} wrong answer${marks.wrong === 1 ? '' : 's'} cost ${marks.gapWrong} of the ${marks.gap} marks you missed. The Lab below shows which to repair first.`;
  return `${marks.blank} blank${marks.blank === 1 ? '' : 's'} left ${marks.gapBlank} marks unearned. The Lab below shows where they were.`;
}

/**
 * Result page: summary first, then the Score Recovery Lab, then every answer in order.
 * Fetches a single attempt by ID instead of pulling all user attempts.
 */
export default function ResultPageClient({ previewId = null }) {
  const params = useParams();
  const id = previewId || params.id;
  const [attempt, setAttempt] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all | correct | wrong | skipped
  const [open, setOpen] = useState(() => new Set());
  const [repaired, setRepaired] = useState(() => new Set());
  const [autoRepair, setAutoRepair] = useState(null);
  const [reporting, setReporting] = useState({});
  const [reported, setReported] = useState({});
  const [reportError, setReportError] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    queueMicrotask(() => { if (alive) { setAttempt(null); setError(null); setFilter('all'); setReporting({}); setReported({}); setReportError(null); setRepaired(new Set()); setAutoRepair(null); } });
    apiGet(`/api/attempts/${id}`)
      .then(data => { if (!alive) return; setAttempt(data); const firstWrong = (data.details || []).find(d => d.isCorrect === false); setOpen(new Set(firstWrong ? [firstWrong.qid] : [])); })
      .catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [id, retry]);

  const analysis = useMemo(() => attempt ? analyseSession(attempt) : null, [attempt]);
  const visible = useMemo(() => analysis ? analysis.rows.filter(r => filter === 'all' || r.verdict === filter) : [], [analysis, filter]);

  const jumpTo = useCallback((number, { repair = false } = {}) => {
    const row = analysis?.rows.find(r => r.number === number);
    if (!row) return;
    setFilter(f => (f === 'all' || f === row.verdict ? f : 'all'));
    setOpen(s => new Set(s).add(row.q.id));
    if (repair) setAutoRepair(row.q.id);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.getElementById(`q-${number}`);
      el?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      el?.querySelector('.rp-q__bar')?.focus({ preventScroll: true });
    }));
  }, [analysis]);

  const repairNext = useCallback(() => {
    const next = analysis?.mistakes.find(r => !repaired.has(r.q.id));
    if (next) jumpTo(next.number, { repair: true });
  }, [analysis, repaired, jumpTo]);

  const settled = useCallback((qid, status) => {
    if (['explained', 'stored', 'held_for_recheck', 'not_explained'].includes(status)) setRepaired(s => new Set(s).add(qid));
  }, []);

  if (error)    return <div className="container-narrow student-page student-page--result pt-8"><ErrorState mascot message="This session did not load. Try again to see your recorded result." onRetry={() => { setError(null); setRetry((count) => count + 1); }} /></div>;
  if (!attempt || !analysis) return <PageSpinner label="Loading your recorded result…" />;

  const { marks, timing } = analysis;
  const answered = marks.right + marks.wrong;
  const accuracy = answered ? Math.round((marks.right / answered) * 100) : 0;
  const isPass = attempt.score >= 40;
  const toggle = (qid) => setOpen(s => { const n = new Set(s); if (n.has(qid)) n.delete(qid); else n.add(qid); return n; });

  async function handleReport(row) {
    const qid = row?.q?.id;
    if (!qid || reporting[qid] || reported[qid]) return;
    const note = window.prompt('What looks wrong? Example: answer key, option text, explanation, or unclear wording.');
    if (note === null) return;

    setReportError(null);
    setReporting((current) => ({ ...current, [qid]: true }));
    try {
      await apiPost(`/api/questions/${encodeURIComponent(qid)}/interact`, {
        interaction_type: 'report',
        flow_context: 'review',
        session_id: attempt.id,
        metadata: {
          source: 'result_analysis',
          attempt_id: attempt.id,
          subject: attempt.subject,
          verdict: row.verdict,
          note: note.trim(),
          given_index: row.d?.givenIndex ?? null,
          correct_index: row.q?.correctIndex ?? null,
        },
      });
      setReported((current) => ({ ...current, [qid]: true }));
    } catch (e) {
      setReportError(e.message || 'Failed to report question.');
    } finally {
      setReporting((current) => {
        const next = { ...current };
        delete next[qid];
        return next;
      });
    }
  }

  return (
    <div className="container-narrow student-page student-page--result rp pb-20">
      {/* ---------- 1. Summary ---------- */}
      <header className="rp-hero">
        <div className="rp-hero__pip pip-drill-result"><Mascot pose={isPass ? 'celebrating' : 'encouraging'} alt={isPass ? 'Mobi celebrating a finished session.' : 'Mobi encouraging you after a hard session.'} /></div>
        <div className="rp-hero__main">
          <p className="rp-eyebrow">Session complete · {subjectName(attempt.subject)} · {attempt.total} questions{timing ? ` · ${formatDuration(timing.totalMs)}` : ''}</p>
          <h1 className="rp-hero__score"><b data-tone={marks.scored < 0 ? 'bad' : isPass ? 'good' : 'mid'}>{marks.scored < 0 ? '−' : ''}<CountUp value={Math.abs(marks.scored)} /></b><span>/ {marks.max} marks</span></h1>
          <p className="rp-hero__line">{verdictLine(analysis)}</p>
        </div>
        <dl className="rp-stats">
          <div data-kind="right"><dt>Right</dt><dd>{marks.right}<small>+{marks.right * 5}</small></dd></div>
          <div data-kind="wrong"><dt>Wrong</dt><dd>{marks.wrong}<small>−{marks.wrong}</small></dd></div>
          <div data-kind="blank"><dt>Blank</dt><dd>{marks.blank}<small>0</small></dd></div>
          <div><dt>Accuracy</dt><dd>{`${accuracy}%`}<small>of answered</small></dd></div>
        </dl>
        <ol className="rp-strip" aria-label="Questions in this session">
          {analysis.rows.map(r => (
            <li key={r.q.id} style={{ '--i': r.index }}>
              <button type="button" data-verdict={r.verdict} data-changed={r.changed || undefined} onClick={() => jumpTo(r.number)}
                aria-label={`Question ${r.number}: ${r.verdict === 'skipped' ? 'blank' : r.verdict}${r.changed ? ', answer changed' : ''}`}>{r.number}</button>
            </li>
          ))}
        </ol>
      </header>

      {/* ---------- 2. Score Recovery Lab ---------- */}
      <ScoreRecoveryLab attempt={attempt} analysis={analysis} repaired={repaired} onJump={jumpTo} onRepairNext={repairNext} />

      {/* ---------- 3. Answer by answer ---------- */}
      <section className="rp-review" aria-labelledby="rp-review-title">
        <div className="rp-review__head">
          <h2 id="rp-review-title">Answer by answer</h2>
          <div className="rp-filters" role="group" aria-label="Filter answers">
            {[
              { id: 'all',     label: `All ${attempt.total}` },
              { id: 'wrong',   label: `Wrong ${marks.wrong}` },
              { id: 'skipped', label: `Blank ${marks.blank}` },
              { id: 'correct', label: `Right ${marks.right}` },
            ].map(t => (
              <button key={t.id} type="button" aria-pressed={filter === t.id} onClick={() => setFilter(t.id)}>{t.label}</button>
            ))}
          </div>
        </div>
        {reportError ? <div role="alert" className="rp-alert">{reportError}</div> : null}

        <ol className="rp-list">
          {visible.length === 0 ? <li className="rp-empty">Nothing in this group.</li> : visible.map(row => {
            const { q, d, verdict, number } = row;
            const isOpen = open.has(q.id);
            const given = d?.givenIndex;
            const isWrong = verdict === 'wrong';
            return (
              <li key={q.id} id={`q-${number}`} className="rp-q" data-verdict={verdict} data-open={isOpen || undefined}>
                <h3 className="rp-q__h"><button type="button" className="rp-q__bar" aria-expanded={isOpen} aria-controls={`q-${number}-body`} onClick={() => toggle(q.id)}>
                  <span className="rp-q__badge" aria-hidden="true">{number}</span>
                  <span className="rp-q__summary">
                    <span className="rp-q__text">{displayValue(q.question ?? q.body, 'Question unavailable')}</span>
                    <span className="rp-q__meta">
                      <span data-verdict={verdict}>{verdict === 'correct' ? 'Right +5' : isWrong ? 'Wrong −1' : 'Blank 0'}</span>
                      <span>{row.chapter}</span>
                      {Number.isFinite(row.ms) ? <span>{formatDuration(row.ms)}</span> : null}
                      {row.changed ? <span>Answer changed</span> : null}
                      {repaired.has(q.id) ? <span data-verdict="repaired">Repaired</span> : null}
                    </span>
                  </span>
                  <span className="rp-q__chev" aria-hidden="true" />
                </button></h3>
                {isOpen ? (
                  <div className="rp-q__body" id={`q-${number}-body`}>
                    <ul className="rp-options">
                      {q.options.map((opt, j) => {
                        const mine = given === j, key = q.correctIndex === j;
                        return (
                          <li key={j} data-state={key ? 'key' : mine ? 'mine' : undefined}>
                            <span className="rp-options__letter">{LETTERS[j]}</span>
                            <span className="rp-options__text">{displayValue(opt, 'Option')}</span>
                            {mine || key ? <span className="rp-options__tag">{key && mine ? 'Your pick · correct' : key ? 'Correct' : 'Your pick'}</span> : null}
                          </li>
                        );
                      })}
                    </ul>
                    {q.explanation ? (
                      isWrong ? (
                        <details className="rp-expl"><summary>Book explanation</summary><p>{displayValue(q.explanation)}</p></details>
                      ) : <div className="rp-expl rp-expl--open"><span>Explanation</span><p>{displayValue(q.explanation)}</p></div>
                    ) : null}
                    {isWrong && Number.isInteger(given) ? (
                      <MistakeRepair key={q.id} attemptId={attempt.id} questionId={q.id} chosen={LETTERS[given]} answer={Number.isInteger(q.correctIndex) ? LETTERS[q.correctIndex] : null}
                        autoStart={autoRepair === q.id} onSettled={settled}
                        next={(() => { const n = analysis.mistakes.find(m => m.number > number && !repaired.has(m.q.id)) || analysis.mistakes.find(m => m.q.id !== q.id && !repaired.has(m.q.id)); return n ? { number: n.number, go: () => jumpTo(n.number, { repair: true }) } : null; })()} />
                    ) : null}
                    <div className="rp-q__foot">
                      <button type="button" className="rp-report" disabled={!!reporting[q.id] || !!reported[q.id]} onClick={() => handleReport(row)}>
                        {reported[q.id] ? 'Reported. Thank you.' : reporting[q.id] ? 'Sending…' : 'Report a problem with this question'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <nav className="rp-links" aria-label="More from your record">
        <Link href="/mentor?tab=record"><AppIcon name="prepos" size={16} />Full record in PrepOS</Link>
        <Link href="/review"><AppIcon name="review" size={16} />All saved mistakes</Link>
        <Link href="/analytics"><AppIcon name="radar" size={16} />Open Radar</Link>
        <Link href="/dashboard"><AppIcon name="practice" size={16} />Back to Practice</Link>
      </nav>
    </div>
  );
}
