"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, Suspense, useMemo, useSyncExternalStore } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icons';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { PageSpinner, ErrorState, NoticeState } from '@/components/ui/Skeleton';
import ArenaCompanion from '@/components/brand/ArenaCompanion';
import { api, apiPost } from '@/lib/fetcher';
import { useAuth } from '@/components/AuthProvider';
import { VoteControls } from '@/components/questions/VoteControls';
import { getMode, isValidModeId, resolveCount, resolveDurationSec } from '@/../data/test_modes';
import { progressFromEvents, resumableDraft, SUBMISSION_GRACE_MS } from '@/../data/session_draft';
import { plainOptionTexts } from '@/../data/option_text';
import './nta-classic.css';
import './practice-run.css';
import MobiReact from '@/components/brand/MobiReact';
import { useExamIntegrity, IntegrityPill, IntegrityOverlay } from '@/components/arena/ExamIntegrityGuard';
import { nextEvent, onScreenQid, endReason, captureMeta, usePresenceCapture } from '@/lib/runnerCapture';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];
const subscribeConnection = callback => {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => { window.removeEventListener('online', callback); window.removeEventListener('offline', callback); };
};
const connectionSnapshot = () => navigator.onLine;

const CHIP_LABELS = { answered: 'Answered', marked: 'Marked', 'marked-answered': 'Answered and marked', visited: 'Not answered', notvisited: 'Not visited' };

const storageKey = (uid, subject, chapter, count, difficulty = 'auto', modeId = 'quick') =>
  `mm:test:${uid || 'anon'}:${subject}:${chapter || '*'}:${count}:${difficulty || 'auto'}:${modeId}`;

function optionLabel(option) {
  return typeof option === 'string' ? option : option?.text ?? String(option ?? '');
}

function displayLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function newGenerationKey() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// A Full Mock for the subject: started directly for a Premium student (it costs them nothing), set up on
// the dashboard otherwise, where its cost is shown before it starts. One key per refusal, so following
// the link twice reopens the same Full Mock.
function fullMockHref(subjectId, isPremium, key) {
  const subject = encodeURIComponent(subjectId || '');
  if (!isPremium) return `/dashboard?subject=${subject}&mode=full`;
  return `/test?subject=${subject}&count=50&mode=full&generationKey=${encodeURIComponent(key)}`;
}

const NTA_LOADING_STEPS = [
  'Checking available evidence',
  'Selecting your question mix',
  'Creating your session',
];

function NtaValidationSpinner({ subjectId }) {
  return (
    <div className="container-narrow max-w-3xl px-4 pt-16">
      <div className="glass p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="w-3 h-3 mt-2 rounded-full bg-volt animate-pulse-slow shadow-[0_0_18px_var(--volt)]" />
          <div className="min-w-0">
            <div className="mono-label mb-2">Preparing practice</div>
            <h1 className="heading text-2xl md:text-3xl text-white">Building your verified {displayLabel(subjectId)} mock.</h1>
            <p className="text-sm text-zinc-400 mt-3 max-w-xl">
              Selecting questions with current verification evidence before the timer starts.
            </p>
            <div className="grid gap-2 mt-6">
              {NTA_LOADING_STEPS.map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-volt/40 text-[11px] font-bold text-volt">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <p className="mono-label mt-5 text-zinc-500">This can take up to 30 seconds.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function passageKeyFor(question) {
  return question?.passageGroupId || question?.passage_group_id || question?.group_id || question?.passageId || question?.passage_id || '';
}

function passageTextFor(question) {
  return question?.passageText || question?.passage_text || '';
}

function passageTitleFor(question) {
  return question?.passageTitle || question?.passage_title || question?.passageType || question?.passage_type || 'Reading Comprehension';
}

function getQuestionBlock(questions, index) {
  const current = questions[index];
  const key = passageKeyFor(current);
  const passageText = passageTextFor(current);
  if (!key || !passageText) {
    return {
      isPassage: false,
      passageKey: '',
      passageText: '',
      passageTitle: '',
      startIdx: index,
      endIdx: index,
      entries: current ? [{ question: current, index }] : [],
    };
  }

  const entries = questions
    .map((question, questionIndex) => ({ question, index: questionIndex }))
    .filter((entry) => passageKeyFor(entry.question) === key)
    .sort((a, b) => Number(a.question.orderIndex || 0) - Number(b.question.orderIndex || 0) || a.index - b.index);

  const indices = entries.map((entry) => entry.index);
  return {
    isPassage: true,
    passageKey: key,
    passageText,
    passageTitle: passageTitleFor(current),
    startIdx: Math.min(...indices),
    endIdx: Math.max(...indices),
    entries,
  };
}

function visitedForBlock(questions, index) {
  const block = getQuestionBlock(questions, index);
  return Object.fromEntries(block.entries.filter((entry) => entry.question?.id).map((entry) => [entry.question.id, true]));
}

function normalizeQuestionPayload(payload) {
  if (Array.isArray(payload)) return { questions: payload, meta: null };
  if (payload && Array.isArray(payload.questions)) {
    return { questions: payload.questions, meta: payload.meta || null };
  }
  return { questions: [], meta: payload?.meta || null };
}

// Practice runner (every mode except NTA): swipe, strike-out and the submit sheet.
const SWIPE_COMMIT_PX = 72;
const SWIPE_FLICK = 0.45; // px per ms
const LONG_PRESS_MS = 460;
const STRIKE_NOTE_KEY = 'mm:strikeNote:v1';
const LEGEND = [
  ['answered', 'Answered'],
  ['marked', 'Marked'],
  ['visited', 'Not answered'],
  ['notvisited', 'Not visited'],
  ['marked-answered', 'Answered and marked'],
];
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const rubberBand = (dx) => Math.sign(dx) * 64 * (1 - 1 / (Math.abs(dx) / 160 + 1));

// Mobi on the practice submit sheet (never a mock, never NTA): reads the sheet, then one gesture.
function SheetMobi({ act }) {
  const alt = act === 'reading' ? 'Mobi reading your answer sheet.' : act === 'nod' ? 'Mobi nodding: every question is answered.' : act === 'point' ? 'Mobi pointing at the first question not answered.' : 'Mobi tilting its head at the questions marked for review.';
  return <div className="pr-mobi"><MobiReact act={act === 'reading' ? 'read' : act} size={60} label={alt} /></div>;
}

function resolveRunnerDurationSec(mode, questions) {
  return resolveDurationSec(mode, questions);
}

function TestRunner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, status: authStatus, refreshSession } = useAuth();

  const subjectId = searchParams.get('subject');
  const chapter = searchParams.get('chapter') || null;
  const chapters = searchParams.get('chapters') || null;
  const difficulty = searchParams.get('difficulty') || null;
  const modeIdRaw = searchParams.get('mode') || 'quick';
  const modeId = isValidModeId(modeIdRaw) ? modeIdRaw : 'quick';
  const mode = getMode(modeId);
  const requestedCount = parseInt(searchParams.get('count') || '10', 10);
  const count = resolveCount(mode, requestedCount);
  const generationKey = searchParams.get('generationKey');
  const isNtaMode = modeId === 'nta';
  const [examInterface, setExamInterface] = useState(() => searchParams.get('interface') === 'nta' ? 'nta' : 'mockmob');
  const classicInterface = isNtaMode && examInterface === 'nta';

  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [visited, setVisited] = useState({});
  const [marked, setMarked] = useState({});
  const [endsAt, setEndsAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // An NTA paper the bank cannot supply: { message, fullMockKey }.
  const [refusal, setRefusal] = useState(null);
  const [selectionMeta, setSelectionMeta] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [syncStatus, setSyncStatus] = useState('saved');
  const [pendingSubmission,setPendingSubmission] = useState(false);
  const online = useSyncExternalStore(subscribeConnection, connectionSnapshot, () => true);
  const autoSubmitTried = useRef(false);
  const [showVoteCoach, setShowVoteCoach] = useState(false);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  // The paper notice opens by default on wide screens only: on a phone it would push the first question below the fold.
  const [noticeOpen, setNoticeOpen] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches);
  const mobilePaletteTriggerRef = useRef(null);
  const mobilePaletteCloseRef = useRef(null);
  const mobilePaletteDialogRef = useRef(null);
  const fullscreenTarget = useRef(null);
  const finishExamRef = useRef(null);
  const practiceRun = !isNtaMode;
  const isMockMode = isNtaMode || modeId === 'full';
  // Hand-off between questions: the block being left, drawn under the incoming one until it fades.
  const [ghost, setGhost] = useState(null); // { startIdx, dir, from, n }
  const [navDir, setNavDir] = useState(1);
  const idxRef = useRef(0);
  const liveRef = useRef(null);
  const swipeRef = useRef(null);
  const suppressClickRef = useRef(false);
  // The crossed-out look lives only in memory and is never restored. Each cross-out and restore is also recorded as a
  // strike event, read only after submit (the Mistake Lab's "You crossed out B, the key, at 0:41").
  const [struck, setStruck] = useState({});
  const struckRef = useRef({});
  const pressRef = useRef(null);
  const lastStrikeAt = useRef(0);
  const [strikeNote, setStrikeNote] = useState(() => {
    if (typeof window === 'undefined' || modeId === 'nta') return false;
    try { return !window.localStorage.getItem(STRIKE_NOTE_KEY); } catch { return false; }
  });
  const [undoClear, setUndoClear] = useState(null); // { qid, answer, number, n }
  const [paletteFilter, setPaletteFilter] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [mobiAct, setMobiAct] = useState('reading');
  const reviewDialogRef = useRef(null);
  const reviewReturnRef = useRef(null);
  const [ackSeq, setAckSeq] = useState(0);
  const [lastAnswerSeq, setLastAnswerSeq] = useState(0);
  const glideRefs = useRef({});

  // The start receipt is added to the address after the server answers; it must not look like a new launch.
  const launchKey = useMemo(() => { const p = new URLSearchParams(searchParams.toString()); p.delete('startReceipt'); return p.toString(); }, [searchParams]);

  const userId = user?.id;
  const key = useMemo(
    () => storageKey(userId, subjectId, chapters || chapter, count, difficulty || 'auto', modeId),
    [userId, subjectId, chapter, chapters, count, difficulty, modeId],
  );

  const answersRef = useRef(answers);
  const markedRef = useRef(marked);
  const eventsRef = useRef([]);
  const startedRef = useRef(0);
  const endsAtRef = useRef(null);
  // One event of the paper's record (src/lib/runnerCapture.js). value: the option index (or null) for an answer,
  // true or false for a mark, how the question was reached for a visit, { option, on } for a strike, the reason
  // for an end. Recording never touches React state, so nothing on the page changes because of it.
  const recordEvent = useCallback((qid, type, value) => {
    const event = nextEvent(eventsRef.current, { startedAt: startedRef.current, now: Date.now(),
      limitMs: endsAtRef.current ? endsAtRef.current - startedRef.current : undefined }, qid, type, value);
    if (event) eventsRef.current.push(event);
    return event;
  }, []);
  // A device-held session has no server row; the server's signed start time rides in the address so a
  // reload that lost the saved draft is given the same clock, never a new one.
  const rememberStart = useCallback((receipt) => {
    if (!receipt || typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('startReceipt') === receipt) return;
      url.searchParams.set('startReceipt', receipt);
      window.history.replaceState(null, '', url);
    } catch { /* the address is a convenience; the saved draft still resumes this device */ }
  }, []);
  const questionsRef = useRef(questions);
  const submittedRef = useRef(false);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { markedRef.current = marked; }, [marked]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { endsAtRef.current = endsAt; }, [endsAt]);
  // The paper is live: started, not yet submitted, and before the deadline. Away, back and strike events are
  // recorded only then.
  const paperLive = useCallback(() => !!startedRef.current && !submittedRef.current && !!endsAtRef.current && Date.now() < endsAtRef.current, []);

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (!subjectId) return;

    const launch = new URLSearchParams(launchKey);
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      setRefusal(null);
      setSelectionMeta(null);
      setPendingSubmission(false);
      autoSubmitTried.current = false;
      submittedRef.current = false;
      if ((!generationKey || generationKey.length < 12) && !launch.get('sessionId')) {
        if (!alive) return;
        setError('Missing generation key. Start a fresh test from the dashboard.');
        setLoading(false);
        return;
      }

      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem(key);
          if (raw) {
            const saved = JSON.parse(raw);
            if (resumableDraft(saved,{generationKey,sessionId:launch.get('sessionId')})) {
              if (!alive) return;
              setQuestions(saved.questions);
              eventsRef.current = saved.events || [];
              startedRef.current = saved.startedAt;
              setAnswers(saved.answers || {});
              setVisited(saved.visited || {});
              setMarked(saved.marked || {});
              markedRef.current = saved.marked || {};
              const resumeIdx = typeof saved.idx === 'number' ? Math.min(saved.idx, saved.questions.length - 1) : 0;
              // Marks saved before they were recorded as events are added to the event log now, so the
              // server learns them too.
              if (!saved.pendingSubmission && Date.now() < saved.endsAt) {
                const recorded = progressFromEvents(eventsRef.current, saved.questions).marked;
                for (const qid of Object.keys(saved.marked || {})) if (!recorded[qid]) recordEvent(qid, 'mark', true);
                // The paper reopened on this device, on the question it was left on (last, so the time from here
                // is credited to that question).
                if (saved.questions[resumeIdx]?.id) recordEvent(saved.questions[resumeIdx].id, 'visit', 'resume');
              }
              rememberStart(saved.selectionMeta?.startReceipt);
              setSelectionMeta(saved.selectionMeta || null);
              setEndsAt(saved.endsAt);
              setIdx(resumeIdx);
              setPendingSubmission(saved.pendingSubmission === true);
              setLoading(false);
              return;
            }
            // Keep a pending submission for reconnect diagnostics; never restart it as a new test.
            if(!saved.pendingSubmission)window.localStorage.removeItem(key);
          }
        } catch {
          // Corrupted local progress should not block a fresh test load.
        }
      }

      try {
        const qs = new URLSearchParams({ subject: subjectId, count: String(count), mode: modeId, includeMeta: '1' });
        if (chapters) qs.set('chapters', chapters);
        else if (chapter) qs.set('chapter', chapter);
        if (difficulty) qs.set('difficulty', difficulty);
        if (generationKey) qs.set('generationKey', generationKey);
        qs.set('experience', launch.get('recoveryFrom') ? 'recovery' : 'practice');
        if (launch.get('recoveryFrom')) qs.set('recoveryFrom', launch.get('recoveryFrom'));
        for (const name of ['sessionId','episodeId','purpose','tonightKey','tonightMinutes','variant']) if (launch.get(name)) qs.set(name, launch.get(name));
        // Same key, saved draft gone: the receipt in the address makes the server return the original start.
        const receipt = new URLSearchParams(window.location.search).get('startReceipt');
        if (receipt) qs.set('startReceipt', receipt);
        const payload = await apiPost('/api/sessions', Object.fromEntries(qs));
        if (!alive) return;

        const { questions: loadedQuestions, meta } = normalizeQuestionPayload(payload);
        setSelectionMeta(meta);
        if (!loadedQuestions.length) {
          setError(meta?.message || 'No verified questions are available for this selection.');
          setLoading(false);
          return;
        }

        // A 'closest' NTA paper may be a little short; the server has already said why.
        if (isNtaMode && loadedQuestions.length !== 50 && meta?.ntaPaper?.status !== 'closest') {
          setError(meta?.message || `The database returned ${loadedQuestions.length} usable NTA questions for this subject; 50 are required.`);
          setLoading(false);
          return;
        }

        // Phone clocks drift from the server's. Time the session on this device from
        // when it arrived, using only the server's duration, so event offsets never run
        // ahead of the server's elapsed time and the countdown is not skewed.
        const receivedAt = Date.now();
        const durationMs = Date.parse(payload.expiresAt) - Date.parse(payload.startedAt);
        const serverNow = Number.isFinite(payload.serverNow) ? payload.serverNow : Date.parse(payload.startedAt);
        const remainingMs = Date.parse(payload.expiresAt) - serverNow;
        const ends = receivedAt + (Number.isFinite(remainingMs) ? Math.max(0, remainingMs) : resolveRunnerDurationSec(mode, loadedQuestions) * 1000);
        startedRef.current = receivedAt - Math.max(0, serverNow - Date.parse(payload.startedAt));
        eventsRef.current = payload.events || [];
        // A session resumed from the server (new device, cleared storage) has its saved events: the
        // answers, the marks for review, and every question the student visited, answered or marked
        // (so the palette does not show them as "Not visited").
        const restored = progressFromEvents(eventsRef.current, loadedQuestions);
        const restoredVisited = {};
        for (const qid of restored.touched) {
          const at = loadedQuestions.findIndex((question) => question.id === qid);
          if (at >= 0) Object.assign(restoredVisited, visitedForBlock(loadedQuestions, at));
        }
        // The first question, reached by a resume when the server already holds events for this session.
        recordEvent(loadedQuestions[0].id, 'visit', eventsRef.current.length ? 'resume' : undefined);
        setQuestions(loadedQuestions);
        setAnswers(restored.answers);
        setVisited({ ...restoredVisited, ...visitedForBlock(loadedQuestions, 0) });
        markedRef.current = restored.marked;
        setMarked(restored.marked);
        rememberStart(meta?.startReceipt);
        setIdx(0);
        setEndsAt(ends);
        setLoading(false);
        if (false) {
          setShowVoteCoach(true);
        }
        refreshSession({ silent: true });
      } catch (e) {
        if (!alive) return;
        if (e?.status === 402 && e?.body?.upgrade) {
          try { await refreshSession({ silent: true }); } catch {}
          setError('Insufficient credits. Upgrade to Premium for unlimited mocks.');
          setLoading(false);
          router.replace('/pricing?reason=insufficient_credits');
          return;
        }
        if (isNtaMode && e?.body?.message) {
          // The NTA engine explains a refusal in the student's terms; show its sentence as it is.
          // A refusal the question bank decides (detail.retryable false, src/lib/server/ntaPaper.js) comes back
          // the same on every retry, so it gets a way forward instead of "Try again"; a build that ran out of
          // time may still succeed on a retry.
          if (e.body.detail?.retryable === false) setRefusal({ message: e.body.message, fullMockKey: newGenerationKey() });
          else setError(e.body.message);
          setLoading(false);
          return;
        }
        setError(e.message === 'PREMIUM_REQUIRED' ? `${mode.label} is part of Pro. Upgrade to start it, or go back and pick another mode.` : e.message === 'INSUFFICIENT_VERIFIED_CONTENT' ? 'Verified questions are not ready for this selection yet. No credits were charged.' : e.message === 'INSUFFICIENT_PRACTICE_CONTENT' ? (isNtaMode ? 'An NTA mode paper needs 50 checked questions laid out like the real CUET paper, and this subject does not have enough yet. Try a full mock instead. No credits were charged.' : 'There are not enough questions for this selection. Try fewer questions or another chapter. No credits were charged.') : e.message === 'RECOVERY_MIGRATION_REQUIRED' ? 'Recovery content is being prepared. Return to Practice to use the existing question library.' : e.message === 'SESSION_EXPIRED' ? 'The time for this test is over, so it cannot be reopened or restarted. Start a new test from the dashboard.' : e.message === 'INVALID_START_RECEIPT' ? 'This test link no longer matches its session. Start a new test from the dashboard.' : e.message || 'Failed to load questions');
        setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [subjectId, chapter, chapters, difficulty, count, mode, modeId, generationKey, key, authStatus, refreshSession, router, isNtaMode, recordEvent, rememberStart, launchKey]);

  // The saved draft is also kept here, so an away can be written at once: a tab being closed may never render again.
  const draftRef = useRef(null);
  useEffect(() => {
    if (loading || !endsAt || typeof window === 'undefined') return;
    const draft = {
      questions,
      answers,
      visited,
      marked,
      selectionMeta,
      generationKey,
      events: eventsRef.current,
      startedAt: startedRef.current,
      endsAt,
      idx,
      pendingSubmission,
    };
    draftRef.current = { key, draft };
    try {
      window.localStorage.setItem(key, JSON.stringify(draft));
    } catch {
      // Private mode or quota pressure should not interrupt the attempt.
    }
  }, [questions, answers, visited, marked, selectionMeta, endsAt, idx, key, loading, generationKey,pendingSubmission]);
  const saveEventsNow = useCallback(() => {
    const saved = draftRef.current;
    if (!saved || typeof window === 'undefined') return;
    try { window.localStorage.setItem(saved.key, JSON.stringify({ ...saved.draft, events: eventsRef.current })); } catch { /* the next save keeps it */ }
  }, []);

  useEffect(() => {
    if (!selectionMeta?.sessionId || selectionMeta.sessionTicket || loading) return;
    let busy=false; let alive=true;
    const sync=async()=>{
      if (busy || submittedRef.current || Date.now() > endsAt || !eventsRef.current.length) return;
      busy=true;
      const sentSeq = eventsRef.current.at(-1)?.seq || 0;
      try {
        await api('/api/sessions',{method:'PUT',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({sessionId:selectionMeta.sessionId,events:eventsRef.current})});
        if(alive){setSyncStatus('saved');setAckSeq((seen) => Math.max(seen, sentSeq));}
      } catch { if(alive)setSyncStatus('pending'); }
      finally { busy=false; }
    };
    const timer=setInterval(sync,1500); window.addEventListener('online',sync);
    return()=>{alive=false;clearInterval(timer);window.removeEventListener('online',sync);};
  },[selectionMeta?.sessionId,selectionMeta?.sessionTicket,loading,endsAt]);

  useEffect(() => { idxRef.current = idx; }, [idx]);
  // via: how the question was reached (next, previous, palette, swipe); none for a question picked inside a passage.
  const gotoQuestion = useCallback((nextIdx, { from = 0, via } = {}) => {
    const safe = Math.max(0, Math.min(questionsRef.current.length - 1, nextIdx));
    if (practiceRun && questionsRef.current.length) {
      const leaving = getQuestionBlock(questionsRef.current, idxRef.current).startIdx;
      const arriving = getQuestionBlock(questionsRef.current, safe).startIdx;
      if (leaving !== arriving) {
        const dir = arriving > leaving ? 1 : -1;
        setNavDir(dir);
        setStrikeNote(false);
        // Rapid Next and Previous presses each count; the newest hand-off replaces the last.
        if (!prefersReducedMotion()) setGhost((prev) => ({ startIdx: leaving, dir, from, n: (prev?.n || 0) + 1 }));
      }
    }
    idxRef.current = safe;
    setIdx(safe);
    if (questionsRef.current[safe]) recordEvent(questionsRef.current[safe].id, 'visit', via);
    const patch = visitedForBlock(questionsRef.current, safe);
    setVisited((prev) => ({ ...prev, ...patch }));
  }, [recordEvent, practiceRun]);

  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setNow(Date.now());
    const h = setInterval(tick, 250);
    const onVis = () => tick();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(h);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [endsAt]);

  // Time away from the paper (spec 6, item 2), in every mode, recorded and nothing else: the page, the timer and the
  // NTA guard (which keeps its own listener and still counts the warning) do exactly what they did before. An away
  // is written to the saved draft at once, so a reload on this device still knows when the student left.
  const presenceRef = useRef(null);
  const recordPresence = useCallback((type) => {
    if (!paperLive()) return;
    if (type === 'back' ? presenceRef.current !== 'away' : presenceRef.current === 'away') return;
    if (!recordEvent(onScreenQid(eventsRef.current, questionsRef.current[idxRef.current]?.id), type)) return;
    presenceRef.current = type;
    if (type === 'away') saveEventsNow();
  }, [paperLive, recordEvent, saveEventsNow]);
  usePresenceCapture(!loading && !!endsAt, recordPresence);

  useEffect(() => {
    if (loading || submittedRef.current) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Your test is in progress. Leaving will save your spot but lose focus.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [loading]);

  const integrityKey = `${key}:integrity:${selectionMeta?.sessionId || generationKey || endsAt}`;
  // reason: 'submit' (the student), 'time_up' (the timer) or 'nta_strikes' (the third NTA warning). A retry passes
  // none (or a click event) and keeps the reason of the end already recorded.
  const submitTest = useCallback(async (reason) => {
    if (submittedRef.current) return;
    if (!user) return;
    submittedRef.current = true;
    setSubmitting(true);
    setMobilePaletteOpen(false);
    // How the paper ended is its last event. A retry adds no second end unless something happened after the first.
    const last = eventsRef.current.at(-1);
    const endedBy = last?.type === 'end' ? last.reason : endReason(eventsRef.current, reason);
    if (last?.type !== 'end') recordEvent(onScreenQid(eventsRef.current, questionsRef.current[idxRef.current]?.id), 'end', endedBy);

    try {
      const data = await apiPost('/api/attempts', {
        sessionId: selectionMeta?.sessionId,
        sessionTicket: selectionMeta?.sessionTicket,
        answers: answersRef.current,
        events: eventsRef.current.filter(e => e.at <= endsAt - startedRef.current),
        ...captureMeta({ startedAt: startedRef.current, endedBy }),
      });
      await finishExamRef.current?.();
      try { window.localStorage.removeItem(key); window.localStorage.removeItem(integrityKey); window.localStorage.removeItem(`${key}:integrity`); } catch {}
      try { window.sessionStorage.setItem('mm:postTest', '1'); } catch {}
      try { await refreshSession({ silent: true }); } catch {}
      router.push(`/result/${data.id}`);
    } catch (e) {
      submittedRef.current = false;
      setSubmitting(false);
      setError(`Submit failed: ${e.message}. Your answers are saved. Press Submit again.`);
      if(e.kind === 'network' || !navigator.onLine){
        setPendingSubmission(true);
        setError(selectionMeta?.sessionTicket
          ? 'Waiting for connection. Answers are held on this device. Reconnect before the two-minute submission window ends.'
          : 'Waiting for connection. After the deadline, the server can score only answers it already received. Reconnect before time runs out.');
      } else {
        setPendingSubmission(false);
        if(e.message === 'SESSION_EXPIRED')setError('The server’s submission window has ended. This session cannot be recorded.');
      }
    }
  }, [user, key, integrityKey, router, refreshSession, selectionMeta, endsAt, recordEvent]);
  const submitForStrikes = useCallback(() => submitTest('nta_strikes'), [submitTest]);

  // NTA mode only: leaving the tab is a strike; the third submits the session.
  const integrity = useExamIntegrity({ enabled: isNtaMode && !loading && !!endsAt, storageKey: integrityKey, fullscreenTarget, onTerminate: submitForStrikes });
  const canAnswer = integrity.canAnswer;
  useEffect(() => { finishExamRef.current = integrity.finish; }, [integrity.finish]);
  const chooseAnswer = useCallback((qid, answer) => {
    if (!canAnswer() || submittedRef.current || submitting || pendingSubmission || (endsAt && Date.now() >= endsAt)) return false;
    recordEvent(qid, 'answer', answer);
    setLastAnswerSeq(eventsRef.current.at(-1)?.seq || 0);
    setAnswers(prev => {
      const next = { ...prev }; if (answer === null) delete next[qid]; else next[qid] = answer;
      answersRef.current = next; return next;
    });
    return true;
  }, [canAnswer, recordEvent, pendingSubmission, endsAt, submitting]);

  // Mark for review is recorded like an answer: an event in the session log, so it is saved on the
  // server and comes back when the session is resumed on another device or after storage is cleared.
  const setMark = useCallback((qid, value) => {
    if (!canAnswer() || submittedRef.current || submitting || pendingSubmission || (endsAt && Date.now() >= endsAt)) return;
    if (!!markedRef.current[qid] === value) return;
    recordEvent(qid, 'mark', value);
    const next = { ...markedRef.current };
    if (value) next[qid] = true; else delete next[qid];
    markedRef.current = next;
    setMarked(next);
  }, [canAnswer, recordEvent, pendingSubmission, endsAt, submitting]);

  const toggleStrike = useCallback((qid, option) => {
    lastStrikeAt.current = Date.now();
    setStrikeNote(false);
    setStruck((prev) => {
      const next = new Set(prev[qid] || []);
      if (next.has(option)) next.delete(option); else next.add(option);
      return { ...prev, [qid]: [...next] };
    });
    // The same toggle on a mirror, so the strike event knows at once whether this crossed out or restored.
    const mirror = new Set(struckRef.current[qid] || []);
    const on = !mirror.has(option);
    if (on) mirror.add(option); else mirror.delete(option);
    struckRef.current = { ...struckRef.current, [qid]: [...mirror] };
    if (paperLive()) recordEvent(qid, 'strike', { option, on });
  }, [paperLive, recordEvent]);

  const timeLeft = endsAt ? Math.max(0, Math.floor((endsAt - now) / 1000)) : 0;
  useEffect(()=>{const reconnect=()=>{if(pendingSubmission && Date.now() <= endsAt+SUBMISSION_GRACE_MS)submitTest();};window.addEventListener('online',reconnect);return()=>window.removeEventListener('online',reconnect);},[pendingSubmission,endsAt,submitTest]);
  useEffect(() => {
    if (!endsAt) return;
    if (timeLeft <= 0 && !submittedRef.current && !loading && !autoSubmitTried.current){autoSubmitTried.current=true;submitTest('time_up');}
  }, [timeLeft, endsAt, loading, submitTest]);

  useEffect(() => {
    if (loading || !questions.length) return;
    const onKeyDown = (event) => {
      if (!canAnswer()) return;
      const tag = event.target?.tagName;
      if (mobilePaletteOpen || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      const block = getQuestionBlock(questionsRef.current, idx);
      if (practiceRun && reviewOpen) return;
      // Shift + 1 to 4 crosses an option out (practice only; shown from memory, recorded as a strike event).
      if (practiceRun && event.shiftKey && /^Digit[1-5]$/.test(event.code)) {
        const active = questionsRef.current[idx];
        const option = Number(event.code.slice(5)) - 1;
        if (active?.id && option < (active.options?.length || 0)) { event.preventDefault(); toggleStrike(active.id, option); }
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        gotoQuestion(block.startIdx - 1, { via: 'previous' });
      } else if (event.key === 'ArrowRight' && block.endIdx < questionsRef.current.length - 1) {
        event.preventDefault();
        gotoQuestion(block.endIdx + 1, { via: 'next' });
      } else if (/^[1-4]$/.test(event.key)) {
        event.preventDefault();
        const active = questionsRef.current[idx];
        if (active?.id) chooseAnswer(active.id, Number(event.key) - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loading, questions.length, idx, gotoQuestion, chooseAnswer, mobilePaletteOpen, canAnswer, practiceRun, reviewOpen, toggleStrike]);

  useEffect(() => {
    if (!mobilePaletteOpen) return undefined;
    const dialog = mobilePaletteDialogRef.current;
    if (!dialog) return undefined;
    const trigger = mobilePaletteTriggerRef.current;

    const onDialogKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobilePaletteOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const controls = [...dialog.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
        .filter((control) => control.getAttribute('aria-hidden') !== 'true');
      if (!controls.length) {
        event.preventDefault();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    mobilePaletteCloseRef.current?.focus();
    document.addEventListener('keydown', onDialogKeyDown);
    return () => {
      document.removeEventListener('keydown', onDialogKeyDown);
      trigger?.focus();
    };
  }, [mobilePaletteOpen]);

  // A new question or passage set starts at its top, below the sticky header.
  const paperRef = useRef(null);
  const shownBlockRef = useRef(null);
  const currentBlockStart = questions.length ? getQuestionBlock(questions, idx).startIdx : null;
  useEffect(() => {
    if (currentBlockStart == null) return;
    if (shownBlockRef.current != null && shownBlockRef.current !== currentBlockStart) {
      const paper = paperRef.current;
      if (paper && paper.getBoundingClientRect().top < 120) paper.scrollIntoView({ block: 'start' });
    }
    shownBlockRef.current = currentBlockStart;
  }, [currentBlockStart]);

  // The selection glides from the old option to the new one. Measured only when an answer or the
  // question changes (and on resize), never per frame.
  const placeGlides = useCallback(() => {
    for (const [qid, glide] of Object.entries(glideRefs.current)) {
      if (!glide?.isConnected) { delete glideRefs.current[qid]; continue; }
      const selected = glide.parentElement?.querySelector('.nta-option.is-selected');
      if (!selected) { glide.style.opacity = '0'; continue; }
      glide.style.height = `${selected.offsetHeight}px`;
      glide.style.transform = `translate3d(0, ${selected.offsetTop}px, 0)`;
      glide.style.opacity = '1';
      if (glide.dataset.placed !== '1') { void glide.offsetHeight; glide.dataset.placed = '1'; }
    }
  }, []);
  useLayoutEffect(() => { if (practiceRun) placeGlides(); }, [practiceRun, placeGlides, answers, idx, questions, loading]);
  useEffect(() => {
    if (!practiceRun) return undefined;
    window.addEventListener('resize', placeGlides);
    return () => window.removeEventListener('resize', placeGlides);
  }, [practiceRun, placeGlides]);

  // Press and hold (or right-click) an option to cross it out.
  const cancelPress = useCallback(() => {
    clearTimeout(pressRef.current?.timer);
    pressRef.current = null;
  }, []);
  const startPress = useCallback((event, qid, option) => {
    if (event.button > 0) return;
    cancelPress();
    pressRef.current = { x: event.clientX, y: event.clientY, timer: setTimeout(() => {
      pressRef.current = null;
      suppressClickRef.current = true;
      toggleStrike(qid, option);
      navigator.vibrate?.(8);
    }, LONG_PRESS_MS) };
  }, [cancelPress, toggleStrike]);
  const movePress = useCallback((event) => {
    const press = pressRef.current;
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) cancelPress();
  }, [cancelPress]);
  const strikeFromMenu = useCallback((event, qid, option) => {
    event.preventDefault();
    if (Date.now() - lastStrikeAt.current < 800) return; // the long press already did it
    cancelPress();
    toggleStrike(qid, option);
  }, [cancelPress, toggleStrike]);

  // The strike note shows once on this device.
  const strikeNoteVisible = practiceRun && strikeNote && !loading && questions.length > 0;
  useEffect(() => {
    if (!strikeNoteVisible) return;
    try { window.localStorage.setItem(STRIKE_NOTE_KEY, '1'); } catch { /* the note may show again; harmless */ }
  }, [strikeNoteVisible]);

  // The outgoing block leaves when its fade ends; this timer covers a page whose animations are paused.
  useEffect(() => {
    if (!ghost) return undefined;
    const timer = setTimeout(() => setGhost((current) => (current?.n === ghost.n ? null : current)), 420);
    return () => clearTimeout(timer);
  }, [ghost]);

  // 'Answer cleared. Undo' stays for four seconds.
  useEffect(() => {
    if (!undoClear) return undefined;
    const timer = setTimeout(() => setUndoClear(null), 4000);
    return () => clearTimeout(timer);
  }, [undoClear]);

  // Submit sheet: Mobi reads it, then reacts once; Escape closes; Tab stays inside.
  useEffect(() => {
    if (!reviewOpen) return undefined;
    const dialog = reviewDialogRef.current;
    const timer = setTimeout(() => setMobiAct('react'), prefersReducedMotion() ? 0 : 900);
    dialog?.querySelector('[data-autofocus]')?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); setReviewOpen(false); return; }
      if (event.key !== 'Tab' || !dialog) return;
      const controls = [...dialog.querySelectorAll('button:not(:disabled)')].filter((control) => control.tabIndex !== -1);
      if (!controls.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      reviewReturnRef.current?.focus?.();
    };
  }, [reviewOpen]);

  if (!subjectId) return (
    <div className="container-narrow max-w-3xl pt-10">
      <ErrorState message="No subject selected" />
      <div className="mt-4">
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          <Icon name="home" /> Back to dashboard
        </Button>
      </div>
    </div>
  );

  if (authStatus === 'loading') return <PageSpinner label="Loading test..." />;
  if (loading) return <div className="container-narrow px-4 pt-10"><ArenaCompanion pose="attentive" title="One question at a time.">Opening your session. Your timer appears when the questions are ready; Mobi stays outside while you answer.</ArenaCompanion>{isNtaMode ? <NtaValidationSpinner subjectId={subjectId} /> : <p role="status">Loading practice…</p>}</div>;

  if (refusal) return (
    <div className="container-narrow max-w-3xl px-4 pt-10">
      <NoticeState
        headingLevel={1}
        title={`No NTA paper for ${displayLabel(subjectId)} yet`}
        message={refusal.message}
        actions={<>
          <Link href={fullMockHref(subjectId, user?.isPremium === true, refusal.fullMockKey)} className="ui-state__action ui-state__action--primary">Start a Full Mock</Link>
          <Link href="/dashboard" className="ui-state__action">Back to dashboard</Link>
        </>}
      />
    </div>
  );

  if (error && !questions.length) return (
    <div className="container-narrow max-w-3xl px-4 pt-10">
      <ErrorState mascot message={error} onRetry={() => window.location.reload()} />
      <div className="mt-4">
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          <Icon name="home" /> Back to dashboard
        </Button>
      </div>
    </div>
  );

  if (!questions.length) return <ErrorState message="No questions available." />;

  const q = questions[idx];
  const block = getQuestionBlock(questions, idx);
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const progress = ((idx + 1) / questions.length) * 100;
  const answered = Object.keys(answers).filter((answerId) => answers[answerId] !== undefined).length;
  const markedCount = Object.values(marked).filter(Boolean).length;
  const notVisitedCount = questions.filter((question) => !visited[question.id]).length;
  const pendingCount = questions.length - answered;
  const lowTime = timeLeft < 60;
  const isLastBlock = block.endIdx >= questions.length - 1;
  const attemptLabel = isNtaMode ? 'NTA Mode' : mode.label;
  const subjectLabel = displayLabel(subjectId);

  const chipStateFor = (qid) => {
    const isAnswered = answers[qid] !== undefined;
    const isMarked = !!marked[qid];
    const isVisited = !!visited[qid];
    if (isMarked && isAnswered) return 'marked-answered';
    if (isMarked) return 'marked';
    if (isAnswered) return 'answered';
    if (isVisited) return 'visited';
    return 'notvisited';
  };

  const toggleMarked = (qid) => setMark(qid, !markedRef.current[qid]);

  const clearAnswer = (qid) => {
    const before = answersRef.current[qid];
    const cleared = chooseAnswer(qid, null);
    if (practiceRun && before !== undefined && cleared) {
      const number = questions.findIndex((question) => question.id === qid) + 1;
      setUndoClear((prev) => ({ qid, answer: before, number, n: (prev?.n || 0) + 1 }));
    }
  };
  const undoClearAnswer = () => {
    if (!undoClear) return;
    chooseAnswer(undoClear.qid, undoClear.answer);
    setUndoClear(null);
  };

  // Ready: every question answered and the server has acknowledged the last answer (a session
  // held on this device has no server save until submission, so its device save is the save).
  const serverSaves = !!selectionMeta?.sessionId && !selectionMeta?.sessionTicket;
  const allReady = practiceRun && questions.length > 0 && pendingCount === 0 && !submitting && !pendingSubmission
    && (!serverSaves || ackSeq >= lastAnswerSeq);
  const firstBlank = questions.findIndex((question) => answers[question.id] === undefined);

  const openReview = () => {
    reviewReturnRef.current = document.activeElement;
    setMobiAct('reading');
    setMobilePaletteOpen(false);
    setReviewOpen(true);
  };

  const confirmAndSubmit = () => {
    if (practiceRun) { openReview(); return; }
    if (pendingCount > 0 || markedCount > 0) {
      const markedText = markedCount ? ` and ${markedCount} marked for review` : '';
      if (!confirm(`You have ${pendingCount} unanswered question${pendingCount === 1 ? '' : 's'}${markedText}. Submit anyway?`)) return;
    }
    submitTest('submit');
  };

  const goNext = () => {
    if (isLastBlock) confirmAndSubmit();
    else gotoQuestion(block.endIdx + 1, { via: 'next' });
  };

  // Swipe between questions on touch: the question follows the finger, commits past 72 px or on a
  // fast flick, rubber-bands at the first question, and on the last one a commit opens the submit sheet.
  const springBack = () => {
    const el = liveRef.current;
    if (!el) return;
    el.classList.add('is-springing');
    el.style.transform = '';
    setTimeout(() => el.classList.remove('is-springing'), 320);
  };
  const onStagePointerDown = (event) => {
    suppressClickRef.current = false;
    if (event.pointerType !== 'touch' || !event.isPrimary || reviewOpen) return;
    swipeRef.current = { id: event.pointerId, x0: event.clientX, y0: event.clientY, axis: null, dx: 0, shown: 0, lastX: event.clientX, lastT: event.timeStamp, v: 0 };
  };
  const onStagePointerMove = (event) => {
    const gesture = swipeRef.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x0;
    const dy = event.clientY - gesture.y0;
    if (!gesture.axis) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      gesture.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      if (gesture.axis === 'x') { cancelPress(); try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture is a convenience */ } }
    }
    if (gesture.axis !== 'x') return;
    const dt = event.timeStamp - gesture.lastT;
    if (dt > 0) gesture.v = (event.clientX - gesture.lastX) / dt;
    gesture.lastX = event.clientX; gesture.lastT = event.timeStamp;
    gesture.dx = dx;
    gesture.shown = dx > 0 && block.startIdx === 0 ? rubberBand(dx) : dx < 0 && isLastBlock ? dx * 0.5 : dx;
    if (liveRef.current) liveRef.current.style.transform = `translate3d(${gesture.shown}px, 0, 0)`;
  };
  const onStagePointerEnd = (event) => {
    const gesture = swipeRef.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    swipeRef.current = null;
    if (gesture.axis !== 'x') return;
    suppressClickRef.current = true;
    const commit = event.type === 'pointerup' && (Math.abs(gesture.dx) > SWIPE_COMMIT_PX || (Math.abs(gesture.v) > SWIPE_FLICK && Math.abs(gesture.dx) > 24));
    if (commit && gesture.dx < 0 && !isLastBlock) gotoQuestion(block.endIdx + 1, { from: gesture.shown, via: 'swipe' });
    else if (commit && gesture.dx > 0 && block.startIdx > 0) gotoQuestion(block.startIdx - 1, { from: gesture.shown, via: 'swipe' });
    else { springBack(); if (commit && gesture.dx < 0 && isLastBlock && !submitting) openReview(); }
  };
  const onStageClickCapture = (event) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };



  const markAndNext = () => {
    setMark(q.id, true);
    if (!isLastBlock) gotoQuestion(block.endIdx + 1, { via: 'next' });
  };

  const renderQuestion = (question, questionIndex) => (
    <section
      key={question.id}
      className={`nta-question-block ${question.id === q.id ? 'is-active' : ''}`}
      aria-labelledby={`question-title-${question.id}`}
    >
      <div className="nta-question-meta">
        <div>
          <span className="nta-question-number">Question {questionIndex + 1}</span>
          <span className={`nta-chip nta-chip--${chipStateFor(question.id)}`}>
            {CHIP_LABELS[chipStateFor(question.id)]}
          </span>
        </div>
        <div className="nta-question-actions">
          <button type="button" className="nta-text-button" onClick={() => toggleMarked(question.id)}>
            <Icon name="flag" /> {marked[question.id] ? 'Unmark' : 'Mark'}
          </button>
          <button type="button" className="nta-text-button" onClick={() => clearAnswer(question.id)}>
            Clear
          </button>
          {!isNtaMode && (
            <VoteControls
              questionId={question.id}
              initialScore={question.score}
              initialUserVote={question.userVote}
              compact
              onVoteApplied={(vote) => {
                setQuestions((prev) => prev.map((item) => (
                  item.id === question.id
                    ? { ...item, score: vote.score, upvotes: vote.upvotes, downvotes: vote.downvotes, userVote: vote.userVote }
                    : item
                )));
              }}
            />
          )}
        </div>
      </div>

      <h2 id={`question-title-${question.id}`} className="nta-question-text">
        {question.question}
      </h2>

      <div className="nta-options" role="group" aria-label={`Options for question ${questionIndex + 1}`}>
        {practiceRun && <span className="pr-glide" aria-hidden="true" ref={(el) => { if (el) glideRefs.current[question.id] = el; }} />}
        {question.options.map((opt, optionIndex) => {
          const selected = answers[question.id] === optionIndex;
          const isStruck = practiceRun && (struck[question.id] || []).includes(optionIndex);
          const pressProps = practiceRun ? {
            onPointerDown: (event) => startPress(event, question.id, optionIndex),
            onPointerMove: movePress,
            onPointerUp: cancelPress,
            onPointerCancel: cancelPress,
            onPointerLeave: cancelPress,
            onContextMenu: (event) => strikeFromMenu(event, question.id, optionIndex),
          } : {};
          return (
            <button
              key={`${question.id}-${optionIndex}`}
              type="button"
              className={`nta-option ${selected ? 'is-selected' : ''} ${isStruck ? 'is-struck' : ''}`}
              {...pressProps}
              onClick={() => {
                chooseAnswer(question.id, optionIndex);
                // Inside a passage set, the answered question becomes current, so Clear response
                // and Mark for review & next act on it.
                if (questionIndex !== idx) gotoQuestion(questionIndex);
              }}
              aria-pressed={selected}
              disabled={pendingSubmission || timeLeft <= 0 || submitting}
            >
              <span className="nta-option-letter">{OPTION_LETTERS[optionIndex] || optionIndex + 1}</span>
              <span className="nta-option-text">{plainOptionTexts(question.options)[optionIndex] ?? optionLabel(opt)}</span>
              {isStruck && <><span className="pr-strike" aria-hidden="true" /><span className="pr-sr">, crossed out</span></>}
            </button>
          );
        })}
      </div>
      {strikeNoteVisible && question.id === q.id && <p className="pr-note">Press and hold an option to cross it out.</p>}
    </section>
  );

  // The block being left, drawn without controls so nothing in it can be focused or pressed.
  const renderGhost = () => {
    if (!ghost || ghost.startIdx === block.startIdx || !questions[ghost.startIdx]) return null;
    const left = getQuestionBlock(questions, ghost.startIdx);
    return (
      <div
        key={`ghost-${ghost.n}`}
        className="pr-ghost"
        aria-hidden="true"
        style={{ '--pr-dir': ghost.dir, '--pr-from': `${ghost.from || 0}px` }}
        onAnimationEnd={(event) => { if (event.target === event.currentTarget) setGhost((current) => (current?.n === ghost.n ? null : current)); }}
      >
        {left.isPassage && (
          <div className="nta-passage">
            <div className="nta-passage-head"><span>Passage</span><strong>{left.passageTitle}</strong></div>
            <p>{left.passageText}</p>
          </div>
        )}
        <div className="nta-question-list">
          {left.entries.map(({ question, index }) => (
            <div key={question.id} className="nta-question-block">
              <div className="nta-question-meta"><div><span className="nta-question-number">Question {index + 1}</span></div></div>
              <p className="nta-question-text">{question.question}</p>
              <div className="nta-options">
                {question.options.map((opt, optionIndex) => (
                  <div key={optionIndex} className={`nta-option ${answers[question.id] === optionIndex ? 'is-ghost-selected' : ''}`}>
                    <span className="nta-option-letter">{OPTION_LETTERS[optionIndex] || optionIndex + 1}</span>
                    <span className="nta-option-text">{plainOptionTexts(question.options)[optionIndex] ?? optionLabel(opt)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const legendCounts = Object.fromEntries(LEGEND.map(([state]) => [state, 0]));
  for (const question of questions) legendCounts[chipStateFor(question.id)] += 1;
  const filterMatches = paletteFilter ? questions.map((question, index) => (chipStateFor(question.id) === paletteFilter ? index : -1)).filter((index) => index >= 0) : [];
  const nextMatch = filterMatches.length ? (filterMatches.find((index) => index > idx) ?? filterMatches[0]) : -1;
  const goToNextMatch = () => { gotoQuestion(nextMatch, { via: 'palette' }); setMobilePaletteOpen(false); };
  const renderLegend = () => (
    <div className="pr-legend" role="group" aria-label="Show questions by state">
      {LEGEND.map(([state, label]) => (
        <button key={state} type="button" aria-pressed={paletteFilter === state} onClick={() => setPaletteFilter((current) => (current === state ? null : state))}>
          <i className={`legend ${state}`} aria-hidden="true" /> {label} <b>{legendCounts[state]}</b>
        </button>
      ))}
      {paletteFilter && (nextMatch >= 0
        ? <button type="button" className="pr-goto" key={`goto-${paletteFilter}`} onClick={goToNextMatch}>Go to question {nextMatch + 1}</button>
        : <p className="pr-note" role="status">No questions in this state.</p>)}
    </div>
  );
  const nextLabel = isLastBlock ? (submitting ? 'Submitting...' : 'Submit test') : classicInterface ? 'Save & next' : 'Next';
  const mobileNextLabel = isLastBlock ? (submitting ? 'Submitting...' : 'Submit') : classicInterface ? 'Save & next' : 'Next';
  const morph = (label) => (practiceRun ? <span className="pr-label" key={label}>{label}</span> : label);

  const renderPalette = (compact = false) => (
    <div className={compact ? 'nta-palette-grid is-compact' : 'nta-palette-grid'}>
      {questions.map((question, questionIndex) => {
        const state = chipStateFor(question.id);
        return (
          <button
            key={question.id}
            type="button"
            className={`nta-palette-chip nta-palette-chip--${state} ${questionIndex === idx ? 'is-current' : ''} ${practiceRun && paletteFilter && paletteFilter !== state ? 'is-dimmed' : ''}`}
            onClick={() => {
              gotoQuestion(questionIndex, { via: 'palette' });
              setMobilePaletteOpen(false);
            }}
            aria-label={`Question ${questionIndex + 1}, ${state.replace('-', ' and ')}`}
          >
            {questionIndex + 1}
          </button>
        );
      })}
    </div>
  );

  return (
    <div ref={fullscreenTarget} className={practiceRun ? 'nta-runner pr-run' : 'nta-runner'} data-interface={classicInterface ? 'nta' : 'mockmob'}>
      <div role="status" className="runner-sync-state">{pendingSubmission ? 'Waiting for server confirmation. Answers are held on this device until the submission window ends.' : !online ? 'You are offline. Answers stay on this device and the timer continues. Reconnect before submitting.' : selectionMeta?.sessionTicket ? 'Answers are saved on this device. Stay online when submitting. Existing practice-bank content is still being audited.' : syncStatus === 'pending' ? 'Waiting for connection. Answers stay on this device; synchronize before the timer ends.' : 'Practice saves to your account while online.'}</div>
      {isNtaMode ? <IntegrityOverlay alert={integrity.alert} onResume={integrity.resume} onRetry={submitTest} submitting={submitting} error={error} supported={integrity.supported} entering={integrity.entering} fullscreenError={integrity.fullscreenError} /> : null}
      {error && integrity.alert?.phase !== 'terminated' && <div role="alert" className="runner-submit-error">{error}<button type="button" onClick={submitTest}>Retry submission</button></div>}
      {showVoteCoach && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="glass volt-soft max-w-lg w-full p-5 md:p-6 relative overflow-hidden">
            <div className="eyebrow mb-3">{'Quality loop'}</div>
            <h2 className="heading text-[24px] mb-3">Help clean the question bank</h2>
            <p className="text-sm text-zinc-300 leading-relaxed mb-4">
              If a question feels out of syllabus, wrongly keyed, or unfairly hard, downvote it. Repeated downvotes push weak questions out of active mocks.
            </p>
            <Button
              variant="volt"
              className="w-full"
              onClick={() => {
                window.localStorage.setItem('mm_vote_coach_seen', '1');
                setShowVoteCoach(false);
              }}
            >
              Got it
            </Button>
          </div>
        </div>
      )}

      {isNtaMode && <div className="nta-interface-toolbar">
        <span>Practice interface</span>
        <div role="group" aria-label="Test interface">
          <button type="button" aria-pressed={!classicInterface} onClick={() => setExamInterface('mockmob')}>MockMob</button>
          <button type="button" aria-pressed={classicInterface} onClick={() => setExamInterface('nta')}>NTA style</button>
        </div>
        <small>Switch anytime. Your answers and timer stay.</small>
      </div>}
      <header className="nta-test-header">
        <div className="nta-header-left">
          {!isNtaMode && <button
            type="button"
            className="nta-icon-button"
            onClick={() => {
              if (confirm('Exit test? Your progress is saved and you can resume from the same URL.')) {
                router.push('/dashboard');
              }
            }}
            aria-label="Exit test"
          >
            <Icon name="x" />
          </button>}
          <div className="nta-title-stack">
            <span>{attemptLabel}</span>
            <strong>{subjectLabel}</strong>
          </div>
        </div>

        <div className="nta-header-progress">
          <div className="nta-progress-row">
            <span>Question {idx + 1} of {questions.length}</span>
            <span>{answered} answered</span>
          </div>
          <ProgressBar value={progress} />
        </div>

        <div className={`nta-timer ${lowTime ? 'is-low' : ''}`} role="timer" aria-label={`Time remaining: ${mins} minutes ${secs} seconds`}>
          <Icon name="clock" />
          <span>{mins}:{secs.toString().padStart(2, '0')}</span>
        </div>
      </header>
      {isNtaMode ? <div className="nta-integrity-status"><IntegrityPill strikes={integrity.strikes} /></div> : null}

      <div className="nta-shell">
        {selectionMeta?.insufficientHighQualityPool && (
          <div className="nta-alert" role="status">
            <Icon name="alert" />
            <span>{selectionMeta.message || `Only ${questions.length} verified questions passed the NTA quality gate for this selection.`}</span>
          </div>
        )}

        {isNtaMode && selectionMeta?.ntaPaper?.status === 'closest' && selectionMeta.ntaPaper.items?.length > 0 && (
          <details className="nta-alert nta-paper-notice" open={noticeOpen} onToggle={(event) => setNoticeOpen(event.currentTarget.open)}>
            <summary>
              <Icon name="alert" />
              <span>How this paper differs from the real CUET paper ({selectionMeta.ntaPaper.items.length})</span>
            </summary>
            <ul>{selectionMeta.ntaPaper.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </details>
        )}

        <div className="nta-grid">
          <div className="nta-paper" ref={paperRef}>
            <div className="nta-paper-head">
              <div>
                <span className="nta-kicker">MockMob CUET Test Console</span>
                <h1>{block.isPassage ? `Questions ${block.startIdx + 1} to ${block.endIdx + 1}` : `Question ${idx + 1}`}</h1>
              </div>
              <div className="nta-paper-tags">
                <span>{q.chapter}</span>
                {q.difficulty && <span>{q.difficulty}</span>}
              </div>
            </div>

            {(() => {
              const content = <>
                {block.isPassage && (
                  <article className="nta-passage" aria-label="Passage">
                    <div className="nta-passage-head">
                      <span>Passage</span>
                      <strong>{block.passageTitle}</strong>
                    </div>
                    <p>{block.passageText}</p>
                  </article>
                )}

                <div className="nta-question-list">
                  {block.entries.map((entry) => renderQuestion(entry.question, entry.index))}
                </div>
              </>;
              if (!practiceRun) return content;
              return (
                <div
                  className="pr-stage"
                  onPointerDown={onStagePointerDown}
                  onPointerMove={onStagePointerMove}
                  onPointerUp={onStagePointerEnd}
                  onPointerCancel={onStagePointerEnd}
                  onClickCapture={onStageClickCapture}
                >
                  {renderGhost()}
                  <div key={`block-${block.startIdx}`} ref={liveRef} className="pr-live" data-entering={ghost ? '' : undefined} style={{ '--pr-dir': navDir }}>
                    {content}
                  </div>
                </div>
              );
            })()}

            <div className="nta-navigation">
              {classicInterface && <>
                <button type="button" className="nta-nav-button nta-classic-review" onClick={markAndNext}>Mark for review & next</button>
                <button type="button" className="nta-nav-button" onClick={() => clearAnswer(q.id)}>Clear response</button>
              </>}
              <button
                type="button"
                className="nta-nav-button"
                disabled={block.startIdx === 0}
                onClick={() => gotoQuestion(block.startIdx - 1, { via: 'previous' })}
              >
                <Icon name="chevL" /> Previous
              </button>
              <button
                type="button"
                className={`nta-nav-button ${isLastBlock ? 'is-primary' : ''} ${allReady && isLastBlock ? 'is-ready' : ''}`}
                onClick={goNext}
                disabled={submitting}
              >
                {morph(nextLabel)}
                {!isLastBlock && <Icon name="chevR" />}
              </button>
            </div>
          </div>

          <aside className="nta-review-panel" aria-label="Question review panel">
            <div className="nta-panel-section">
              <span className="nta-kicker">Review</span>
              <div className="nta-summary-grid">
                <div><strong>{answered}</strong><span>Answered</span></div>
                <div><strong>{markedCount}</strong><span>Marked</span></div>
                <div><strong>{pendingCount}</strong><span>Pending</span></div>
                <div><strong>{notVisitedCount}</strong><span>Not visited</span></div>
              </div>
            </div>
            {renderPalette()}
            {practiceRun ? renderLegend() : <div className="nta-legend">
              <span><i className="legend answered" /> Answered</span>
              <span><i className="legend marked" /> Marked</span>
              <span><i className="legend visited" /> Not answered</span>
              <span><i className="legend notvisited" /> Not visited</span>
              <span><i className="legend marked-answered" /> Answered & marked for review</span>
            </div>}
            <button type="button" className={`nta-submit-button ${allReady ? 'is-ready' : ''}`} onClick={confirmAndSubmit} disabled={submitting}>
              {morph(submitting ? 'Submitting...' : 'Submit test')}
            </button>
          </aside>
        </div>
      </div>

      <div className="nta-mobile-actions">
        <button type="button" disabled={block.startIdx === 0} onClick={() => gotoQuestion(block.startIdx - 1, { via: 'previous' })}>
          <Icon name="chevL" /> {classicInterface ? 'Back' : 'Prev'}
        </button>
        {classicInterface && (
          <button type="button" onClick={() => clearAnswer(q.id)} disabled={answers[q.id] === undefined}>
            Clear response
          </button>
        )}
        <button ref={mobilePaletteTriggerRef} type="button" onClick={() => setMobilePaletteOpen(true)} aria-label={`Question palette, ${answered} of ${questions.length} answered`}>
          {classicInterface ? `Palette ${answered}/${questions.length}` : morph(allReady ? 'All answered' : 'Palette')}
        </button>
        {classicInterface && (
          <button type="button" className="nta-m-review" onClick={markAndNext}>
            Mark for review & next
          </button>
        )}
        <button type="button" className={`${classicInterface ? 'is-primary nta-m-save' : 'is-primary'} ${allReady && isLastBlock ? 'is-ready' : ''}`} onClick={goNext} disabled={submitting}>
          {morph(mobileNextLabel)} {!isLastBlock && !classicInterface && <Icon name="chevR" />}
        </button>
      </div>

      {mobilePaletteOpen && (
        <div ref={mobilePaletteDialogRef} className="nta-mobile-sheet" role="dialog" aria-modal="true" aria-label="Question palette">
          <button className="nta-sheet-backdrop" type="button" tabIndex={-1} aria-label="Close palette" onClick={() => setMobilePaletteOpen(false)} />
          <div className="nta-sheet-panel">
            <div className="nta-sheet-head">
              <div>
                <span className="nta-kicker">Review palette</span>
                <strong>{answered}/{questions.length} answered</strong>
              </div>
              <button ref={mobilePaletteCloseRef} type="button" className="nta-icon-button" onClick={() => setMobilePaletteOpen(false)} aria-label="Close palette">
                <Icon name="x" />
              </button>
            </div>
            <div className="nta-summary-grid">
              <div><strong>{answered}</strong><span>Answered</span></div>
              <div><strong>{markedCount}</strong><span>Marked</span></div>
              <div><strong>{pendingCount}</strong><span>Pending</span></div>
              <div><strong>{notVisitedCount}</strong><span>Not visited</span></div>
            </div>
            {renderPalette(true)}
            {practiceRun && renderLegend()}
            <button type="button" className={`nta-submit-button ${allReady ? 'is-ready' : ''}`} onClick={confirmAndSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit test'}
            </button>
          </div>
        </div>
      )}

      {practiceRun && <span className="pr-sr" role="status">{allReady ? `All ${questions.length} answered${serverSaves ? ' and saved' : ''}. Ready to submit.` : ''}</span>}

      {practiceRun && undoClear && (
        <div className="pr-undo" role="status" key={`undo-${undoClear.n}`}>
          <span>Answer cleared.</span>
          <button type="button" onClick={undoClearAnswer} aria-label={`Undo: restore the answer to question ${undoClear.number}`}>Undo</button>
          <i aria-hidden="true" />
        </div>
      )}

      {practiceRun && reviewOpen && (
        <div ref={reviewDialogRef} className="pr-sheet" role="dialog" aria-modal="true" aria-labelledby="pr-sheet-title">
          <button className="pr-sheet__backdrop" type="button" tabIndex={-1} aria-label="Close" onClick={() => setReviewOpen(false)} />
          <div className="pr-sheet__panel">
            <h2 id="pr-sheet-title">{isMockMode ? 'Submit this mock?' : 'Submit this practice?'}</h2>
            <dl className="pr-sheet__counts">
              <div><dt>Answered</dt><dd>{answered}</dd></div>
              <div><dt>Not answered</dt><dd>{pendingCount}</dd></div>
              <div><dt>Marked</dt><dd>{markedCount}</dd></div>
            </dl>
            <div className={isMockMode ? 'pr-sheet__say is-plain' : 'pr-sheet__say'}>
              {!isMockMode && <SheetMobi act={mobiAct === 'reading' ? 'reading' : pendingCount > 0 ? 'point' : markedCount > 0 ? 'tilt' : 'nod'} />}
              {pendingCount > 0 && firstBlank >= 0
                ? <button type="button" className="pr-sheet__go" onClick={() => { setReviewOpen(false); gotoQuestion(firstBlank, { via: 'palette' }); }}>{pendingCount} not answered. Go to {firstBlank + 1}?</button>
                : <p>{markedCount > 0 ? `${markedCount} marked for review. Every question has an answer.` : `All ${questions.length} answered.`}</p>}
            </div>
            <div className="pr-sheet__actions">
              <button type="button" data-autofocus onClick={() => setReviewOpen(false)}>Keep answering</button>
              <button type="button" className="is-primary" disabled={submitting} onClick={() => { setReviewOpen(false); submitTest('submit'); }}>Submit now</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .nta-runner {
          min-height: 100vh;
          background:
            radial-gradient(circle at 20% 0%, rgba(210,240,0,.055), transparent 30%),
            linear-gradient(180deg, #0a0a0a, #0d0e0b 58%, #090a08);
          color: var(--text-primary);
        }
        .nta-test-header {
          position: sticky;
          top: 0;
          z-index: 35;
          min-height: 74px;
          display: grid;
          grid-template-columns: minmax(230px, .8fr) minmax(260px, 1fr) auto;
          align-items: center;
          gap: 18px;
          padding: 12px clamp(18px, 2vw, 28px);
          border-bottom: 1px solid rgba(255,255,255,.08);
          background: var(--a-topbar, rgba(8,9,7,.92));
          backdrop-filter: blur(18px);
        }
        .nta-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .nta-title-stack {
          display: grid;
          gap: 1px;
          min-width: 0;
        }
        .nta-title-stack span,
        .nta-kicker {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: var(--text-subtle);
        }
        .nta-title-stack strong {
          font-family: var(--font-display);
          font-size: 17px;
          line-height: 1.15;
          color: var(--a-ink, #f4f6ed);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .nta-icon-button {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          border: 1px solid var(--a-line, rgba(255,255,255,.1));
          background: var(--a-hover, rgba(255,255,255,.035));
          color: var(--a-ink-2, #d4d4d8);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .nta-icon-button:hover { border-color: var(--a-line-hover, rgba(255,255,255,.22)); color: var(--a-ink, #fff); }
        .nta-header-progress {
          display: grid;
          gap: 8px;
          min-width: 0;
        }
        .nta-progress-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: var(--text-subtle);
        }
        .nta-timer {
          min-width: 122px;
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 8px;
          border: 1px solid var(--a-line, rgba(255,255,255,.1));
          background: var(--a-hover, rgba(255,255,255,.035));
          color: var(--a-ink, #f4f6ed);
          font-family: var(--font-mono);
          font-weight: 900;
          font-variant-numeric: tabular-nums;
        }
        .nta-timer.is-low {
          border-color: rgba(248,113,113,.45);
          background: rgba(248,113,113,.1);
          color: var(--a-bad-text, #fca5a5);
        }
        .nta-shell {
          width: min(100%, 1340px);
          margin: 0 auto;
          padding: 22px clamp(16px, 2.2vw, 30px) 116px;
        }
        .nta-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0 0 16px;
          padding: 12px 14px;
          border-radius: 8px;
          border: 1px solid rgba(251,191,36,.28);
          background: rgba(251,191,36,.08);
          color: var(--a-warn-text, #fde68a);
          font-size: 13px;
          line-height: 1.5;
        }
        .nta-paper-notice { display: block; }
        .nta-paper-notice summary {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 44px;
          cursor: pointer;
          font-weight: 600;
        }
        .nta-paper-notice summary:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; border-radius: 4px; }
        .nta-paper-notice ul { margin: 6px 0 2px; padding-left: 30px; list-style: disc; }
        .nta-paper-notice li + li { margin-top: 4px; }
        .nta-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 292px;
          gap: 22px;
          align-items: start;
        }
        .nta-paper {
          scroll-margin-top: 92px;
          width: 100%;
          max-width: 930px;
          justify-self: end;
          border: 1px solid var(--a-line, rgba(255,255,255,.1));
          border-radius: 8px;
          background: var(--a-topbar, rgba(15,16,13,.94));
          box-shadow: 0 18px 70px rgba(0,0,0,.28);
          overflow: hidden;
        }
        .nta-paper-head {
          min-height: 76px;
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: center;
          padding: 20px 22px;
          border-bottom: 1px solid rgba(255,255,255,.08);
          background: var(--a-hover, rgba(255,255,255,.025));
        }
        .nta-paper-head h1 {
          margin: 4px 0 0;
          font-family: var(--font-display);
          font-size: 22px;
          line-height: 1.15;
          color: var(--a-ink, #f8faf0);
        }
        .nta-paper-tags {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }
        .nta-paper-tags span {
          border: 1px solid var(--a-line, rgba(255,255,255,.1));
          border-radius: 6px;
          color: var(--a-ink-2, #d4d4d8);
          padding: 6px 8px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .nta-passage {
          margin: 22px;
          padding: 18px;
          border: 1px solid rgba(210,240,0,.18);
          border-radius: 8px;
          background: rgba(210,240,0,.035);
        }
        .nta-passage-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: var(--a-accent-text, var(--volt));
        }
        .nta-passage-head strong {
          color: var(--a-ink, #f4f6ed);
          letter-spacing: .08em;
        }
        .nta-passage p {
          margin: 0;
          color: var(--a-ink-2, #d4d4d8);
          font-size: 15px;
          line-height: 1.8;
          max-width: 72ch;
        }
        .nta-question-list {
          display: grid;
        }
        .nta-question-block {
          padding: 22px;
          border-top: 1px solid rgba(255,255,255,.08);
        }
        .nta-passage + .nta-question-list .nta-question-block:first-child {
          border-top: 0;
        }
        .nta-question-block.is-active {
          background: linear-gradient(90deg, rgba(210,240,0,.035), transparent 36%);
        }
        .nta-question-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }
        .nta-question-meta > div:first-child,
        .nta-question-actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }
        .nta-question-number {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: var(--a-accent-text, var(--volt));
        }
        .nta-chip {
          border-radius: 6px;
          border: 1px solid var(--a-line, rgba(255,255,255,.1));
          padding: 4px 7px;
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .09em;
          text-transform: uppercase;
          color: var(--a-ink-3, #a1a1aa);
        }
        .nta-chip--answered { color: var(--a-good-text, #86efac); border-color: rgba(74,222,128,.38); background: rgba(74,222,128,.08); }
        .nta-chip--marked,
        .nta-chip--marked-answered { color: var(--a-purple-text, #c4b5fd); border-color: rgba(168,85,247,.42); background: rgba(168,85,247,.1); }
        .nta-chip--visited { color: var(--a-bad-text, #fca5a5); border-color: rgba(248,113,113,.34); background: rgba(248,113,113,.08); }
        .nta-text-button {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid var(--a-line, rgba(255,255,255,.1));
          border-radius: 8px;
          background: var(--a-hover, rgba(255,255,255,.025));
          color: var(--a-ink-2, #d4d4d8);
          padding: 0 10px;
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }
        .nta-text-button:hover { border-color: var(--a-line-hover, rgba(255,255,255,.24)); color: var(--a-ink, #fff); }
        .nta-question-text {
          margin: 0 0 18px;
          max-width: 74ch;
          color: var(--a-ink, #f8faf0);
          font-family: var(--font-display);
          font-size: 21px;
          font-weight: 750;
          line-height: 1.55;
          letter-spacing: 0;
        }
        .nta-options {
          display: grid;
          gap: 10px;
        }
        .nta-option {
          width: 100%;
          min-height: 54px;
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr);
          align-items: start;
          gap: 12px;
          border: 1px solid var(--a-line, rgba(255,255,255,.11));
          border-radius: 8px;
          background: var(--a-hover, rgba(255,255,255,.018));
          color: var(--a-ink-2, #e4e4e7);
          padding: 12px;
          text-align: left;
          cursor: pointer;
        }
        .nta-option:hover {
          border-color: var(--a-line-hover, rgba(255,255,255,.26));
          background: var(--a-hover, rgba(255,255,255,.035));
        }
        .nta-option.is-selected {
          border-color: rgba(210,240,0,.72);
          background: rgba(210,240,0,.08);
        }
        .nta-option-letter {
          width: 32px;
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 7px;
          background: var(--a-hover, rgba(255,255,255,.06));
          color: var(--a-ink-3, #a1a1aa);
          font-family: var(--font-display);
          font-weight: 900;
        }
        .nta-option.is-selected .nta-option-letter {
          background: var(--volt);
          color: #050600;
        }
        .nta-option-text {
          min-width: 0;
          font-size: 14px;
          line-height: 1.55;
        }
        .nta-navigation {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 18px 22px 22px;
          border-top: 1px solid rgba(255,255,255,.08);
        }
        .nta-nav-button,
        .nta-submit-button,
        .nta-mobile-actions button {
          min-height: 44px;
          border: 1px solid var(--a-line, rgba(255,255,255,.12));
          border-radius: 8px;
          background: var(--a-hover, rgba(255,255,255,.03));
          color: var(--a-ink, #f4f6ed);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 16px;
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 900;
          letter-spacing: .04em;
          text-transform: uppercase;
          cursor: pointer;
        }
        .nta-nav-button:disabled,
        .nta-mobile-actions button:disabled,
        .nta-submit-button:disabled {
          opacity: .35;
          cursor: not-allowed;
        }
        .nta-nav-button.is-primary,
        .nta-submit-button,
        .nta-mobile-actions button.is-primary {
          border-color: var(--a-accent-text, var(--volt));
          background: var(--volt);
          color: #050600;
        }
        .nta-review-panel {
          position: sticky;
          top: 96px;
          display: grid;
          gap: 14px;
          border: 1px solid var(--a-line, rgba(255,255,255,.1));
          border-radius: 8px;
          background: var(--a-topbar, rgba(15,16,13,.94));
          padding: 14px;
          box-shadow: 0 18px 70px rgba(0,0,0,.22);
        }
        .nta-panel-section {
          display: grid;
          gap: 10px;
        }
        .nta-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .nta-summary-grid div {
          min-height: 58px;
          display: grid;
          align-content: center;
          gap: 4px;
          border: 1px solid var(--a-line, rgba(255,255,255,.08));
          border-radius: 8px;
          background: var(--a-hover, rgba(255,255,255,.025));
          padding: 9px;
        }
        .nta-summary-grid strong {
          color: var(--a-ink, #f8faf0);
          font-family: var(--font-display);
          font-size: 22px;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .nta-summary-grid span {
          color: var(--text-subtle);
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .11em;
          text-transform: uppercase;
        }
        .nta-palette-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
        }
        .nta-palette-grid.is-compact {
          grid-template-columns: repeat(6, minmax(0, 1fr));
        }
        .nta-palette-chip {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          min-height: 44px;
          border-radius: 7px;
          border: 1px solid var(--a-line, rgba(255,255,255,.1));
          background: var(--a-hover, rgba(255,255,255,.04));
          color: var(--a-ink-3, #a1a1aa);
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }
        .nta-palette-chip.is-current {
          outline: 2px solid var(--volt);
          outline-offset: 2px;
        }
        .nta-palette-chip--answered {
          background: rgba(74,222,128,.16);
          border-color: rgba(74,222,128,.5);
          color: var(--a-good-text, #86efac);
        }
        .nta-palette-chip--visited {
          background: rgba(248,113,113,.1);
          border-color: rgba(248,113,113,.42);
          color: var(--a-bad-text, #fca5a5);
        }
        .nta-palette-chip--marked,
        .nta-palette-chip--marked-answered {
          background: rgba(168,85,247,.14);
          border-color: rgba(168,85,247,.5);
          color: var(--a-purple-text, #c4b5fd);
        }
        .nta-palette-chip--marked-answered::after {
          content: '';
          position: absolute;
          right: 5px;
          bottom: 5px;
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #86efac;
          box-shadow: 0 0 0 1px rgba(0,0,0,.65);
        }
        .nta-legend {
          display: grid;
          gap: 6px;
          color: var(--text-subtle);
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .05em;
        }
        .nta-legend span {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .legend {
          width: 10px;
          height: 10px;
          border-radius: 3px;
          border: 1px solid var(--a-line, rgba(255,255,255,.14));
          display: inline-block;
        }
        .legend.answered { background: rgba(74,222,128,.16); border-color: rgba(74,222,128,.5); }
        .legend.marked { background: rgba(168,85,247,.14); border-color: rgba(168,85,247,.5); }
        .legend.visited { background: rgba(248,113,113,.1); border-color: rgba(248,113,113,.42); }
        .legend.notvisited { background: var(--a-hover, rgba(255,255,255,.04)); }
        .nta-mobile-actions,
        .nta-mobile-sheet {
          display: none;
        }
        @media (max-width: 1180px) {
          .nta-grid {
            grid-template-columns: minmax(0, 1fr) 270px;
          }
          .nta-paper {
            max-width: none;
          }
        }
        @media (max-width: 1023px) {
          .nta-test-header {
            grid-template-columns: 1fr auto;
            gap: 12px;
            min-height: auto;
            padding: 10px 12px;
          }
          .nta-header-progress {
            grid-column: 1 / -1;
            order: 3;
          }
          .nta-title-stack strong {
            max-width: 48vw;
          }
          .nta-timer {
            min-width: 108px;
          }
          .nta-shell {
            padding: 14px 12px 96px;
          }
          .nta-grid {
            display: block;
          }
          .nta-review-panel {
            display: none;
          }
          .nta-paper-head {
            align-items: flex-start;
            flex-direction: column;
            padding: 16px;
          }
          .nta-paper-head h1 {
            font-size: 20px;
          }
          .nta-paper-tags {
            justify-content: flex-start;
          }
          .nta-passage {
            margin: 16px;
            padding: 14px;
          }
          .nta-passage p {
            font-size: 14px;
            line-height: 1.75;
          }
          .nta-question-block {
            padding: 16px;
          }
          .nta-question-meta {
            align-items: flex-start;
            flex-direction: column;
          }
          .nta-question-text {
            font-size: 18px;
            line-height: 1.55;
          }
          .nta-option {
            min-height: 48px;
          }
          .nta-navigation {
            display: none;
          }
          .nta-mobile-actions {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 42;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 8px;
            padding: 10px 10px calc(10px + env(safe-area-inset-bottom, 0px));
            border-top: 1px solid rgba(255,255,255,.1);
            background: var(--a-topbar, rgba(8,9,7,.94));
            backdrop-filter: blur(16px);
          }
          .nta-mobile-actions button {
            min-width: 0;
            padding: 0 10px;
            font-size: 12px;
          }
          .nta-mobile-sheet {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 80;
          }
          .nta-sheet-backdrop {
            position: absolute;
            inset: 0;
            border: 0;
            background: rgba(0,0,0,.62);
          }
          .nta-sheet-panel {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            max-height: min(78vh, 620px);
            max-height: min(78dvh, 620px);
            overflow: auto;
            border-radius: 14px 14px 0 0;
            border: 1px solid var(--a-line, rgba(255,255,255,.12));
            background: var(--a-raised, #0f100d);
            padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px));
            display: grid;
            gap: 14px;
          }
          .nta-sheet-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }
          .nta-sheet-head strong {
            display: block;
            margin-top: 3px;
            font-family: var(--font-display);
            font-size: 18px;
            color: var(--a-ink, #fff);
          }
        }
        @media (max-width: 520px) {
          .nta-palette-grid.is-compact {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }
          .nta-question-actions {
            width: 100%;
          }
          .nta-text-button {
            flex: 1;
            justify-content: center;
            min-height: 44px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .nta-option,
          .nta-icon-button,
          .nta-nav-button,
          .nta-submit-button {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function TestPageClient() {
  return (
    <Suspense fallback={<PageSpinner label="Loading test..." />}>
      <TestRunner />
    </Suspense>
  );
}
