"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { apiGet } from '@/lib/fetcher';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
  pending: {
    label: 'Under Review',
    color: '#fbbf24',
    bg:    'rgba(251,191,36,.1)',
    icon:  '⏳',
    desc:  'Our moderators are reviewing this. Hang tight!',
  },
  approved: {
    label: 'Live in Feed',
    color: '#4ade80',
    bg:    'rgba(74,222,128,.1)',
    icon:  '✅',
    desc:  'Your question is live and being served to learners.',
  },
  rejected: {
    label: 'Not Approved',
    color: '#f87171',
    bg:    'rgba(248,113,113,.1)',
    icon:  '❌',
    desc:  'This question did not pass moderation. Review the feedback and try again.',
  },
};

function StatusBadge({ status }) {
  const s = STATUS[status] ?? STATUS.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '20px',
      background: s.bg, color: s.color,
      fontSize: '10px', fontFamily: 'var(--font-mono)',
      fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
    }}>
      {s.icon} {s.label}
    </span>
  );
}

function UploadCard({ q }) {
  const [open, setOpen] = useState(false);
  const s = STATUS[q.status] ?? STATUS.pending;
  const options = Array.isArray(q.options) ? q.options : [];

  return (
    <div style={{
      background: 'rgba(255,255,255,.02)',
      border: `1px solid ${open ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.07)'}`,
      borderRadius: '16px', overflow: 'hidden',
      transition: 'border-color .2s ease',
    }}>
      {/* ── Header row ── */}
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          padding: '18px 20px', cursor: 'pointer', display: 'flex',
          alignItems: 'flex-start', gap: '14px',
        }}
      >
        {/* Status bar */}
        <div style={{
          width: '4px', borderRadius: '4px', flexShrink: 0, alignSelf: 'stretch',
          background: s.color, opacity: 0.8,
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Question preview */}
          <p style={{
            fontSize: '14px', fontWeight: 500, color: '#e4e4e7',
            lineHeight: 1.5, marginBottom: '10px',
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {q.body ?? q.question ?? 'No question text'}
          </p>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusBadge status={q.status} />
            {q.subject && (
              <span style={{
                padding: '2px 8px', borderRadius: '4px',
                background: 'rgba(255,255,255,.05)', color: '#71717a',
                fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em',
              }}>{q.subject}</span>
            )}
            {q.difficulty && (
              <span style={{
                padding: '2px 8px', borderRadius: '4px',
                background: 'rgba(255,255,255,.05)', color: '#71717a',
                fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em',
              }}>{q.difficulty}</span>
            )}
            {q.createdAt && (
              <span style={{ color: '#52525b', fontSize: '11px', marginLeft: 'auto' }}>
                {new Date(q.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        {/* Chevron */}
        <span style={{
          color: '#52525b', fontSize: '12px', flexShrink: 0, marginTop: '2px',
          transition: 'transform .2s ease',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        }}>▶</span>
      </button>

      {/* ── Expanded detail ── */}
      {open && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,.06)',
          padding: '16px 20px 20px',
        }}>
          {/* Status message */}
          <div style={{
            padding: '10px 14px', borderRadius: '10px',
            background: s.bg, color: s.color,
            fontSize: '12px', marginBottom: '16px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span>{s.icon}</span>
            <span>{s.desc}</span>
          </div>

          {/* Options preview */}
          {options.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
              {options.map((opt, i) => {
                const isCorrect = opt.key === q.correct_answer || String(opt.key) === String(q.correct_answer);
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', borderRadius: '8px',
                    background: isCorrect ? 'rgba(74,222,128,.06)' : 'rgba(255,255,255,.02)',
                    border: isCorrect ? '1px solid rgba(74,222,128,.25)' : '1px solid rgba(255,255,255,.05)',
                  }}>
                    <span style={{
                      width: '24px', height: '24px', borderRadius: '5px', flexShrink: 0,
                      background: isCorrect ? '#4ade80' : 'rgba(255,255,255,.05)',
                      color: isCorrect ? '#000' : '#71717a',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '10px',
                    }}>{opt.key ?? 'ABCDE'[i]}</span>
                    <span style={{ fontSize: '13px', color: isCorrect ? '#4ade80' : '#a1a1aa' }}>{opt.text}</span>
                    {isCorrect && <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#4ade80', fontWeight: 700 }}>CORRECT</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Explanation */}
          {q.explanation && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px',
              background: 'rgba(255,255,255,.025)',
              border: '1px solid rgba(255,255,255,.06)',
              fontSize: '12px', color: '#71717a', lineHeight: 1.6,
            }}>
              <span style={{ color: 'var(--volt)', fontWeight: 700 }}>💡 </span>
              {q.explanation}
            </div>
          )}

          {/* AI score / tier if available */}
          {(q.ai_score != null || q.ai_tier) && (
            <div style={{
              marginTop: '12px', display: 'flex', gap: '12px',
              fontSize: '11px', color: '#52525b', fontFamily: 'var(--font-mono)',
            }}>
              {q.ai_tier && <span>TIER: <strong style={{ color: '#a1a1aa' }}>{q.ai_tier}</strong></span>}
              {q.ai_score != null && <span>AI SCORE: <strong style={{ color: '#a1a1aa' }}>{q.ai_score}</strong></span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ borderRadius: '16px', overflow: 'hidden' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          padding: '20px', marginBottom: '12px',
          background: 'rgba(255,255,255,.02)',
          border: '1px solid rgba(255,255,255,.06)', borderRadius: '16px',
        }}>
          <div className="skeleton" style={{ height: '14px', width: '75%', marginBottom: '10px' }} />
          <div className="skeleton" style={{ height: '14px', width: '50%', marginBottom: '14px' }} />
          <div className="skeleton" style={{ height: '20px', width: '100px', borderRadius: '20px' }} />
        </div>
      ))}
    </div>
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────────────
const FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'pending',  label: 'Under Review' },
  { key: 'approved', label: 'Live' },
  { key: 'rejected', label: 'Rejected' },
];

export default function MyUploadsPageClient() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [filter,    setFilter]    = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all statuses in parallel
      const [pending, allQ] = await Promise.all([
        apiGet('/api/questions/pending'),
        apiGet('/api/questions/pending?status=rejected').catch(() => []),
      ]);
      // Combine and tag
      const combined = [
        ...(Array.isArray(pending) ? pending.map(q => ({ ...q, status: q.status ?? 'pending' })) : []),
        ...(Array.isArray(allQ)    ? allQ.map(q => ({ ...q, status: q.status ?? 'rejected' })) : []),
      ];
      // Deduplicate by id
      const seen = new Set();
      const deduped = combined.filter(q => { if (seen.has(q.id)) return false; seen.add(q.id); return true; });
      setQuestions(deduped.sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0)));
    } catch (e) {
      setError(e.message ?? 'Failed to load uploads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? questions : questions.filter(q => q.status === filter);

  const counts = {
    all:      questions.length,
    pending:  questions.filter(q => q.status === 'pending').length,
    approved: questions.filter(q => q.status === 'approved').length,
    rejected: questions.filter(q => q.status === 'rejected').length,
  };

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', width: '100%' }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: '28px' }}>
        <div className="eyebrow" style={{ marginBottom: '8px' }}>// MY UPLOADS</div>
        <h1 className="display-md">
          Your <span className="text-volt" style={{ fontStyle: 'italic' }}>Contributions</span>
        </h1>
        <p style={{ color: '#71717a', fontSize: '13px', marginTop: '6px' }}>
          Track the status of every question you've submitted to the community bank.
        </p>
      </div>

      {/* ── Stats row ── */}
      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
          {[
            { label: 'Under Review', count: counts.pending,  color: '#fbbf24' },
            { label: 'Live',         count: counts.approved, color: '#4ade80' },
            { label: 'Rejected',     count: counts.rejected, color: '#f87171' },
          ].map(s => (
            <div key={s.label} style={{
              padding: '14px 16px', borderRadius: '12px',
              background: 'rgba(255,255,255,.02)',
              border: '1px solid rgba(255,255,255,.07)',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '24px', fontWeight: 900, color: s.color,
                fontFamily: 'var(--font-display)', letterSpacing: '-0.03em',
                lineHeight: 1,
              }}>{s.count}</div>
              <div style={{ fontSize: '10px', color: '#71717a', marginTop: '4px', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter tabs ── */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '10px',
              letterSpacing: '0.12em', textTransform: 'uppercase', transition: 'all .15s ease',
              background: filter === f.key ? 'var(--volt)' : 'rgba(255,255,255,.05)',
              color: filter === f.key ? '#000' : '#71717a',
            }}
          >
            {f.label} {counts[f.key] > 0 && `(${counts[f.key]})`}
          </button>
        ))}
        <button
          onClick={load}
          title="Refresh"
          style={{
            marginLeft: 'auto', padding: '6px 12px', borderRadius: '20px',
            background: 'none', border: '1px solid rgba(255,255,255,.08)',
            color: '#71717a', cursor: 'pointer', fontSize: '12px',
            fontFamily: 'var(--font-mono)',
          }}
        >↻ Refresh</button>
      </div>

      {/* ── States ── */}
      {loading && <Skeleton />}

      {!loading && error && (
        <div style={{
          textAlign: 'center', padding: '48px 20px',
          background: 'rgba(248,113,113,.05)',
          border: '1px solid rgba(248,113,113,.2)', borderRadius: '16px',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⚠️</div>
          <p style={{ color: '#f87171', marginBottom: '16px' }}>{error}</p>
          <button className="btn-outline md" onClick={load}>Retry</button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: 'rgba(255,255,255,.02)',
          border: '1px solid rgba(255,255,255,.07)', borderRadius: '20px',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📭</div>
          <h3 className="heading" style={{ marginBottom: '8px' }}>
            {filter === 'all' ? 'No uploads yet' : `No ${filter} questions`}
          </h3>
          <p style={{ color: '#71717a', fontSize: '13px', marginBottom: '20px' }}>
            {filter === 'all'
              ? 'Start contributing to the community question bank.'
              : `You have no questions with "${filter}" status.`}
          </p>
          {filter === 'all' && (
            <Link href="/upload">
              <button className="btn-volt md">Upload a Question ↗</button>
            </Link>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(q => <UploadCard key={q.id} q={q} />)}
        </div>
      )}
    </div>
  );
}
