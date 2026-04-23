"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchFeed } from '@/lib/services/questionService';
import { QuestionCard } from './QuestionCard';

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
  const [chapters,    setChapters]    = useState([]);
  const [chapter,     setChapter]     = useState('');
  const [questions,   setQuestions]   = useState([]);
  const [cursors,     setCursors]     = useState({ easy: null, medium: null, hard: null });
  const [initLoading, setInitLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [hasMore,     setHasMore]     = useState(true);
  const [error,       setError]       = useState(null);

  const loadingRef  = useRef(false);
  const sentinelRef = useRef(null);

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

  // ── Load chapters when subject changes ──
  useEffect(() => {
    if (!subject) return;
    setChapter('');
    setChapters([]);
    fetch(`/api/chapters?subject=${encodeURIComponent(subject)}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setChapters(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [subject]);

  // ── Core fetch ──
  const loadFeed = useCallback(async (isReset, activeCursors) => {
    if (loadingRef.current || !subject) return;
    loadingRef.current = true;
    isReset ? setInitLoading(true) : setMoreLoading(true);
    setError(null);

    try {
      const data = await fetchFeed({
        subject,
        chapter: chapter || '',
        limit: 12,
        cursors: isReset ? { easy: null, medium: null, hard: null } : activeCursors,
      });

      const incoming = data.questions ?? [];
      const nc = data.next_cursors ?? {};
      const newCursors = {
        easy:   nc.cursor_easy   ?? null,
        medium: nc.cursor_medium ?? null,
        hard:   nc.cursor_hard   ?? null,
      };

      setQuestions(prev => isReset ? incoming : [...prev, ...incoming]);
      setCursors(newCursors);

      const exhausted = !nc.cursor_easy && !nc.cursor_medium && !nc.cursor_hard;
      if (incoming.length === 0 || exhausted) setHasMore(false);
      else setHasMore(true);
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
    setCursors({ easy: null, medium: null, hard: null });
    loadFeed(true, null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, chapter]);

  // ── Infinite scroll: prefetch 400px before bottom ──
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingRef.current && questions.length > 0) {
          loadFeed(false, cursors);
        }
      },
      { rootMargin: '400px' }
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, cursors, questions.length, loadFeed]);

  const currentSubject = subjects.find(s => s.id === subject);

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

      {/* ── Subject filter ── */}
      {subjects.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px',
            scrollbarWidth: 'none',
          }} className="no-scrollbar">
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

      {/* ── Chapter filter ── */}
      {chapters.length > 0 && (
        <div style={{
          marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span style={{
            fontSize: '10px', color: '#52525b',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.15em', textTransform: 'uppercase',
            flexShrink: 0,
          }}>Chapter</span>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none' }} className="no-scrollbar">
            <FilterPill active={chapter === ''} onClick={() => setChapter('')}>All</FilterPill>
            {chapters.map(c => (
              <FilterPill
                key={c.id ?? c.name}
                active={chapter === c.name}
                onClick={() => setChapter(c.name)}
              >{c.name}</FilterPill>
            ))}
          </div>
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
        <ErrorState message={error} onRetry={() => loadFeed(true, null)} />
      )}

      {!initLoading && !error && questions.length === 0 && (
        <EmptyState subjectName={currentSubject?.name} />
      )}

      {!initLoading && !error && questions.map(row => (
        <QuestionCard
          key={row.question_id ?? row.id ?? row.questions?.id ?? Math.random()}
          row={row}
        />
      ))}

      {/* Scroll sentinel */}
      <div ref={sentinelRef} style={{ height: '1px' }} />

      {moreLoading && <Spinner />}

      {!hasMore && !moreLoading && questions.length > 0 && (
        <EndState count={questions.length} />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
