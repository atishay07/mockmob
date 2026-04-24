"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icons';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { SkeletonCard, ErrorState, EmptyState } from '@/components/ui/Skeleton';
import { apiGet } from '@/lib/fetcher';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';

export default function DashboardPageClient() {
  const { user, status: authStatus, refreshSession } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [subjects, setSubjects] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ bankSize: 0 });

  const [selSubj, setSelSubj] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selChapter, setSelChapter] = useState(null);
  const [count, setCount] = useState(10);
  const [isLaunching, setIsLaunching] = useState(false);
  const [creditError, setCreditError] = useState(null);
  const [launchSuccess, setLaunchSuccess] = useState(null);

  useEffect(() => {
    if (authStatus === 'loading' || !user?.id) return;

    let alive = true;
    async function load() {
      try {
        const [subs, atts, board, statData] = await Promise.all([
          apiGet('/api/subjects'),
          apiGet(`/api/attempts?userId=${user.id}`),
          apiGet('/api/leaderboard'),
          apiGet('/api/stats'),
        ]);
        if (!alive) return;
        setSubjects(subs);
        setAttempts(atts);
        setLeaderboard(board);
        setStats(statData);
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
              Generate Mock <span className="text-volt font-semibold">- 1 Credit</span>
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
                      disabled={isLaunching || (user?.creditBalance || 0) < 1}
                      onClick={async () => {
                        setCreditError(null);
                        setLaunchSuccess(null);
                        setIsLaunching(true);
                        try {
                          const res = await fetch('/api/credits/spend', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ amount: 1, reference: `generate_mock_${selSubj}_${count}` }),
                          });

                          if (!res.ok) {
                            const data = await res.json();
                            const message = data.error || 'Insufficient credits to generate mock.';
                            setCreditError(message);
                            toast.error(message);
                            setIsLaunching(false);
                            return;
                          }

                          await refreshSession({ silent: true });
                          setLaunchSuccess('Credits verified. Launching your mock...');
                          toast.success('Mock unlocked. Entering the arena...');
                          router.push(launchHref);
                        } catch {
                          const message = 'Failed to verify credits. Please try again.';
                          setCreditError(message);
                          toast.error(message);
                          setIsLaunching(false);
                        }
                      }}
                    >
                      <Icon name="play" /> {isLaunching ? 'Verifying...' : 'Generate Mock - 1 Credit'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
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
