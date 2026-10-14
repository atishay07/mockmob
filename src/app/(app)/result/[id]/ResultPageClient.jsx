"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageSpinner, ErrorState } from '@/components/ui/Skeleton';
import { apiGet, apiPost } from '@/lib/fetcher';
import ScoreRecoveryLab from '@/components/ScoreRecoveryLab';
import MistakeRepair from '@/components/recovery/MistakeRepair';
import KeyReviewLog from '@/components/recovery/KeyReviewLog';
import AnswerCorrectionNotice from '@/components/recovery/AnswerCorrectionNotice';
import KeyReviewNotice from '@/components/recovery/KeyReviewNotice';
import RunTrack from '@/components/recovery/RunTrack';
import RepairEnding from '@/components/recovery/RepairEnding';
import { RUN_COPY, runSegments, stepIndex, endingModel, retryIds as retryIdsOf, earlierMisses, earlierMissLine } from '@/components/recovery/repairRun';
import { REPAIR_OUTCOMES, hasExplanation, repairLabel, repairProgress } from '@/../data/repair_presentation.mjs';
import { analyseSession, formatDuration } from '@/../data/session_recovery';
import { AppIcon } from '@/components/ui/Glyph';
import MobiReact from '@/components/brand/MobiReact';
import ReaderMobi from '@/components/brand/ReaderMobi';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import '@/components/recovery/result.css';
import { plainOptionTexts } from '@/../data/option_text';
import { mobiReaction, answerReaction, repairKeyLabel, repairCandidates, verdictWord } from './reaction';

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
  const [visited, setVisited] = useState(() => new Set());
  const [repairOutcomes, setRepairOutcomes] = useState({});
  const [autoRepair, setAutoRepair] = useState(null);
  const [reporting, setReporting] = useState({});
  const [reported, setReported] = useState({});
  const [reportError, setReportError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [reading, setReading] = useState(null); // the answer row the reader Mobi glances at
  const [readerReact, setReaderReact] = useState(null); // { qid, first, then }: his reaction to the answer just opened
  const [hour] = useState(() => new Date().getHours()); // for the late-night hero
  const prefs = useMobiPrefs();
  const [arrived, setArrived] = useState(null); // { number, n }: focus ring after a jump
  const [peek, setPeek] = useState(null); // a bubble's label shown by a long press
  // The repair run: the mistakes of this paper in order, which ones the student began, the one on screen,
  // the panel the track just brought back (for its 160 ms hand-over), and the ending.
  const [started, setStarted] = useState(() => new Set());
  const [runCurrent, setRunCurrent] = useState(null);
  const [handover, setHandover] = useState(null); // { qid, n }
  const [ending, setEnding] = useState(false);
  const [ackedAt, setAckedAt] = useState(null); // when the server last acknowledged a new repair
  const [epochs, setEpochs] = useState({}); // qid -> times "Try the same mistakes again" reopened it
  const pressRef = useRef(null);
  const suppressRef = useRef(false);

  useEffect(() => {
    let alive = true;
    queueMicrotask(() => { if (alive) { setAttempt(null); setError(null); setFilter('all'); setReporting({}); setReported({}); setReportError(null); setRepairOutcomes({}); setAutoRepair(null); setStarted(new Set()); setRunCurrent(null); setHandover(null); setEnding(false); setAckedAt(null); setEpochs({}); } });
    apiGet(`/api/attempts/${id}`)
      .then(data => { if (!alive) return; setAttempt(data); setRepairOutcomes(Object.fromEntries(Object.entries(data.answerReviews || {}).map(([qid, review]) => [qid, review.state === 'corrected' ? 'corrected_key' : 'held_for_recheck']))); const firstWrong = (data.details || []).find(d => d.isCorrect === false); const initial = new Set(firstWrong ? [firstWrong.qid] : []); setOpen(initial); setVisited(initial); })
      .catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [id, retry]);

  const analysis = useMemo(() => attempt ? analyseSession(attempt) : null, [attempt]);
  const visible = useMemo(() => analysis ? analysis.rows.filter(r => filter === 'all' || r.verdict === filter) : [], [analysis, filter]);

  // The run is the paper's mistakes that repair could open when the result loaded (a key held later stays in it, as a set-aside segment).
  const runIds = useMemo(() => (attempt && analysis ? repairCandidates(analysis, new Set(), attempt.answerReviews).map(r => r.q.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attempt?.id, analysis?.rows.length]);
  const runNumbers = useMemo(() => Object.fromEntries((analysis?.rows || []).map(r => [r.q.id, r.number])), [analysis]);
  const reached = useMemo(() => new Set([...started, ...runIds.filter(id => repairOutcomes[id])]), [started, runIds, repairOutcomes]);
  const engaged = started.size > 0;
  const segments = useMemo(() => runSegments({ ids: runIds, numbers: runNumbers, outcomes: repairOutcomes, reached, current: runCurrent }), [runIds, runNumbers, repairOutcomes, reached, runCurrent]);
  const jumpTo = useCallback((number, { repair = false, instant, keepFocus = false } = {}) => {
    const row = analysis?.rows.find(r => r.number === number);
    if (!row) return;
    const inRun = runIds.includes(row.q.id);
    const step = inRun && (repair || engaged);
    const quick = instant ?? (step && engaged);
    setFilter(f => (f === 'all' || f === row.verdict ? f : 'all'));
    setOpen(s => new Set(s).add(row.q.id));
    setVisited(s => new Set(s).add(row.q.id));
    if (repair) setAutoRepair(row.q.id);
    if (step) { setRunCurrent(row.q.id); setHandover((h) => ({ qid: row.q.id, n: (h?.n || 0) + 1 })); }
    setReading(row.q.id);
    setArrived((prev) => ({ number, n: (prev?.n || 0) + 1 }));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.getElementById(`q-${number}`);
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
      el?.scrollIntoView({ behavior: still || quick ? 'auto' : 'smooth', block: 'start' });
      if (!keepFocus) el?.querySelector('.rp-q__bar')?.focus({ preventScroll: true });
    }));
  }, [analysis, runIds, engaged]);

  const repaired = useMemo(() => new Set((analysis?.mistakes || []).filter(r => hasExplanation(repairOutcomes[r.q.id])).map(r => r.q.id)), [analysis, repairOutcomes]);
  const handled = useMemo(() => repairProgress(analysis?.mistakes || [], repairOutcomes).handled, [analysis, repairOutcomes]);
  const noteStart = useCallback((qid) => { setStarted(s => (s.has(qid) ? s : new Set(s).add(qid))); setRunCurrent(qid); }, []);
  const goSegment = useCallback((index, { keepFocus = false } = {}) => {
    const id = runIds[index];
    if (id != null) jumpTo(runNumbers[id], { instant: true, keepFocus });
  }, [runIds, runNumbers, jumpTo]);
  const stepFrom = useCallback((qid, dir) => {
    const to = stepIndex(segments, runIds.indexOf(qid), dir);
    if (to >= 0) goSegment(to, { keepFocus: true });
  }, [segments, runIds, goSegment]);

  const keyReviews = (analysis?.rows || []).filter(r => repairOutcomes[r.q.id] === 'held_for_recheck').map(r => ({ number: r.number, chapter: r.chapter }));
  const correctedRows = (analysis?.rows || []).filter(r => attempt.answerReviews?.[r.q.id]?.state === 'corrected');
  const correctionAdjustment = correctedRows.reduce((sum, r) => sum + attempt.answerReviews[r.q.id].adjustment, 0);
  const reviewReceived = useCallback((qid, review) => {
    setAttempt(a => ({ ...a, answerReviews: { ...a.answerReviews, [qid]: review } }));
    setRepairOutcomes(s => ({ ...s, [qid]: review.state === 'corrected' ? 'corrected_key' : 'held_for_recheck' }));
  }, []);

  const repairNext = useCallback(() => {
    const next = analysis?.mistakes.find(r => !handled.has(r.q.id));
    if (next) jumpTo(next.number, { repair: true });
  }, [analysis, handled, jumpTo]);

  // Long press on a bubble shows its label instead of jumping.
  useEffect(() => {
    if (!peek) return undefined;
    const timer = setTimeout(() => setPeek(null), 1800);
    return () => clearTimeout(timer);
  }, [peek]);
  const startBubblePress = useCallback((event, number) => {
    suppressRef.current = false;
    if (event.pointerType !== 'touch') return;
    clearTimeout(pressRef.current);
    pressRef.current = setTimeout(() => { suppressRef.current = true; setPeek(number); }, 450);
  }, []);
  const endBubblePress = useCallback(() => clearTimeout(pressRef.current), []);

  const settled = useCallback((qid, status) => {
    if (REPAIR_OUTCOMES.includes(status)) setRepairOutcomes(s => ({ ...s, [qid]: status }));
    if (status === 'explained') setAckedAt(Date.now());
  }, []);

  if (error)    return <div className="container-narrow student-page student-page--result pt-8"><ErrorState mascot message="This session did not load. Try again to see your recorded result." onRetry={() => { setError(null); setRetry((count) => count + 1); }} /></div>;
  if (!attempt || !analysis) return <PageSpinner label="Loading your recorded result…" />;

  const { marks, timing } = analysis;
  const runModel = endingModel({ ids: runIds, outcomes: repairOutcomes, reached });
  const answered = marks.right + marks.wrong;
  const accuracy = answered ? Math.round((marks.right / answered) * 100) : 0;
  const isPass = attempt.score >= 40;
  const toggle = (qid) => { if (!open.has(qid)) { setReading(qid); const verdict = analysis.rows.find(r => r.q.id === qid)?.verdict; const react = !engaged ? answerReaction(verdict, { celebrations: prefs.celebrations, reduced: prefs.reduced }) : null; setReaderReact(react ? { qid, ...react } : null); } setVisited(s => new Set(s).add(qid)); setOpen(s => { const n = new Set(s); if (n.has(qid)) n.delete(qid); else n.add(qid); return n; }); };
  // Mobi's reaction follows the server's recap tone, the same table as the app; none in NTA mode.
  const reaction = mobiReaction(attempt, { celebrations: prefs.celebrations, hour });
  const isNtaAttempt = attempt.selectionMeta?.mode === 'nta';
  const candidates = repairCandidates(analysis, handled, attempt.answerReviews);
  const repairKey = repairKeyLabel(candidates);
  const firstWrong = analysis.rows.findIndex(r => r.verdict === 'wrong');
  const rippleStep = firstWrong > 0 ? Math.min(35, Math.round(700 / firstWrong)) : 0;
  // The ending reads the run's real outcomes; "Try the same mistakes again" reopens exactly those that did not settle.
  const retryRows = (ids) => analysis.rows.filter(r => ids.includes(r.q.id));
  const retryChapter = (() => { const chapters = new Set(retryRows(retryIdsOf(runModel)).map(r => r.chapter)); return chapters.size === 1 ? [...chapters][0] : ''; })();
  const tryAgain = (ids) => {
    setEnding(false);
    setRepairOutcomes(s => { const n = { ...s }; for (const id of ids) delete n[id]; return n; });
    setEpochs(e => { const n = { ...e }; for (const id of ids) n[id] = (n[id] || 0) + 1; return n; });
    const first = retryRows(ids)[0];
    // Only the first reopened mistake starts on its own (set now, so the reopened rows mount with it); the rest wait for their turn.
    if (first) { setAutoRepair(first.q.id); requestAnimationFrame(() => jumpTo(first.number, { repair: true, instant: true })); }
  };
  const bubbleLabel = (r) => `Q${r.number}, ${r.chapter}: ${verdictWord(r.verdict)}${r.changed ? ', answer changed' : ''}`;

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
      <header className="rp-hero" data-mobi={reaction ? undefined : 'none'}>
        {reaction ? <div className="rp-hero__pip pip-drill-result"><MobiReact act={reaction.act} size={84} label={reaction.alt} still={engaged || reading != null} /></div> : null}
        <div className="rp-hero__main">
          <p className="rp-eyebrow">Session complete · {subjectName(attempt.subject)} · {attempt.total} questions{timing ? ` · ${formatDuration(timing.totalMs)}` : ''}</p>
          <h1 className="rp-hero__score"><b data-tone={marks.scored < 0 ? 'bad' : isPass ? 'good' : 'mid'}>{marks.scored < 0 ? '−' : ''}<CountUp value={Math.abs(marks.scored)} /></b><span>/ {marks.max} marks</span></h1>
          <p className="rp-hero__line">{verdictLine(analysis)}{reaction?.line ? ` ${reaction.line}` : ''}</p>
        </div>
        <dl className="rp-stats">
          <div data-kind="right"><dt>Right</dt><dd><span className="rp-stat__value">{marks.right}</span><small>+{marks.right * 5}</small></dd></div>
          <div data-kind="wrong"><dt>Wrong</dt><dd><span className="rp-stat__value">{marks.wrong}</span><small>−{marks.wrong}</small></dd></div>
          <div data-kind="blank"><dt>Blank</dt><dd><span className="rp-stat__value">{marks.blank}</span><small>0</small></dd></div>
          <div><dt>Accuracy</dt><dd><span className="rp-stat__value">{`${accuracy}%`}</span><small>of answered</small></dd></div>
        </dl>
        <ol className="rp-strip" aria-label="Answer map: press a question to open it" style={{ '--rp-step': `${rippleStep}ms` }}>
          {analysis.rows.map(r => (
            <li key={r.q.id} style={{ '--i': r.index }}>
              <button type="button" data-verdict={r.verdict} data-changed={r.changed || undefined}
                data-ripple={firstWrong >= 0 && r.index <= firstWrong ? (r.index === firstWrong ? 'end' : '') : undefined}
                data-label={bubbleLabel(r)} data-peek={peek === r.number || undefined}
                onPointerDown={(event) => startBubblePress(event, r.number)} onPointerUp={endBubblePress} onPointerCancel={endBubblePress} onPointerLeave={endBubblePress}
                onContextMenu={(event) => { if (event.nativeEvent.pointerType === 'touch' || suppressRef.current) event.preventDefault(); }}
                onClick={() => { if (suppressRef.current) { suppressRef.current = false; return; } jumpTo(r.number); }}
                aria-label={bubbleLabel(r).replace(/^Q/, 'Question ')}>{r.number}</button>
            </li>
          ))}
        </ol>
        {repairKey ? <div className="rp-hero__next"><button type="button" className="rp-repair-key" onClick={() => jumpTo(candidates[0].number, { repair: true })}>{repairKey}</button></div> : null}
      </header>

      {/* ---------- 2. Score Recovery Lab ---------- */}
      <ScoreRecoveryLab attempt={attempt} analysis={analysis} repaired={repaired} handled={handled} onJump={jumpTo} onRepairNext={repairNext} />

      <KeyReviewLog items={keyReviews} onJump={jumpTo} />
      {attempt.answerReviewState === 'unavailable' ? <p className="rp-alert" role="status">Current answer-key checks could not load. The options below show the key used in your original session.</p> : null}
      {correctedRows.length ? <section className="kr-log" aria-label="Answer corrections"><h2>We corrected {correctedRows.length === 1 ? 'an answer key' : `${correctedRows.length} answer keys`}. We’re sorry.</h2><p>Your original result is preserved. Applying these checked corrections gives a separate adjustment of {correctionAdjustment > 0 ? '+' : ''}{correctionAdjustment} marks. This has not changed your account or leaderboard score.</p><ul>{correctedRows.map(r => <li key={r.q.id}><button type="button" onClick={() => jumpTo(r.number)}><b>Q{r.number}</b><span>{r.chapter}</span><em>See correction</em></button></li>)}</ul></section> : null}

      {/* ---------- 3. Answer by answer ---------- */}
      <section className="rp-review" aria-labelledby="rp-review-title">
        {engaged && segments.length > 1 ? (
          <div className="rt-bar">
            <RunTrack segments={segments} onGo={goSegment} onFinish={runIds.some(id => repairOutcomes[id]) ? () => setEnding(true) : null} />
          </div>
        ) : null}
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
          {visible.length === 0 ? <li className="rp-empty">Nothing in this group.</li> : null}
          {analysis.rows.map(row => {
            const { q, d, verdict, number } = row;
            const isOpen = open.has(q.id);
            const given = d?.givenIndex;
            const isWrong = verdict === 'wrong';
            const review = attempt.answerReviews?.[q.id];
            return (
              <li key={q.id} id={`q-${number}`} className="rp-q" hidden={filter !== 'all' && filter !== verdict} data-verdict={verdict} data-open={isOpen || undefined}>
                {arrived?.number === number ? <span key={arrived.n} className="rp-q__ring" aria-hidden="true" /> : null}
                <h3 className="rp-q__h"><button type="button" className="rp-q__bar" aria-expanded={isOpen} aria-controls={`q-${number}-body`} onClick={() => toggle(q.id)}>
                  <span className="rp-q__badge" aria-hidden="true">{number}</span>
                  <span className="rp-q__summary">
                    <span className="rp-q__text">{displayValue(q.question ?? q.body, 'Question unavailable')}</span>
                    <span className="rp-q__meta">
                      <span data-verdict={verdict}>{review ? 'Recorded: ' : ''}{verdict === 'correct' ? 'Right +5' : isWrong ? 'Wrong −1' : 'Blank 0'}</span>
                      <span>{row.chapter}</span>
                      {Number.isFinite(row.ms) ? <span>{formatDuration(row.ms)}</span> : null}
                      {row.changed ? <span>Answer changed</span> : null}
                      {earlierMisses(attempt, q.id).length ? <span data-kind="twice">{RUN_COPY.missedTimes(earlierMisses(attempt, q.id).length + 1)}</span> : null}
                      {repairLabel(repairOutcomes[q.id]) ? <span data-verdict={hasExplanation(repairOutcomes[q.id]) ? "repaired" : "held"}>{repairLabel(repairOutcomes[q.id])}</span> : null}
                    </span>
                  </span>
                  <span className="rp-q__chev" aria-hidden="true" />
                </button></h3>
                  <div className="rp-q__body" id={`q-${number}-body`} hidden={!isOpen}>
                    {visited.has(q.id) ? <>
                    <ul className="rp-options">
                      {q.options.map((opt, j) => {
                        const mine = given === j, key = q.correctIndex === j;
                        const corrected = review?.state === 'corrected' && review.currentIndex === j;
                        return (
                          <li key={j} data-state={corrected || (!review && key) ? 'key' : mine ? 'mine' : undefined}>
                            <span className="rp-options__letter">{LETTERS[j]}</span>
                            <span className="rp-options__text">{displayValue(plainOptionTexts(q.options)[j] ?? opt, 'Option')}</span>
                            {mine || key || corrected ? <span className="rp-options__tag">{corrected ? mine ? 'Your pick · corrected answer' : 'Corrected answer' : key ? mine ? 'Your pick · key at submission' : 'Key at submission' : 'Your pick'}</span> : null}
                          </li>
                        );
                      })}
                    </ul>
                    {q.explanation && !review ? (
                      isWrong ? (
                        <details className="rp-expl"><summary>Book explanation</summary><p>{displayValue(q.explanation)}</p></details>
                      ) : <div className="rp-expl rp-expl--open"><span>Explanation</span><p>{displayValue(q.explanation)}</p></div>
                    ) : null}
                    {isWrong && Number.isInteger(given) ? (
                      <MistakeRepair key={`${q.id}:${epochs[q.id] || 0}`} attemptId={attempt.id} questionId={q.id} number={number} nta={isNtaAttempt} chosen={LETTERS[given]} answer={Number.isInteger(q.correctIndex) ? LETTERS[q.correctIndex] : null}
                        autoStart={autoRepair === q.id} onSettled={settled} initialReview={review} onReview={reviewReceived}
                        isCurrent={!engaged || runCurrent === q.id} onStart={noteStart} onStep={engaged ? stepFrom : undefined} onFinish={() => setEnding(true)}
                        handover={handover?.qid === q.id ? (handover.n % 2 ? 'a' : 'b') : null}
                        earlier={(() => { const m = earlierMisses(attempt, q.id)[0]; return m ? { line: earlierMissLine(m), href: `/result/${m.attemptId}` } : null; })()}
                        next={(() => { const n = analysis.mistakes.find(m => m.number > number && !handled.has(m.q.id)) || analysis.mistakes.find(m => m.q.id !== q.id && !handled.has(m.q.id)); return n ? { number: n.number, go: () => jumpTo(n.number, { repair: true }) } : null; })()} />
                    ) : null}
                    {review && !(isWrong && Number.isInteger(given)) ? review.state === 'corrected' || review.state === 'key_changed_unverified' ? <AnswerCorrectionNotice review={review} /> : <KeyReviewNotice chosenLetter={Number.isInteger(given) ? LETTERS[given] : null} keyLetter={LETTERS[q.correctIndex]} reviewState={review.state} /> : null}
                    <div className="rp-q__foot">
                      {reaction && reading === q.id && !engaged ? <span className="rp-reader" key={`reader-${q.id}`}><ReaderMobi react={readerReact?.qid === q.id ? readerReact : null} /></span> : null}
                      <button type="button" className="rp-report" disabled={!!reporting[q.id] || !!reported[q.id]} onClick={() => handleReport(row)}>
                        {reported[q.id] ? 'Reported. Thank you.' : reporting[q.id] ? 'Sending…' : 'Report a problem with this question'}
                      </button>
                    </div>
                    </> : null}
                  </div>
              </li>
            );
          })}
        </ol>
      </section>

      {ending ? (
        <RepairEnding ids={runIds} numbers={runNumbers} model={runModel} ackedAt={ackedAt}
          chapter={retryChapter} onClose={() => setEnding(false)} onRetry={tryAgain} withMobi={!isNtaAttempt} />
      ) : null}

      <nav className="rp-links" aria-label="More from your record">
        <Link href="/mentor?tab=record"><AppIcon name="prepos" size={16} />Full record in PrepOS</Link>
        <Link href="/review"><AppIcon name="review" size={16} />All saved mistakes</Link>
        <Link href="/analytics"><AppIcon name="radar" size={16} />Open Radar</Link>
        <Link href="/dashboard"><AppIcon name="practice" size={16} />Back to Practice</Link>
      </nav>
    </div>
  );
}
