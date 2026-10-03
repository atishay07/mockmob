"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense, useMemo, useSyncExternalStore } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icons';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { PageSpinner, ErrorState } from '@/components/ui/Skeleton';
import ArenaCompanion from '@/components/brand/ArenaCompanion';
import { api, apiPost } from '@/lib/fetcher';
import { useAuth } from '@/components/AuthProvider';
import { VoteControls } from '@/components/questions/VoteControls';
import { getMode, isValidModeId, resolveCount, resolveDurationSec } from '@/../data/test_modes';
import { resumableDraft, SUBMISSION_GRACE_MS } from '@/../data/session_draft';
import './nta-classic.css';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];
const subscribeConnection = callback => {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => { window.removeEventListener('online', callback); window.removeEventListener('offline', callback); };
};
const connectionSnapshot = () => navigator.onLine;

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
  const [selectionMeta, setSelectionMeta] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [syncStatus, setSyncStatus] = useState('saved');
  const [pendingSubmission,setPendingSubmission] = useState(false);
  const online = useSyncExternalStore(subscribeConnection, connectionSnapshot, () => true);
  const autoSubmitTried = useRef(false);
  const [showVoteCoach, setShowVoteCoach] = useState(false);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const mobilePaletteTriggerRef = useRef(null);
  const mobilePaletteCloseRef = useRef(null);
  const mobilePaletteDialogRef = useRef(null);

  const userId = user?.id;
  const key = useMemo(
    () => storageKey(userId, subjectId, chapters || chapter, count, difficulty || 'auto', modeId),
    [userId, subjectId, chapter, chapters, count, difficulty, modeId],
  );

  const answersRef = useRef(answers);
  const eventsRef = useRef([]);
  const startedRef = useRef(0);
  const recordEvent = useCallback((qid, type, answer) => {
    if (!startedRef.current || eventsRef.current.length >= 5000) return;
    const prior = eventsRef.current.at(-1);
    eventsRef.current.push({ seq: (prior?.seq || 0) + 1, qid, type,
      at: Math.max(prior?.at || 0, Date.now() - startedRef.current),
      ...(type === 'answer' ? { answer } : {}) });
  }, []);
  const chooseAnswer = useCallback((qid, answer) => {
    if(submitting || pendingSubmission || (endsAt && Date.now()>=endsAt))return;
    recordEvent(qid, 'answer', answer);
    setAnswers(prev => {
      const next = { ...prev }; if (answer === null) delete next[qid]; else next[qid] = answer;
      answersRef.current = next; return next;
    });
  }, [recordEvent,pendingSubmission,endsAt,submitting]);
  const questionsRef = useRef(questions);
  const submittedRef = useRef(false);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (!subjectId) return;

    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      setSelectionMeta(null);
      setPendingSubmission(false);
      autoSubmitTried.current = false;
      submittedRef.current = false;
      if ((!generationKey || generationKey.length < 12) && !searchParams.get('sessionId')) {
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
            if (resumableDraft(saved,{generationKey,sessionId:searchParams.get('sessionId')})) {
              if (!alive) return;
              setQuestions(saved.questions);
              eventsRef.current = saved.events || [];
              startedRef.current = saved.startedAt;
              setAnswers(saved.answers || {});
              setVisited(saved.visited || {});
              setMarked(saved.marked || {});
              setSelectionMeta(saved.selectionMeta || null);
              setEndsAt(saved.endsAt);
              setIdx(typeof saved.idx === 'number' ? Math.min(saved.idx, saved.questions.length - 1) : 0);
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
        qs.set('experience', searchParams.get('recoveryFrom') ? 'recovery' : 'practice');
        if (searchParams.get('recoveryFrom')) qs.set('recoveryFrom', searchParams.get('recoveryFrom'));
        for (const name of ['sessionId','episodeId','purpose','tonightKey','tonightMinutes']) if (searchParams.get(name)) qs.set(name, searchParams.get(name));
        const payload = await apiPost('/api/sessions', Object.fromEntries(qs));
        if (!alive) return;

        const { questions: loadedQuestions, meta } = normalizeQuestionPayload(payload);
        setSelectionMeta(meta);
        if (!loadedQuestions.length) {
          setError(meta?.message || 'No verified questions are available for this selection.');
          setLoading(false);
          return;
        }

        if (isNtaMode && loadedQuestions.length !== 50) {
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
        recordEvent(loadedQuestions[0].id, 'visit');
        setQuestions(loadedQuestions);
        const restoredAnswers = {};
        for (const event of eventsRef.current) if (event.type === 'answer') restoredAnswers[event.qid] = event.answer;
        setAnswers(restoredAnswers);
        setVisited(visitedForBlock(loadedQuestions, 0));
        setMarked({});
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
        setError(e.message === 'INSUFFICIENT_VERIFIED_CONTENT' ? 'Verified questions are not ready for this selection yet. No credits were charged.' : e.message === 'INSUFFICIENT_PRACTICE_CONTENT' ? 'There are not enough questions for this selection. Try fewer questions or another chapter. No credits were charged.' : e.message === 'RECOVERY_MIGRATION_REQUIRED' ? 'Recovery content is being prepared. Return to Practice to use the existing question library.' : e.message || 'Failed to load questions');
        setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [subjectId, chapter, chapters, difficulty, count, mode, modeId, generationKey, key, authStatus, refreshSession, router, isNtaMode, recordEvent, searchParams]);

  useEffect(() => {
    if (loading || !endsAt || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify({
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
      }));
    } catch {
      // Private mode or quota pressure should not interrupt the attempt.
    }
  }, [questions, answers, visited, marked, selectionMeta, endsAt, idx, key, loading, generationKey,pendingSubmission]);

  useEffect(() => {
    if (!selectionMeta?.sessionId || selectionMeta.sessionTicket || loading) return;
    let busy=false; let alive=true;
    const sync=async()=>{
      if (busy || submittedRef.current || Date.now() > endsAt || !eventsRef.current.length) return;
      busy=true;
      try {
        await api('/api/sessions',{method:'PUT',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({sessionId:selectionMeta.sessionId,events:eventsRef.current})});
        if(alive)setSyncStatus('saved');
      } catch { if(alive)setSyncStatus('pending'); }
      finally { busy=false; }
    };
    const timer=setInterval(sync,1500); window.addEventListener('online',sync);
    return()=>{alive=false;clearInterval(timer);window.removeEventListener('online',sync);};
  },[selectionMeta?.sessionId,selectionMeta?.sessionTicket,loading,endsAt]);

  const gotoQuestion = useCallback((nextIdx) => {
    const safe = Math.max(0, Math.min(questionsRef.current.length - 1, nextIdx));
    setIdx(safe);
    if (questionsRef.current[safe]) recordEvent(questionsRef.current[safe].id, 'visit');
    const patch = visitedForBlock(questionsRef.current, safe);
    setVisited((prev) => ({ ...prev, ...patch }));
  }, [recordEvent]);

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

  const submitTest = useCallback(async () => {
    if (submittedRef.current) return;
    if (!user) return;
    submittedRef.current = true;
    setSubmitting(true);
    setMobilePaletteOpen(false);

    try {
      const data = await apiPost('/api/attempts', {
        sessionId: selectionMeta?.sessionId,
        sessionTicket: selectionMeta?.sessionTicket,
        answers: answersRef.current,
        events: eventsRef.current.filter(e => e.at <= endsAt - startedRef.current),
      });
      try { window.localStorage.removeItem(key); } catch {}
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
  }, [user, key, router, refreshSession, selectionMeta, endsAt]);

  const timeLeft = endsAt ? Math.max(0, Math.floor((endsAt - now) / 1000)) : 0;
  useEffect(()=>{const reconnect=()=>{if(pendingSubmission && Date.now() <= endsAt+SUBMISSION_GRACE_MS)submitTest();};window.addEventListener('online',reconnect);return()=>window.removeEventListener('online',reconnect);},[pendingSubmission,endsAt,submitTest]);
  useEffect(() => {
    if (!endsAt) return;
    if (timeLeft <= 0 && !submittedRef.current && !loading && !autoSubmitTried.current){autoSubmitTried.current=true;submitTest();}
  }, [timeLeft, endsAt, loading, submitTest]);

  useEffect(() => {
    if (loading || !questions.length) return;
    const onKeyDown = (event) => {
      const tag = event.target?.tagName;
      if (mobilePaletteOpen || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      const block = getQuestionBlock(questionsRef.current, idx);
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        gotoQuestion(block.startIdx - 1);
      } else if (event.key === 'ArrowRight' && block.endIdx < questionsRef.current.length - 1) {
        event.preventDefault();
        gotoQuestion(block.endIdx + 1);
      } else if (/^[1-4]$/.test(event.key)) {
        event.preventDefault();
        const active = questionsRef.current[idx];
        if (active?.id) chooseAnswer(active.id, Number(event.key) - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loading, questions.length, idx, gotoQuestion, chooseAnswer, mobilePaletteOpen]);

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
  if (loading) return <div className="container-narrow px-4 pt-10"><ArenaCompanion pose="attentive" title="One question at a time.">Opening your session. Your timer appears when the questions are ready; Pip stays outside while you answer.</ArenaCompanion>{isNtaMode ? <NtaValidationSpinner subjectId={subjectId} /> : <p role="status">Loading practice…</p>}</div>;

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

  const toggleMarked = (qid) => {
    setMarked((prev) => {
      const next = { ...prev };
      if (next[qid]) delete next[qid];
      else next[qid] = true;
      return next;
    });
  };

  const clearAnswer = (qid) => chooseAnswer(qid, null);

  const confirmAndSubmit = () => {
    if (pendingCount > 0 || markedCount > 0) {
      const markedText = markedCount ? ` and ${markedCount} marked for review` : '';
      if (!confirm(`You have ${pendingCount} unanswered question${pendingCount === 1 ? '' : 's'}${markedText}. Submit anyway?`)) return;
    }
    submitTest();
  };

  const goNext = () => {
    if (isLastBlock) confirmAndSubmit();
    else gotoQuestion(block.endIdx + 1);
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
            {chipStateFor(question.id).replace('-', ' + ')}
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
        {question.options.map((opt, optionIndex) => {
          const selected = answers[question.id] === optionIndex;
          return (
            <button
              key={`${question.id}-${optionIndex}`}
              type="button"
              className={`nta-option ${selected ? 'is-selected' : ''}`}
              onClick={() => chooseAnswer(question.id, optionIndex)}
              aria-pressed={selected}
              disabled={pendingSubmission || timeLeft <= 0 || submitting}
            >
              <span className="nta-option-letter">{OPTION_LETTERS[optionIndex] || optionIndex + 1}</span>
              <span className="nta-option-text">{optionLabel(opt)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );

  const renderPalette = (compact = false) => (
    <div className={compact ? 'nta-palette-grid is-compact' : 'nta-palette-grid'}>
      {questions.map((question, questionIndex) => {
        const state = chipStateFor(question.id);
        return (
          <button
            key={question.id}
            type="button"
            className={`nta-palette-chip nta-palette-chip--${state} ${questionIndex === idx ? 'is-current' : ''}`}
            onClick={() => {
              gotoQuestion(questionIndex);
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
    <div className="nta-runner" data-interface={classicInterface ? 'nta' : 'mockmob'}>
      <div role="status" className="runner-sync-state">{pendingSubmission ? 'Waiting for server confirmation. Answers are held on this device until the submission window ends.' : !online ? 'You are offline. Answers stay on this device and the timer continues. Reconnect before submitting.' : selectionMeta?.sessionTicket ? 'Answers are saved on this device. Stay online when submitting. Existing practice-bank content is still being audited.' : syncStatus === 'pending' ? 'Waiting for connection. Answers stay on this device; synchronize before the timer ends.' : 'Practice saves to your account while online.'}</div>
      {error && <div role="alert" className="runner-submit-error">{error}<button type="button" onClick={submitTest}>Retry submission</button></div>}
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
          <button
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
          </button>
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

      <main className="nta-shell">
        {selectionMeta?.insufficientHighQualityPool && (
          <div className="nta-alert" role="status">
            <Icon name="alert" />
            <span>{selectionMeta.message || `Only ${questions.length} verified questions passed the NTA quality gate for this selection.`}</span>
          </div>
        )}

        <div className="nta-grid">
          <div className="nta-paper">
            <div className="nta-paper-head">
              <div>
                <span className="nta-kicker">MockMob CUET Test Console</span>
                <h1>{block.isPassage ? 'Passage Set' : `Question ${idx + 1}`}</h1>
              </div>
              <div className="nta-paper-tags">
                <span>{q.chapter}</span>
                {q.difficulty && <span>{q.difficulty}</span>}
              </div>
            </div>

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

            <div className="nta-navigation">
              {classicInterface && <>
                <button type="button" className="nta-nav-button nta-classic-review" onClick={() => {
                  setMarked((prev) => ({ ...prev, [q.id]: true }));
                  if (!isLastBlock) gotoQuestion(block.endIdx + 1);
                }}>Mark for Review & Next</button>
                <button type="button" className="nta-nav-button" onClick={() => clearAnswer(q.id)}>Clear response</button>
              </>}
              <button
                type="button"
                className="nta-nav-button"
                disabled={block.startIdx === 0}
                onClick={() => gotoQuestion(block.startIdx - 1)}
              >
                <Icon name="chevL" /> Previous
              </button>
              <button
                type="button"
                className={`nta-nav-button ${isLastBlock ? 'is-primary' : ''}`}
                onClick={goNext}
                disabled={submitting}
              >
                {isLastBlock ? (submitting ? 'Submitting...' : 'Submit Test') : classicInterface ? 'Save & Next' : 'Next'}
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
            <div className="nta-legend">
              <span><i className="legend answered" /> Answered</span>
              <span><i className="legend marked" /> Marked</span>
              <span><i className="legend visited" /> Not answered</span>
              <span><i className="legend notvisited" /> Not visited</span>
              <span><i className="legend marked-answered" /> Answered & marked for review</span>
            </div>
            <button type="button" className="nta-submit-button" onClick={confirmAndSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit test'}
            </button>
          </aside>
        </div>
      </main>

      <div className="nta-mobile-actions">
        <button type="button" disabled={block.startIdx === 0} onClick={() => gotoQuestion(block.startIdx - 1)}>
          <Icon name="chevL" /> Prev
        </button>
        <button ref={mobilePaletteTriggerRef} type="button" onClick={() => setMobilePaletteOpen(true)}>
          Palette
        </button>
        <button type="button" className="is-primary" onClick={goNext} disabled={submitting}>
          {isLastBlock ? 'Submit' : 'Next'} {!isLastBlock && <Icon name="chevR" />}
        </button>
      </div>

      {mobilePaletteOpen && (
        <div ref={mobilePaletteDialogRef} className="nta-mobile-sheet" role="dialog" aria-modal="true" aria-label="Question palette">
          <button className="nta-sheet-backdrop" type="button" tabIndex={-1} aria-label="Close palette" onClick={() => setMobilePaletteOpen(false)} />
          <div className="nta-sheet-panel">
            <div className="nta-sheet-head">
              <div>
                <span className="nta-kicker">Review Palette</span>
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
            <button type="button" className="nta-submit-button" onClick={confirmAndSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit test'}
            </button>
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
        .nta-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 292px;
          gap: 22px;
          align-items: start;
        }
        .nta-paper {
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
