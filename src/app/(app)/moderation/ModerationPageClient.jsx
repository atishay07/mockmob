"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/fetcher';
import { useRole } from '@/lib/roleContext';
import { EmptyState, ErrorState, PageSpinner } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ToastProvider';

const DIFF_STYLE = {
  easy: { color: '#4ade80', bg: 'rgba(74,222,128,.1)' },
  medium: { color: '#fbbf24', bg: 'rgba(251,191,36,.1)' },
  hard: { color: '#f87171', bg: 'rgba(248,113,113,.1)' },
};

function DiffTag({ difficulty }) {
  const style = DIFF_STYLE[difficulty] ?? DIFF_STYLE.medium;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '4px', fontSize: '9px',
      fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', background: style.bg, color: style.color,
    }}>
      {difficulty}
    </span>
  );
}

function QueueSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="glass p-5">
          <div className="skeleton h-4 w-40 mb-4" />
          <div className="skeleton h-5 w-full mb-2" />
          <div className="skeleton h-5 w-3/4 mb-4" />
          <div className="grid gap-2">
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="skeleton h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ModCard({ question, onAction, toast }) {
  const [decision, setDecision] = useState(null);
  const [loading, setLoading] = useState(false);
  const options = Array.isArray(question.options) ? question.options : [];

  async function handleAction(action) {
    if (loading || decision) return;
    setLoading(true);
    try {
      await apiPost('/api/questions/moderate', { id: question.id, action });
      setDecision(action);
      window.setTimeout(() => onAction(question.id, action), 500);
    } catch (e) {
      toast.error(`Failed to ${action} question: ${e.message}`);
      setLoading(false);
      return;
    }
    setLoading(false);
  }

  const borderColor = decision === 'approve'
    ? 'rgba(74,222,128,.4)'
    : decision === 'reject'
      ? 'rgba(248,113,113,.3)'
      : 'rgba(255,255,255,.08)';

  return (
    <div className="glass" style={{ borderColor, opacity: decision ? 0.55 : 1, transition: 'all .25s ease' }}>
      <div className="p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {question.subject && (
            <span className="pill subtle">{question.subject}</span>
          )}
          {question.chapter && <span className="text-xs text-zinc-500">{question.chapter}</span>}
          <DiffTag difficulty={question.difficulty} />
          {question.ai_tier && <span className="pill volt">Tier {question.ai_tier}</span>}
          {question.ai_score != null && (
            <span className="ml-auto text-xs text-zinc-500 font-mono">AI: {typeof question.ai_score === 'number' ? question.ai_score.toFixed(2) : question.ai_score}</span>
          )}
        </div>

        <p className="text-sm md:text-[15px] font-medium text-zinc-100 leading-7 mb-4">
          {question.body ?? question.question ?? '—'}
        </p>

        {options.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {options.map((option, index) => {
              const isCorrect = option.key === question.correct_answer || String(option.key) === String(question.correct_answer);
              return (
                <div
                  key={index}
                  className="rounded-lg border px-3 py-2.5 flex items-start gap-3"
                  style={{
                    background: isCorrect ? 'rgba(74,222,128,.06)' : 'rgba(255,255,255,.02)',
                    borderColor: isCorrect ? 'rgba(74,222,128,.25)' : 'rgba(255,255,255,.06)',
                  }}
                >
                  <span
                    className="shrink-0 inline-flex items-center justify-center rounded-md font-display font-bold text-[10px]"
                    style={{
                      width: '24px',
                      height: '24px',
                      background: isCorrect ? '#4ade80' : 'rgba(255,255,255,.06)',
                      color: isCorrect ? '#000' : '#71717a',
                    }}
                  >
                    {option.key ?? 'ABCDE'[index]}
                  </span>
                  <span className={`text-sm ${isCorrect ? 'text-green-300' : 'text-zinc-400'}`}>{option.text}</span>
                </div>
              );
            })}
          </div>
        )}

        {question.explanation && (
          <div className="rounded-lg border border-white/6 bg-white/3 px-3 py-3 text-sm text-zinc-400 leading-6 mb-4">
            <span className="text-volt font-semibold">Hint:</span> {question.explanation}
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-xs text-zinc-500 font-mono">
          {question.author_id && <span>BY: {String(question.author_id).slice(0, 12)}…</span>}
          {question.createdAt && <span>{new Date(question.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
          {question.verification_state && <span>STATE: {question.verification_state}</span>}
        </div>
      </div>

      <div className="border-t border-white/6 p-4 flex flex-wrap items-center justify-end gap-2 bg-white/[0.01]">
        {decision ? (
          <span className={`text-xs font-mono tracking-[0.15em] uppercase ${decision === 'approve' ? 'text-green-300' : 'text-red-300'}`}>
            {decision === 'approve' ? 'Approved' : 'Rejected'}
          </span>
        ) : (
          <>
            <button
              disabled={loading}
              onClick={() => handleAction('reject')}
              className="btn-outline sm"
              style={{ borderColor: 'rgba(248,113,113,.3)', color: '#f87171' }}
            >
              {loading ? 'Saving…' : 'Reject'}
            </button>
            <button
              disabled={loading}
              onClick={() => handleAction('approve')}
              className="btn-volt sm"
              style={{ background: '#4ade80', boxShadow: 'none' }}
            >
              {loading ? 'Saving…' : 'Approve'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ModerationPageClient() {
  const { isModerator } = useRole();
  const toast = useToast();
  const router = useRouter();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approved, setApproved] = useState(0);
  const [rejected, setRejected] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet('/api/questions/pending');
      setQueue(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message ?? 'Failed to load moderation queue');
      toast.error(e.message ?? 'Failed to load moderation queue');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let alive = true;

    async function bootstrap() {
      try {
        const data = await apiGet('/api/questions/pending');
        if (!alive) return;
        setQueue(Array.isArray(data) ? data : []);
        setError(null);
      } catch (e) {
        if (!alive) return;
        setError(e.message ?? 'Failed to load moderation queue');
        toast.error(e.message ?? 'Failed to load moderation queue');
      } finally {
        if (alive) setLoading(false);
      }
    }

    bootstrap();
    return () => { alive = false; };
  }, [toast]);

  useEffect(() => {
    if (!isModerator) {
      router.replace('/dashboard');
    }
  }, [isModerator, router]);

  if (!isModerator) {
    return <PageSpinner label="Redirecting to dashboard…" />;
  }

  function handleAction(id, action) {
    setQueue((current) => current.filter((question) => question.id !== id));
    if (action === 'approve') setApproved((value) => value + 1);
    if (action === 'reject') setRejected((value) => value + 1);
    toast.success(action === 'approve' ? 'Question approved.' : 'Question rejected.');
  }

  return (
    <div className="w-full max-w-3xl mx-auto view">
      <div className="mb-6">
        <div className="eyebrow mb-2">{'// Moderator mode'}</div>
        <h1 className="display-md">Moderation <span className="text-volt italic">Queue</span></h1>
        <p className="text-sm text-zinc-500 mt-2">Review community submissions, publish the good ones, and keep the bank trustworthy.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {[
          { label: 'In Queue', value: queue.length, color: '#fbbf24' },
          { label: 'Approved', value: approved, color: '#4ade80' },
          { label: 'Rejected', value: rejected, color: '#f87171' },
        ].map((stat) => (
          <div key={stat.label} className="glass p-4 text-center">
            <div
              className="font-display font-black text-[28px]"
              style={{ color: stat.color, letterSpacing: '-0.03em', lineHeight: 1 }}
            >
              {stat.value}
            </div>
            <div className="mono-label mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="flex justify-end mb-4">
        <button onClick={load} disabled={loading} className="btn-outline sm" style={{ borderRadius: '999px' }}>
          {loading ? 'Refreshing…' : 'Refresh Queue'}
        </button>
      </div>

      {loading && <QueueSkeleton />}

      {!loading && error && (
        <ErrorState message={error} onRetry={load} />
      )}

      {!loading && !error && queue.length === 0 && (
        <EmptyState
          eyebrow="// Queue clear"
          title="Nothing waiting for review"
          message={`No questions are pending right now.${approved + rejected > 0 ? ` You reviewed ${approved + rejected} this session.` : ''}`}
          actionLabel="Refresh Queue"
          onAction={load}
        />
      )}

      {!loading && !error && queue.length > 0 && (
        <div className="flex flex-col gap-4">
          {queue.map((question) => (
            <ModCard key={question.id} question={question} onAction={handleAction} toast={toast} />
          ))}
        </div>
      )}
    </div>
  );
}
