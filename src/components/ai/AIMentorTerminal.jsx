"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icons';
import { useAuth } from '@/components/AuthProvider';

const SUGGESTED_PROMPTS = [
  { label: 'What should I do today?', mode: 'mentor' },
  { label: 'Analyze my last mock', mode: 'autopsy' },
  { label: 'Why am I not improving?', mode: 'mentor' },
  { label: 'Start an AI Rival battle', mode: 'battle' },
  { label: 'Build a trap drill', mode: 'trap_drill' },
  { label: 'How far am I from my DU target?', mode: 'admission' },
  { label: 'What should I revise today?', mode: 'revision' },
];

const CARD_ICONS = {
  recommendation: 'spark',
  warning: 'alert',
  battle: 'shield',
  admission: 'target',
  weakness: 'trend',
  mock: 'bar',
  autopsy: 'radar',
  trap_drill: 'flag',
};

const ACTION_ICONS = {
  launch_ai_rival: 'shield',
  create_next_mock: 'play',
  create_trap_drill: 'flag',
  show_admission_path: 'target',
  explain_mistake: 'msg',
  start_revision_queue: 'book',
  show_mock_autopsy: 'radar',
};

export default function AIMentorTerminal() {
  const router = useRouter();
  const { user } = useAuth();
  const [usageSnapshot, setUsageSnapshot] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('mentor');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const transcriptRef = useRef(null);

  const isPaid = useMemo(() => Boolean(user?.isPremium), [user]);

  // Initial usage snapshot.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/ai/usage')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.ok) setUsageSnapshot(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  // Auto-scroll on new message.
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages, pending]);

  if (!user) {
    return <TerminalShell><LoadingState /></TerminalShell>;
  }

  if (!isPaid) {
    return <TerminalShell><LockedState /></TerminalShell>;
  }

  const remaining = usageSnapshot?.remaining?.aiMentorMessages ?? null;
  const creditCost = usageSnapshot?.creditCosts?.ai_mentor_extra ?? 1;

  async function sendMessage(text, overrideMode) {
    const finalText = (text ?? input).trim();
    if (!finalText || pending) return;

    const finalMode = overrideMode || mode;
    setError(null);
    setInput('');

    const userMsg = { id: `u_${Date.now()}`, role: 'user', text: finalText, mode: finalMode };
    setMessages((prev) => [...prev, userMsg]);
    setPending(true);

    try {
      const res = await fetch('/api/ai/mentor/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: finalText, mode: finalMode }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 402) {
          setError({
            kind: 'paywall',
            message: data.message || 'Out of mentor messages — buy credits or upgrade.',
            balance: data.balance,
            required: data.required,
          });
        } else {
          setError({ kind: 'error', message: data.error || 'Mentor request failed.' });
        }
        return;
      }

      const aiMsg = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        response: data.response,
      };
      setMessages((prev) => [...prev, aiMsg]);
      if (data.usageSnapshot) {
        setUsageSnapshot((prev) => ({ ...(prev || {}), ...data.usageSnapshot }));
      }
    } catch (err) {
      setError({ kind: 'error', message: 'Network error. Try again.' });
    } finally {
      setPending(false);
    }
  }

  async function executeAction(action) {
    setError(null);
    try {
      const res = await fetch('/api/ai/actions/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: action.action, params: action.params || {} }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ kind: 'action', message: data.error || 'Action failed', balance: data.balance, required: data.required });
        return;
      }
      if (data.kind === 'redirect' && data.target) {
        const qp = new URLSearchParams();
        for (const [k, v] of Object.entries(data.params || {})) {
          if (v == null) continue;
          if (Array.isArray(v)) qp.set(k, v.join(','));
          else qp.set(k, String(v));
        }
        const url = qp.toString() ? `${data.target}?${qp.toString()}` : data.target;
        router.push(url);
      } else if (data.kind === 'mentor_followup' && data.params?.prompt) {
        await sendMessage(data.params.prompt, data.params.mode || 'autopsy');
      } else {
        // inline / recommendation → append a system note in transcript.
        setMessages((prev) => [
          ...prev,
          {
            id: `s_${Date.now()}`,
            role: 'system',
            text: data.message || 'Action accepted.',
          },
        ]);
        if (data.target) {
          setTimeout(() => router.push(data.target), 700);
        }
      }
    } catch {
      setError({ kind: 'action', message: 'Could not execute action.' });
    }
  }

  return (
    <TerminalShell>
      <header style={S.header}>
        <div>
          <div style={S.headerLabel}>MOCKMOB · AI MENTOR</div>
          <h1 style={S.headerTitle}>Tell me what's blocking your CUET score.</h1>
        </div>
        <div style={S.statusBar}>
          <Pill label="Mentor msgs" value={renderRemaining(remaining)} />
          <Pill
            label="Credits"
            value={usageSnapshot?.creditBalance ?? user?.creditBalance ?? 0}
            tone="volt"
          />
          {remaining === 0 ? (
            <span style={S.creditCost}>Extra: {creditCost} credit / msg</span>
          ) : null}
        </div>
      </header>

      <ModeBar mode={mode} setMode={setMode} />

      <div style={S.transcriptWrap}>
        <div ref={transcriptRef} style={S.transcript}>
          {messages.length === 0 && <EmptyState onSelect={(p) => sendMessage(p.label, p.mode)} />}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} onAction={executeAction} />
          ))}
          {pending && <ThinkingBubble />}
          {error && <ErrorBanner error={error} onDismiss={() => setError(null)} />}
        </div>
      </div>

      {messages.length > 0 && !pending && (
        <SuggestedRow prompts={SUGGESTED_PROMPTS.slice(0, 4)} onSelect={(p) => sendMessage(p.label, p.mode)} />
      )}

      <Composer
        value={input}
        onChange={setInput}
        onSubmit={() => sendMessage()}
        disabled={pending}
        mode={mode}
      />
    </TerminalShell>
  );
}

// ---------- subcomponents ----------

function TerminalShell({ children }) {
  return (
    <div style={S.shell}>
      <div style={S.shellInner}>{children}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ padding: '64px 20px', textAlign: 'center', color: '#71717a', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
      LOADING MENTOR…
    </div>
  );
}

function LockedState() {
  return (
    <div style={S.locked}>
      <div style={S.lockedBadge}>
        <Icon name="shield" />
        <span>PAID FEATURE</span>
      </div>
      <h2 style={S.lockedTitle}>AI Mentor is for paid MockMob members.</h2>
      <p style={S.lockedBody}>
        The Mentor reads your last mocks, weak chapters, traps you fall for, and DU targets — then
        tells you the single next move that will actually move your score. It is not a chatbot.
      </p>
      <ul style={S.lockedList}>
        <li><Icon name="check" /> 5 deep diagnostic messages every day</li>
        <li><Icon name="check" /> Personalised mock autopsy and trap drills</li>
        <li><Icon name="check" /> 2 premium AI Rival battles per day included</li>
        <li><Icon name="check" /> DU admission planning grounded in your real data</li>
      </ul>
      <div style={S.lockedActions}>
        <Link href="/pricing" style={S.lockedCta}>Unlock Mentor — view plans</Link>
        <Link href="/rival" style={S.lockedSecondary}>Try a free AI Rival battle →</Link>
      </div>
    </div>
  );
}

function EmptyState({ onSelect }) {
  return (
    <div style={S.emptyState}>
      <div style={S.emptyKicker}>SUGGESTED PROMPTS</div>
      <p style={S.emptyHelp}>Pick one or type your own. Mentor uses your real MockMob data — it does not guess.</p>
      <div style={S.suggestedGrid}>
        {SUGGESTED_PROMPTS.map((p) => (
          <button key={p.label} type="button" onClick={() => onSelect(p)} style={S.suggestedBtn}>
            <span>{p.label}</span>
            <Icon name="arrow" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ModeBar({ mode, setMode }) {
  const modes = [
    { id: 'mentor', label: 'Mentor', icon: 'spark' },
    { id: 'autopsy', label: 'Autopsy', icon: 'radar' },
    { id: 'trap_drill', label: 'Trap drill', icon: 'flag' },
    { id: 'battle', label: 'Battle', icon: 'shield' },
    { id: 'admission', label: 'Admission', icon: 'target' },
    { id: 'revision', label: 'Revision', icon: 'book' },
  ];
  return (
    <div style={S.modeBar}>
      {modes.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => setMode(m.id)}
          style={{
            ...S.modeBtn,
            ...(mode === m.id ? S.modeBtnActive : null),
          }}
        >
          <Icon name={m.icon} style={{ width: 12, height: 12 }} />
          <span>{m.label}</span>
        </button>
      ))}
    </div>
  );
}

function MessageBubble({ message, onAction }) {
  if (message.role === 'user') {
    return (
      <div style={S.userBubble}>
        <div style={S.userMeta}>YOU · {(message.mode || 'mentor').toUpperCase()}</div>
        <div>{message.text}</div>
      </div>
    );
  }
  if (message.role === 'system') {
    return (
      <div style={S.systemBubble}>
        <Icon name="check" style={{ width: 12, height: 12, color: 'var(--volt)' }} />
        <span>{message.text}</span>
      </div>
    );
  }

  const r = message.response || {};
  return (
    <div style={S.aiBubble}>
      <div style={S.aiMeta}>
        <span>MENTOR</span>
        <span style={{ opacity: 0.6 }}>·</span>
        <span style={{ color: '#a3a3a3' }}>{r.usage?.model || 'model'}</span>
        <span style={{ opacity: 0.6 }}>·</span>
        <span style={S.confidenceBadge}>Confidence {r.confidence ?? '–'}%</span>
      </div>
      <div style={S.aiReply}>{r.reply}</div>
      {Array.isArray(r.cards) && r.cards.length > 0 && (
        <div style={S.cardList}>
          {r.cards.map((card, idx) => (
            <Card key={idx} card={card} />
          ))}
        </div>
      )}
      {Array.isArray(r.actions) && r.actions.length > 0 && (
        <div style={S.actionRow}>
          {r.actions.map((a, idx) => (
            <ActionButton key={idx} action={a} onClick={() => onAction(a)} />
          ))}
        </div>
      )}
      {r.charge?.kind === 'credits' && (
        <div style={S.chargeNote}>Charged {r.charge.amount} credit · stays cached for this session.</div>
      )}
    </div>
  );
}

function Card({ card }) {
  return (
    <div style={{ ...S.card, ...(toneFor(card.type)) }}>
      <div style={S.cardHead}>
        <Icon name={CARD_ICONS[card.type] || 'spark'} style={{ width: 14, height: 14 }} />
        <span style={S.cardType}>{card.type.replace('_', ' ')}</span>
      </div>
      <div style={S.cardTitle}>{card.title}</div>
      {card.body && <div style={S.cardBody}>{card.body}</div>}
    </div>
  );
}

function ActionButton({ action, onClick }) {
  return (
    <button type="button" onClick={onClick} style={S.actionBtn}>
      <Icon name={ACTION_ICONS[action.action] || 'arrow'} style={{ width: 12, height: 12 }} />
      <span>{action.label}</span>
      {action.creditCost > 0 && (
        <span style={S.creditBadge}>{action.creditCost} credit{action.creditCost > 1 ? 's' : ''}</span>
      )}
      {action.requiresPaid && <span style={S.paidBadge}>PRO</span>}
    </button>
  );
}

function ThinkingBubble() {
  return (
    <div style={S.aiBubble}>
      <div style={S.aiMeta}>
        <span>MENTOR</span>
        <span style={{ opacity: 0.6 }}>· thinking</span>
      </div>
      <div style={S.dots}>
        <span style={S.dot}>•</span>
        <span style={{ ...S.dot, animationDelay: '120ms' }}>•</span>
        <span style={{ ...S.dot, animationDelay: '240ms' }}>•</span>
      </div>
      <style>{`
        @keyframes mentor-pulse { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}

function ErrorBanner({ error, onDismiss }) {
  return (
    <div style={S.errorBanner}>
      <Icon name="alert" />
      <div style={{ flex: 1, fontSize: 13 }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>
          {error.kind === 'paywall' ? 'Out of mentor messages' : 'Something went wrong'}
        </div>
        <div style={{ color: '#a3a3a3' }}>{error.message}</div>
        {error.kind === 'paywall' && (
          <Link href="/pricing" style={S.errorCta}>Buy credits or upgrade →</Link>
        )}
      </div>
      <button type="button" onClick={onDismiss} style={S.errorClose}><Icon name="x" /></button>
    </div>
  );
}

function SuggestedRow({ prompts, onSelect }) {
  return (
    <div style={S.suggestedRow}>
      {prompts.map((p) => (
        <button key={p.label} type="button" onClick={() => onSelect(p)} style={S.chipBtn}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

function Composer({ value, onChange, onSubmit, disabled, mode }) {
  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }
  return (
    <form
      style={S.composer}
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={`Ask mentor in ${mode} mode…`}
        rows={2}
        style={S.textarea}
        disabled={disabled}
        maxLength={1500}
      />
      <button type="submit" disabled={disabled || !value.trim()} style={S.submitBtn}>
        <Icon name="play" style={{ width: 14, height: 14 }} />
        <span>{disabled ? 'Thinking…' : 'Ask Mentor'}</span>
      </button>
    </form>
  );
}

function Pill({ label, value, tone }) {
  return (
    <span style={{ ...S.pill, ...(tone === 'volt' ? S.pillVolt : null) }}>
      <span style={S.pillLabel}>{label}</span>
      <span style={S.pillValue}>{value}</span>
    </span>
  );
}

function renderRemaining(remaining) {
  if (remaining == null) return '—';
  if (remaining === Infinity || remaining === 'unlimited') return '∞';
  return remaining;
}

function toneFor(type) {
  if (type === 'warning') return { borderColor: 'rgba(248,113,113,.4)', background: 'rgba(248,113,113,.08)' };
  if (type === 'battle') return { borderColor: 'rgba(34,211,238,.35)', background: 'rgba(34,211,238,.07)' };
  if (type === 'admission') return { borderColor: 'rgba(251,191,36,.35)', background: 'rgba(251,191,36,.06)' };
  if (type === 'autopsy' || type === 'trap_drill') return { borderColor: 'rgba(244,114,182,.35)', background: 'rgba(244,114,182,.06)' };
  return { borderColor: 'rgba(210,240,0,.28)', background: 'rgba(210,240,0,.06)' };
}

// ---------- styles ----------

const S = {
  shell: {
    width: '100%',
    maxWidth: 980,
    margin: '0 auto',
    padding: '0',
  },
  shellInner: {
    background: 'rgba(10,10,10,.72)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 22,
    padding: 'clamp(16px, 3vw, 24px)',
    backdropFilter: 'blur(20px)',
    boxShadow: '0 24px 70px rgba(0,0,0,.45)',
    minHeight: 'min(82vh, 720px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  headerLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    letterSpacing: '.18em',
    color: 'var(--volt)',
    fontWeight: 800,
  },
  headerTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(20px, 2.6vw, 28px)',
    fontWeight: 800,
    color: '#fafafa',
    margin: '6px 0 0',
    lineHeight: 1.2,
  },
  statusBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(255,255,255,.08)',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: '#d4d4d8',
  },
  pillVolt: {
    background: 'rgba(210,240,0,.1)',
    border: '1px solid rgba(210,240,0,.25)',
    color: 'var(--volt)',
  },
  pillLabel: { opacity: 0.65, textTransform: 'uppercase', letterSpacing: '.12em', fontSize: 9 },
  pillValue: { fontWeight: 800 },
  creditCost: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    color: '#a3a3a3',
    letterSpacing: '.1em',
  },
  modeBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    paddingBottom: 4,
    borderBottom: '1px solid rgba(255,255,255,.05)',
  },
  modeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 11px',
    borderRadius: 999,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,.08)',
    color: '#a3a3a3',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '.08em',
    cursor: 'pointer',
    textTransform: 'uppercase',
  },
  modeBtnActive: {
    color: 'var(--volt)',
    background: 'rgba(210,240,0,.08)',
    borderColor: 'rgba(210,240,0,.4)',
  },
  transcriptWrap: {
    flex: 1,
    minHeight: 240,
    display: 'flex',
    flexDirection: 'column',
  },
  transcript: {
    flex: 1,
    overflowY: 'auto',
    padding: '6px 2px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    scrollBehavior: 'smooth',
  },
  emptyState: { padding: '14px 4px' },
  emptyKicker: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    letterSpacing: '.18em',
    color: 'var(--volt)',
    fontWeight: 800,
    marginBottom: 6,
  },
  emptyHelp: {
    color: '#a3a3a3',
    fontSize: 13,
    margin: '0 0 14px',
    maxWidth: 560,
  },
  suggestedGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 8,
  },
  suggestedBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '12px 14px',
    background: 'rgba(255,255,255,.03)',
    border: '1px solid rgba(255,255,255,.07)',
    borderRadius: 14,
    color: '#e4e4e7',
    fontSize: 13,
    textAlign: 'left',
    cursor: 'pointer',
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    background: 'rgba(210,240,0,.08)',
    border: '1px solid rgba(210,240,0,.22)',
    borderRadius: '14px 14px 4px 14px',
    padding: '10px 14px',
    color: '#fafafa',
    fontSize: 14,
    lineHeight: 1.45,
  },
  userMeta: {
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    letterSpacing: '.18em',
    color: 'var(--volt)',
    fontWeight: 800,
    marginBottom: 4,
  },
  systemBubble: {
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: 'rgba(255,255,255,.025)',
    border: '1px dashed rgba(255,255,255,.12)',
    borderRadius: 10,
    color: '#a3a3a3',
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    background: 'rgba(255,255,255,.02)',
    border: '1px solid rgba(255,255,255,.07)',
    borderRadius: '4px 14px 14px 14px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  aiMeta: {
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    letterSpacing: '.16em',
    color: '#71717a',
    fontWeight: 700,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
    textTransform: 'uppercase',
  },
  confidenceBadge: {
    color: 'var(--volt)',
  },
  aiReply: {
    fontSize: 14,
    lineHeight: 1.55,
    color: '#e4e4e7',
    whiteSpace: 'pre-wrap',
  },
  cardList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 8,
  },
  card: {
    border: '1px solid rgba(210,240,0,.22)',
    background: 'rgba(210,240,0,.05)',
    borderRadius: 12,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    letterSpacing: '.18em',
    color: '#a3a3a3',
    fontWeight: 800,
    textTransform: 'uppercase',
  },
  cardType: { color: '#d4d4d8' },
  cardTitle: { fontWeight: 800, color: '#fafafa', fontSize: 14 },
  cardBody: { color: '#a1a1aa', fontSize: 12, lineHeight: 1.5 },
  actionRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
  },
  actionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    background: 'var(--volt)',
    color: '#000',
    border: 'none',
    borderRadius: 999,
    fontWeight: 800,
    fontSize: 12,
    fontFamily: 'var(--font-display)',
    letterSpacing: '.04em',
    cursor: 'pointer',
    boxShadow: '0 0 22px rgba(210,240,0,.2)',
  },
  creditBadge: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    fontWeight: 800,
    background: 'rgba(0,0,0,.18)',
    padding: '2px 6px',
    borderRadius: 999,
    letterSpacing: '.06em',
  },
  paidBadge: {
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    fontWeight: 900,
    background: '#000',
    color: 'var(--volt)',
    padding: '2px 6px',
    borderRadius: 999,
    letterSpacing: '.12em',
  },
  chargeNote: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    color: '#71717a',
    letterSpacing: '.06em',
  },
  dots: { display: 'flex', gap: 4 },
  dot: {
    fontSize: 24,
    color: 'var(--volt)',
    animation: 'mentor-pulse 1.1s ease-in-out infinite',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '12px 14px',
    background: 'rgba(248,113,113,.06)',
    border: '1px solid rgba(248,113,113,.3)',
    borderRadius: 12,
    color: '#fecaca',
  },
  errorCta: { color: 'var(--volt)', fontSize: 12, fontWeight: 700, display: 'inline-block', marginTop: 6 },
  errorClose: {
    background: 'none',
    border: 'none',
    color: '#71717a',
    cursor: 'pointer',
    padding: 4,
  },
  suggestedRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 4,
  },
  chipBtn: {
    background: 'rgba(255,255,255,.03)',
    border: '1px solid rgba(255,255,255,.08)',
    color: '#d4d4d8',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    padding: '5px 10px',
    borderRadius: 999,
    cursor: 'pointer',
    letterSpacing: '.04em',
  },
  composer: {
    display: 'flex',
    gap: 10,
    alignItems: 'stretch',
    paddingTop: 6,
    borderTop: '1px solid rgba(255,255,255,.05)',
  },
  textarea: {
    flex: 1,
    background: 'rgba(255,255,255,.025)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 14,
    color: '#fafafa',
    padding: '12px 14px',
    fontSize: 14,
    fontFamily: 'inherit',
    resize: 'none',
    minHeight: 56,
    outline: 'none',
  },
  submitBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 18px',
    background: 'var(--volt)',
    color: '#000',
    border: 'none',
    borderRadius: 14,
    fontWeight: 800,
    fontSize: 13,
    fontFamily: 'var(--font-display)',
    cursor: 'pointer',
    boxShadow: '0 0 22px rgba(210,240,0,.22)',
  },
  locked: {
    padding: 'clamp(20px, 4vw, 36px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 16,
  },
  lockedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    background: 'rgba(210,240,0,.1)',
    border: '1px solid rgba(210,240,0,.3)',
    color: 'var(--volt)',
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '.16em',
    borderRadius: 999,
  },
  lockedTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(22px, 3vw, 32px)',
    fontWeight: 800,
    color: '#fafafa',
    lineHeight: 1.2,
    margin: 0,
  },
  lockedBody: { color: '#a3a3a3', fontSize: 14, lineHeight: 1.6, maxWidth: 580, margin: 0 },
  lockedList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'grid',
    gap: 8,
    color: '#d4d4d8',
    fontSize: 13,
  },
  lockedActions: { display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  lockedCta: {
    background: 'var(--volt)',
    color: '#000',
    padding: '12px 22px',
    borderRadius: 999,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: 14,
    textDecoration: 'none',
    boxShadow: '0 0 26px rgba(210,240,0,.25)',
  },
  lockedSecondary: {
    color: '#d4d4d8',
    padding: '12px 8px',
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    letterSpacing: '.1em',
    textDecoration: 'none',
  },
};
