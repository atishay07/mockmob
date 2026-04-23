"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '@/lib/fetcher';
import { useRole } from '@/lib/roleContext';
import { useRouter } from 'next/navigation';

// ── Difficulty badge ──────────────────────────────────────────────────────────
const DIFF_STYLE = {
  easy:   { color: '#4ade80', bg: 'rgba(74,222,128,.1)' },
  medium: { color: '#fbbf24', bg: 'rgba(251,191,36,.1)' },
  hard:   { color: '#f87171', bg: 'rgba(248,113,113,.1)' },
};

function DiffTag({ d }) {
  const s = DIFF_STYLE[d] ?? DIFF_STYLE.medium;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '4px', fontSize: '9px',
      fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', background: s.bg, color: s.color,
    }}>{d}</span>
  );
}

// ── Single question card in the mod queue ─────────────────────────────────────
function ModCard({ q, onAction }) {
  const [decision, setDecision] = useState(null); // null | 'approve' | 'reject'
  const [loading,  setLoading]  = useState(false);
  const options = Array.isArray(q.options) ? q.options : [];

  const handleAction = async (action) => {
    if (loading || decision) return;
    setLoading(true);
    try {
      await apiPost('/api/questions/moderate', { id: q.id, action });
      setDecision(action);
      setTimeout(() => onAction(q.id, action), 600); // let animation play
    } catch (e) {
      alert(`Failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const borderColor = decision === 'approve'
    ? 'rgba(74,222,128,.4)'
    : decision === 'reject'
    ? 'rgba(248,113,113,.3)'
    : 'rgba(255,255,255,.08)';

  return (
    <div style={{
      background: 'rgba(255,255,255,.02)',
      border: `1px solid ${borderColor}`,
      borderRadius: '18px', overflow: 'hidden',
      transition: 'all .3s ease',
      opacity: decision ? 0.5 : 1,
    }}>
      {/* ── Question header ── */}
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {q.subject && (
            <span style={{
              padding: '2px 9px', borderRadius: '4px',
              background: 'rgba(255,255,255,.06)', color: '#a1a1aa',
              fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>{q.subject}</span>
          )}
          {q.chapter && (
            <span style={{ color: '#52525b', fontSize: '11px' }}>{q.chapter}</span>
          )}
          <DiffTag d={q.difficulty} />
          {q.ai_tier && (
            <span style={{
              padding: '2px 8px', borderRadius: '4px',
              background: 'rgba(210,240,0,.08)', color: 'var(--volt)',
              fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em',
            }}>TIER: {q.ai_tier}</span>
          )}
          {q.ai_score != null && (
            <span style={{
              marginLeft: 'auto', fontSize: '11px', color: '#52525b',
              fontFamily: 'var(--font-mono)',
            }}>AI: {typeof q.ai_score === 'number' ? q.ai_score.toFixed(2) : q.ai_score}</span>
          )}
        </div>

        {/* Question body */}
        <p style={{ fontSize: '15px', fontWeight: 500, color: '#f4f4f5', lineHeight: 1.6, marginBottom: '16px' }}>
          {q.body ?? q.question ?? '—'}
        </p>

        {/* Options */}
        {options.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '14px' }}>
            {options.map((opt, i) => {
              const isCorrect = opt.key === q.correct_answer || String(opt.key) === String(q.correct_answer);
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', borderRadius: '8px',
                  background: isCorrect ? 'rgba(74,222,128,.06)' : 'rgba(255,255,255,.02)',
                  border: `1px solid ${isCorrect ? 'rgba(74,222,128,.25)' : 'rgba(255,255,255,.05)'}`,
                }}>
                  <span style={{
                    width: '24px', height: '24px', borderRadius: '5px', flexShrink: 0,
                    background: isCorrect ? '#4ade80' : 'rgba(255,255,255,.06)',
                    color: isCorrect ? '#000' : '#71717a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '10px',
                  }}>{opt.key ?? 'ABCDE'[i]}</span>
                  <span style={{ fontSize: '13px', color: isCorrect ? '#4ade80' : '#a1a1aa' }}>{opt.text}</span>
                  {isCorrect && (
                    <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#4ade80', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>✓ CORRECT</span>
                  )}
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
            fontSize: '12px', color: '#71717a', lineHeight: 1.6, marginBottom: '12px',
          }}>
            <span style={{ color: 'var(--volt)', fontWeight: 700 }}>💡 </span>{q.explanation}
          </div>
        )}

        {/* Tags */}
        {Array.isArray(q.tags) && q.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {q.tags.map(t => (
              <span key={t} style={{
                padding: '2px 7px', borderRadius: '4px',
                background: 'rgba(255,255,255,.04)', color: '#52525b',
                fontSize: '10px', fontFamily: 'var(--font-mono)',
              }}>#{t}</span>
            ))}
          </div>
        )}

        {/* Metadata footer */}
        <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#52525b', fontFamily: 'var(--font-mono)' }}>
          {q.author_id && <span>BY: {String(q.author_id).slice(0, 12)}…</span>}
          {q.createdAt && <span>{new Date(q.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
          {q.verification_state && <span>STATE: {q.verification_state}</span>}
        </div>
      </div>

      {/* ── Action bar ── */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,.06)',
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px',
        background: 'rgba(255,255,255,.01)',
      }}>
        {decision ? (
          <span style={{
            fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em',
            color: decision === 'approve' ? '#4ade80' : '#f87171',
          }}>
            {decision === 'approve' ? '✓ APPROVED' : '✗ REJECTED'}
          </span>
        ) : (
          <>
            <button
              disabled={loading}
              onClick={() => handleAction('reject')}
              style={{
                padding: '8px 20px', borderRadius: '8px', cursor: 'pointer',
                background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.25)',
                color: '#f87171', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '12px',
                letterSpacing: '0.05em', transition: 'all .15s ease',
                opacity: loading ? 0.5 : 1,
              }}
            >✗ Reject</button>
            <button
              disabled={loading}
              onClick={() => handleAction('approve')}
              style={{
                padding: '8px 22px', borderRadius: '8px', cursor: 'pointer',
                background: 'rgba(74,222,128,.12)', border: '1px solid rgba(74,222,128,.3)',
                color: '#4ade80', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '12px',
                letterSpacing: '0.05em', transition: 'all .15s ease',
                opacity: loading ? 0.5 : 1,
              }}
            >✓ Approve</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          padding: '20px', borderRadius: '18px',
          background: 'rgba(255,255,255,.02)',
          border: '1px solid rgba(255,255,255,.06)',
        }}>
          <div className="skeleton" style={{ height: '13px', width: '35%', marginBottom: '14px' }} />
          <div className="skeleton" style={{ height: '15px', width: '90%', marginBottom: '8px' }} />
          <div className="skeleton" style={{ height: '15px', width: '70%', marginBottom: '16px' }} />
          {[0,1,2,3].map(j => (
            <div key={j} className="skeleton" style={{ height: '40px', width: '100%', marginBottom: '7px', borderRadius: '8px' }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ModerationPageClient() {
  const { isModerator } = useRole();
  const router = useRouter();

  const [queue,    setQueue]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Guard — non-moderators see access denied
  if (!isModerator) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔒</div>
        <h2 className="heading" style={{ marginBottom: '8px' }}>Moderator Access Only</h2>
        <p style={{ color: '#71717a', fontSize: '13px', marginBottom: '24px' }}>
          You need moderator privileges to access this page.
        </p>
        <button
          className="btn-volt md"
          onClick={() => router.push('/dashboard')}
        >← Back to Dashboard</button>
      </div>
    );
  }

  const handleAction = (id, action) => {
    setQueue(prev => prev.filter(q => q.id !== id));
    if (action === 'approve') setApproved(p => p + 1);
    else setRejected(p => p + 1);
  };

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', width: '100%' }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: '28px' }}>
        <div className="eyebrow" style={{ marginBottom: '8px' }}>// MOD DASHBOARD</div>
        <h1 className="display-md">
          Moderation <span className="text-volt" style={{ fontStyle: 'italic' }}>Queue</span>
        </h1>
        <p style={{ color: '#71717a', fontSize: '13px', marginTop: '6px' }}>
          Review community-submitted questions. Approve to publish, reject to remove.
        </p>
      </div>

      {/* ── Session stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '24px' }}>
        {[
          { label: 'In Queue',  value: queue.length,  color: '#fbbf24' },
          { label: 'Approved',  value: approved,      color: '#4ade80' },
          { label: 'Rejected',  value: rejected,      color: '#f87171' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '14px 16px', borderRadius: '12px', textAlign: 'center',
            background: 'rgba(255,255,255,.02)',
            border: '1px solid rgba(255,255,255,.07)',
          }}>
            <div style={{
              fontSize: '26px', fontWeight: 900, color: s.color,
              fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', lineHeight: 1,
            }}>{s.value}</div>
            <div style={{ fontSize: '10px', color: '#71717a', marginTop: '4px', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Refresh ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: '6px 14px', borderRadius: '20px', cursor: 'pointer',
            background: 'none', border: '1px solid rgba(255,255,255,.1)',
            color: '#71717a', fontFamily: 'var(--font-mono)', fontSize: '11px',
            letterSpacing: '0.1em',
          }}
        >↻ REFRESH</button>
      </div>

      {/* ── States ── */}
      {loading && <Skeleton />}

      {!loading && error && (
        <div style={{
          textAlign: 'center', padding: '48px',
          background: 'rgba(248,113,113,.04)',
          border: '1px solid rgba(248,113,113,.15)', borderRadius: '16px',
        }}>
          <p style={{ color: '#f87171', marginBottom: '16px' }}>{error}</p>
          <button className="btn-outline md" onClick={load}>Retry</button>
        </div>
      )}

      {!loading && !error && queue.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: 'rgba(74,222,128,.03)',
          border: '1px solid rgba(74,222,128,.12)', borderRadius: '20px',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✨</div>
          <h3 className="heading" style={{ marginBottom: '8px', color: '#4ade80' }}>Queue is clear!</h3>
          <p style={{ color: '#71717a', fontSize: '13px' }}>
            No questions waiting for review.{approved + rejected > 0 && ` You reviewed ${approved + rejected} this session.`}
          </p>
        </div>
      )}

      {!loading && !error && queue.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {queue.map(q => (
            <ModCard key={q.id} q={q} onAction={handleAction} />
          ))}
        </div>
      )}
    </div>
  );
}
