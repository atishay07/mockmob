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
import { CreditsRemainingModal } from '@/components/CreditsRemainingModal';

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
  const [learningSummary, setLearningSummary] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [subRefreshing, setSubRefreshing] = useState(false);

  const [selSubj, setSelSubj] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [chapterSearch, setChapterSearch] = useState('');
  const [selChapter, setSelChapter] = useState(null);
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [difficultyMode, setDifficultyMode] = useState('auto');
  const [count, setCount] = useState(10);
  const [isLaunching, setIsLaunching] = useState(false);
  const launchingKeyRef = useRef(null);
  const [creditError, setCreditError] = useState(null);
  const [launchSuccess, setLaunchSuccess] = useState(null);
  const [showCreditsModal, setShowCreditsModal] = useState(false);

  // After a mock attempt the test page sets `mm:postTest=1` in sessionStorage
  // before redirecting. When the user lands back here (Arena), pop the modal
  // once and clear the flag so it doesn't re-trigger on a refresh.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (authStatus !== 'authenticated') return;
    try {
      if (window.sessionStorage.getItem('mm:postTest') === '1') {
        window.sessionStorage.removeItem('mm:postTest');
        setShowCreditsModal(true);
      }
    } catch { /* private mode — non-fatal */ }
  }, [authStatus]);

  useEffect(() => {
    if (authStatus === 'loading' || !user?.id) return;

    let alive = true;
    async function load() {
      try {
        const [subs, atts, board, statData, myQs, learning] = await Promise.all([
          apiGet('/api/subjects'),
          apiGet(`/api/attempts?userId=${user.id}`),
          apiGet('/api/leaderboard'),
          apiGet('/api/stats'),
          apiGet('/api/questions/mine').catch(() => []),
          apiGet('/api/learning/summary').catch(() => null),
        ]);
        if (!alive) return;
        setSubjects(subs);
        setAttempts(atts);
        setLeaderboard(board);
        setStats(statData || { bankSize: 0, subjectCounts: {} });
        setLearningSummary(learning);
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
      .then((data) => {
        if (!alive) return;
        const list = data?.grouped
          ? (data.units || []).flatMap((unit) => (unit.chapters || []).map((chapter) => ({ ...chapter, unitName: unit.name })))
          : (data?.chapters || []);
        setChapters(list);
        setChapterSearch('');
        setSelectedChapters([]);
      })
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
  const isPremium = Boolean(user?.isPremium || learningSummary?.plan?.isPremium);
  const mockCreditCost = isPremium ? 0 : TEST_START_CREDIT_COST;
  const filteredChapters = useMemo(() => {
    const needle = chapterSearch.trim().toLowerCase();
    if (!needle) return chapters;
    return chapters.filter((chapter) => chapter.name?.toLowerCase().includes(needle));
  }, [chapters, chapterSearch]);

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

  const chapterParam = selectedChapters.length > 0
    ? `&chapters=${encodeURIComponent(selectedChapters.join(','))}`
    : '';
  const difficultyParam = isPremium && difficultyMode !== 'auto'
    ? `&difficulty=${encodeURIComponent(difficultyMode)}`
    : '';
  const launchHref = `/test?subject=${selSubj}&count=${count}${chapterParam}${difficultyParam}`;
  const selectedSubject = subjects.find((entry) => entry.id === selSubj);
  const selectedSubjectCount = stats.subjectCounts?.[selSubj] || 0;

  function togglePremiumChapter(chapterName) {
    setSelectedChapters((prev) => (
      prev.includes(chapterName)
        ? prev.filter((entry) => entry !== chapterName)
        : [...prev, chapterName]
    ));
  }

  return (
    <div className="flex flex-col gap-6 view">
      <CreditsRemainingModal
        open={showCreditsModal}
        credits={user?.creditBalance ?? 0}
        onClose={() => setShowCreditsModal(false)}
      />
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
              Generate Mock <span className="text-volt font-semibold">{mockCreditCost === 0 ? '0 Credits with Premium' : `- ${mockCreditCost} Credits`}</span>
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
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-3 mb-5">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {mySubs.slice(0, 5).map((subject) => (
                  <button
                    key={subject.id}
                    className={`arena-subject-card ${selSubj === subject.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelSubj(subject.id);
                    setSelChapter(null);
                    setSelectedChapters([]);
                    setDifficultyMode('auto');
                  }}
                >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="mono-label">{subject.short}</span>
                      <span className="text-[18px] text-volt leading-none">{subject.glyph}</span>
                    </div>
                    <div className="font-display font-bold text-[13px] leading-tight text-white line-clamp-2">{subject.name}</div>
                    <div className="text-xs text-zinc-500 mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {stats.subjectCounts?.[subject.id] || 0} questions
                    </div>
                </button>
              ))}
            </div>
              <label className="flex flex-col gap-2">
                <span className="mono-label">Select subject</span>
                <select
                  className="select"
                  value={selSubj || ''}
                  onChange={(event) => {
                    setSelSubj(event.target.value);
                    setSelChapter(null);
                    setSelectedChapters([]);
                    setDifficultyMode('auto');
                  }}
                >
                  {mySubs.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name} ({stats.subjectCounts?.[subject.id] || 0} qs)
                    </option>
                  ))}
                </select>
                <span className="text-xs text-zinc-500">
                  {selectedSubject?.name || 'Subject'} has <span className="text-volt">{selectedSubjectCount}</span> available questions.
                </span>
              </label>
            </div>

            {selSubj && (
              <div className="flex flex-col gap-4 pt-4 border-t border-white/5">
                {chapters.length > 0 && (
                  <div className="glass p-3 relative overflow-hidden">
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                      <span className="mono-label">Chapter</span>
                      <select
                        className="select"
                        style={{ maxWidth: '320px' }}
                        value={selectedChapters[0] || ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          setSelectedChapters(value ? [value] : []);
                          setSelChapter(value || null);
                        }}
                      >
                        <option value="">Any chapter</option>
                        {chapters.map((chapter) => (
                          <option key={chapter.id || chapter.name} value={chapter.name}>{chapter.name}</option>
                        ))}
                      </select>
                    </div>
                    <input
                      className="input mb-3"
                      value={chapterSearch}
                      onChange={(event) => setChapterSearch(event.target.value)}
                      placeholder="Search chapters..."
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[210px] overflow-y-auto pr-1">
                      <button
                        className={`count-btn ${selChapter === null && selectedChapters.length === 0 ? 'active' : ''}`}
                        style={{ width: '100%', padding: '0 14px', justifyContent: 'flex-start' }}
                        onClick={() => { setSelChapter(null); setSelectedChapters([]); }}
                      >
                        Any chapter
                      </button>
                      {filteredChapters.map((chapter) => (
                        <button
                          key={chapter.id || chapter.name}
                          className={`count-btn ${selectedChapters.includes(chapter.name) ? 'active' : ''}`}
                          style={{ width: '100%', padding: '0 14px', justifyContent: 'flex-start', overflow: 'hidden', textOverflow: 'ellipsis' }}
                          onClick={() => togglePremiumChapter(chapter.name)}
                          title={chapter.name}
                        >
                          {chapter.name}
                        </button>
                      ))}
                    </div>
                    {!isPremium && (
                      <div className="mt-4 rounded-xl border border-volt/25 bg-black/55 backdrop-blur-md p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-display font-bold text-white text-sm">Premium difficulty controls</div>
                            <p className="text-xs text-zinc-400 mt-1">Choose Easy, Medium, or Hard instead of Auto.</p>
                          </div>
                          <button className="btn-volt sm" onClick={() => router.push('/pricing')}>
                            Go Premium
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <span className="mono-label">Difficulty</span>
                        {!isPremium && <span className="pill volt">Premium</span>}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {['auto', 'easy', 'medium', 'hard'].map((mode) => (
                          <button
                            key={mode}
                            className={`count-btn ${difficultyMode === mode ? 'active' : ''}`}
                            disabled={!isPremium && mode !== 'auto'}
                            onClick={() => setDifficultyMode(mode)}
                            style={{ width: '100%', textTransform: 'capitalize' }}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
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
                      disabled={isLaunching || (user?.creditBalance || 0) < mockCreditCost}
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
                      <Icon name="play" /> {isLaunching ? 'Verifying...' : mockCreditCost === 0 ? 'Generate Premium Mock' : `Generate Mock - ${mockCreditCost} Credits`}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="glass p-6">
          <div className="eyebrow mb-3">{'// Premium speed'}</div>
          <h3 className="heading mb-2 text-[18px]">{isPremium ? 'Fast lane active' : 'Remove credit friction'}</h3>
          <p className="text-sm text-zinc-400 mb-4 max-w-sm">
            {isPremium
              ? 'Arena mocks launch at zero credits with fast-lane generation and deeper speed diagnostics.'
              : 'Premium keeps unlimited mocks, fast-lane generation, and speed diagnostics ready for longer grind sessions.'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="glass p-3">
              <div className="mono-label mb-1">Mock cost</div>
              <div className="font-display font-bold text-volt">{mockCreditCost}</div>
            </div>
            <div className="glass p-3">
              <div className="mono-label mb-1">Solved</div>
              <div className="font-display font-bold text-white">{learningSummary?.progress?.solvedTotal || 0}</div>
            </div>
            <div className="glass p-3">
              <div className="mono-label mb-1">Speed</div>
              <div className="font-display font-bold text-white">
                {learningSummary?.progress?.avgDwellMs ? `${Math.round(learningSummary.progress.avgDwellMs / 1000)}s` : '—'}
              </div>
            </div>
          </div>
        </div>

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
      <style>{`
        .arena-subject-card {
          min-height: 104px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,.07);
          background: rgba(255,255,255,.018);
          padding: 12px;
          text-align: left;
          transition: border-color .15s ease, background .15s ease;
        }
        .arena-subject-card:hover {
          border-color: rgba(255,255,255,.18);
        }
        .arena-subject-card.selected {
          border-color: rgba(210,240,0,.55);
          background: rgba(210,240,0,.055);
        }
      `}</style>
    </div>
  );
}
