"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icons';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { SkeletonCard, ErrorState, EmptyState } from '@/components/ui/Skeleton';
import { apiGet } from '@/lib/fetcher';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';

const TEST_START_CREDIT_COST = 10;

export default function DashboardPageClient() {
  const { user, status: authStatus } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [subjects, setSubjects] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ bankSize: 0 });
  const [submissions, setSubmissions] = useState([]);
  const [subRefreshing, setSubRefreshing] = useState(false);

  const [selSubj, setSelSubj] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selChapter, setSelChapter] = useState(null);
  const [count, setCount] = useState(10);
  const [isLaunching, setIsLaunching] = useState(false);
  const launchingKeyRef = useRef(null);
  const [creditError, setCreditError] = useState(null);
  const [launchSuccess, setLaunchSuccess] = useState(null);

  useEffect(() => {
    if (authStatus === 'loading' || !user?.id) return;

    let alive = true;
    async function load() {
      try {
        const [subs, atts, board, statData, myQs] = await Promise.all([
          apiGet('/api/subjects'),
          apiGet(`/api/attempts?userId=${user.id}`),
          apiGet('/api/leaderboard'),
          apiGet('/api/stats'),
          apiGet('/api/questions/mine').catch(() => []),
        ]);
        if (!alive) return;
        setSubjects(subs);
        setAttempts(atts);
        setLeaderboard(board);
        setStats(statData);
        setSubmissions(Array.isArray(myQs) ? myQs : []);
        const mySubs = subs.filter((subject) => user.subjects?.includes(subject.id));
        if (mySubs.length > 0) setSelSubj(mySubs[0].id);
        setStatus('ready');
      } catch (e) {
        if (!alive) return;
        setError(e.message);
        setStatus('error');
      }
    }

    load();
    return () => { alive = false; };
  }, [user, authStatus]);

  async function refreshSubmissions() {
    setSubRefreshing(true);
    try {
      const myQs = await apiGet('/api/questions/mine');
      setSubmissions(Array.isArray(myQs) ? myQs : []);
    } catch {
      // non-fatal
    } finally {
      setSubRefreshing(false);
    }
  }

  useEffect(() => {
    if (!selSubj) return;
    let alive = true;
    apiGet(`/api/chapters?subject=${selSubj}`)
      .then((data) => { if (alive) setChapters(data); })
      .catch(() => { if (alive) setChapters([]); });
    return () => { alive = false; };
  }, [selSubj]);

  const mySubs = useMemo(
    () => subjects.filter((subject) => user?.subjects?.includes(subject.id)),
    [subjects, user],
  );
  const myRankIdx = leaderboard.findIndex((entry) => entry.userId === user?.id);
  const avg = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length) : 0;
  const rank = myRankIdx >= 0 ? myRankIdx + 1 : null;

  if (status === 'loading') {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <div className="eyebrow mb-2">{'// Command centre'}</div>
          <div className="h-10 w-72 max-w-full skeleton mb-2" />
          <div className="h-4 w-64 max-w-full skeleton" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass p-4">
              <div className="h-4 w-24 skeleton mb-4" />
              <div className="h-8 w-20 skeleton" />
            </div>
          ))}
        </div>
        <SkeletonCard lines={5} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  const launchHref = `/test?subject=${selSubj}&count=${count}${selChapter ? `&chapter=${encodeURIComponent(selChapter)}` : ''}`;

  return (
    <div className="flex flex-col gap-6 view">
      <div>
        <div className="eyebrow mb-2">{'// Command centre'}</div>
        <h1 className="display-md">What are we <span className="text-volt italic">grinding</span> today, {user?.name?.split(' ')[0]}?</h1>
        <p className="text-sm text-zinc-500 mt-2">Your arena is live. Pick a subject, drop a mock, and own the board.</p>
        {creditError && (
          <div className="mt-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            <Icon name="spark" className="inline-block mr-2" style={{ width: '14px', height: '14px' }} />
            {creditError}
          </div>
        )}
        {launchSuccess && (
          <div className="mt-4 p-3 rounded-lg border border-volt/25 bg-volt/10 text-volt text-sm">
            <Icon name="check" className="inline-block mr-2" style={{ width: '14px', height: '14px' }} />
            {launchSuccess}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Bank size · questions" value={stats.bankSize} icon="book" />
        <StatCard label="Tests crushed · attempts" value={attempts.length} icon="target" />
        <StatCard label="Avg score · all-time" value={`${avg}%`} icon="trend" highlight={avg >= 70} />
        <StatCard label="Your rank · on board" value={rank ? `#${rank}` : '—'} icon="trophy" highlight />
      </div>

      <div className="glass p-4 md:p-6">
        <div className="glass volt-soft p-4 mb-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="mono-label mb-2">Credits</div>
              <div className="display-md text-volt">{user?.creditBalance || 0}</div>
            </div>
            <div className="text-sm text-zinc-400">
              Generate Mock <span className="text-volt font-semibold">- {TEST_START_CREDIT_COST} Credits</span>
            </div>
          </div>
        </div>

        <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
          <div>
            <div className="eyebrow mb-2">{'// Drop a mock'}</div>
            <h2 className="heading text-[22px] text-white">Start a test</h2>
          </div>
          <div className="mono-label flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-volt animate-pulse-slow" />
            CUET +5/-1 scoring
          </div>
        </div>

        {mySubs.length === 0 ? (
          <EmptyState
            eyebrow="// No subjects"
            title="Pick your subjects first"
            message="Tell us what you're targeting and we’ll tune your arena around those chapters."
            actionLabel="Go to Onboarding"
            onAction={() => router.push('/onboarding')}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
              {mySubs.map((subject) => (
                <button
                  key={subject.id}
                  className={`subject-card ${selSubj === subject.id ? 'selected' : ''} p-3.5`}
                  onClick={() => {
                    setSelSubj(subject.id);
                    setSelChapter(null);
                  }}
                >
                  <div className="glyph text-[22px] mb-1.5">{subject.glyph}</div>
                  <div className="mono-label mb-1">{subject.short}</div>
                  <div className="font-display font-bold text-[13px] text-white mb-0.5">{subject.name}</div>
                  <div className="text-xs text-zinc-500">Qs available</div>
                </button>
              ))}
            </div>

            {selSubj && (
              <div className="flex flex-col gap-4 pt-4 border-t border-white/5">
                {chapters.length > 0 && (
                  <div className="flex items-start gap-3 flex-wrap">
                    <span className="mono-label pt-2 shrink-0">Chapter</span>
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        className={`count-btn ${selChapter === null ? 'active' : ''}`}
                        style={{ width: 'auto', padding: '0 14px' }}
                        onClick={() => setSelChapter(null)}
                      >
                        Any
                      </button>
                      {chapters.map((chapter) => (
                        <button
                          key={chapter.id}
                          className={`count-btn ${selChapter === chapter.name ? 'active' : ''}`}
                          style={{ width: 'auto', padding: '0 14px' }}
                          onClick={() => setSelChapter(chapter.name)}
                        >
                          {chapter.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <span className="mono-label">Questions</span>
                  <div className="flex gap-1.5">
                    {[5, 10, 15, 20].map((n) => (
                      <button
                        key={n}
                        className={`count-btn ${count === n ? 'active' : ''}`}
                        onClick={() => setCount(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="sm:ml-auto flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-zinc-500 font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {count * 60}s · {count * 5} pts max
                    </span>
                    <Button
                      variant="volt"
                      size="md"
                      disabled={isLaunching || (user?.creditBalance || 0) < TEST_START_CREDIT_COST}
                      onClick={async () => {
                        setCreditError(null);
                        setLaunchSuccess(null);
                        if (isLaunching) return;
                        setIsLaunching(true);
                        launchingKeyRef.current = launchingKeyRef.current || crypto.randomUUID();
                        try {
                          setLaunchSuccess('Launching your mock...');
                          toast.success('Entering the arena...');
                          router.push(`${launchHref}&generationKey=${encodeURIComponent(launchingKeyRef.current)}`);
                        } catch {
                          const message = 'Failed to verify credits. Please try again.';
                          setCreditError(message);
                          toast.error(message);
                          setIsLaunching(false);
                          launchingKeyRef.current = null;
                        }
                      }}
                    >
                      <Icon name="play" /> {isLaunching ? 'Verifying...' : `Generate Mock - ${TEST_START_CREDIT_COST} Credits`}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── My Submissions ── */}
      <div className="glass p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="eyebrow">{'// My submissions'}</div>
          <button
            onClick={refreshSubmissions}
            disabled={subRefreshing}
            className="btn-outline sm"
            style={{ borderRadius: '999px', fontSize: '10px', padding: '3px 12px' }}
          >
            {subRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {submissions.length === 0 ? (
          <EmptyState
            eyebrow="// Nothing yet"
            title="No questions uploaded"
            message="Upload a question and track its moderation status here."
          />
        ) : (
          <div>
            {submissions.slice(0, 10).map((q) => {
              const STATUS = {
                live:     { label: 'Approved', color: '#4ade80', bg: 'rgba(74,222,128,.08)',    border: 'rgba(74,222,128,.2)'    },
                pending:  { label: 'Pending',  color: '#fbbf24', bg: 'rgba(251,191,36,.08)',   border: 'rgba(251,191,36,.2)'   },
                rejected: { label: 'Rejected', color: '#f87171', bg: 'rgba(248,113,113,.08)', border: 'rgba(248,113,113,.2)' },
              };
              const s = STATUS[q.status] ?? STATUS.pending;
              return (
                <div key={q.id} className="flex items-start justify-between gap-3 py-2.5 border-b border-white/5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="font-display font-medium text-[13px] text-white truncate">{q.question}</div>
                    <div className="mono-label mt-0.5">
                      {q.subject}{q.chapter ? ` · ${q.chapter}` : ''} · {new Date(q.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span style={{
                    flexShrink: 0, padding: '2px 8px', borderRadius: '4px',
                    fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: s.color, background: s.bg, border: `1px solid ${s.border}`,
                  }}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="glass p-6 relative overflow-hidden">
          <div className="absolute top-[-20px] right-[-20px] w-[150px] h-[150px] bg-volt opacity-5 blur-[60px] rounded-full" />
          <div className="relative">
            <Icon name="upload" style={{ color: 'var(--volt)', width: '24px', height: '24px', marginBottom: '12px', strokeWidth: '1.5' }} />
            <h3 className="heading mb-2 text-[18px]">Feed the bank</h3>
            <p className="text-sm text-zinc-400 mb-4 max-w-sm">Upload a question. Pass moderation, earn credits, and unlock more premium mocks.</p>
            <Link href="/upload" className="btn-ghost font-bold text-volt">
              Upload now <Icon name="arrow" style={{ width: '12px', height: '12px' }} />
            </Link>
          </div>
        </div>

        <div className="glass p-6">
          <div className="eyebrow mb-3">{'// Recent attempts'}</div>
          {attempts.length === 0 ? (
            <EmptyState
              eyebrow="// No attempts"
              title="No tests yet"
              message="Your recent mocks will show up here once you generate your first sprint."
            />
          ) : (
            <div>
              {attempts.slice(0, 5).map((attempt) => {
                const subject = subjects.find((entry) => entry.id === attempt.subject);
                const cls = attempt.score >= 70 ? 'text-volt' : attempt.score >= 40 ? 'verdict-mid' : 'verdict-bad';
                return (
                  <Link
                    key={attempt.id}
                    href={`/result/${attempt.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 border-b border-white/5 last:border-0 hover:bg-white/[0.02] px-2 -mx-2 rounded transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[20px] font-display text-volt">{subject?.glyph}</span>
                      <div className="min-w-0">
                        <div className="font-display font-bold text-[13px] text-white truncate">{subject?.name || attempt.subject}</div>
                        <div className="mono-label">{new Date(attempt.completedAt).toLocaleDateString()} · {attempt.correct}/{attempt.total} correct</div>
                      </div>
                    </div>
                    <div className={`font-display font-bold text-[18px] ${cls}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{attempt.score}%</div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
