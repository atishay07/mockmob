"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QuestionCard } from './QuestionCard';

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

// ── Main Feed ─────────────────────────────────────────────────────────────────
export function DiscoveryFeed() {
  const [subjects,    setSubjects]    = useState([]);
  const [subject,     setSubject]     = useState('');
  // chaptersData holds the raw API response: { grouped, units? [], chapters? [] }
  const [chaptersData, setChaptersData] = useState(null);
  const [unit,        setUnit]        = useState('');
  const [chapter,     setChapter]     = useState('');
  const [questions,   setQuestions]   = useState([]);
  const [search,      setSearch]      = useState('');
  const [initLoading, setInitLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [hasMore,     setHasMore]     = useState(true);
  const [error,       setError]       = useState(null);

  const loadingRef  = useRef(false);
  const offsetRef   = useRef(0);       // tracks how many questions have been fetched
  const sentinelRef = useRef(null);

  // ── Derived chapter lists ──
  const isGrouped     = chaptersData?.grouped === true;
  const unitList      = isGrouped ? (chaptersData.units ?? []) : [];
  const flatChapters  = isGrouped ? [] : (chaptersData?.chapters ?? []);
  const unitChapters  = isGrouped && unit
    ? (unitList.find(u => u.id === unit)?.chapters ?? [])
    : [];

  // ── Load subjects once ──
  useEffect(() => {
    fetch('/api/subjects')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setSubjects(list);
        if (list.length) setSubject(list[0].id);
      })
      .catch(() => {});
  }, []);

  // ── Load chapters/units when subject changes ──
  useEffect(() => {
    if (!subject) return;
    setUnit('');
    setChapter('');
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
  }, [subject, chapter]);

  // ── Reset on filter change ──
  useEffect(() => {
    if (!subject) return;
    setQuestions([]);
    setHasMore(true);
    loadFeed(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, chapter]);

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
    <div style={{ maxWidth: '640px', margin: '0 auto', width: '100%' }}>
      {/* ── Page header ── */}
      <div style={{ marginBottom: '24px' }}>
        <div className="eyebrow" style={{ marginBottom: '8px' }}>// DISCOVERY</div>
        <h1 className="display-md">
          The Mob&apos;s <span className="text-volt" style={{ fontStyle: 'italic' }}>Feed</span>
        </h1>
        <p style={{ color: '#71717a', fontSize: '13px', marginTop: '6px' }}>
          Top-ranked questions from the community. Tap any option to reveal the answer.
        </p>
      </div>

      {/* ── Search input ── */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions by text, subject, or tag…"
          style={{
            width: '100%', padding: '11px 14px', borderRadius: '12px',
            border: '1px solid rgba(255,255,255,.08)',
            background: 'rgba(255,255,255,.03)',
            color: '#f4f4f5', fontSize: '13px',
            fontFamily: 'var(--font-sans, inherit)', outline: 'none',
            transition: 'border-color .15s ease',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(210,240,0,.4)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)'; }}
        />
      </div>

      {/* ── Subject filter (wrapping grid — no horizontal scroll) ── */}
      {subjects.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {subjects.map(s => (
              <FilterPill
                key={s.id}
                active={subject === s.id}
                onClick={() => { if (subject !== s.id) setSubject(s.id); }}
              >
                {s.short ?? s.name}
              </FilterPill>
            ))}
          </div>
        </div>
      )}

      {/* ── Unit dropdown (only when subject has units) ── */}
      {isGrouped && unitList.length > 0 && (
        <div style={{
          marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{
            fontSize: '10px', color: '#52525b',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.15em', textTransform: 'uppercase',
            flexShrink: 0,
          }}>Unit</span>
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
        </div>
      )}

      {/* ── Chapter dropdown ── */}
      {/* Grouped subject: show only when a unit is selected */}
      {isGrouped && unit && unitChapters.length > 0 && (
        <div style={{
          marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{
            fontSize: '10px', color: '#52525b',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.15em', textTransform: 'uppercase',
            flexShrink: 0,
          }}>Chapter</span>
          <select
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            style={selectStyle}
          >
            <option value="" style={{ background: '#0a0a0a' }}>All chapters</option>
            {unitChapters.map(c => (
              <option key={c.id ?? c.name} value={c.name} style={{ background: '#0a0a0a' }}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Flat subject: always show chapter dropdown */}
      {!isGrouped && flatChapters.length > 0 && (
        <div style={{
          marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{
            fontSize: '10px', color: '#52525b',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.15em', textTransform: 'uppercase',
            flexShrink: 0,
          }}>Chapter</span>
          <select
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            style={selectStyle}
          >
            <option value="" style={{ background: '#0a0a0a' }}>All chapters</option>
            {flatChapters.map(c => (
              <option key={c.id ?? c.name} value={c.name} style={{ background: '#0a0a0a' }}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Content ── */}
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
        <div style={{
          textAlign: 'center', padding: '48px 24px',
          background: 'rgba(255,255,255,.02)',
          border: '1px solid rgba(255,255,255,.06)',
          borderRadius: '20px',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🔍</div>
          <p style={{ color: '#71717a', fontSize: '13px' }}>
            No questions match “{search}”.
          </p>
        </div>
      )}

      {!initLoading && !error && visibleQuestions.map(q => (
        <QuestionCard
          key={q.id}
          row={q}
        />
      ))}

      {/* Scroll sentinel */}
      <div ref={sentinelRef} style={{ height: '1px' }} />

      {moreLoading && <Spinner />}

      {!hasMore && !moreLoading && visibleQuestions.length > 0 && (
        <EndState count={visibleQuestions.length} />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
