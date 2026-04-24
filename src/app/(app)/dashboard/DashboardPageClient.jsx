"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icons';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { SkeletonCard, ErrorState } from '@/components/ui/Skeleton';
import { apiGet } from '@/lib/fetcher';
import { useAuth } from '@/components/AuthProvider';

export default function DashboardPageClient() {
  const { user, status: authStatus, refreshSession } = useAuth();
  const router = useRouter();

  const [subjects, setSubjects] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ bankSize: 0 });

  const [selSubj, setSelSubj] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selChapter, setSelChapter] = useState(null); // null = "Any"
  const [count, setCount] = useState(10);
  const [isLaunching, setIsLaunching] = useState(false);
  const [creditError, setCreditError] = useState(null);
  const [launchSuccess, setLaunchSuccess] = useState(null);

  // ---------- bootstrap data ----------
  useEffect(() => {
    if (authStatus === 'loading') return;
    if (!user?.id) return;

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
        const mySubs = subs.filter(s => user.subjects?.includes(s.id));
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

  // ---------- fetch chapters when subject changes ----------
  useEffect(() => {
    if (!selSubj) return;
    let alive = true;
    apiGet(`/api/chapters?subject=${selSubj}`)
      .then(cs => { if (alive) setChapters(cs); })
      .catch(() => { if (alive) setChapters([]); });
    return () => { alive = false; };
  }, [selSubj]);

  const mySubs = useMemo(
    () => subjects.filter(s => user?.subjects?.includes(s.id)),
    [subjects, user],
  );
  const myRankIdx = leaderboard.findIndex(x => x.userId === user?.id);
  const avg = attempts.length ? Math.round(attempts.reduce((a,b)=>a+b.score,0)/attempts.length) : 0;
  const rank = myRankIdx >= 0 ? myRankIdx + 1 : null;

  // ---------- loading / error ----------
  if (status === 'loading') {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <div className="eyebrow mb-2">{'// Command centre'}</div>
          <div className="h-10 w-96 skeleton mb-2" />
          <div className="h-4 w-72 skeleton" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="glass p-4"><div className="h-4 w-24 skeleton mb-4" /><div className="h-8 w-20 skeleton" /></div>)}
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
        <StatCard label="Your rank · on board" value={rank ? `#${rank}` : '—'} icon="trophy" highlight={true} />
      </div>

      {/* ---------- Launcher ---------- */}
      <div className="glass p-6">
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
            CUET +5/−1 SCORING
          </div>
        </div>

        {mySubs.length === 0 ? (
          <div className="text-sm text-zinc-400">
            You haven&apos;t picked any subjects yet. <Link href="/onboarding" className="text-volt underline">Pick some →</Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
              {mySubs.map(s => (
                <button
                  key={s.id}
                  className={`subject-card ${selSubj === s.id ? 'selected' : ''} p-3.5`}
                  onClick={() => {
                    setSelSubj(s.id);
                    setSelChapter(null);
                  }}
                >
                  <div className="glyph text-[22px] mb-1.5">{s.glyph}</div>
                  <div className="mono-label mb-1">{s.short}</div>
                  <div className="font-display font-bold text-[13px] text-white mb-0.5">{s.name}</div>
                  <div className="text-xs text-zinc-500">Qs available</div>
                </button>
              ))}
            </div>

            {selSubj && (
              <div className="flex flex-col gap-4 pt-4 border-t border-white/5">
                {/* Chapter selector */}
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
                      {chapters.map(c => (
                        <button
                          key={c.id}
                          className={`count-btn ${selChapter === c.name ? 'active' : ''}`}
                          style={{ width: 'auto', padding: '0 14px' }}
                          onClick={() => setSelChapter(c.name)}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Count + launch */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <span className="mono-label">Questions</span>
                  <div className="flex gap-1.5">
                    {[5, 10, 15, 20].map(n => (
                      <button
                        key={n}
                        className={`count-btn ${count === n ? 'active' : ''}`}
                        onClick={() => setCount(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="sm:ml-auto flex items-center gap-3">
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
                          // Spend 1 credit to generate a premium mock
                          const res = await fetch('/api/credits/spend', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ amount: 1, reference: `generate_mock_${selSubj}_${count}` })
                          });
                          
                          if (!res.ok) {
                            const data = await res.json();
                            setCreditError(data.error || 'Insufficient credits to generate mock.');
                            setIsLaunching(false);
                            return;
                          }
                          
                          await refreshSession({ silent: true });
                          setLaunchSuccess('Credits verified. Launching your mock...');
                          router.push(launchHref);
                        } catch (err) {
                          setCreditError('Failed to verify credits. Please try again.');
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

      {/* ---------- Bottom row ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="glass p-6 relative overflow-hidden">
          <div className="absolute top-[-20px] right-[-20px] w-[150px] h-[150px] bg-volt opacity-5 blur-[60px] rounded-full" />
          <div className="relative">
            <Icon name="upload" style={{ color: 'var(--volt)', width: '24px', height: '24px', marginBottom: '12px', strokeWidth: '1.5' }} />
            <h3 className="heading mb-2 text-[18px]">Feed the bank</h3>
            <p className="text-sm text-zinc-400 mb-4 max-w-sm">Upload a question. Pass moderation → earn credits → unlock premium mocks.</p>
            <Link href="/upload" className="btn-ghost font-bold text-volt">
              Upload now <Icon name="arrow" style={{ width: '12px', height: '12px' }} />
            </Link>
          </div>
        </div>

        <div className="glass p-6">
          <div className="eyebrow mb-3">{'// Recent attempts'}</div>
          {attempts.length === 0 ? (
            <p className="text-sm text-zinc-500">No tests yet. Drop your first mock above.</p>
          ) : (
            <div>
              {attempts.slice(0, 5).map(a => {
                const sub = subjects.find(s => s.id === a.subject);
                const cls = a.score >= 70 ? 'text-volt' : a.score >= 40 ? 'verdict-mid' : 'verdict-bad';
                return (
                  <Link
                    key={a.id}
                    href={`/result/${a.id}`}
                    className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0 hover:bg-white/[0.02] px-2 -mx-2 rounded transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[20px] font-display text-volt">{sub?.glyph}</span>
                      <div>
                        <div className="font-display font-bold text-[13px] text-white">{sub?.name || a.subject}</div>
                        <div className="mono-label">{new Date(a.completedAt).toLocaleDateString()} · {a.correct}/{a.total} correct</div>
                      </div>
                    </div>
                    <div className={`font-display font-bold text-[18px] ${cls}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{a.score}%</div>
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
