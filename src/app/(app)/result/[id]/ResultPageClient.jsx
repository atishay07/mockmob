"use client";

// The result, 17 Oct (docs/design-decisions/pass-1017/RESULT-1017.md; owner ledger F11, F14, F16, F17). One order for
// practice sets and mocks:
//   1 what happened, in one glance: one receipt line, the score with its denominator, the marks bar, the counts, and the
//     chapter that cost the most (src/components/result/ResultHead.jsx);
//   2 one next move, chosen by stated rules (data/result_next_move.mjs), the only volt key in view, with Repair's value
//     and its cost before the student pays (src/components/result/NextMove.jsx);
//   3 the mistakes in repair order, each with Repair and Check it held inline (src/components/result/MistakeList.jsx);
//   4 everything else, folded under plain names (src/components/result/Fold.jsx): Where the marks went, Your time and
//     changed answers, After this mock, How others answered, Your rule and proof it stuck, Every answer.
// Then the next fresh paper and the links. Nothing was deleted: every block of the earlier page has a place (section 6).
// No Mobi on arrival and none on the rows: his one moment is a repair that held on a new question, after the server
// marked it. A repaired mistake opens its saved repair, free, and is never offered as a paid repair again (lab.repaired).
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ErrorState } from '@/components/ui/Skeleton';
import { apiGet, apiPost } from '@/lib/fetcher';
import { LabLedger, LabTime, LabProof, RepairTotal } from '@/components/ScoreRecoveryLab';
import { QuestionStrip } from '@/components/result/Replay';
import SwotPanel from '@/components/result/SwotPanel';
import OthersAnswered, { OptionShare, shareTone } from '@/components/result/OthersAnswered';
import TrapTag from '@/components/result/TrapTag';
import ResultHead from '@/components/result/ResultHead';
import NextMove from '@/components/result/NextMove';
import MistakeList, { SHOWN_FIRST } from '@/components/result/MistakeList';
import Fold, { useFolds } from '@/components/result/Fold';
import MistakeRepair from '@/components/recovery/MistakeRepair';
import KeyReviewLog from '@/components/recovery/KeyReviewLog';
import AnswerCorrectionNotice from '@/components/recovery/AnswerCorrectionNotice';
import KeyReviewNotice from '@/components/recovery/KeyReviewNotice';
import RunTrack from '@/components/recovery/RunTrack';
import RepairEnding from '@/components/recovery/RepairEnding';
import MistakeLessonLink from '@/components/study/MistakeLessonLink';
import { RUN_COPY, arrowIntent, runSegments, stepIndex, endingModel, retryIds as retryIdsOf, earlierMisses, earlierMissLine } from '@/components/recovery/repairRun';
import { REPAIR_OUTCOMES, hasExplanation, repairLabel, repairProgress } from '@/../data/repair_presentation.mjs';
import { analyseSession, formatDuration } from '@/../data/session_recovery';
import { buildTimeDecisions, TIME_COPY, spentLabel, TIME_RULES } from '@/../data/time_decisions';
import { attemptMode, costliestLine, nextMove, receiptLine, shortDuration } from '@/../data/result_next_move.mjs';
import { AppIcon } from '@/components/ui/Glyph';
import { MobResultRow } from '@/components/mob/MobResultRow';
import '@/components/recovery/result.css';
import '@/components/result/result-1017.css';
import { plainOptionTexts } from '@/../data/option_text';
import { repairCandidates, verdictWord } from './reaction';
import { inRepairOrder } from '@/components/result/labLoop';
import { useAuth } from '@/components/AuthProvider';
import { useWalletSummary } from '@/components/useWalletSummary';
import { bankCount, nextPaper, practiceSubjectId } from '@/lib/paperCopy.mjs';

function displayValue(value, fallback = '') {
  if (value == null) return fallback;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') return value.text ?? value.label ?? value.name ?? value.key ?? fallback;
  return String(value);
}

const LETTERS = 'ABCDEFGH';
const HELD_STATES = new Set(['withdrawn', 'under_review', 'content_changed', 'key_changed_unverified', 'corrected']);
const subjectName = (s) => String(s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const reducedMotion = () => {
  try { return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
};
// The arrival sequence plays on a result's first open in this browser session only; a return visit never replays it.
function firstOpen(id) {
  try {
    const key = `mm:result-seen:${id}`;
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, '1');
    return !reducedMotion();
  } catch { return false; }
}

// The loading state: shaped like the result (receipt, score, bar, two lines, the panel with its key). No Mobi, no spinner.
function ResultSkeleton() {
  return (
    <div className="container-narrow student-page student-page--result rx rx--loading" role="status" aria-live="polite">
      <span className="mr-sr">Loading your result</span>
      <div className="rx-top" aria-hidden="true">
        <div className="rx-skel">
          <i className="rx-skel__line" style={{ width: '62%' }} />
          <i className="rx-skel__score" />
          <i className="rx-skel__bar" />
          <i className="rx-skel__line" style={{ width: '48%' }} />
          <i className="rx-skel__line" style={{ width: '86%' }} />
        </div>
        <div className="rx-skel rx-skel--panel"><i className="rx-skel__line" style={{ width: '30%' }} /><i className="rx-skel__key" /><i className="rx-skel__line" style={{ width: '80%' }} /></div>
      </div>
    </div>
  );
}

/**
 * Result page in four layers. Fetches a single attempt by ID instead of pulling all user attempts.
 */
export default function ResultPageClient({ previewId = null }) {
  const params = useParams();
  const id = previewId || params.id;
  const [attempt, setAttempt] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all | correct | wrong | skipped (Every answer)
  const [open, setOpen] = useState(() => new Set());
  const [visited, setVisited] = useState(() => new Set());
  const [repairOutcomes, setRepairOutcomes] = useState({});
  const [autoRepair, setAutoRepair] = useState(null);
  const [reporting, setReporting] = useState({});
  const [reported, setReported] = useState({});
  const [reportError, setReportError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [hour] = useState(() => new Date().getHours()); // the late-night line in the next-move panel
  const [arrived, setArrived] = useState(null); // { number, n }: focus ring after a jump
  const [peek, setPeek] = useState(null); // a bubble's label shown by a long press
  const [arrive, setArrive] = useState(false); // first open: the arrival sequence
  // The repair run: the mistakes of this paper in order, which ones the student began, the one on screen,
  // the panel the track just brought back (for its 160 ms hand-over), and the ending.
  const [started, setStarted] = useState(() => new Set());
  const [runCurrent, setRunCurrent] = useState(null);
  const [handover, setHandover] = useState(null); // { qid, n }
  const [ending, setEnding] = useState(false);
  const [ackedAt, setAckedAt] = useState(null); // when the server last acknowledged a new repair
  const [epochs, setEpochs] = useState({}); // qid -> times "Try the same mistakes again" reopened it
  const [checks, setChecks] = useState({}); // qid -> { right, replayed }: Check it held, as the server marked it
  const [cheer, setCheer] = useState(null); // the qid whose check just held: Mobi's one cheer
  const [showAll, setShowAll] = useState(false);
  const [blanksOpen, setBlanksOpen] = useState(false);
  const [replayFocus, setReplayFocus] = useState(null);
  const [folds, setFold] = useFolds();
  const pressRef = useRef(null);
  const suppressRef = useRef(false);
  const { user } = useAuth();
  const wallet = useWalletSummary(user?.id, { reuseFresh: true });
  // The bank count for "Take another fresh paper": the stored daily counts (/api/stats). A failed read leaves the
  // count out of the sentence; it is never shown as 0.
  const [stats, setStats] = useState({ state: 'loading' });
  useEffect(() => {
    let alive = true;
    apiGet('/api/stats').then((data) => { if (alive) setStats(data || { state: 'unavailable' }); }).catch(() => { if (alive) setStats({ state: 'unavailable' }); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    queueMicrotask(() => { if (alive) { setAttempt(null); setError(null); setFilter('all'); setReporting({}); setReported({}); setReportError(null); setRepairOutcomes({}); setAutoRepair(null); setStarted(new Set()); setRunCurrent(null); setHandover(null); setEnding(false); setAckedAt(null); setEpochs({}); setChecks({}); setCheer(null); setShowAll(false); setBlanksOpen(false); setOpen(new Set()); setVisited(new Set()); } });
    apiGet(`/api/attempts/${id}`)
      .then(data => {
        if (!alive) return;
        // A repair the server already holds (lab.repaired) starts as stored, so it counts as repaired and opens free.
        const saved = Array.isArray(data?.lab?.repaired) ? data.lab.repaired : [];
        const reviews = Object.entries(data.answerReviews || {}).map(([qid, review]) => [qid, review.state === 'corrected' ? 'corrected_key' : 'held_for_recheck']);
        setRepairOutcomes(Object.fromEntries([...saved.map((qid) => [qid, 'stored']), ...reviews]));
        setArrive(firstOpen(data.id || id));
        setAttempt(data);
      })
      .catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [id, retry]);

  const analysis = useMemo(() => attempt ? analyseSession(attempt) : null, [attempt]);
  // Time and decisions: the time fold and each answer's "Your time and picks" read the same object. The server's
  // finished read (attempt.lab.time, from the one time calculator, with the slice 2 trace lines) comes first; an older
  // server or a result without the Lab falls back to the same builder here.
  const timeRead = useMemo(() => {
    if (!attempt) return null;
    const served = attempt.lab?.time;
    if (served && typeof served === 'object' && typeof served.state === 'string' && (served.state !== 'ready' || Array.isArray(served.rows))) return served;
    return buildTimeDecisions(attempt, { answerReviews: attempt.answerReviews || {} });
  }, [attempt]);
  const visible = useMemo(() => analysis ? analysis.rows.filter(r => filter === 'all' || r.verdict === filter) : [], [analysis, filter]);

  // The run is the paper's mistakes that repair could open when the result loaded (a key held later stays in it, as a set-aside segment).
  // In the server's repair order when it sends one (lab.repairOrder, spec 4.7), so the next move, the list, the track and
  // each repair's "next" all follow the same order; without one, paper order as before.
  const repairOrder = attempt?.lab?.repairOrder || null;
  const savedIds = useMemo(() => new Set(Array.isArray(attempt?.lab?.repaired) ? attempt.lab.repaired : []), [attempt]);
  const runIds = useMemo(() => (attempt && analysis ? repairCandidates(analysis, new Set(), attempt.answerReviews, attempt.lab?.repairOrder).map(r => r.q.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attempt?.id, analysis?.rows.length]);
  const runNumbers = useMemo(() => Object.fromEntries((analysis?.rows || []).map(r => [r.q.id, r.number])), [analysis]);
  const reached = useMemo(() => new Set([...started, ...runIds.filter(id => repairOutcomes[id] && !savedIds.has(id))]), [started, runIds, repairOutcomes, savedIds]);
  const engaged = started.size > 0;
  const segments = useMemo(() => runSegments({ ids: runIds, numbers: runNumbers, outcomes: repairOutcomes, reached, current: runCurrent }), [runIds, runNumbers, repairOutcomes, reached, runCurrent]);
  const orderedMistakes = useMemo(() => inRepairOrder(analysis?.mistakes, repairOrder), [analysis, repairOrder]);

  const jumpTo = useCallback((number, { repair = false, instant, keepFocus = false } = {}) => {
    const row = analysis?.rows.find(r => r.number === number);
    if (!row) return;
    const inRun = runIds.includes(row.q.id);
    const step = inRun && (repair || engaged);
    const quick = instant ?? (step && engaged);
    // Each row lives in one place: a mistake in the list (opening "Show all" when it is further down), a blank in the
    // blanks row, a right answer in "Every answer".
    if (row.verdict === 'wrong') { if (orderedMistakes.findIndex(m => m.q.id === row.q.id) >= SHOWN_FIRST) setShowAll(true); }
    else if (row.verdict === 'skipped') setBlanksOpen(true);
    else { setFold('every', true, { remember: false }); setFilter(f => (f === 'all' || f === row.verdict ? f : 'all')); }
    setOpen(s => new Set(s).add(row.q.id));
    setVisited(s => new Set(s).add(row.q.id));
    if (repair) setAutoRepair(row.q.id);
    if (step) { setRunCurrent(row.q.id); setHandover((h) => ({ qid: row.q.id, n: (h?.n || 0) + 1 })); }
    setArrived((prev) => ({ number, n: (prev?.n || 0) + 1 }));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.getElementById(`q-${number}`);
      el?.scrollIntoView({ behavior: reducedMotion() || quick ? 'auto' : 'smooth', block: 'start' });
      if (!keepFocus) el?.querySelector('.rp-q__bar')?.focus({ preventScroll: true });
    }));
  }, [analysis, runIds, engaged, orderedMistakes, setFold]);

  const handled = useMemo(() => repairProgress(analysis?.mistakes || [], repairOutcomes).handled, [analysis, repairOutcomes]);
  const repaired = useMemo(() => new Set((analysis?.mistakes || []).filter(r => hasExplanation(repairOutcomes[r.q.id])).map(r => r.q.id)), [analysis, repairOutcomes]);
  const noteStart = useCallback((qid) => { setStarted(s => (s.has(qid) ? s : new Set(s).add(qid))); setRunCurrent(qid); }, []);
  const goSegment = useCallback((index, { keepFocus = false } = {}) => {
    const id = runIds[index];
    if (id != null) jumpTo(runNumbers[id], { instant: true, keepFocus });
  }, [runIds, runNumbers, jumpTo]);
  const stepFrom = useCallback((qid, dir) => {
    const to = stepIndex(segments, runIds.indexOf(qid), dir);
    if (to >= 0) goSegment(to, { keepFocus: true });
  }, [segments, runIds, goSegment]);
  // Desktop: once the run has begun, the arrow keys step between the mistakes already opened, even when nothing
  // on the panel has focus. Keys the track or a panel already handled (or typed into a field) are left alone.
  useEffect(() => {
    if (!engaged || ending || !runCurrent) return undefined;
    const onKey = (event) => {
      const t = event.target;
      const inReview = !t || t === document.body || t === document.documentElement || t.closest?.('.rp-review, .rt-bar');
      if (!inReview) return;
      const intent = arrowIntent(event);
      if (!intent) return;
      event.preventDefault();
      stepFrom(runCurrent, intent === 'prev' ? -1 : 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engaged, ending, runCurrent, stepFrom]);

  const reviewReceived = useCallback((qid, review) => {
    setAttempt(a => ({ ...a, answerReviews: { ...a.answerReviews, [qid]: review } }));
    setRepairOutcomes(s => ({ ...s, [qid]: review.state === 'corrected' ? 'corrected_key' : 'held_for_recheck' }));
  }, []);

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
  const isNtaAttempt = attempt?.selectionMeta?.mode === 'nta';
  // Check it held came back marked by the server. A right answer marked now (not one read back from earlier) is Mobi's
  // one moment on the page; never in NTA mode.
  const checked = useCallback((qid, result) => {
    setChecks(s => (s[qid]?.right === result.right && s[qid]?.replayed === result.replayed ? s : { ...s, [qid]: result }));
    if (result.right && !result.replayed && !isNtaAttempt) setCheer(qid);
  }, [isNtaAttempt]);

  if (error) return <div className="container-narrow student-page student-page--result pt-8"><ErrorState scene="unreachable" title="This session did not load" message="Your recorded result is safe. Try again to see it." onRetry={() => { setError(null); setRetry((count) => count + 1); }} /></div>;
  if (!attempt || !analysis) return <ResultSkeleton />;

  const { marks, timing } = analysis;
  const answerReviews = attempt.answerReviews || {};
  const mode = attemptMode(attempt);
  const subject = subjectName(attempt.subject);
  const isMock = mode === 'full' || mode === 'nta';
  const runModel = endingModel({ ids: runIds, outcomes: repairOutcomes, reached });
  const checkMap = Object.fromEntries(Object.entries(checks).map(([qid, c]) => [qid, c.right ? 'right' : 'wrong']));
  const aiCredits = wallet.wallet?.known ? wallet.wallet.total : null;
  const move = nextMove({
    analysis, answerReviews, repairOrder, repaired, checks: checkMap, aiCredits,
    practiceCredits: user ? user.creditBalance ?? null : null, isPremium: Boolean(user?.isPremium),
    mode, subject: practiceSubjectId(attempt.subject), subjectName: subject,
    labReady: Boolean(attempt.lab) && attempt.answerReviewState !== 'unavailable', hour,
  });
  const finding = costliestLine(analysis, { answerReviews });
  const receipt = receiptLine({ subjectName: subject, mode, completedAt: attempt.completedAt, durationMs: timing?.totalMs ?? null });
  const keyReviews = analysis.rows.filter(r => repairOutcomes[r.q.id] === 'held_for_recheck').map(r => ({ number: r.number, chapter: r.chapter }));
  const correctedRows = analysis.rows.filter(r => answerReviews[r.q.id]?.state === 'corrected');
  const correctionAdjustment = correctedRows.reduce((sum, r) => sum + answerReviews[r.q.id].adjustment, 0);
  // The one notice line in layer 1: a correction first (it changes a mark), else a key under re-check.
  const notice = correctedRows.length
    ? { text: `We corrected ${correctedRows.length === 1 ? 'an answer key' : `${correctedRows.length} answer keys`}. Your original result is preserved.`, number: correctedRows[0].number }
    : keyReviews.length ? { text: `Q${keyReviews[0].number}’s answer key is being re-checked${keyReviews.length > 1 ? `, with ${keyReviews.length - 1} more` : ''}. It is left out of repairs until the check ends.`, number: keyReviews[0].number }
      : attempt.answerReviewState === 'unavailable' ? { text: 'Current answer-key checks could not load. The options show the key used in your original session.', number: null } : null;

  const toggle = (qid) => { setVisited(s => new Set(s).add(qid)); setOpen(s => { const n = new Set(s); if (n.has(qid)) n.delete(qid); else n.add(qid); return n; }); };
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
  const firstWrong = analysis.rows.findIndex(r => r.verdict === 'wrong');
  const rippleStep = firstWrong > 0 ? Math.min(35, Math.round(700 / firstWrong)) : 0;

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
      setReportError(e.message || 'Could not send your report. Try again.');
    } finally {
      setReporting((current) => {
        const next = { ...current };
        delete next[qid];
        return next;
      });
    }
  }

  // The opened row: what the answer row always held, in the same order (How others answered, the options with your pick
  // and the correct answer, your time and picks, the repair with Check it held, the key notices, Report a problem).
  const renderBody = (row) => {
    const { q, d, verdict, number } = row;
    const given = d?.givenIndex;
    const isWrong = verdict === 'wrong';
    const review = answerReviews[q.id];
    const timeRow = timeRead?.state === 'ready' ? timeRead.rows[row.index] : null;
    const insights = attempt.mistakeInsights?.[q.id] ?? null;
    const repairInsights = insights && timeRow?.lines.length ? { ...insights, lines: (insights.lines || []).filter(l => l?.kind !== 'change' && l?.kind !== 'time') } : insights;
    // How others answered (server-built; null under 10 other students, on held keys, or without the Lab).
    const others = attempt.lab?.byQuestion?.[q.id]?.others || null;
    // The trap tag under the student's own wrong option (server-built: the trap atlas, then the question format).
    const trap = isWrong ? attempt.lab?.traps?.tags?.[q.id] || null : null;
    return (
      <div className="rp-q__body rx-body">
        {others ? <OthersAnswered others={others} title={attempt.lab?.labels?.othersTitle} /> : null}
        <ul className="rp-options">
          {q.options.map((opt, j) => {
            const mine = given === j, key = q.correctIndex === j;
            const corrected = review?.state === 'corrected' && review.currentIndex === j;
            return (
              <li key={j} data-state={corrected || (!review && key) ? 'key' : mine ? 'mine' : undefined} data-others={others ? '' : undefined}>
                <span className="rp-options__letter">{LETTERS[j]}</span>
                <span className="rp-options__text">{displayValue(plainOptionTexts(q.options)[j] ?? opt, 'Option')}</span>
                {mine || key || corrected ? <span className="rp-options__tag">{corrected ? mine ? 'Your pick, corrected answer' : 'Corrected answer' : key ? mine ? 'Your pick, correct' : 'Correct answer' : 'Your pick'}</span> : null}
                {others ? <OptionShare others={others} index={j} tone={shareTone(others, j, given)} /> : null}
                {trap && trap.index === j && mine ? <TrapTag trap={trap} /> : null}
              </li>
            );
          })}
        </ul>
        {timeRow?.lines.length ? (
          <div className="rp-td">
            <p className="rp-td__label">{TIME_COPY.rowLabel}</p>
            {attempt.lab?.replay ? <QuestionStrip replay={attempt.lab.replay} number={number} /> : null}
            {timeRow.lines.map((line, i) => <p key={i}>{line}</p>)}
          </div>
        ) : null}
        {q.explanation && !review ? (
          isWrong ? (
            <details className="rp-expl"><summary>Book explanation</summary><p>{displayValue(q.explanation)}</p></details>
          ) : <div className="rp-expl rp-expl--open"><span>Explanation</span><p>{displayValue(q.explanation)}</p></div>
        ) : null}
        {isWrong && Number.isInteger(given) ? (
          <MistakeRepair key={`${q.id}:${epochs[q.id] || 0}`} attemptId={attempt.id} questionId={q.id} number={number} nta={isNtaAttempt} chosen={LETTERS[given]} answer={Number.isInteger(q.correctIndex) ? LETTERS[q.correctIndex] : null}
            autoStart={autoRepair === q.id || savedIds.has(q.id)} saved={savedIds.has(q.id)} onSettled={settled} initialReview={review} onReview={reviewReceived} onCheck={checked}
            insights={repairInsights}
            isCurrent={(!engaged || runCurrent === q.id) && cheer !== q.id} onStart={noteStart} onStep={engaged ? stepFrom : undefined} onFinish={() => setEnding(true)}
            handover={handover?.qid === q.id ? (handover.n % 2 ? 'a' : 'b') : null}
            earlier={(() => { const m = earlierMisses(attempt, q.id)[0]; return m ? { line: earlierMissLine(m), href: `/result/${m.attemptId}` } : null; })()}
            next={(() => { const at = orderedMistakes.findIndex(m => m.q.id === q.id); const n = orderedMistakes.find((m, i) => i > at && !handled.has(m.q.id)) || orderedMistakes.find(m => m.q.id !== q.id && !handled.has(m.q.id)); return n ? { number: n.number, go: () => jumpTo(n.number, { repair: true }) } : null; })()} />
        ) : null}
        {review && !(isWrong && Number.isInteger(given)) ? review.state === 'corrected' || review.state === 'key_changed_unverified' ? <AnswerCorrectionNotice review={review} /> : <KeyReviewNotice chosenLetter={Number.isInteger(given) ? LETTERS[given] : null} keyLetter={LETTERS[q.correctIndex]} reviewState={review.state} /> : null}
        <div className="rp-q__foot">
          <button type="button" className="rp-report" disabled={!!reporting[q.id] || !!reported[q.id]} onClick={() => handleReport(row)}>
            {reported[q.id] ? 'Reported. Thank you.' : reporting[q.id] ? 'Sending…' : 'Report a problem with this question'}
          </button>
        </div>
      </div>
    );
  };

  // Each row's chip says a real server state, never ahead of it (RESULT-1017 4.5).
  const statusOf = (row) => {
    const qid = row.q.id;
    const review = answerReviews[qid];
    if (review?.state === 'corrected') return { id: 'corrected', label: 'Key corrected' };
    if (review && HELD_STATES.has(review.state)) return { id: 'recheck', label: 'Key being re-checked' };
    if (row.verdict !== 'wrong') return null;
    const out = repairOutcomes[qid];
    if (out === 'held_for_recheck') return { id: 'recheck', label: 'Key being re-checked' };
    if (out === 'not_explained') return { id: 'none', label: 'No repair, no charge' };
    const c = checks[qid];
    if (c) return c.right ? { id: 'held', label: 'Held on a new question' } : { id: 'slipped', label: 'Slipped on a new question' };
    if (hasExplanation(out)) return { id: 'check', label: 'Check it held' };
    if (started.has(qid)) return { id: 'writing', label: 'Writing' };
    if (move?.kind === 'repair' && move.target?.qid === qid) return { id: 'first', label: 'Repair first' };
    return { id: 'repair', label: 'Repair' };
  };
  const cohortItem = new Map((repairOrder?.state === 'cohort' ? repairOrder.items || [] : []).filter(x => x?.reason === 'most_right' && x.line).map(x => [x.qid, x.line]));
  const cohortOf = (row) => { const line = cohortItem.get(row.q.id); return line ? line.replace(' other students got it right.', ' got it right') : null; };
  const blanks = analysis.rows.filter(r => r.verdict === 'skipped');
  const heldCount = Object.values(checks).filter(c => c.right).length;
  const repairsLeft = orderedMistakes.filter(r => !handled.has(r.q.id) && !HELD_STATES.has(answerReviews[r.q.id]?.state)).length;
  const chapterCounts = Object.entries(analysis.mistakes.reduce((m, row) => { if (row.chapter) m[row.chapter] = (m[row.chapter] || 0) + 1; return m; }, {})).sort((x, y) => y[1] - x[1]).map(([chapter, count]) => ({ chapter, count }));
  const topChapter = move?.target?.chapter || finding?.chapter || chapterCounts[0]?.chapter || null;
  const lesson = <MistakeLessonLink subject={attempt.subject} chapter={topChapter} chapters={chapterCounts} conceptIds={analysis.mistakes.map(row => row.q.conceptId).filter(Boolean)} />;
  const next = nextPaper({ mode: attempt.selectionMeta?.mode, subject: attempt.subject, subjectName: subject, count: bankCount(stats, attempt.subject), total: attempt.total, isPremium: Boolean(user?.isPremium), balance: user ? user.creditBalance ?? null : null });

  const onAct = ({ kind, target }) => {
    if ((kind === 'repair' || kind === 'check') && Number.isInteger(target?.number)) jumpTo(target.number, { repair: true });
  };

  // ---------- Layer 4: the folds and their teasers (each states its finding; a fold with nothing to hold is not drawn) ----------
  const lab = attempt.lab || null;
  const swotShown = attempt.swot?.state === 'ready';
  const largest = (lab?.groups || []).reduce((best, g) => (!best || (g.marks || 0) > (best.marks || 0) ? g : best), null);
  const answered = marks.right + marks.wrong;
  const marksTeaser = lab?.headline?.text
    || (largest?.label && largest?.line ? `${largest.label}: ${largest.line}.` : null)
    || (!lab && attempt.answerReviewState !== 'ready' && isMock ? 'Being counted. It is ready when the answer checks finish.' : null)
    || (answered ? `${Math.round((marks.right / answered) * 100)}% of answered questions right: ${marks.right} of ${answered}.` : 'Nothing was answered on this paper.');
  const changes = timeRead?.changes && typeof timeRead.changes === 'object' ? timeRead.changes : null;
  const timeTeaser = [
    Number.isFinite(timeRead?.medianMs) ? `Your median was ${shortDuration(timeRead.medianMs)} a question.` : timeRead?.summary?.pace || null,
    changes?.count ? `${changes.count} ${changes.count === 1 ? 'answer' : 'answers'} changed, net ${changes.net > 0 ? '+' : changes.net < 0 ? '−' : ''}${Math.abs(changes.net || 0)} marks.` : null,
  ].filter(Boolean).join(' ') || (analysis.timing ? `About ${formatDuration(analysis.timing.averageMs)} a question.` : 'The replay, your pace and every changed answer.');
  const showTime = Boolean(lab?.replay?.rows?.length || timeRead || analysis.chapters.length || analysis.observations.length);
  const swotItem = (() => {
    const qs = Array.isArray(attempt.swot?.quadrants) ? attempt.swot.quadrants : [];
    for (const id of ['threat', 'opportunity']) { const q = qs.find(x => x.id === id); if (q?.items?.length) return q.items[0]; }
    return null;
  })();
  const showSwot = Boolean(attempt.swot && attempt.swot.state !== 'not_available' && (swotShown || attempt.swot.message));
  const swotTeaser = swotShown ? (swotItem?.title || (attempt.swot.plan?.[0]?.label ? `Next: ${attempt.swot.plan[0].label}` : 'Your strengths, your gaps and a short plan.')) : attempt.swot?.message || null;
  const cohort = lab?.cohort?.line ? lab.cohort : null;
  const ruleCheck = lab?.prove?.ruleCheck || null;
  const proofTeaser = ruleCheck?.text || (lab?.rules?.active?.text ? `Your rule: ${lab.rules.active.text}` : isMock ? 'No rule chosen for this mock.' : 'Five fresh questions show whether a repair stuck.');
  const foldProps = (fid) => ({ id: fid, open: folds.has(fid), onToggle: setFold });

  return (
    <div className="container-narrow student-page student-page--result rp rx pb-20" data-arrive={arrive || undefined}>
      {/* ---------- 1 and 2: what happened, and the one next move (side by side on a wide screen) ---------- */}
      <div className="rx-top">
        <ResultHead receipt={receipt} marks={marks} finding={finding} notice={notice} onNotice={(n) => jumpTo(n)} arrive={arrive} />
        <NextMove move={move} onAct={onAct} paperHref={next.href} arrive={arrive}
          lesson={move?.kind === 'practise' && move.rule === 2 ? lesson : null} />
      </div>

      {/* ---------- 3: the mistakes, in repair order ---------- */}
      <MistakeList
        mistakes={orderedMistakes} blanks={blanks} openIds={open} onToggle={toggle} visited={visited}
        statusOf={statusOf} cohortOf={cohortOf} renderBody={renderBody}
        showAll={showAll} onShowAll={setShowAll} blanksOpen={blanksOpen} onBlanks={setBlanksOpen}
        repairedCount={repaired.size} heldCount={heldCount} ordered={repairOrder?.state === 'cohort' ? 'repair' : 'paper'}
        cheer={cheer} arrived={arrived} arrive={arrive} answered={marks.right + marks.wrong}
        top={engaged && segments.length > 1 ? (
          <div className="rt-bar">
            <RunTrack segments={segments} onGo={goSegment} onFinish={runIds.some(id => repairOutcomes[id]) ? () => setEnding(true) : null} />
          </div>
        ) : null}
        after={<>
          {reportError ? <div role="alert" className="rp-alert">{reportError}</div> : null}
          <RepairTotal remaining={repairsLeft} />
          {analysis.mistakes.length ? <p className="srl-fine">Reopening a repair is free. No charge if a question is held for review.</p> : null}
          {move?.kind === 'practise' && move.rule === 2 ? null : lesson}
        </>}
      />

      {/* The Mob's weekly paper: one quiet row with the ring and the way back to /mob (draws nothing otherwise). */}
      {attempt.selectionMeta?.mobPaper ? <MobResultRow mobPaper={attempt.selectionMeta.mobPaper} /> : null}

      {/* ---------- 4: everything else, folded and named ---------- */}
      <section className="rx-more-from" aria-labelledby="rx-folds-title">
        <h2 id="rx-folds-title" className="rx-section-title">More from this paper</h2>
        <div className="rx-folds">
          <Fold {...foldProps('marks')} title="Where the marks went" teaser={marksTeaser}>
            <LabLedger attempt={attempt} analysis={analysis} timeRead={timeRead} lab={lab} onJump={jumpTo} changesId="rx-time-changes"
              onSeeReplay={(chip) => { setFold('time', true, { remember: false }); setReplayFocus((f) => ({ chip, n: (f?.n || 0) + 1 })); }} />
            <KeyReviewLog items={keyReviews} onJump={jumpTo} />
            {correctedRows.length ? <section className="kr-log" aria-label="Answer corrections"><h2>We corrected {correctedRows.length === 1 ? 'an answer key' : `${correctedRows.length} answer keys`}. We’re sorry.</h2><p>Your original result is preserved. Applying these checked corrections gives a separate adjustment of {correctionAdjustment > 0 ? '+' : ''}{correctionAdjustment} marks. This has not changed your account or leaderboard score.</p><ul>{correctedRows.map(r => <li key={r.q.id}><button type="button" onClick={() => jumpTo(r.number)}><b>Q{r.number}</b><span>{r.chapter}</span><em>See correction</em></button></li>)}</ul></section> : null}
          </Fold>
          {showTime ? (
            <Fold {...foldProps('time')} title="Your time and changed answers" teaser={timeTeaser}>
              <LabTime attempt={attempt} analysis={analysis} timeRead={timeRead} lab={lab} onJump={jumpTo} swotShown={swotShown} focus={replayFocus} changesId="rx-time-changes" />
            </Fold>
          ) : null}
          {showSwot ? (
            <Fold {...foldProps('after')} title="After this mock: strengths, gaps and plan" teaser={swotTeaser}>
              <SwotPanel swot={attempt.swot} attemptId={attempt.id} onJump={jumpTo} inFold />
            </Fold>
          ) : null}
          {cohort ? (
            <Fold {...foldProps('others')} title="How others answered" teaser={cohort.line}>
              <div className="rx-others">
                {cohort.truth ? <p>{cohort.truth}</p> : null}
                {Array.isArray(cohort.numbers) && cohort.numbers.length ? (
                  <span className="srl-qchips"><span className="srl-qchips__label">See</span>{cohort.numbers.map(n => <button key={n} type="button" onClick={() => jumpTo(n)} aria-label={`Go to question ${n}`}>Q{n}</button>)}</span>
                ) : null}
                {(Array.isArray(cohort.fine) ? cohort.fine : cohort.fine ? [cohort.fine] : []).map((line, i) => <p key={i} className="srl-fine">{line}</p>)}
              </div>
            </Fold>
          ) : null}
          <Fold {...foldProps('proof')} title="Your rule and proof it stuck" teaser={proofTeaser}>
            <LabProof attempt={attempt} analysis={analysis} lab={lab} />
          </Fold>
          <Fold {...foldProps('every')} title={`Every answer, all ${attempt.total}`}
            teaser={<span className="rx-dots" role="img" aria-label={`${marks.right} right, ${marks.wrong} wrong, ${marks.blank} blank`}>{analysis.rows.map(r => <i key={r.q.id} data-verdict={r.verdict} />)}</span>}>
            <div className="rx-every">
              <ol className="rp-strip" aria-label="Answer map: press a question to open it" style={{ '--rp-step': `${rippleStep}ms` }}>
                {analysis.rows.map(r => (
                  <li key={r.q.id} style={{ '--i': r.index }}>
                    <button type="button" data-verdict={r.verdict} data-changed={r.changed || undefined}
                      data-label={bubbleLabel(r)} data-peek={peek === r.number || undefined}
                      onPointerDown={(event) => startBubblePress(event, r.number)} onPointerUp={endBubblePress} onPointerCancel={endBubblePress} onPointerLeave={endBubblePress}
                      onContextMenu={(event) => { if (event.nativeEvent.pointerType === 'touch' || suppressRef.current) event.preventDefault(); }}
                      onClick={() => { if (suppressRef.current) { suppressRef.current = false; return; } jumpTo(r.number); }}
                      aria-label={bubbleLabel(r).replace(/^Q/, 'Question ')}>{r.number}</button>
                  </li>
                ))}
              </ol>
              <div className="rp-filters" role="group" aria-label="Filter answers">
                {[
                  { id: 'all', label: `All ${attempt.total}` },
                  { id: 'wrong', label: `Wrong ${marks.wrong}` },
                  { id: 'skipped', label: `Blank ${marks.blank}` },
                  { id: 'correct', label: `Right ${marks.right}` },
                ].map(t => (
                  <button key={t.id} type="button" aria-pressed={filter === t.id} onClick={() => setFilter(t.id)}>{t.label}</button>
                ))}
              </div>
              <ol className="rp-list">
                {visible.length === 0 ? <li className="rp-empty">Nothing in this group.</li> : null}
                {analysis.rows.map(row => {
                  const { q, verdict, number } = row;
                  // A wrong answer and a blank live in the mistakes above; here their row takes you there.
                  const elsewhere = verdict !== 'correct';
                  const isOpen = !elsewhere && open.has(q.id);
                  const review = answerReviews[q.id];
                  const timeRow = timeRead?.state === 'ready' ? timeRead.rows[row.index] : null;
                  const rowMs = timeRow ? (timeRow.ms >= TIME_RULES.minTimedMs ? timeRow.ms : null) : row.ms;
                  return (
                    <li key={q.id} id={elsewhere ? `qa-${number}` : `q-${number}`} className="rp-q" hidden={filter !== 'all' && filter !== verdict} data-verdict={verdict} data-open={isOpen || undefined}>
                      {!elsewhere && arrived?.number === number ? <span key={arrived.n} className="rp-q__ring" aria-hidden="true" /> : null}
                      <h3 className="rp-q__h"><button type="button" className="rp-q__bar" aria-expanded={elsewhere ? undefined : isOpen} aria-controls={elsewhere ? undefined : `q-${number}-body`} onClick={() => (elsewhere ? jumpTo(number) : toggle(q.id))}>
                        <span className="rp-q__badge" aria-hidden="true">{number}</span>
                        <span className="rp-q__summary">
                          <span className="rp-q__text">{displayValue(q.question ?? q.body, 'Question unavailable')}</span>
                          <span className="rp-q__meta">
                            <span data-verdict={verdict}>{review ? 'Recorded: ' : ''}{verdict === 'correct' ? 'Right +5' : verdict === 'wrong' ? 'Wrong −1' : 'Blank 0'}</span>
                            <span>{row.chapter}</span>
                            {Number.isFinite(rowMs) ? <span>{timeRow ? spentLabel(rowMs / 1000) : formatDuration(rowMs)}</span> : null}
                            {row.changed ? <span>Answer changed</span> : null}
                            {earlierMisses(attempt, q.id).length ? <span data-kind="twice">{RUN_COPY.missedTimes(earlierMisses(attempt, q.id).length + 1)}</span> : null}
                            {repairLabel(repairOutcomes[q.id]) ? <span data-verdict={hasExplanation(repairOutcomes[q.id]) ? 'repaired' : 'held'}>{repairLabel(repairOutcomes[q.id])}</span> : null}
                            {elsewhere ? <span>{verdict === 'wrong' ? 'Open it in your mistakes' : 'Open it in your blanks'}</span> : null}
                          </span>
                        </span>
                        <span className="rp-q__chev" aria-hidden="true" />
                      </button></h3>
                      {elsewhere ? null : <div id={`q-${number}-body`} hidden={!isOpen}>{visited.has(q.id) ? renderBody(row) : null}</div>}
                    </li>
                  );
                })}
              </ol>
            </div>
          </Fold>
        </div>
      </section>

      {ending ? (
        <RepairEnding ids={runIds} numbers={runNumbers} model={runModel} ackedAt={ackedAt}
          chapter={retryChapter} onClose={() => setEnding(false)} onRetry={tryAgain} withMobi={!isNtaAttempt} />
      ) : null}

      {/* ---------- The next paper: after the repair work, never above it. No fixed set of mocks: the next one is built
           fresh from this subject's bank (src/lib/paperCopy.mjs holds the words and the code facts behind them). ---------- */}
      <section className="rp-next" aria-labelledby="rp-next-title">
        <div className="rp-next__text">
          <h2 id="rp-next-title">{next.title}</h2>
          <p>{next.fresh}</p>
          <p className="rp-next__price">{next.price}</p>
        </div>
        <Link href={next.href} className="btn-outline md rp-next__go mk-press"><AppIcon name="practice" size={16} />{next.action}</Link>
      </section>

      <nav className="rp-links" aria-label="More from your record">
        <Link href="/mentor?tab=record"><AppIcon name="prepos" size={16} />Your full record</Link>
        <Link href="/review"><AppIcon name="review" size={16} />All saved mistakes</Link>
        <Link href="/analytics"><AppIcon name="radar" size={16} />Open weak chapters</Link>
        <Link href="/dashboard"><AppIcon name="practice" size={16} />Back to Practice</Link>
      </nav>
    </div>
  );
}
