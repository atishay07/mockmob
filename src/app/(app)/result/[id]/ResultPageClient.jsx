"use client";

// The result, restored 17 Oct night (owner N12 to N16, docs/brain/OWNER-FEEDBACK-2026-10-17-NIGHT.md). The owner
// rejected the folded 17 Oct page ("more basic ... removed the good stuff ... There was a mascot and an entire screen
// showing so many things"), so the earlier page is back, in its order, open, with only the 17 Oct pieces that add clarity:
//   1 the summary card (src/components/result/ResultHero.jsx): Mobi's reveal, the receipt with 12-hour time, the score
//     counting up, which chapter cost the most, the four counts, the answer map, and the one next move with Repair's
//     value and its cost before paying (src/components/result/NextMove.jsx, data/result_next_move.mjs);
//   2 the Mistake Lab, open: where the marks went (the ledger), the mistakes in repair order with Repair and Check it
//     held inline (a saved repair opens free; each names its paper and time), Find (the replay, time and every changed
//     answer), Prove (the rule check, same mistakes later, fresh questions, across your mocks). A mistake that is not
//     repaired opens sealed (W-032): the student tries it again or asks for the answer, free, before the key shows;
//     the paid Repair comes after, with its cost line;
//   3 After this mock: the SWOT and the plan, open;
//   4 Answer by answer, with the reader Mobi glancing at the answer just opened.
// Then the next fresh paper and the links. Mobi never shows in NTA mode and is never sleepy.
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ErrorState } from '@/components/ui/Skeleton';
import { apiGet, apiPost } from '@/lib/fetcher';
import { LabLedger, LabTime, LabProof, RepairTotal, ledgerOf } from '@/components/ScoreRecoveryLab';
import SwotPanel from '@/components/result/SwotPanel';
import OthersAnswered, { OptionShare, shareTone } from '@/components/result/OthersAnswered';
import TrapTag from '@/components/result/TrapTag';
import ResultHero from '@/components/result/ResultHero';
import EarnedBadges from '@/components/EarnedBadges';
import NextMove from '@/components/result/NextMove';
import { InlineNudge, ProFacts, reportFirstAction } from '@/components/pro';
import { weakestChapter } from '@/lib/proNudge.mjs';
import MistakeList, { SHOWN_FIRST } from '@/components/result/MistakeList';
import RetryFirst, { RetrySaid } from '@/components/result/RetryFirst';
import { questionModel } from '@/components/review/freeSteps';
import { RETRY_COPY, retryEligible, retrySaid } from '@/../data/retry_first.mjs';
import ReaderMobi from '@/components/brand/ReaderMobi';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import MistakeRepair from '@/components/recovery/MistakeRepair';
import AnswerCorrectionNotice from '@/components/recovery/AnswerCorrectionNotice';
import KeyReviewNotice from '@/components/recovery/KeyReviewNotice';
import RunTrack from '@/components/recovery/RunTrack';
import RepairEnding from '@/components/recovery/RepairEnding';
import { paperStamp } from '@/../data/repair_paper.mjs';
import MistakeLessonLink from '@/components/study/MistakeLessonLink';
import LineYouNeeded from '@/components/keycards/LineYouNeeded';
import { RUN_COPY, arrowIntent, runSegments, stepIndex, endingModel, retryIds as retryIdsOf, earlierMisses, earlierMissAt } from '@/components/recovery/repairRun';
import { REPAIR_OUTCOMES, actionLabel, hasExplanation, repairLabel, repairProgress } from '@/../data/repair_presentation.mjs';
import { repairReceipt } from '@/../data/repair_receipt.mjs';
import { analyseSession, formatDuration } from '@/../data/session_recovery';
import { buildTimeDecisions, TIME_COPY, spentLabel, TIME_RULES } from '@/../data/time_decisions';
import { attemptMode, costliestLine, leadMistake, nextMove, receiptLine } from '@/../data/result_next_move.mjs';
import { AppIcon } from '@/components/ui/Glyph';
import { MobResultRow } from '@/components/mob/MobResultRow';
import '@/components/recovery/result.css';
import '@/components/result/result-1017.css';
import { plainOptionTexts } from '@/../data/option_text';
import { mobiReaction, answerReaction, repairCandidates, verdictWord } from './reaction';
import HeldResult from './HeldResult';
import { inRepairOrder } from '@/components/result/labLoop';
import { useAuth } from '@/components/AuthProvider';
import { useWalletSummary } from '@/components/useWalletSummary';
import { useMyDailySet } from '@/components/useMyDailySet';
import { bankCount, nextPaper, practiceSubjectId } from '@/lib/paperCopy.mjs';
import AnalysisParts, { partFromUrl, writePart, scrollToPart } from '@/components/result/AnalysisParts';
import { settleInto, cancelSettle } from '@/components/result/settleInto.mjs';
import { QuestionStrip, replayCutLine } from '@/components/result/ReplaySlots';
import { knownRecord } from '@/../data/replay';
import { ReelEntry } from '@/components/result/PaperReel';
import { questionFromSearch } from '@/components/result/questionParam.mjs';
import '@/components/result/result-parts.css';
import AskMobiLink from '@/components/ai/AskMobiLink';
import { canAskAboutQuestion, mockContext, mockEntryLabel, mockLabel, questionContext, questionEntryLabel } from '@/components/ai/askContexts.mjs';

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
  const [savedRepairs, setSavedRepairs] = useState({}); // qid -> { repairedAt }: wrong answers that already hold a saved repair (F17)
  const [repairs, setRepairs] = useState(null); // the repair record's rows for the receipt line; null while unread or when it did not load
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
  // W-032: qid -> { how: 'tried', pick, right } | { how: 'shown' }: the mistakes whose key the student has now asked for, by trying again
  // or by "Show the answer". Kept on this page only: a try is not recorded, marked or charged.
  const [retried, setRetried] = useState({});
  // Pass 1018 (REVIEW-RESULT-1018 5.2): the one open part of Your full analysis, in the URL (?part=).
  const [part, setPart] = useState(partFromUrl);
  const openPart = useCallback((id) => { setPart(id); writePart(id); }, []);
  const [reading, setReading] = useState(null); // the answer row the reader Mobi glances at
  const [readerReact, setReaderReact] = useState(null); // { qid, first, then }: his reaction to the answer just opened
  const prefs = useMobiPrefs();
  const pressRef = useRef(null);
  const suppressRef = useRef(false);
  const { user } = useAuth();
  const wallet = useWalletSummary(user?.id, { reuseFresh: true });
  // Today's included 10-question set, as the server quote reads it: the next move prices its set from this (src/lib/dailySet.mjs).
  const dailySet = useMyDailySet();
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
    queueMicrotask(() => { if (alive) { setAttempt(null); setError(null); setFilter('all'); setReporting({}); setReported({}); setReportError(null); setRepairOutcomes({}); setSavedRepairs({}); setRepairs(null); setAutoRepair(null); setStarted(new Set()); setRunCurrent(null); setHandover(null); setEnding(false); setAckedAt(null); setEpochs({}); setChecks({}); setCheer(null); setShowAll(false); setBlanksOpen(false); setRetried({}); setOpen(new Set()); setVisited(new Set()); } });
    // The repair record (the read Today makes) rides along for the receipt line. The first paint waits for it a moment, so the line is
    // in the first paint and never pushes the page down; a slow or failed read leaves the line out (or draws it when it arrives).
    const record = apiGet('/api/me/repair-record?limit=100').then((body) => (Array.isArray(body?.repairs) ? body.repairs : null)).catch(() => null);
    apiGet(`/api/attempts/${id}`)
      .then(async (data) => {
        const rows = await Promise.race([record, new Promise((resolve) => { setTimeout(() => resolve(undefined), 500); })]);
        if (!alive) return;
        if (rows !== undefined) setRepairs(rows); else record.then((late) => { if (alive) setRepairs(late); });
        // A repair the server already holds (lab.repaired) starts as stored, so it counts as repaired and opens free.
        const ids = Array.isArray(data?.lab?.repaired) ? data.lab.repaired : [];
        const map = data.savedRepairs && typeof data.savedRepairs === 'object' ? data.savedRepairs : {};
        const saved = [...new Set([...ids, ...Object.keys(map)])];
        setSavedRepairs(map);
        const reviews = Object.entries(data.answerReviews || {}).map(([qid, review]) => [qid, review.state === 'corrected' ? 'corrected_key' : 'held_for_recheck']);
        setRepairOutcomes(Object.fromEntries([...saved.map((qid) => [qid, 'stored']), ...reviews]));
        setArrive(firstOpen(data.id || id));
        setAttempt(data);
      })
      .catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [id, retry]);

  const analysis = useMemo(() => attempt ? analyseSession(attempt) : null, [attempt]);
  // The after-the-mock receipt (FEATURE-ADOPTION item 5): what the repairs made before this paper did on it, or null (data/repair_receipt.mjs).
  const repairsDid = useMemo(() => (attempt ? repairReceipt({ attempt, repairs }) : null), [attempt, repairs]);
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
  const savedIds = useMemo(() => new Set([...(Array.isArray(attempt?.lab?.repaired) ? attempt.lab.repaired : []), ...Object.keys(attempt?.savedRepairs && typeof attempt.savedRepairs === 'object' ? attempt.savedRepairs : {})]), [attempt]);
  // D15 (owner, 18 Oct dawn): the key says Repair Q6, so the list leads with Q6. Priority is shown by order, never by a label.
  // The lead is read once when the result loads, so rows do not shuffle while the student repairs.
  const leadQid = useMemo(() => (attempt && analysis ? leadMistake({ analysis, answerReviews: attempt.answerReviews || {}, repairOrder, repaired: savedIds })?.q?.id ?? null : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attempt?.id, analysis?.rows.length]);
  const listOrder = useMemo(() => (leadQid ? { ...(repairOrder || {}), qids: [leadQid, ...(Array.isArray(repairOrder?.qids) ? repairOrder.qids : []).filter((q) => q !== leadQid)] } : repairOrder), [leadQid, repairOrder]);
  const runIds = useMemo(() => (attempt && analysis ? repairCandidates(analysis, new Set(), attempt.answerReviews, listOrder).map(r => r.q.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attempt?.id, analysis?.rows.length]);
  const runNumbers = useMemo(() => Object.fromEntries((analysis?.rows || []).map(r => [r.q.id, r.number])), [analysis]);
  const reached = useMemo(() => new Set([...started, ...runIds.filter(id => repairOutcomes[id] && !savedIds.has(id))]), [started, runIds, repairOutcomes, savedIds]);
  const engaged = started.size > 0;
  const segments = useMemo(() => runSegments({ ids: runIds, numbers: runNumbers, outcomes: repairOutcomes, reached, current: runCurrent }), [runIds, runNumbers, repairOutcomes, reached, runCurrent]);
  const orderedMistakes = useMemo(() => inRepairOrder(analysis?.mistakes, listOrder), [analysis, listOrder]);
  // Said above the list only when the move pulled a mistake ahead of the order the list would otherwise follow.
  const leadMoved = useMemo(() => { const natural = inRepairOrder(analysis?.mistakes, repairOrder); return Boolean(leadQid) && natural.length > 1 && natural[0]?.q?.id !== leadQid; }, [analysis, repairOrder, leadQid]);

  useEffect(() => cancelSettle, []);
  const jumpTo = useCallback((number, { repair = false, instant, keepFocus = false } = {}) => {
    const row = analysis?.rows.find(r => r.number === number);
    if (!row) return;
    const inRun = runIds.includes(row.q.id);
    const step = inRun && (repair || engaged);
    const quick = instant ?? (step && engaged);
    // Each row lives in one place: a mistake in the list (opening "Show all" when it is further down), a blank in the
    // blanks row, a right answer in "Every answer".
    // Pass 1018: the part that owns the row opens first (a wrong answer or a blank: Your mistakes; a right one: Answer by answer).
    if (row.verdict === 'wrong') { if (orderedMistakes.findIndex(m => m.q.id === row.q.id) >= SHOWN_FIRST) setShowAll(true); }
    else if (row.verdict === 'skipped') setBlanksOpen(true);
    else setFilter(f => (f === 'all' || f === row.verdict ? f : 'all'));
    const owner = row.verdict === 'correct' ? 'answers' : 'mistakes';
    setPart(owner); writePart(owner);
    setOpen(s => new Set(s).add(row.q.id));
    setVisited(s => new Set(s).add(row.q.id));
    if (repair) setAutoRepair(row.q.id);
    if (step) { setRunCurrent(row.q.id); setHandover((h) => ({ qid: row.q.id, n: (h?.n || 0) + 1 })); }
    setReading(row.q.id);
    setArrived((prev) => ({ number, n: (prev?.n || 0) + 1 }));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.getElementById(`q-${number}`);
      // Aimed again once the scroll ends, so the part opening in the same frame cannot leave the row under the sticky heading.
      settleInto(el, { behavior: reducedMotion() || quick ? 'auto' : 'smooth' });
      if (!keepFocus) el?.querySelector('.rp-q__bar')?.focus({ preventScroll: true });
    }));
  }, [analysis, runIds, engaged, orderedMistakes]);

  // ?q=N (Today's weak chapters, Last paper and the reel's last key): once the paper is read, open that question the way a press on
  // its row does: Your mistakes (or the part that owns it) opens, the row expands and comes into view with its Repair button. It is
  // jumpTo without { repair: true }, so it never sets autoRepair: a repair can spend a credit and is only ever the student's own
  // press. An unknown or out-of-range N does nothing. Once per paper, so a later re-render never scrolls the page again.
  const fromUrl = useRef(null);
  useEffect(() => {
    if (!attempt || !analysis || fromUrl.current === attempt.id) return undefined;
    const n = questionFromSearch(window.location.search, analysis.rows.length);
    const t = window.setTimeout(() => { fromUrl.current = attempt.id; if (n) jumpTo(n); }, 0);
    return () => window.clearTimeout(t);
  }, [attempt, analysis, jumpTo]);

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
    if (status === 'explained' || status === 'stored') setSavedRepairs(s => (s[qid] ? s : { ...s, [qid]: { repairedAt: new Date().toISOString() } }));
  }, []);
  // D81: a scored set has landed. In the first usage session after onboarding this is the student's first real action, and
  // the shell may then open the Upgrade sheet once (src/components/pro/ProNudgeHost.jsx decides; Pro never sees it).
  const firstActionAttempt = attempt?.id && Number(attempt.total) > 0 && !user?.isPremium ? attempt.id : null;
  useEffect(() => {
    if (!firstActionAttempt) return;
    reportFirstAction({ kind: 'paper', at: Date.parse(attempt?.completedAt) || Date.now() });
  }, [firstActionAttempt]); // eslint-disable-line react-hooks/exhaustive-deps
  const isNtaAttempt = attempt?.selectionMeta?.mode === 'nta';
  // Check it held came back marked by the server. A right answer marked now (not one read back from earlier) is Mobi's
  // one moment on the page; never in NTA mode.
  const checked = useCallback((qid, result) => {
    setChecks(s => (s[qid]?.right === result.right && s[qid]?.replayed === result.replayed ? s : { ...s, [qid]: result }));
    if (result.right && !result.replayed && !isNtaAttempt) setCheer(qid);
  }, [isNtaAttempt]);

  // A Mob paper still open for the Mob (C-dec 2 item 1): the server sent the marks and when the answers open, nothing more.
  // At that moment the page reads the result again and the full result takes this one's place.
  const reopen = useCallback(() => setRetry((count) => count + 1), []);
  if (attempt?.mobHold && !error) return <HeldResult attempt={attempt} subjectName={subjectName(attempt.subject)} celebrations={prefs.celebrations} onOpened={reopen} />;
  if (error) return <div className="container-narrow student-page student-page--result pt-8"><ErrorState scene="unreachable" title="This session did not load" message="Your recorded result is safe. Try again to see it." onRetry={() => { setError(null); setRetry((count) => count + 1); }} /></div>;
  if (!attempt || !analysis) return <ResultSkeleton />;

  const { marks, timing } = analysis;
  const answerReviews = attempt.answerReviews || {};
  const mode = attemptMode(attempt);
  const subject = subjectName(attempt.subject);
  const runModel = endingModel({ ids: runIds, outcomes: repairOutcomes, reached });
  const checkMap = Object.fromEntries(Object.entries(checks).map(([qid, c]) => [qid, c.right ? 'right' : 'wrong']));
  const aiCredits = wallet.wallet?.known ? wallet.wallet.total : null;
  const move = nextMove({
    analysis, answerReviews, repairOrder, repaired, checks: checkMap, aiCredits,
    practiceCredits: user ? user.creditBalance ?? null : null, isPremium: Boolean(user?.isPremium), dailySet,
    mode, subject: practiceSubjectId(attempt.subject), subjectName: subject,
    labReady: Boolean(attempt.lab) && attempt.answerReviewState !== 'unavailable', hour,
  });
  const finding = costliestLine(analysis, { answerReviews });
  // Mobi's reveal follows the server's recap tone (the app's table); none in NTA mode, never sleepy.
  const reaction = mobiReaction(attempt, { celebrations: prefs.celebrations });
  const receipt = receiptLine({ subjectName: subject, mode, completedAt: attempt.completedAt, durationMs: timing?.totalMs ?? null });
  const keyReviews = analysis.rows.filter(r => repairOutcomes[r.q.id] === 'held_for_recheck').map(r => ({ number: r.number, chapter: r.chapter }));
  const correctedRows = analysis.rows.filter(r => answerReviews[r.q.id]?.state === 'corrected');
  const correctionAdjustment = correctedRows.reduce((sum, r) => sum + answerReviews[r.q.id].adjustment, 0);
  // The one notice line in layer 1: a correction first (it changes a mark), else a key under re-check.
  const notice = correctedRows.length
    ? { text: `We corrected ${correctedRows.length === 1 ? 'an answer key' : `${correctedRows.length} answer keys`}. Your original result is preserved.`, number: correctedRows[0].number }
    : keyReviews.length ? { text: `Q${keyReviews[0].number}’s answer key is being re-checked${keyReviews.length > 1 ? `, with ${keyReviews.length - 1} more` : ''}. It is left out of repairs until the check ends.`, number: keyReviews[0].number }
      : attempt.answerReviewState === 'unavailable' ? { text: 'Current answer-key checks could not load. The options show the key used in your original session.', number: null } : null;

  const toggle = (qid) => {
    if (!open.has(qid)) { setReading(qid); const verdict = analysis.rows.find(r => r.q.id === qid)?.verdict; const react = !engaged ? answerReaction(verdict, { celebrations: prefs.celebrations, reduced: prefs.reduced }) : null; setReaderReact(react ? { qid, ...react } : null); }
    setVisited(s => new Set(s).add(qid)); setOpen(s => { const n = new Set(s); if (n.has(qid)) n.delete(qid); else n.add(qid); return n; }); };
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
  // F17: which paper every mistake here came from, and when it was attempted ("Mock 3, Accountancy, 16 Oct, 9:40 PM").
  const paperLine = paperStamp({ source: attempt.paper?.source, subject: subjectName(attempt.subject), at: attempt.paper?.completedAt ?? attempt.completedAt });
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

  // W-032, "Repair lets the student retry before seeing the key": a wrong answer or a blank that holds no repair opens sealed.
  // Its key, its book explanation, its option shares and its repair are not on screen (and the key is not in the row's markup
  // either) until the student tries it again or asks for the answer. Both are free and neither is recorded or marked: they only
  // change what this page shows. A saved repair opens free as before (F17), a key under re-check says so, a repair already
  // written has already shown the key; none of those is sealed (data/retry_first.mjs retryEligible).
  const sealedOf = (row) => !retried[row.q.id] && retryEligible({
    verdict: row.verdict, saved: savedIds.has(row.q.id), outcome: repairOutcomes[row.q.id] || null, hasReview: Boolean(answerReviews[row.q.id]),
    keyIndex: row.q.correctIndex, optionCount: row.q.options?.length || 0,
  });
  // The student has now asked for the key. This only reveals it: it calls no route and charges nothing. The next-move key, "Next
  // mistake" and "Try the same mistakes again" press Repair for a mistake that was still sealed; that press opened the retry, so the
  // Repair it asked for waits for the student's own tap on the paid key (the wallet moves only on Repair, after it is written).
  const reveal = (row, how) => {
    setRetried((s) => (s[row.q.id] ? s : { ...s, [row.q.id]: how }));
    if (autoRepair === row.q.id) setAutoRepair(null);
  };

  // The opened row: what the answer row always held, in the same order (How others answered, the options with your pick
  // and the correct answer, your time and picks, the repair with Check it held, the key notices, Report a problem).
  const renderBody = (row) => {
    const { q, d, verdict, number } = row;
    const given = d?.givenIndex;
    const isWrong = verdict === 'wrong';
    const review = answerReviews[q.id];
    const tried = retried[q.id] || null;
    // One Ask Mobi line per mistake and the report link close the row, sealed or not (askAbout is declared below; it runs when called).
    const foot = (
      <>
        {askAbout(row)}
        <div className="rp-q__foot">
          {reaction && reading === q.id && !engaged ? <span className="rp-reader" key={`reader-${q.id}`}><ReaderMobi react={readerReact?.qid === q.id ? readerReact : null} /></span> : null}
          <button type="button" className="rp-report" disabled={!!reporting[q.id] || !!reported[q.id]} onClick={() => handleReport(row)}>
            {reported[q.id] ? 'Reported. Thank you.' : reporting[q.id] ? 'Sending…' : 'Report a problem with this question'}
          </button>
        </div>
      </>
    );
    if (sealedOf(row)) {
      return (
        <div className="rp-q__body rx-body" data-sealed="">
          <RetryFirst q={questionModel(q, d)} number={number} repairable={isWrong && Number.isInteger(given) && aiCredits !== 0}
            onTried={({ pick, right }) => reveal(row, { how: 'tried', pick, right })} onShow={() => reveal(row, { how: 'shown' })} />
          {foot}
        </div>
      );
    }
    const timeRow = timeRead?.state === 'ready' ? timeRead.rows[row.index] : null;
    const insights = attempt.mistakeInsights?.[q.id] ?? null;
    const repairInsights = insights && timeRow?.lines.length ? { ...insights, lines: (insights.lines || []).filter(l => l?.kind !== 'change' && l?.kind !== 'time') } : insights;
    // How others answered (server-built; null under 10 other students, on held keys, or without the Lab).
    const others = attempt.lab?.byQuestion?.[q.id]?.others || null;
    // The trap tag under the student's own wrong option (server-built: the trap atlas, then the question format).
    const trap = isWrong ? attempt.lab?.traps?.tags?.[q.id] || null : null;
    return (
      <div className="rp-q__body rx-body">
        {tried?.how === 'tried' ? <RetrySaid said={retrySaid({ pick: tried.pick, keyIndex: q.correctIndex, right: tried.right })} /> : null}
        {others ? <OthersAnswered others={others} title={attempt.lab?.labels?.othersTitle} /> : null}
        <ul className="rp-options">
          {q.options.map((opt, j) => {
            const mine = given === j, key = q.correctIndex === j;
            const corrected = review?.state === 'corrected' && review.currentIndex === j;
            return (
              <li key={j} data-state={corrected || (!review && key) ? 'key' : mine ? 'mine' : undefined} data-others={others ? '' : undefined}>
                <span className="rp-options__letter">{LETTERS[j]}</span>
                <span className="rp-options__text">{displayValue(plainOptionTexts(q.options)[j] ?? opt, 'Option')}</span>
                {mine || key || corrected ? <span className="rp-options__tag">{corrected ? mine ? 'Your pick, corrected answer' : 'Corrected answer' : key ? mine ? 'Your pick, correct' : 'Correct answer' : tried?.how === 'tried' ? RETRY_COPY.firstPick : 'Your pick'}</span> : null}
                {others ? <OptionShare others={others} index={j} tone={shareTone(others, j, given)} /> : null}
                {trap && trap.index === j && mine ? <TrapTag trap={trap} /> : null}
              </li>
            );
          })}
        </ul>
        {timeRow?.lines.length ? (
          <div className="rp-td">
            <p className="rp-td__label">{TIME_COPY.rowLabel}</p>
            {attempt.lab?.replay ? <QuestionStrip replay={attempt.lab.replay} number={number} paceSec={timeRead?.pace?.perQuestionMs ? timeRead.pace.perQuestionMs / 1000 : null} /> : null}
            {timeRow.lines.map((line, i) => <p key={i}>{line}</p>)}
          </div>
        ) : null}
        {q.explanation && !review ? (
          isWrong && !tried ? (
            <details className="rp-expl"><summary>{RETRY_COPY.bookExplanation}</summary><p>{displayValue(q.explanation)}</p></details>
          ) : <div className="rp-expl rp-expl--open"><span>{tried ? RETRY_COPY.bookExplanation : 'Explanation'}</span><p>{displayValue(q.explanation)}</p></div>
        ) : tried && !review ? <div className="rp-expl rp-expl--open"><span>{RETRY_COPY.bookExplanation}</span><p>{RETRY_COPY.noExplanation(isWrong && Number.isInteger(given))}</p></div> : null}
        {/* The line you needed (KEYCARDS-BUILD-SPEC.md section 3): the NCERT line behind a wrong answer; hidden when none is found. */}
        {isWrong ? <LineYouNeeded questionId={q.id} /> : null}
        {isWrong && Number.isInteger(given) ? (
          <MistakeRepair key={`${q.id}:${epochs[q.id] || 0}`} attemptId={attempt.id} questionId={q.id} number={number} nta={isNtaAttempt} chosen={LETTERS[given]} answer={Number.isInteger(q.correctIndex) ? LETTERS[q.correctIndex] : null}
            autoStart={autoRepair === q.id || savedIds.has(q.id)} saved={savedRepairs[q.id]?.repairedAt || (savedIds.has(q.id) ? 'saved' : null)} paper={paperLine || null} onSettled={settled} initialReview={review} onReview={reviewReceived} onCheck={checked}
            insights={repairInsights} askContext={askContextOf(row)}
            isCurrent={(!engaged || runCurrent === q.id) && cheer !== q.id} onStart={noteStart} onStep={engaged ? stepFrom : undefined} onFinish={() => setEnding(true)}
            handover={handover?.qid === q.id ? (handover.n % 2 ? 'a' : 'b') : null}
            earlier={(() => { const m = earlierMisses(attempt, q.id)[0]; return m ? { line: earlierMissAt(m), href: `/result/${m.attemptId}` } : null; })()}
            next={(() => { const at = orderedMistakes.findIndex(m => m.q.id === q.id); const n = orderedMistakes.find((m, i) => i > at && !handled.has(m.q.id)) || orderedMistakes.find(m => m.q.id !== q.id && !handled.has(m.q.id)); return n ? { number: n.number, go: () => jumpTo(n.number, { repair: true }) } : null; })()} />
        ) : null}
        {review && !(isWrong && Number.isInteger(given)) ? review.state === 'corrected' || review.state === 'key_changed_unverified' ? <AnswerCorrectionNotice review={review} /> : <KeyReviewNotice chosenLetter={Number.isInteger(given) ? LETTERS[given] : null} keyLetter={LETTERS[q.correctIndex]} reviewState={review.state} /> : null}
        {foot}
      </div>
    );
  };

  // Ask Mobi about this question (ASK-MOBI-1018): one quiet text line under the repair, for a wrong answer or a blank whose key
  // is not under re-check. Once the repair is written, the same ask sits inside it (RepairAsk), so it is not drawn twice.
  const askContextOf = (row) => {
    const { q, d, verdict, number } = row;
    const review = answerReviews[q.id];
    if (!canAskAboutQuestion({ verdict, held: Boolean(review && HELD_STATES.has(review.state)) })) return null;
    const texts = plainOptionTexts(q.options);
    const given = d?.givenIndex;
    return questionContext({
      attemptId: attempt.id, questionId: q.id, number, chapter: row.chapter,
      pickText: Number.isInteger(given) ? texts[given] : null, keyText: Number.isInteger(q.correctIndex) ? texts[q.correctIndex] : null,
      hasKey: Number.isInteger(q.correctIndex), blank: verdict === 'skipped',
    });
  };
  const askAbout = (row) => {
    // v13: on an opened wrong answer that has not been fixed yet, "Ask Mobi about Q7" is the Fix it for good job itself, titled
    // above its key in the repair (MistakeRepair's RepairStart), so the line is not drawn a second time here.
    if (row.verdict === 'wrong' && Number.isInteger(row.d?.givenIndex) && !sealedOf(row) && !repairOutcomes[row.q.id]) return null;
    const context = hasExplanation(repairOutcomes[row.q.id]) ? null : askContextOf(row);
    return context ? <p className="ame-line"><AskMobiLink context={context}>{questionEntryLabel(row.number)}</AskMobiLink></p> : null;
  };


  // Each row's chip says a real server state, never ahead of it (RESULT-1017 4.5). D15 (owner, 18 Oct dawn): one action
  // per mistake with one label everywhere. A mistake not yet repaired says "Repair" (the next move says "Repair Q6", the
  // opened row's key says "Repair Q6"); the one the next move points at keeps its volt outline, never other words. A
  // repaired one says "Check it held" until the new question is marked. The price lives in the one spend line under the list.
  const statusOf = (row) => {
    const qid = row.q.id;
    const review = answerReviews[qid];
    if (review?.state === 'corrected') return { id: 'corrected', label: 'Key corrected' };
    if (review && HELD_STATES.has(review.state)) return { id: 'recheck', label: 'Key being re-checked' };
    // A blank has one action too (D15, section 7): Try it again, free. It is actionLabel's word, the same as Review and Today. Once the
    // student has tried it or asked for the answer the step is done and the chip goes (a blank has no paid Repair to follow).
    if (row.verdict === 'skipped') return sealedOf(row) ? { id: 'again', label: actionLabel('blank') } : null;
    if (row.verdict !== 'wrong') return null;
    const out = repairOutcomes[qid];
    if (out === 'held_for_recheck') return { id: 'recheck', label: 'Key being re-checked' };
    if (out === 'not_explained') return { id: 'none', label: 'No repair, no charge' };
    // Pass 1018 section 7: one label per state. Repaired and checked says See repair (it opens free); its state words
    // ("Held on a new question") are said in Answer by answer. Priority is shown by order, never by a label.
    const c = checks[qid];
    if (c) return c.right ? { id: 'held', label: actionLabel('held'), words: 'Held on a new question' } : { id: 'slipped', label: actionLabel('slipped'), words: 'Slipped on a new question' };
    if (hasExplanation(out)) return { id: 'check', label: actionLabel('repaired') };
    if (started.has(qid)) return { id: 'writing', label: 'Writing' };
    // Out of credits: the same word; the opened row offers the credits line, not a paid repair.
    return { id: 'repair', label: actionLabel('open') };
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

  // ---------- The Lab's parts (each drawn only when it has something to hold) ----------
  const lab = attempt.lab || null;
  const swotShown = attempt.swot?.state === 'ready';
  const showTime = Boolean(lab?.replay?.rows?.length || timeRead || analysis.chapters.length || analysis.observations.length);
  const showSwot = Boolean(attempt.swot && attempt.swot.state !== 'not_available' && (swotShown || attempt.swot.message));
  // The ledger already states the cohort line under its groups; without a ledger it is said here once.
  const cohort = lab?.cohort?.line && !ledgerOf(lab) ? lab.cohort : null;
  const labTitle = lab?.heading ? lab.heading : marks.gap ? `You missed ${marks.gap} ${marks.gap === 1 ? 'mark' : 'marks'}. Here’s where they went.` : 'You didn’t miss a mark this session.';
  const seeReplay = () => { openPart('time'); scrollToPart('time'); };
  // D17 (owner, 18 Oct dawn): the answer bar is sized to the paper. Up to 20 questions it fills the card's width in even
  // lines (10 questions: one line of 10 on a desktop, two of 5 on a phone); a longer paper keeps the 44 px wrap.
  const mapCount = analysis.rows.length;
  const balanced = (most) => Math.ceil(mapCount / Math.ceil(mapCount / most));
  const mapFit = mapCount > 0 && mapCount <= 20;
  const answerMap = (
    <ol className="rp-strip" aria-label="Answer map: press a question to open it" data-fit={mapFit || undefined}
      style={{ '--rp-step': `${rippleStep}ms`, ...(mapFit ? { '--rp-cols': balanced(10), '--rp-cols-phone': balanced(6) } : {}) }}>
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
  );


  // ---------- Your full analysis (pass 1018, REVIEW-RESULT-1018 5.2 and 5.3): six parts, each finding generated ----------
  const ledgerTop = (ledgerOf(lab)?.groups || []).filter(g => g.marks > 0).sort((x, y) => y.marks - x.marks)[0] || null;
  const waiting = orderedMistakes.find(r => statusOf(r)?.id === 'check') || null;
  const usedMs = timing?.totalMs ?? null;
  const paperMs = timeRead?.pace?.paperMs ?? null;
  const changes = timeRead?.state === 'ready' ? timeRead.changes : null;
  // With no replay to draw, the index line still names the paper's own total time (the same number the line below it would give).
  const cutLine = lab ? replayCutLine(lab.replay || null, analysis.rows.length, knownRecord({ totalMs: usedMs, changed: changes?.count || 0 })) : null;
  const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
  const ruleCheck = lab?.prove?.ruleCheck || null;
  const ruleFigure = { kept: 'Held', not_kept: 'Slipped', counted: 'Counted' }[ruleCheck?.state] || '';
  const threat = attempt.swot?.state === 'ready' ? (() => {
    const quads = Array.isArray(attempt.swot.quadrants) ? attempt.swot.quadrants : [];
    const first = (id) => quads.find(q => q.id === id)?.items?.[0]?.title || null;
    return first('threat') || first('weakness') || attempt.swot.plan?.[0]?.label || null;
  })() : null;
  const parts = [
    { id: 'marks', name: 'Where your marks went', figure: marks.gap ? `${marks.gap} marks` : '0 marks',
      line: marks.gap ? `${marks.gap} ${marks.gap === 1 ? 'mark' : 'marks'} missed.${ledgerTop ? ` ${ledgerTop.label}: ${ledgerTop.marks} of them.` : ''}` : 'You didn’t miss a mark this session.',
      body: (
        <div className="srl rl" data-in="">
          <header className="srl-head"><h2 id="srl-title">{labTitle}</h2></header>
        <LabLedger attempt={attempt} analysis={analysis} timeRead={timeRead} lab={lab} onJump={jumpTo} changesId="rx-time-changes" onSeeReplay={seeReplay} bare />
        {/* One line under the ledger: Mobi opens already on this paper, with the first answer (where the marks went) free. */}
        <p className="ame-line"><AskMobiLink context={mockContext({ attemptId: attempt.id, label: mockLabel({ source: attempt.paper?.source, mode }), analysis })}>{mockEntryLabel(mode)}</AskMobiLink></p>
        {cohort ? (
          <div className="rl-cohort">
            <p>{cohort.line}</p>
            {Array.isArray(cohort.numbers) && cohort.numbers.length ? (
              <span className="srl-qchips"><span className="srl-qchips__label">See</span>{cohort.numbers.map(n => <button key={n} type="button" onClick={() => jumpTo(n)} aria-label={`Go to question ${n}`}>Q{n}</button>)}</span>
            ) : null}
            {(Array.isArray(cohort.fine) ? cohort.fine : cohort.fine ? [cohort.fine] : []).map((line, i) => <p key={i} className="srl-fine">{line}</p>)}
          </div>
        ) : null}
        {/* A key under re-check is said once, in the line under the score (the notice) and on its own row; the old second list is gone (release 9). */}
      {correctedRows.length ? <section className="kr-log" aria-label="Answer corrections"><h2>We corrected {correctedRows.length === 1 ? 'an answer key' : `${correctedRows.length} answer keys`}. We’re sorry.</h2><p>Your original result is preserved. Applying these checked corrections gives a separate adjustment of {correctionAdjustment > 0 ? '+' : ''}{correctionAdjustment} marks. This has not changed your account or leaderboard score.</p><ul>{correctedRows.map(r => <li key={r.q.id}><button type="button" onClick={() => jumpTo(r.number)}><b>Q{r.number}</b><span>{r.chapter}</span><em>See correction</em></button></li>)}</ul></section> : null}
        </div>
      ) },
    { id: 'mistakes', name: 'Your mistakes', figure: String(marks.wrong + marks.blank),
      line: `${marks.wrong} wrong and ${marks.blank} left blank.${waiting ? ` Q${waiting.number} is repaired and waiting for Check it held.` : repaired.size ? ` ${repaired.size} repaired.` : ''}`,
      body: (
        <div className="rl-part" id="rl-repair">
          <MistakeList
            mistakes={orderedMistakes} blanks={blanks} openIds={open} onToggle={toggle} visited={visited}
            statusOf={statusOf} sealedOf={sealedOf} cohortOf={cohortOf} renderBody={renderBody}
            showAll={showAll} onShowAll={setShowAll} blanksOpen={blanksOpen} onBlanks={setBlanksOpen}
            repairedCount={repaired.size} heldCount={heldCount} ordered={repairOrder?.state === 'cohort' ? 'repair' : 'paper'} lead={leadMoved ? runNumbers[leadQid] : null}
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
        </div>
      ) },
    { id: 'time', name: 'Time and changes', figure: cutLine ? '' : usedMs ? formatDuration(usedMs) : '',
      line: cutLine || [usedMs ? `${formatDuration(usedMs)}${paperMs ? ` of ${Math.round(paperMs / 60000)} minutes` : ''}.` : null, changes?.count ? `${changes.count} changed ${changes.count === 1 ? 'answer' : 'answers'}, net ${signed(changes.net)} marks.` : null].filter(Boolean).join(' ') || 'Where your time went and every answer you changed.',
      body: showTime || lab ? (
        <div className="rl-part" id="rl-find">
          <LabTime attempt={attempt} analysis={analysis} timeRead={timeRead} lab={lab} onJump={jumpTo} swotShown={swotShown} changesId="rx-time-changes" />
        </div>
      ) : <p className="ap-empty">This paper has no record of its time, so there is nothing to show here. Every answer is in Answer by answer.</p> },
    { id: 'rule', name: 'Did your rule hold', figure: ruleFigure,
      line: ruleCheck?.line ? (ruleCheck.result || ruleCheck.line) : 'Show it stuck, on questions you haven’t seen.',
      body: (
        <div className="rl-part" id="rl-prove">
          <LabProof attempt={attempt} analysis={analysis} lab={lab} />
        </div>
      ) },
    { id: 'after', name: 'After this mock', figure: '',
      line: threat || (showSwot && attempt.swot?.message) || 'What to do next, and what this paper shows.',
      body: showSwot ? <SwotPanel swot={attempt.swot} attemptId={attempt.id} onJump={jumpTo} inFold plain /> : <p className="ap-empty">This part fills in after a full mock or an NTA paper: what is costing you, what is working, and what to do next.</p> },
    { id: 'answers', name: 'Answer by answer', figure: String(attempt.total),
      line: `All ${attempt.total}: ${marks.right} right, ${marks.wrong} wrong, ${marks.blank} blank.`,
      body: (
      <section className="rp-review rl-answers" aria-labelledby="rp-review-title">
        <div className="rp-review__head">
          <h2 id="rp-review-title">Answer by answer</h2>
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
        </div>
        <ol className="rp-list">
          {visible.length === 0 ? <li className="rp-empty">Nothing in this group.</li> : null}
          {analysis.rows.map(row => {
            const { q, verdict, number } = row;
            const elsewhere = verdict !== 'correct';
            const isOpen = !elsewhere && open.has(q.id);
            const review = answerReviews[q.id];
            const timeRow = timeRead?.state === 'ready' ? timeRead.rows[row.index] : null;
            const rowMs = timeRow ? (timeRow.ms >= TIME_RULES.minTimedMs ? timeRow.ms : null) : row.ms;
            // A mistake's progress in the chip's own words (D15), so the two lists never name one state twice; the plain
            // "Repair" is left to the mistakes list, where the action is.
            const chip = verdict === 'wrong' ? statusOf(row) : null;
            const progress = chip ? (chip.id === 'repair' ? null : { label: chip.words || chip.label, tone: ['check', 'held'].includes(chip.id) ? 'repaired' : 'held' })
              : repairLabel(repairOutcomes[q.id]) ? { label: repairLabel(repairOutcomes[q.id]), tone: hasExplanation(repairOutcomes[q.id]) ? 'repaired' : 'held' } : null;
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
                      {progress ? <span data-verdict={progress.tone}>{progress.label}</span> : null}
                      {elsewhere ? <span>{verdict === 'wrong' ? 'Opens in your mistakes' : 'Opens in your blanks'}</span> : null}
                    </span>
                  </span>
                  <span className="rp-q__chev" aria-hidden="true" />
                </button></h3>
                {elsewhere ? null : <div id={`q-${number}-body`} hidden={!isOpen}>{visited.has(q.id) ? renderBody(row) : null}</div>}
              </li>
            );
          })}
        </ol>
      </section>
      ) },
  ];

  return (
    <div className="container-narrow student-page student-page--result rp rx rl-page pb-20" data-arrive={arrive || undefined}>
      {/* ---------- 1. The summary: Mobi, the score, the finding, the counts, the answer map and the one next move ---------- */}
      <ResultHero receipt={receipt} marks={marks} finding={finding} reaction={reaction} holdStill={engaged || reading != null}
        notice={notice} onNotice={(n) => jumpTo(n)} arrive={arrive} strip={answerMap} repairReceipt={repairsDid}
        next={<NextMove move={move} onAct={onAct} paperHref={next.href} arrive={arrive} flat lesson={move?.kind === 'practise' && move.rule === 2 ? lesson : null} />} />

      {/* A badge this scored set earned: one compact row, once, right after the summary and above the analysis (BADGES-REFINE-1018).
           Draws nothing otherwise. */}
      <EarnedBadges attempt={attempt} />

      {/* D29: the paper played back, about 20 s, from the record (sheet, real moments, costliest chapter, the one next move).
           A quiet row under the front, never inside it. */}
      <ReelEntry analysis={analysis} attempt={attempt} timeRead={timeRead} finding={finding} move={move} onAct={onAct} />

      {/* ---------- 2. Your full analysis (pass 1018, REVIEW-RESULT-1018 5.2 and 5.3): one index of six named parts, each
           saying what it found, exactly one open. Every R4 block lives in exactly one part, moved and not rewritten. ---------- */}
      <AnalysisParts parts={parts} open={part} onOpen={openPart} />

      {/* The Mob's weekly paper: one quiet row with the ring and the way back to /mob (draws nothing otherwise). */}
      {attempt.selectionMeta?.mobPaper ? <MobResultRow mobPaper={attempt.selectionMeta.mobPaper} /> : null}

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
      {/* Free only, after a scored set (D79): one quiet line beside the next paper's price. */}
      <ProFacts facts={{ weakChapter: weakestChapter(chapterCounts), balance: user ? user.creditBalance ?? null : null, subjects: user?.subjects || [] }} />
      {attempt.total > 0 ? <InlineNudge placement="result" facts={{ weakChapter: weakestChapter(chapterCounts) }} className="rp-nudge" /> : null}

      <nav className="rp-links" aria-label="More from your record">
        <Link href="/mentor?tab=record"><AppIcon name="prepos" size={16} />Your full record</Link>
        <Link href="/review"><AppIcon name="review" size={16} />All saved mistakes</Link>
        <Link href="/analytics"><AppIcon name="radar" size={16} />See your marks trend</Link>
        <Link href="/dashboard"><AppIcon name="practice" size={16} />Back to Practice</Link>
      </nav>
    </div>
  );
}
