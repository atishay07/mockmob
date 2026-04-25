"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icons';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { PageSpinner, ErrorState } from '@/components/ui/Skeleton';
import { apiGet, apiPost } from '@/lib/fetcher';
import { useAuth } from '@/components/AuthProvider';
import { VoteControls } from '@/components/questions/VoteControls';

/**
 * Test Runner
 * -----------
 * Design notes:
 *  - Timer is derived from a persisted `endsAt` timestamp. We never
 *    count down with a counter variable — every tick compares `Date.now()`
 *    against `endsAt`, so there is zero drift even if the tab throttles
 *    or the user switches tabs.
 *  - Answers + `endsAt` + question IDs are autosaved to localStorage under
 *    an attempt key. Refresh or accidental navigation doesn't lose progress.
 *  - `answersRef` mirrors state so the auto-submit path (timer expiry, tab
 *    close) always reads the latest answers without needing effect re-wiring.
 *  - The palette lives in a right rail on desktop, a bottom bar on mobile.
 */

// A stable localStorage key per (user, subject, chapter, count) — distinct tests
// get distinct keys so two subjects' progress don't collide.
const storageKey = (uid, subject, chapter, count) =>
  `mm:test:${uid || 'anon'}:${subject}:${chapter || '*'}:${count}`;

function optionLabel(option) {
  return typeof option === 'string' ? option : option?.text ?? String(option ?? '');
}

function correctOptionIndex(question) {
  if (Number.isInteger(question.correctIndex)) return question.correctIndex;
  if (!Array.isArray(question.options)) return -1;
  return question.options.findIndex((option, index) => (
    option?.key === question.correctAnswer ||
    option?.key === question.correct_answer ||
    String(index) === String(question.correctAnswer ?? question.correct_answer)
  ));
}

function TestRunner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, status: authStatus, refreshSession } = useAuth();

  const subjectId = searchParams.get('subject');
  const chapter   = searchParams.get('chapter') || null;
  const count     = parseInt(searchParams.get('count') || '10', 10);
  const generationKey = searchParams.get('generationKey');

  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [endsAt, setEndsAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const userId = user?.id;
  const key = useMemo(
    () => storageKey(userId, subjectId, chapter, count),
    [userId, subjectId, chapter, count],
  );

  // Keep latest answers/questions in refs so timer-triggered submit sees them.
  const answersRef   = useRef(answers);
  const questionsRef = useRef(questions);
  const submittedRef = useRef(false);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);

  // ------------------------------------------------------------------
  // Load: restore from localStorage if it matches, else fetch fresh.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (authStatus === 'loading') return;
    if (!subjectId) return;

    let alive = true;
    async function load() {
      setLoading(true); setError(null);
      if (!generationKey || generationKey.length < 12) {
        if (!alive) return;
        setError('Missing generation key. Start a fresh test from the dashboard.');
        setLoading(false);
        return;
      }

      // Attempt restore from localStorage
      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem(key);
          if (raw) {
            const saved = JSON.parse(raw);
            if (
              saved?.questions?.length &&
              typeof saved.endsAt === 'number' &&
              saved.endsAt > Date.now()
            ) {
              if (!alive) return;
              setQuestions(saved.questions);
              setAnswers(saved.answers || {});
              setEndsAt(saved.endsAt);
              setIdx(typeof saved.idx === 'number' ? Math.min(saved.idx, saved.questions.length - 1) : 0);
              setLoading(false);
              return;
            }
            // Stale / expired: drop it
            window.localStorage.removeItem(key);
          }
        } catch { /* ignore corrupted state */ }
      }

      try {
        const qs = new URLSearchParams({ subject: subjectId, count: String(count) });
        if (chapter) qs.set('chapter', chapter);
        qs.set('generationKey', generationKey);
        const data = await apiGet(`/api/questions?${qs.toString()}`);
        if (!alive) return;
        if (!Array.isArray(data) || data.length === 0) {
          setError('No questions available for this selection.');
          setLoading(false);
          return;
        }
        const ends = Date.now() + count * 60 * 1000;
        setQuestions(data);
        setAnswers({});
        setIdx(0);
        setEndsAt(ends);
        setLoading(false);
        refreshSession({ silent: true });
      } catch (e) {
        if (!alive) return;
        setError(e.message || 'Failed to load questions');
        setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [subjectId, chapter, count, generationKey, key, authStatus, refreshSession]);

  // ------------------------------------------------------------------
  // Persist progress on every answer/idx change.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (loading || !endsAt || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify({
        questions, answers, endsAt, idx,
      }));
    } catch { /* quota full / private mode — non-fatal */ }
  }, [questions, answers, endsAt, idx, key, loading]);

  // ------------------------------------------------------------------
  // Timer: tick 4x/sec, derive seconds from endsAt.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setNow(Date.now());
    const h = setInterval(tick, 250);
    const onVis = () => tick(); // re-sync immediately when tab regains focus
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(h); document.removeEventListener('visibilitychange', onVis); };
  }, [endsAt]);

  // ------------------------------------------------------------------
  // Warn on refresh/close while test is live.
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // Submit — shared by button, last-question, and timer expiry.
  // ------------------------------------------------------------------
  const submitTest = useCallback(async () => {
    if (submittedRef.current) return;
    if (!user) return;
    submittedRef.current = true;
    setSubmitting(true);

    const qs = questionsRef.current;
    const ans = answersRef.current;

    let correct = 0, wrong = 0, unattempted = 0;
    const details = qs.map((q) => {
      const given = ans[q.id];
      if (given === undefined) { unattempted++; return { qid: q.id, givenIndex: null, isCorrect: null }; }
      const isCorrect = given === correctOptionIndex(q);
      if (isCorrect) correct++; else wrong++;
      return { qid: q.id, givenIndex: given, isCorrect };
    });

    const max = qs.length * 5;
    const raw = (correct * 5) - (wrong * 1);
    const score = Math.max(0, Math.round((raw / max) * 100));

    const payload = {
      subject: subjectId,
      score, correct, wrong, unattempted, total: qs.length,
      details,
      questionsSnapshot: qs,
    };

    try {
      const data = await apiPost('/api/attempts', payload);
      try { window.localStorage.removeItem(key); } catch {}
      router.push(`/result/${data.id}`);
    } catch (e) {
      submittedRef.current = false;
      setSubmitting(false);
      setError(`Submit failed: ${e.message}. Your answers are saved — press Submit again.`);
    }
  }, [user, subjectId, key, router]);

  // Auto-submit when time reaches zero.
  const timeLeft = endsAt ? Math.max(0, Math.floor((endsAt - now) / 1000)) : 0;
  useEffect(() => {
    if (!endsAt) return;
    if (timeLeft <= 0 && !submittedRef.current && !loading) {
      submitTest();
    }
  }, [timeLeft, endsAt, loading, submitTest]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
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
  if (authStatus === 'loading' || loading) return <PageSpinner label="Loading arena…" />;
  if (error) return (
    <div className="container-narrow max-w-3xl pt-10">
      <ErrorState message={error} onRetry={() => router.refresh()} />
      <div className="mt-4">
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          <Icon name="home" /> Back to dashboard
        </Button>
      </div>
    </div>
  );
  if (!questions.length) return <ErrorState message="No questions available." />;

  const q = questions[idx];
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const progress = ((idx + 1) / questions.length) * 100;
  const answered = Object.keys(answers).filter(k => answers[k] !== undefined).length;
  const lowTime = timeLeft < 60;

  return (
    <div className="container-std pb-28 relative">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => {
            if (confirm('Exit test? Your progress is saved — you can resume from the same URL.')) {
              router.push('/dashboard');
            }
          }}>
            <Icon name="x" /> Exit
          </Button>
          <div className="w-px h-4 bg-white/20" />
          <div className="mono-label" style={{ color: '#fff' }}>Q {idx + 1} / {questions.length}</div>
          <div className="w-px h-4 bg-white/20 mobile-hide" />
          <div className="mono-label mobile-hide">{answered} answered</div>
        </div>
        <div
          className="pill"
          style={{
            background: lowTime ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.05)',
            color: lowTime ? '#f87171' : '#fff',
            fontVariantNumeric: 'tabular-nums',
          }}
          aria-live="polite"
        >
          <Icon name="clock" style={{ marginRight: '6px' }} />
          {mins}:{secs.toString().padStart(2, '0')}
        </div>
      </div>

      <ProgressBar value={progress} className="mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6">
        {/* ------------------------- Question card ------------------------- */}
        <div>
          <div className="glass p-6 md:p-8 mb-6 view" key={q.id}>
            <div className="flex gap-2 mb-4">
              <span className="pill volt">{q.chapter}</span>
              {q.difficulty && <span className="pill subtle">{q.difficulty}</span>}
              <span className="ml-auto">
                <VoteControls
                  questionId={q.id}
                  initialScore={q.score}
                  initialUserVote={q.userVote}
                  compact
                  onVoteApplied={(vote) => {
                    setQuestions((prev) => prev.map((item) => (
                      item.id === q.id
                        ? { ...item, score: vote.score, upvotes: vote.upvotes, downvotes: vote.downvotes, userVote: vote.userVote }
                        : item
                    )));
                  }}
                />
              </span>
            </div>
            <h2 className="heading text-xl md:text-2xl leading-relaxed mb-8">{q.question}</h2>
            <div className="flex flex-col gap-3">
              {q.options.map((opt, i) => (
                <button
                  key={i}
                  className={`q-option ${answers[q.id] === i ? 'selected' : ''}`}
                  onClick={() => setAnswers(prev => ({ ...prev, [q.id]: i }))}
                >
                  <span className="letter">{['A','B','C','D','E'][i] || (i + 1)}</span>
                  <span>{optionLabel(opt)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Button variant="outline" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
              <Icon name="chevL" /> Previous
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => {
                setAnswers(prev => { const n = { ...prev }; delete n[q.id]; return n; });
              }}>Clear</Button>
              {idx === questions.length - 1 ? (
                <Button variant="volt" onClick={submitTest} disabled={submitting}>
                  {submitting ? 'Submitting…' : <>Submit Test <Icon name="check" /></>}
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setIdx(idx + 1)}>
                  Next <Icon name="chevR" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ------------------------- Palette (desktop rail) ------------------------- */}
        <aside className="glass p-4 h-max sticky top-24 mobile-hide">
          <div className="eyebrow no-dot mb-3">{'// Palette'}</div>
          <div className="q-palette mb-4">
            {questions.map((qq, i) => (
              <button
                key={qq.id}
                className={`q-chip ${answers[qq.id] !== undefined ? 'done' : ''} ${i === idx ? 'current' : ''}`}
                onClick={() => setIdx(i)}
                aria-label={`Go to question ${i + 1}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1 text-xs text-zinc-500 font-mono">
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-sm bg-volt inline-block" /> Answered</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-sm bg-white/10 inline-block" /> Not visited</div>
          </div>
          {!submitting && (
            <Button
              variant="volt"
              className="mt-4 w-full"
              onClick={() => {
                if (answered < questions.length) {
                  if (!confirm(`You have ${questions.length - answered} unanswered. Submit anyway?`)) return;
                }
                submitTest();
              }}
            >
              Submit test
            </Button>
          )}
        </aside>
      </div>

      {/* Palette (mobile bottom bar) */}
      <div className="fixed bottom-0 left-0 right-0 px-3 py-3 bg-ink/85 backdrop-blur-md border-t border-white/8 md:hidden flex gap-2 overflow-x-auto no-scrollbar">
        {questions.map((qq, i) => (
          <button
            key={qq.id}
            className={`q-chip shrink-0 ${answers[qq.id] !== undefined ? 'done' : ''} ${i === idx ? 'current' : ''}`}
            onClick={() => setIdx(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TestPageClient() {
  return (
    <Suspense fallback={<PageSpinner label="Loading arena…" />}>
      <TestRunner />
    </Suspense>
  );
}
