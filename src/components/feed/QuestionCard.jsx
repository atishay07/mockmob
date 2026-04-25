"use client";
import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { interactWithQuestion } from '@/lib/services/questionService';
import { Analytics } from '@/lib/analytics';
import { VoteControls } from '@/components/questions/VoteControls';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

function readSavedState(id) {
  if (!id || typeof window === 'undefined') return false;
  try {
    const saves = JSON.parse(localStorage.getItem('mm_saves') || '{}');
    return Boolean(saves[id]);
  } catch {
    return false;
  }
}

// ── Difficulty badge ──────────────────────────────────────────────────────────
const DIFF = {
  easy:   { label: 'Easy',   bg: 'rgba(74,222,128,.12)',  color: '#4ade80' },
  medium: { label: 'Medium', bg: 'rgba(251,191,36,.12)',  color: '#fbbf24' },
  hard:   { label: 'Hard',   bg: 'rgba(248,113,113,.12)', color: '#f87171' },
};

function DiffBadge({ d }) {
  const s = DIFF[d] ?? DIFF.medium;
  return (
    <span style={{
      padding: '3px 9px', borderRadius: '20px', fontSize: '10px',
      fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', background: s.bg, color: s.color,
    }}>{s.label}</span>
  );
}

// ── Single option button ──────────────────────────────────────────────────────
const Option = memo(function Option({ idx, text, state, disabled, onSelect }) {
  /* state: 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed' */
  const styles = {
    idle:     { border: '1.5px solid rgba(255,255,255,.08)', bg: 'rgba(255,255,255,.02)', letter: { bg: 'rgba(255,255,255,.06)', color: '#71717a' }, text: '#d4d4d8' },
    selected: { border: '1.5px solid rgba(210,240,0,.5)',    bg: 'rgba(210,240,0,.04)',   letter: { bg: 'var(--volt)',              color: '#000'    }, text: '#fff'    },
    correct:  { border: '1.5px solid rgba(74,222,128,.55)', bg: 'rgba(74,222,128,.06)',  letter: { bg: '#4ade80',                  color: '#000'    }, text: '#4ade80' },
    wrong:    { border: '1.5px solid rgba(248,113,113,.55)',bg: 'rgba(248,113,113,.06)', letter: { bg: '#f87171',                  color: '#fff'    }, text: '#f87171' },
    dimmed:   { border: '1.5px solid rgba(255,255,255,.04)', bg: 'transparent',           letter: { bg: 'rgba(255,255,255,.04)',   color: '#3f3f46' }, text: '#52525b' },
  };
  const s = styles[state] ?? styles.idle;

  return (
    <button
      disabled={disabled}
      onClick={onSelect}
      aria-label={`Option ${LETTERS[idx]}: ${text}`}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(0.983)'; }}
      onMouseUp={e => { e.currentTarget.style.transform = ''; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
      style={{
        width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px',
        padding: '14px 16px', borderRadius: '12px', cursor: disabled ? 'default' : 'pointer',
        border: s.border, background: s.bg, color: s.text,
        transition: 'all .15s ease', transform: 'scale(1)',
      }}
    >
      <span style={{
        width: '28px', height: '28px', borderRadius: '7px', flexShrink: 0,
        background: s.letter.bg, color: s.letter.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '11px',
        transition: 'all .15s ease',
      }}>{LETTERS[idx]}</span>
      <span style={{ flex: 1, fontSize: '14px', lineHeight: 1.5 }}>{text}</span>
      {state === 'correct' && <span style={{ fontSize: '15px' }}>✓</span>}
      {state === 'wrong'   && <span style={{ fontSize: '15px' }}>✗</span>}
    </button>
  );
});

// ── Main card ─────────────────────────────────────────────────────────────────
export const QuestionCard = memo(function QuestionCard({ row }) {
  const q       = row?.questions ?? row ?? {};
  const options = useMemo(() => (
    Array.isArray(q.options) ? q.options : []
  ), [q.options]);

  const [selected,  setSelected]  = useState(null);   // idx
  const [revealed,  setRevealed]  = useState(false);
  const [saved,     setSaved]     = useState(() => readSavedState(q.id));
  const [skipping,  setSkipping]  = useState(false);

  const mountAt  = useRef(0);
  const seenDone = useRef(false);
  const cardRef  = useRef(null);

  // ── Reset per-question timers without making render time-dependent ──
  useEffect(() => {
    mountAt.current = Date.now();
  }, [q.id]);

  const writeLS = (key, id, value) => {
    try {
      const obj = JSON.parse(localStorage.getItem(key) || '{}');
      if (value === null || value === 0 || value === false) delete obj[id];
      else obj[id] = value;
      localStorage.setItem(key, JSON.stringify(obj));
    } catch { /* ignore */ }
  };

  // ── Auto-fire "seen" at 60 % visibility ──────────────────────────────────
  useEffect(() => {
    if (!cardRef.current || seenDone.current || !q.id) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !seenDone.current) {
        seenDone.current = true;
        Analytics.recordView();
        interactWithQuestion(q.id, { interaction_type: 'seen', flow_context: 'explore' });
      }
    }, { threshold: 0.6 });
    obs.observe(cardRef.current);
    return () => obs.disconnect();
  }, [q.id]);

  const dwellMs = () => Date.now() - mountAt.current;

  // ── Correct option index ──────────────────────────────────────────────────
  const correctIdx = options.findIndex(
    o => o.key === q.correct_answer || String(o.key) === String(q.correct_answer)
  );

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSelect = useCallback((idx) => {
    if (revealed) return;
    const ms = dwellMs();
    setSelected(idx);
    setRevealed(true);
    Analytics.recordAnswer();
    Analytics.recordDwell(ms);
    interactWithQuestion(q.id, {
      interaction_type: 'attempted',
      flow_context: 'explore',
      dwell_ms: ms,
      metadata: { selected_key: options[idx]?.key ?? String(idx) },
    });
  }, [revealed, q.id, options]);

  const handleSkip = useCallback(() => {
    if (revealed || skipping) return;
    const ms = dwellMs();
    setSkipping(true);
    Analytics.recordSkip(ms);
    interactWithQuestion(q.id, { interaction_type: 'skip', flow_context: 'explore', dwell_ms: ms });
    setTimeout(() => { setRevealed(true); setSkipping(false); }, 300);
  }, [revealed, skipping, q.id]);

  const handleSave = useCallback(() => {
    const next = !saved;
    setSaved(next);
    writeLS('mm_saves', q.id, next ? Date.now() : false);
    interactWithQuestion(q.id, {
      interaction_type: next ? 'save' : 'unsave',
      flow_context: 'explore',
      dwell_ms: dwellMs(),
    });
  }, [saved, q.id]);

  // ── Option state resolver ─────────────────────────────────────────────────
  const optionState = (idx) => {
    if (!revealed) return idx === selected ? 'selected' : 'idle';
    if (idx === correctIdx)                    return 'correct';
    if (idx === selected && idx !== correctIdx) return 'wrong';
    return 'dimmed';
  };

  return (
    <article
      ref={cardRef}
      style={{
        background: 'linear-gradient(135deg,rgba(255,255,255,.032),rgba(255,255,255,.008) 40%,rgba(255,255,255,.014))',
        border: '1px solid rgba(255,255,255,.08)',
        borderRadius: '20px', padding: '24px',
        marginBottom: '16px', overflow: 'hidden',
        transition: 'opacity .3s ease, transform .3s ease',
        opacity: skipping ? 0 : 1,
        transform: skipping ? 'translateX(32px)' : 'none',
      }}
    >
      {/* ── Meta row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {q.subject && (
          <span style={{
            padding: '3px 9px', borderRadius: '20px', fontSize: '10px',
            fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', background: 'rgba(255,255,255,.06)', color: '#a1a1aa',
          }}>{q.subject}</span>
        )}
        {q.chapter && (
          <span style={{
            padding: '3px 9px', borderRadius: '20px', fontSize: '10px',
            fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', background: 'rgba(255,255,255,.04)', color: '#71717a',
          }}>{q.chapter}</span>
        )}
        <span style={{ marginLeft: 'auto' }}><DiffBadge d={q.difficulty} /></span>
      </div>

      {/* ── Question body ── */}
      <p style={{
        fontSize: '16px', fontWeight: 500, lineHeight: 1.65,
        color: '#f4f4f5', marginBottom: '20px',
      }}>
        {q.body ?? q.question ?? '—'}
      </p>

      {/* ── Options ── */}
      {options.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '22px' }}>
          {options.map((opt, idx) => (
            <Option
              key={opt.key ?? idx}
              idx={idx}
              text={opt.text}
              state={optionState(idx)}
              disabled={revealed}
              onSelect={() => handleSelect(idx)}
            />
          ))}
        </div>
      ) : (
        revealed && q.correct_answer && (
          <div style={{
            padding: '12px 16px', marginBottom: '20px',
            background: 'rgba(74,222,128,.06)',
            border: '1px solid rgba(74,222,128,.3)',
            borderRadius: '10px', color: '#4ade80', fontSize: '14px',
          }}>✓ {q.correct_answer}</div>
        )
      )}

      {/* ── Explanation ── */}
      {revealed && q.explanation && (
        <div style={{
          padding: '13px 15px', marginBottom: '20px',
          background: 'rgba(255,255,255,.025)',
          border: '1px solid rgba(255,255,255,.07)',
          borderRadius: '10px', fontSize: '13px',
          color: '#a1a1aa', lineHeight: 1.65,
        }}>
          <span style={{ color: 'var(--volt)', fontWeight: 700 }}>💡 </span>
          {q.explanation}
        </div>
      )}

      {/* ── Tags ── */}
      {Array.isArray(q.tags) && q.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '18px' }}>
          {q.tags.map(t => (
            <span key={t} style={{
              padding: '2px 8px', borderRadius: '4px',
              background: 'rgba(255,255,255,.04)', color: '#52525b',
              fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
            }}>#{t}</span>
          ))}
        </div>
      )}

      {/* ── Action bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,.06)',
        gap: '12px',
      }}>
        {/* Vote cluster */}
        <VoteControls
          questionId={q.id}
          initialScore={q.score}
          initialUserVote={q.userVote}
        />

        {/* Save + Skip */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <ActionBtn
            label="Save"
            active={saved}
            activeColor="var(--volt)"
            activeBg="rgba(210,240,0,.1)"
            onClick={handleSave}
            pill
          >
            {saved ? '★' : '☆'} Save
          </ActionBtn>
          {!revealed && (
            <ActionBtn label="Skip" onClick={handleSkip} pill muted>
              Skip →
            </ActionBtn>
          )}
        </div>
      </div>
    </article>
  );
});

// ── Small action button atom ──────────────────────────────────────────────────
function ActionBtn({ children, label, onClick, active, activeBg, activeColor, pill, muted }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      style={{
        border: pill ? '1px solid rgba(255,255,255,.1)' : 'none',
        borderRadius: pill ? '20px' : '20px',
        padding: pill ? '5px 12px' : '0',
        width: pill ? 'auto' : '32px',
        height: pill ? 'auto' : '32px',
        minWidth: pill ? undefined : '32px',
        background: active ? activeBg : 'transparent',
        color: active ? activeColor : muted ? '#3f3f46' : '#71717a',
        cursor: 'pointer', fontSize: pill ? '11px' : '14px',
        fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.08em',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
        transition: 'all .15s ease',
      }}
    >{children}</button>
  );
}
