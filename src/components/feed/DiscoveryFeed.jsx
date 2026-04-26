"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { QuestionCard } from './QuestionCard';
import { Icon } from '@/components/ui/Icons';
import { useAuth } from '@/components/AuthProvider';

const FEED_LIMIT = 20;

// ── Card skeleton ─────────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div style={{
      background: 'rgba(255,255,255,.02)',
      border: '1px solid rgba(255,255,255,.06)',
      borderRadius: '20px', padding: '24px', marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <div className="skeleton" style={{ width: '70px', height: '20px', borderRadius: '20px' }} />
        <div className="skeleton" style={{ width: '90px', height: '20px', borderRadius: '20px' }} />
        <div className="skeleton" style={{ width: '50px', height: '20px', borderRadius: '20px', marginLeft: 'auto' }} />
      </div>
      <div className="skeleton" style={{ width: '100%', height: '18px', marginBottom: '8px' }} />
      <div className="skeleton" style={{ width: '82%',  height: '18px', marginBottom: '24px' }} />
      {[0,1,2,3].map(i => (
        <div key={i} className="skeleton" style={{ width: '100%', height: '48px', marginBottom: '9px', borderRadius: '12px' }} />
      ))}
    </div>
  );
}

// ── Filter pill button ────────────────────────────────────────────────────────
function FilterPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 14px', borderRadius: '20px',
        border: active ? 'none' : '1px solid rgba(255,255,255,.08)',
        cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700,
        fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase',
        transition: 'all .15s ease',
        background: active ? 'var(--volt)' : 'rgba(255,255,255,.04)',
        color: active ? '#000' : '#71717a',
        whiteSpace: 'nowrap',
      }}
    >{children}</button>
  );
}

// ── End-of-feed state ─────────────────────────────────────────────────────────
function EndState({ count }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '12px',
        padding: '12px 24px', borderRadius: '99px',
        background: 'rgba(255,255,255,.03)',
        border: '1px solid rgba(255,255,255,.06)',
      }}>
        <span style={{ fontSize: '18px' }}>✓</span>
        <span style={{
          fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700,
          letterSpacing: '0.15em', color: '#52525b', textTransform: 'uppercase',
        }}>
          {count} questions loaded · end of feed
        </span>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ subjectName }) {
  return (
    <div style={{
      textAlign: 'center', padding: '60px 24px',
      background: 'rgba(255,255,255,.02)',
      border: '1px solid rgba(255,255,255,.06)',
      borderRadius: '20px',
    }}>
      <div style={{ fontSize: '2.8rem', marginBottom: '14px' }}>🌵</div>
      <h3 className="heading" style={{ fontSize: '18px', marginBottom: '8px' }}>No questions yet</h3>
      <p style={{ color: '#71717a', fontSize: '13px', lineHeight: 1.6 }}>
        {subjectName
          ? `No approved questions found for "${subjectName}". Be the first to contribute!`
          : 'Select a subject to start exploring.'}
      </p>
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────
function ErrorState({ message, onRetry }) {
  return (
    <div style={{
      textAlign: 'center', padding: '48px 24px',
      background: 'rgba(248,113,113,.04)',
      border: '1px solid rgba(248,113,113,.15)',
      borderRadius: '20px',
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚡</div>
      <p style={{ color: '#f87171', marginBottom: '18px', fontSize: '14px' }}>{message}</p>
      <button
        onClick={onRetry}
        style={{
          padding: '9px 22px', borderRadius: '8px', cursor: 'pointer',
          background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.25)',
          color: '#f87171', fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: '12px', letterSpacing: '0.06em',
        }}
      >Retry</button>
    </div>
  );
}

// ── Loading spinner ───────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '28px' }}>
      <div style={{
        width: '24px', height: '24px', borderRadius: '50%',
        border: '2px solid rgba(210,240,0,.2)',
        borderTopColor: 'var(--volt)',
        animation: 'spin .8s linear infinite',
      }} />
    </div>
  );
}

function MetricTile({ label, value, icon, accent }) {
  return (
    <div className="feedMetric">
      <div className="feedMetricTop">
        <Icon name={icon} style={{ width: '14px', height: '14px', color: accent ? 'var(--volt)' : '#71717a' }} />
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function CircularGoal({ value = 0, solved = 0, goal = 30 }) {
  const safe = Math.min(Math.max(value, 0), 100);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div className="circleGoal" aria-label={`${safe}% weekly progress`}>
      <svg viewBox="0 0 112 112">
        <circle cx="56" cy="56" r={radius} className="circleTrack" />
        <circle cx="56" cy="56" r={radius} className="circleFill" strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="circleCopy">
        <strong>{safe}%</strong>
        <span>{solved}/{goal}</span>
      </div>
    </div>
  );
}

function ActivityGraph({ activity = [] }) {
  const max = Math.max(1, ...activity.map((day) => day.solved || 0));
  return (
    <div className="activityGraph">
      {activity.map((day) => (
        <div key={day.day} className="activityBarWrap">
          <span className="activityBar" style={{ height: `${Math.max(12, ((day.solved || 0) / max) * 56)}px` }} />
          <small>{day.label}</small>
        </div>
      ))}
    </div>
  );
}

function TopContributors({ contributors = [] }) {
  const rows = contributors.length ? contributors : [
    { id: 'empty-1', name: 'Top solvers', count: 0 },
    { id: 'empty-2', name: 'Upload questions', count: 0 },
    { id: 'empty-3', name: 'Earn credits', count: 0 },
  ];

  return (
    <div className="contributors">
      {rows.map((person, index) => (
        <div key={person.id || person.name} className="contributorRow">
          <span>{index + 1}</span>
          <strong>{person.name}</strong>
          <small>{person.count} qs</small>
        </div>
      ))}
    </div>
  );
}

function LearningRail({ summary, user }) {
  const progress = summary?.progress || {};
  const plan = summary?.plan || {};
  const premium = summary?.premium || {};
  const avgDwell = progress.avgDwellMs ? `${Math.max(1, Math.round(progress.avgDwellMs / 1000))}s` : '—';

  return (
    <aside className="learningRail">
      <div className="glass feedCommand">
        <div className="feedCommandHeader">
          <div>
            <div className="eyebrow no-dot">Progress</div>
            <h2>{user?.name?.split(' ')[0] || 'Your'} sprint</h2>
          </div>
          <span className={`planPill ${plan.isPremium ? 'premium' : ''}`}>
            {plan.label || 'Free'}
          </span>
        </div>

        <div className="weeklyBlock">
          <div className="weeklyCopy">
            <span>Weekly solve goal</span>
            <strong>{progress.solvedThisWeek || 0}/{progress.weeklyGoal || 30}</strong>
          </div>
          <CircularGoal
            value={progress.weeklyPercent || 0}
            solved={progress.solvedThisWeek || 0}
            goal={progress.weeklyGoal || 30}
          />
        </div>

        <div className="feedMetricGrid">
          <MetricTile label="Solved" value={progress.solvedTotal || 0} icon="check" accent />
          <MetricTile label="Accuracy" value={`${progress.accuracy || 0}%`} icon="target" />
          <MetricTile label="Streak" value={`${progress.streakDays || 0}d`} icon="flame" />
          <MetricTile label="Speed" value={avgDwell} icon="zap" accent={plan.isPremium} />
        </div>
      </div>

      <div className="glass premiumRail">
        <div className="premiumTitle">
          <Icon name="spark" style={{ width: '16px', height: '16px' }} />
          <span>{plan.isPremium ? 'Premium active' : 'Premium edge'}</span>
        </div>
        <p>{premium.speedBenefit || 'Premium unlocks fast-lane generation and deeper speed diagnostics.'}</p>
        {!plan.isPremium && (
          <Link href="/pricing" className="premiumCta">
            Go Premium <Icon name="arrow" style={{ width: '12px', height: '12px' }} />
          </Link>
        )}
        <div className="benefitRows">
          <span>Mock cost</span>
          <strong>{premium.mockCost === 0 ? '0 credits' : `${premium.mockCost || 10} credits`}</strong>
          <span>Bookmarks</span>
          <strong>{premium.bookmarkBenefit || '25 saved questions'}</strong>
          <span>Arena</span>
          <strong>{premium.mockAllowance || 'Credit-gated mocks'}</strong>
        </div>
      </div>

      <div className="glass insightRail">
        <div className="railSectionTitle">
          <span>7-day activity</span>
          <Icon name="bar" style={{ width: '14px', height: '14px' }} />
        </div>
        <ActivityGraph activity={summary?.activity || []} />
      </div>

      <div className="glass insightRail">
        <div className="railSectionTitle">
          <span>Top contributors</span>
          <Icon name="users" style={{ width: '14px', height: '14px' }} />
        </div>
        <TopContributors contributors={summary?.topContributors || []} />
      </div>
    </aside>
  );
}

// ── Main Feed ─────────────────────────────────────────────────────────────────
export function DiscoveryFeed() {
  const { user } = useAuth();
  const [subjects,    setSubjects]    = useState([]);
  const [subject,     setSubject]     = useState('');
  // chaptersData holds the raw API response: { grouped, units? [], chapters? [] }
  const [chaptersData, setChaptersData] = useState(null);
  const [unit,        setUnit]        = useState('');
  const [chapter,     setChapter]     = useState('');
  const [chapterSearch, setChapterSearch] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [questions,   setQuestions]   = useState([]);
  const [search,      setSearch]      = useState('');
  const [initLoading, setInitLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [hasMore,     setHasMore]     = useState(true);
  const [error,       setError]       = useState(null);
  const [summary,     setSummary]     = useState(null);
  const [showAllSubjects, setShowAllSubjects] = useState(false);

  const loadingRef  = useRef(false);
  const offsetRef   = useRef(0);       // tracks how many questions have been fetched
  const sentinelRef = useRef(null);
  const summaryRefreshRef = useRef(null);

  // ── Derived chapter lists ──
  const isGrouped     = chaptersData?.grouped === true;
  const unitList      = useMemo(() => (isGrouped ? (chaptersData.units ?? []) : []), [chaptersData, isGrouped]);
  const flatChapters  = useMemo(() => (isGrouped ? [] : (chaptersData?.chapters ?? [])), [chaptersData, isGrouped]);
  const allGroupedChapters = useMemo(() => (
    isGrouped
      ? unitList.flatMap((u) => (u.chapters || []).map((chapterItem) => ({ ...chapterItem, unitName: u.name })))
      : []
  ), [isGrouped, unitList]);
  const unitChapters  = useMemo(() => (
    isGrouped && unit
      ? (unitList.find(u => u.id === unit)?.chapters ?? [])
      : allGroupedChapters
  ), [allGroupedChapters, isGrouped, unit, unitList]);

  // ── Load subjects once ──
  useEffect(() => {
    fetch('/api/subjects')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        const preferred = user?.subjects?.length
          ? list.filter((entry) => user.subjects.includes(entry.id))
          : list;
        setSubjects(preferred);
        if (preferred.length) {
          setSubject((current) => preferred.some((entry) => entry.id === current) ? current : preferred[0].id);
        }
      })
      .catch(() => {});
  }, [user?.subjects]);

  // ── Load chapters/units when subject changes ──
  useEffect(() => {
    if (!subject) return;
    setUnit('');
    setChapter('');
    setChapterSearch('');
    setChaptersData(null);
    fetch(`/api/chapters?subject=${encodeURIComponent(subject)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setChaptersData(d && typeof d === 'object' ? d : null))
      .catch(() => {});
  }, [subject]);

  // ── Core fetch — uses /api/questions/feed with offset pagination ──
  const loadFeed = useCallback(async (isReset) => {
    if (loadingRef.current || !subject) return;
    loadingRef.current = true;
    isReset ? setInitLoading(true) : setMoreLoading(true);
    setError(null);

    if (isReset) offsetRef.current = 0;

    try {
      const params = new URLSearchParams({
        subject,
        limit: String(FEED_LIMIT),
        offset: String(offsetRef.current),
      });
      if (chapter) params.set('chapter', chapter);
      if (difficulty) params.set('difficulty', difficulty);
      if (search.trim().length >= 2) params.set('search', search.trim());

      const res = await fetch(`/api/questions/feed?${params}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Feed load failed (${res.status})`);
      }
      const data = await res.json();

      const incoming = data.questions ?? [];
      offsetRef.current += incoming.length;
      setQuestions(prev => isReset ? incoming : [...prev, ...incoming]);
      setHasMore(data.hasMore ?? false);
    } catch (e) {
      setError(e.message ?? 'Could not load questions');
    } finally {
      isReset ? setInitLoading(false) : setMoreLoading(false);
      loadingRef.current = false;
    }
  }, [subject, chapter, difficulty, search]);

  // ── Reset on filter change ──
  useEffect(() => {
    if (!subject) return;
    setQuestions([]);
    setHasMore(true);
    loadFeed(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, chapter, difficulty]);

  useEffect(() => {
    if (!subject) return;
    const id = window.setTimeout(() => {
      setQuestions([]);
      setHasMore(true);
      loadFeed(true);
    }, 280);
    return () => window.clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ── Infinite scroll: prefetch 400px before bottom ──
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingRef.current && questions.length > 0) {
          loadFeed(false);
        }
      },
      { rootMargin: '400px' }
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, questions.length, loadFeed]);

  const currentSubject = subjects.find(s => s.id === subject);
  const visibleSubjects = useMemo(
    () => showAllSubjects ? subjects : subjects.slice(0, 5),
    [subjects, showAllSubjects],
  );
  const activeChapterList = useMemo(() => {
    const source = isGrouped ? unitChapters : flatChapters;
    const needleValue = chapterSearch.trim().toLowerCase();
    if (!needleValue) return source.slice(0, 12);
    return source.filter((entry) => entry.name?.toLowerCase().includes(needleValue)).slice(0, 16);
  }, [isGrouped, unitChapters, flatChapters, chapterSearch]);

  const loadSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (subject) params.set('subject', subject);
      const res = await fetch(`/api/learning/summary?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setSummary(data);
    } catch {
      // Progress is additive; feed remains usable if summary is unavailable.
    }
  }, [subject]);

  useEffect(() => {
    if (!subject) return;
    const id = window.setTimeout(loadSummary, 0);
    return () => window.clearTimeout(id);
  }, [subject, loadSummary]);

  const scheduleSummaryRefresh = useCallback(() => {
    window.clearTimeout(summaryRefreshRef.current);
    summaryRefreshRef.current = window.setTimeout(loadSummary, 450);
  }, [loadSummary]);

  useEffect(() => () => window.clearTimeout(summaryRefreshRef.current), []);

  const selectStyle = {
    flex: 1, padding: '8px 12px', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,.08)',
    background: 'rgba(255,255,255,.03)',
    color: '#f4f4f5', fontSize: '12px',
    fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
    cursor: 'pointer', outline: 'none',
    appearance: 'none',
    backgroundImage: 'linear-gradient(45deg, transparent 50%, #71717a 50%), linear-gradient(135deg, #71717a 50%, transparent 50%)',
    backgroundPosition: 'calc(100% - 16px) 50%, calc(100% - 11px) 50%',
    backgroundSize: '5px 5px',
    backgroundRepeat: 'no-repeat',
    paddingRight: '30px',
  };

  // ── Client-side search filter ──
  const needle = search.trim().toLowerCase();
  const visibleQuestions = needle
    ? questions.filter(q => {
        const hay = [
          q.body, q.question, q.subject, q.chapter,
          ...(Array.isArray(q.tags) ? q.tags : []),
        ].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(needle);
      })
    : questions;

  return (
    <div className="feedShell">
      <LearningRail summary={summary} user={user} />

      <section className="feedMain">
        <div className="feedHero">
          <div>
            <div className="eyebrow" style={{ marginBottom: '8px' }}>{'// Discovery'}</div>
            <h1 className="display-md">
              The Mob&apos;s <span className="text-volt" style={{ fontStyle: 'italic' }}>Feed</span>
            </h1>
            <p>Top-ranked questions from the community. Solve, save, and build streak momentum.</p>
          </div>
          <div className="heroMini">
            <span>{visibleQuestions.length || questions.length}</span>
            <small>loaded</small>
          </div>
        </div>

        <div className="glass filterDock">
          <label className="searchBox">
            <Icon name="radar" style={{ width: '15px', height: '15px' }} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions, concepts, tags..."
            />
          </label>

          {subjects.length > 0 && (
            <div className="subjectStrip">
              {visibleSubjects.map(s => (
                <FilterPill
                  key={s.id}
                  active={subject === s.id}
                  onClick={() => { if (subject !== s.id) setSubject(s.id); }}
                >
                  {s.short ?? s.name}
                </FilterPill>
              ))}
              {subjects.length > 5 && (
                <button className="morePill" onClick={() => setShowAllSubjects((value) => !value)}>
                  {showAllSubjects ? 'Less' : `+${subjects.length - 5} more`}
                </button>
              )}
            </div>
          )}

          <div className="filterRow">
            {subjects.length > 0 && (
              <label>
                <span>Subject</span>
                <select
                  value={subject}
                  onChange={(e) => { setSubject(e.target.value); setChapter(''); }}
                  style={selectStyle}
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.id} style={{ background: '#0a0a0a' }}>{s.name}</option>
                  ))}
                </select>
              </label>
            )}

            {isGrouped && unitList.length > 0 && (
              <label>
                <span>Unit</span>
                <select
                  value={unit}
                  onChange={(e) => { setUnit(e.target.value); setChapter(''); }}
                  style={selectStyle}
                >
                  <option value="" style={{ background: '#0a0a0a' }}>All units</option>
                  {unitList.map(u => (
                    <option key={u.id} value={u.id} style={{ background: '#0a0a0a' }}>{u.name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="difficultyRow">
            {[
              ['', 'All levels'],
              ['easy', 'Easy'],
              ['medium', 'Medium'],
              ['hard', 'Hard'],
            ].map(([value, label]) => (
              <button
                key={value || 'all'}
                className={`difficultyToggle ${difficulty === value ? 'active' : ''}`}
                onClick={() => setDifficulty(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {(isGrouped ? unitChapters.length > 0 : flatChapters.length > 0) && (
            <div className="chapterPicker">
              <div className="chapterPickerTop">
                <label className="chapterSearch">
                  <Icon name="book" style={{ width: '14px', height: '14px' }} />
                  <input
                    value={chapterSearch}
                    onChange={(e) => setChapterSearch(e.target.value)}
                    placeholder="Search chapters..."
                  />
                </label>
                <select
                  value={chapter}
                  onChange={(e) => setChapter(e.target.value)}
                  style={selectStyle}
                >
                  <option value="" style={{ background: '#0a0a0a' }}>All chapters</option>
                  {(isGrouped ? unitChapters : flatChapters).map(c => (
                    <option key={c.id ?? c.name} value={c.name} style={{ background: '#0a0a0a' }}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="chapterResults">
                <button className={`chapterChoice ${chapter === '' ? 'active' : ''}`} onClick={() => setChapter('')}>
                  All chapters
                </button>
                {activeChapterList.map((c) => (
                  <button
                    key={c.id ?? c.name}
                    className={`chapterChoice ${chapter === c.name ? 'active' : ''}`}
                    onClick={() => setChapter(c.name)}
                    title={c.name}
                  >
                    <span>{c.name}</span>
                    {c.unitName && <small>{c.unitName}</small>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="feedList">
          {initLoading && (
            <>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </>
          )}

          {!initLoading && error && (
            <ErrorState message={error} onRetry={() => loadFeed(true)} />
          )}

          {!initLoading && !error && questions.length === 0 && (
            <EmptyState subjectName={currentSubject?.name} />
          )}

          {!initLoading && !error && questions.length > 0 && visibleQuestions.length === 0 && (
            <div className="glass feedEmpty">
              <Icon name="radar" style={{ width: '22px', height: '22px', color: 'var(--volt)' }} />
              <p>No questions match &quot;{search}&quot;.</p>
            </div>
          )}

          {!initLoading && !error && visibleQuestions.map(q => (
            <QuestionCard
              key={q.id}
              row={q}
              onProgressChange={scheduleSummaryRefresh}
            />
          ))}

          <div ref={sentinelRef} style={{ height: '1px' }} />

          {moreLoading && <Spinner />}

          {!hasMore && !moreLoading && visibleQuestions.length > 0 && (
            <EndState count={visibleQuestions.length} />
          )}
        </div>
      </section>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .feedShell {
          display: grid;
          grid-template-columns: minmax(230px, 280px) minmax(0, 680px);
          align-items: start;
          justify-content: center;
          gap: 22px;
          width: 100%;
        }
        .feedMain { min-width: 0; }
        .feedHero {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }
        .feedHero p {
          color: #71717a;
          font-size: 13px;
          margin-top: 6px;
        }
        .heroMini {
          border: 1px solid rgba(210,240,0,.18);
          background: rgba(210,240,0,.06);
          border-radius: 10px;
          padding: 10px 12px;
          min-width: 78px;
          text-align: center;
        }
        .heroMini span {
          display: block;
          color: var(--volt);
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 800;
          line-height: 1;
        }
        .heroMini small {
          color: #71717a;
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: .14em;
          text-transform: uppercase;
        }
        .filterDock {
          position: sticky;
          top: 78px;
          z-index: 5;
          padding: 14px;
          margin-bottom: 16px;
          backdrop-filter: blur(18px);
        }
        .searchBox {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 46px;
          padding: 0 14px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,.09);
          background: rgba(0,0,0,.2);
          color: #71717a;
        }
        .searchBox:focus-within {
          border-color: rgba(210,240,0,.45);
          box-shadow: 0 0 0 3px rgba(210,240,0,.05);
        }
        .searchBox input {
          width: 100%;
          background: transparent;
          border: 0;
          outline: 0;
          color: #f4f4f5;
          font-size: 14px;
        }
        .subjectStrip {
          display: flex;
          gap: 7px;
          overflow-x: auto;
          padding: 12px 0 2px;
          scrollbar-width: none;
        }
        .subjectStrip::-webkit-scrollbar { display: none; }
        .morePill {
          flex: 0 0 auto;
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 999px;
          background: rgba(255,255,255,.035);
          color: #a1a1aa;
          padding: 5px 12px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .08em;
          cursor: pointer;
        }
        .filterRow {
          display: grid;
          grid-template-columns: repeat(2, minmax(220px, 1fr));
          gap: 14px;
          margin-top: 10px;
        }
        .filterRow label {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .filterRow label > span {
          flex: 0 0 auto;
          color: #52525b;
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: .14em;
          text-transform: uppercase;
        }
        .difficultyRow {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(255,255,255,.06);
        }
        .difficultyToggle {
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 999px;
          background: rgba(255,255,255,.025);
          color: #71717a;
          cursor: pointer;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .1em;
          padding: 6px 10px;
          text-transform: uppercase;
        }
        .difficultyToggle.active {
          background: rgba(210,240,0,.12);
          border-color: rgba(210,240,0,.35);
          color: var(--volt);
        }
        .chapterPicker {
          margin-top: 12px;
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 10px;
          background: rgba(0,0,0,.14);
          padding: 10px;
        }
        .chapterPickerTop {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(160px, .7fr);
          gap: 8px;
        }
        .chapterSearch {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 10px;
          padding: 0 10px;
          min-height: 38px;
          color: #71717a;
          background: rgba(255,255,255,.025);
        }
        .chapterSearch:focus-within {
          border-color: rgba(210,240,0,.38);
        }
        .chapterSearch input {
          min-width: 0;
          width: 100%;
          background: transparent;
          border: 0;
          outline: 0;
          color: #f4f4f5;
          font-size: 12px;
        }
        .chapterResults {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
          margin-top: 8px;
          max-height: 162px;
          overflow: auto;
          padding-right: 2px;
        }
        .chapterChoice {
          min-width: 0;
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 8px;
          background: rgba(255,255,255,.025);
          color: #a1a1aa;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 8px 10px;
          text-align: left;
        }
        .chapterChoice span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
          font-weight: 700;
        }
        .chapterChoice small {
          color: #52525b;
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .chapterChoice.active {
          border-color: rgba(210,240,0,.38);
          background: rgba(210,240,0,.09);
          color: var(--volt);
        }
        .feedList article {
          border-radius: 14px !important;
          margin-bottom: 14px !important;
        }
        .feedEmpty {
          padding: 34px 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: #71717a;
          font-size: 13px;
        }
        .learningRail {
          position: sticky;
          top: 78px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .feedCommand, .premiumRail { padding: 16px; border-radius: 14px; }
        .feedCommandHeader {
          display: flex;
          align-items: start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }
        .feedCommandHeader h2 {
          color: #fff;
          font-family: var(--font-display);
          font-size: 21px;
          font-weight: 800;
          margin-top: 4px;
        }
        .planPill {
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 999px;
          padding: 4px 9px;
          color: #a1a1aa;
          background: rgba(255,255,255,.035);
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .planPill.premium {
          color: #000;
          background: var(--volt);
          border-color: var(--volt);
        }
        .weeklyBlock {
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 10px;
          padding: 12px;
          background: rgba(255,255,255,.02);
          margin-bottom: 12px;
        }
        .weeklyCopy {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 9px;
          font-size: 12px;
          color: #71717a;
        }
        .weeklyCopy strong { color: #fff; font-variant-numeric: tabular-nums; }
        .circleGoal {
          position: relative;
          width: 126px;
          height: 126px;
          margin: 4px auto 0;
        }
        .circleGoal svg {
          width: 126px;
          height: 126px;
          transform: rotate(-90deg);
        }
        .circleTrack, .circleFill {
          fill: none;
          stroke-width: 10;
        }
        .circleTrack { stroke: rgba(255,255,255,.07); }
        .circleFill {
          stroke: var(--volt);
          stroke-linecap: round;
          filter: drop-shadow(0 0 8px rgba(210,240,0,.45));
          transition: stroke-dashoffset .45s ease;
        }
        .circleCopy {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
        }
        .circleCopy strong {
          color: #fff;
          font-family: var(--font-display);
          font-size: 26px;
          font-weight: 900;
          line-height: 1;
        }
        .circleCopy span {
          color: #71717a;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .1em;
          margin-top: 5px;
        }
        .feedMetricGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .feedMetric {
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 10px;
          padding: 10px;
          background: rgba(255,255,255,.018);
        }
        .feedMetricTop {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #71717a;
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .1em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .feedMetric strong {
          color: #fff;
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }
        .premiumTitle {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--volt);
          font-family: var(--font-display);
          font-weight: 800;
          margin-bottom: 8px;
        }
        .premiumRail p {
          color: #a1a1aa;
          font-size: 12px;
          line-height: 1.55;
          margin-bottom: 12px;
        }
        .premiumCta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          border-radius: 8px;
          background: var(--volt);
          color: #000;
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .06em;
          padding: 10px 12px;
          text-decoration: none;
          text-transform: uppercase;
          margin-bottom: 12px;
          box-shadow: 0 0 26px rgba(210,240,0,.18);
        }
        .benefitRows {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px 10px;
          border-top: 1px solid rgba(255,255,255,.06);
          padding-top: 12px;
          font-size: 11px;
        }
        .benefitRows span {
          color: #52525b;
          font-family: var(--font-mono);
          text-transform: uppercase;
          letter-spacing: .1em;
        }
        .benefitRows strong {
          color: #f4f4f5;
          text-align: right;
          font-size: 11px;
        }
        .insightRail {
          padding: 14px;
          border-radius: 14px;
        }
        .railSectionTitle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #f4f4f5;
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 12px;
        }
        .activityGraph {
          height: 84px;
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 7px;
          align-items: end;
        }
        .activityBarWrap {
          display: flex;
          align-items: center;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }
        .activityBar {
          width: 100%;
          max-width: 22px;
          border-radius: 6px 6px 3px 3px;
          background: linear-gradient(180deg, var(--volt), rgba(210,240,0,.18));
          box-shadow: 0 0 14px rgba(210,240,0,.18);
        }
        .activityBarWrap small {
          color: #52525b;
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 800;
        }
        .contributors {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .contributorRow {
          display: grid;
          grid-template-columns: 24px 1fr auto;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(255,255,255,.06);
          border-radius: 9px;
          padding: 8px;
          background: rgba(255,255,255,.02);
        }
        .contributorRow span {
          width: 22px;
          height: 22px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(210,240,0,.12);
          color: var(--volt);
          font-family: var(--font-display);
          font-size: 11px;
          font-weight: 900;
        }
        .contributorRow strong {
          color: #e4e4e7;
          font-size: 12px;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .contributorRow small {
          color: #71717a;
          font-family: var(--font-mono);
          font-size: 10px;
        }
        @media (max-width: 960px) {
          .feedShell {
            grid-template-columns: minmax(0, 1fr);
            gap: 14px;
          }
          .learningRail {
            position: static;
            order: 2;
            display: grid;
            grid-template-columns: 1fr;
          }
          .feedMain { order: 1; }
          .filterDock {
            top: 64px;
          }
        }
        @media (max-width: 640px) {
          .feedHero {
            align-items: start;
          }
          .heroMini { display: none; }
          .filterRow {
            grid-template-columns: 1fr;
          }
          .chapterPickerTop,
          .chapterResults {
            grid-template-columns: 1fr;
          }
          .filterRow label {
            align-items: stretch;
            flex-direction: column;
            gap: 6px;
          }
        }
      `}</style>
    </div>
  );
}
