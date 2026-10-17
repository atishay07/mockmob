"use client";

// PrepOS is an explanation layer. It shows the same server-generated next action as Today,
// Radar and results (GET /api/learning/plan), answers product questions, and shows the
// PrepOS wallet read-only. It does not build missions, day plans, setup schedules,
// benchmark entitlements or credit purchases of its own.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icons';
import { useAuth } from '@/components/AuthProvider';
import { FEATURE_GUIDE, deterministicReplyFor, pageHelpForPath } from './assistantKnowledge';
import { walletFromResponse, isPaidUser } from '@/services/credits/aiWalletState';
import { CreditAmount } from '@/components/ui/Glyph';
import { announceWallet, cachedWallet } from '@/components/useWalletSummary';
import { answerFromInsights } from '../../../data/prepos_insights';
import RecordView from './RecordView';
import ArenaHead from '@/components/arena/ArenaHead';
import FirstTime from '@/components/arena/FirstTime';
import { PrepOSOrb } from '@/components/ui/PrepOSOrb';
import { useInsights } from './useInsights';
import { POOL_USE, usedLine, usesLine } from '@/lib/creditCopy.mjs';
import { Listbox } from '@/components/ui/controls/Listbox';
import './prepos.css';

// What a written-guidance reply concentrates on (the model request's mode).
const FOCUS_OPTIONS = [
  { value: 'mentor', label: 'Explain my next step' },
  { value: 'revision', label: 'Reason through a concept' },
  { value: 'autopsy', label: 'Reflect on my session' },
  { value: 'mock_plan', label: 'Plan a practice approach' },
];

const SECTIONS = [
  { id: 'plan', label: 'Next step' },
  { id: 'record', label: 'Your record' },
  { id: 'ask', label: 'Ask' },
  { id: 'tools', label: 'AI credits' },
];
const MINUTES = [10, 20, 30];

export default function MockMobAIHub(props) {
  const { user } = useAuth();
  // Remount on account change so no plan, transcript or wallet from another account survives.
  return <Hub key={user?.id || 'guest'} {...props} />;
}

function Hub({ variant = 'drawer', initialTab = 'plan', onClose }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const isAuthenticated = Boolean(user?.id);
  const userId = user?.id || null;
  const pro = isPaidUser(user);
  const isDrawer = variant === 'drawer';
  // The full-page console honours ?tab=record; the drawer ignores the host page's query string.
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  // "Ask Mobi about this question" (from a repair): /mentor?tab=ask&q=<attemptId>:<questionId>. Page only, like ?tab.
  const questionRef = variant === 'page' ? searchParams.get('q') : null;
  const wanted = variant === 'page' && requestedTab ? requestedTab : initialTab;
  const [section, setSection] = useState(SECTIONS.some((s) => s.id === wanted) ? wanted : wanted === 'guide' ? 'tools' : 'plan');
  const insightsState = useInsights(user?.id);
  const [wallet, setWallet] = useState(null);
  const walletSequence = useRef(0);
  const readWallet = useCallback(async () => {
    const sequence = ++walletSequence.current;
    try {
      const res = await fetch('/api/ai/credits', { cache: 'no-store' });
      const data = await res.json();
      const next = walletFromResponse(data, {ok:res.ok});
      if (sequence === walletSequence.current) setWallet(next);
      // The top bar chip and Account take the same balance at once (W-060), so no screen shows a stale number.
      announceWallet(userId, next);
    } catch { if (sequence === walletSequence.current) setWallet(walletFromResponse(null,{ok:false})); }
  }, [userId]);
  useEffect(() => {
    const fence = walletSequence;
    let active = true;
    // The balance this tab read in the last five minutes paints at once; the server's answer replaces it.
    const cached = cachedWallet(userId);
    if (isAuthenticated) Promise.resolve().then(() => { if (!active) return; if (cached) setWallet((prev) => prev || cached); readWallet(); });
    return () => { active = false; fence.current++; };
  }, [isAuthenticated, readWallet, userId]);
  const firstName = useMemo(() => String(user?.name || '').trim().split(/\s+/)[0] || '', [user?.name]);

  const shellClass = isDrawer
    ? 'arena-dark-island flex h-full min-h-0 flex-col bg-[#090a08] text-zinc-100'
    : 'arena-dark-island flex min-h-[640px] w-full max-w-4xl flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#090a08] text-zinc-100';

  function navigate(route) {
    if (!route) return;
    router.push(route);
    onClose?.();
  }

  return (
    <>{!isDrawer && <ArenaHead title="Ask Mobi" lede="The same next action as Today, with the reasoning from your recorded practice." />}{!isDrawer && isAuthenticated ? <FirstTime id="ask-mobi">Start with Ask and a question about your own record, like “Where am I losing marks?”. Those answers are free. A written reply costs 1 AI credit, and the cost shows before you send.</FirstTime> : null}<div className={`prepos-console ${shellClass}`}>
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-6">
        <PrepOSOrb size={40} />
        <div className="min-w-0">
          <div className="font-display text-lg font-black text-zinc-50">Ask Mobi</div>
          <p className="text-xs text-zinc-400">Your practice record. One useful next move.</p>
        </div>
        {isDrawer && onClose ? (
          <button type="button" onClick={onClose} aria-label="Close Ask Mobi" className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-xl border border-white/10 text-zinc-300 hover:border-white/25 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt">
            <Icon name="x" />
          </button>
        ) : null}
      </header>

      <nav className="flex gap-1 border-b border-white/10 px-2 md:px-4" aria-label="Ask Mobi sections">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={section === s.id}
            onClick={() => setSection(s.id)}
            className={`min-h-[44px] px-3 text-sm font-semibold border-b-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt ${section === s.id ? 'border-volt text-zinc-50' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
        {!isAuthenticated ? (
          <SignedOut onNavigate={navigate} />
        ) : section === 'plan' ? (
          <PlanSection firstName={firstName} onNavigate={navigate} insightsState={insightsState} onInspect={() => setSection('record')} onAsk={() => setSection('ask')} />
        ) : section === 'record' ? (
          <RecordView state={insightsState} onNavigate={navigate} pro={pro} />
        ) : section === 'tools' ? (
          <ToolsSection onNavigate={navigate} />
        ) : null}
        {isAuthenticated ? <div hidden={section !== 'ask'}><AskSection pathname={pathname} onNavigate={navigate} insightsState={insightsState} pro={pro} wallet={wallet} readWallet={readWallet} questionRef={questionRef} /></div> : null}
      </div>
    </div></>
  );
}

function SignedOut({ onNavigate }) {
  return (
    <div className="grid gap-3">
      <p className="text-sm text-zinc-300">Mobi explains your next step from your own practice record, so it needs an account.</p>
      <button type="button" className="btn-volt md self-start" onClick={() => onNavigate('/signup?source=prepos')}>Create a free account</button>
    </div>
  );
}

function PlanSection({ firstName, onNavigate, insightsState, onInspect, onAsk }) {
  const [minutes, setMinutes] = useState(10);
  const [plan, setPlan] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let alive = true;
    const id = window.setTimeout(() => {
      setStatus('loading');
      fetch(`/api/learning/plan?minutes=${minutes}`, { cache: 'no-store' })
        .then(async (res) => {
          const body = await res.json().catch(() => null);
          if (!alive) return;
          if (!res.ok || !body?.primary) throw new Error('plan_unavailable');
          setPlan(body);
          setStatus('ready');
        })
        .catch(() => { if (alive) { setPlan(null); setStatus('error'); } });
    }, 0);
    return () => { alive = false; window.clearTimeout(id); };
  }, [minutes]);

  return (
    <section className="pp-plan grid gap-4" aria-label="Your next step">
      <h2 className="font-display text-2xl font-extrabold text-zinc-50">{firstName ? `${firstName}, here is your next step.` : 'Here is your next step.'}</h2>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold text-zinc-300">Time you have</legend>
        <div className="flex flex-wrap gap-2">
          {MINUTES.map((m) => (
            <button key={m} type="button" aria-pressed={minutes === m} onClick={() => setMinutes(m)}
              className={`min-h-[44px] rounded-xl border px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt ${minutes === m ? 'border-volt bg-volt text-black' : 'border-white/15 text-zinc-200 hover:border-white/30'}`}>
              {m} minutes
            </button>
          ))}
        </div>
      </fieldset>

      <div role="status" aria-live="polite">
        {status === 'loading' && <p className="text-sm text-zinc-400">Loading your next step…</p>}
        {status === 'error' && (
          <div className="grid gap-2">
            <p className="text-sm text-zinc-300">Your plan could not be loaded. Your saved attempts are still in Review.</p>
            <button type="button" className="btn-outline sm self-start" onClick={() => onNavigate('/review')}>Open Review</button>
          </div>
        )}
      </div>

      {status === 'ready' && plan ? (
        <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs font-semibold text-zinc-400">The same step as Today, planned for {plan.minutes || minutes} minutes</div>
          <h3 className="font-display text-xl font-bold text-zinc-50">{plan.primary.title}</h3>
          <p className="text-sm leading-6 text-zinc-300">{plan.primary.reason}</p>
          {plan.primary.facts?.some((f) => f.basis === 'record') ? (
            <div className="pp-facts">
              <h4>Why this step</h4>
              <ul>
                {plan.primary.facts.filter((f) => f.basis === 'record').map((f) => (
                  <li key={f.text}>{f.text}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <button type="button" className="btn-outline md self-start" onClick={() => onNavigate(plan.primary.href)}>
            {plan.primary.title}
          </button>
          {plan.alternatives?.length ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {plan.alternatives.slice(0, 2).map((a) => (
                <button key={a.kind} type="button" className="btn-outline sm" onClick={() => onNavigate(a.href)}>{a.title}</button>
              ))}
            </div>
          ) : null}
          <p className="text-xs leading-5 text-zinc-400">
            This step comes from your practice record. Showing it uses no AI credits.
          </p>
        </div>
      ) : null}
      <section className="pp-evidence" aria-label="Why this step">
        <div className="pp-evidence__head"><span>From your recorded practice</span><button type="button" onClick={onInspect}>Inspect your record</button></div>
        {insightsState.status === 'ready' && insightsState.findings?.[0] ? <><p>From {insightsState.insights?.sessions} recorded sessions: chapter marks, pace and changed answers.</p><button type="button" className="pp-evidence__go" onClick={() => onNavigate('/analytics')}>See what stands out on Weak chapters</button></> : <p>{insightsState.status === 'error' ? 'Your record could not be read. The next step above has its own availability check.' : insightsState.status === 'loading' ? 'Reading your recorded sessions…' : 'Take a session first. Mobi will explain what your record shows, without inventing a weak chapter.'}</p>}
      </section>
      <div className="pp-plan__handoff"><span>Want to understand the choice?</span><button type="button" onClick={onAsk}>Ask Mobi</button></div>
    </section>
  );
}

function AskSection({ pathname, onNavigate, insightsState, pro, wallet, readWallet, questionRef = null }) {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  // A question handed over from a repair: its short context is read from the server (free), and the reply is written about
  // that one question. Written guidance only (a record answer cannot discuss a question), so the cost line shows at once.
  const [questionCtx, setQuestionCtx] = useState(questionRef ? { status: 'loading' } : null);
  const [kind, setKind] = useState(questionRef ? 'model' : 'record');
  const [mode, setMode] = useState('mentor');
  const [retry, setRetry] = useState(null);
  const inFlight = useRef(false);
  const transcriptRef = useRef(null);
  const askRef = useRef(null);
  const arrived = useRef(false);
  const pendingRef = useRef(null);
  const current = useMemo(() => pageHelpForPath(pathname), [pathname]);

  useEffect(() => {
    let alive = true;
    fetch('/api/ai/mentor/history', { cache: 'no-store' })
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (!alive || !res.ok || !data?.ok) return;
        setSessionId((previous) => previous || data.session?.id || null);
        setMessages((previous) => previous.length ? previous : (data.messages || []).map((row) => row.role === 'assistant'
          ? { id: row.id, role: 'assistant', response: normalizeResponse(row.response || { reply: row.text }) }
          : { id: row.id, role: 'user', text: row.text || '' }));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!questionRef) return undefined;
    let alive = true;
    fetch(`/api/recovery/ask-context?q=${encodeURIComponent(questionRef)}`, { cache: 'no-store' })
      .then(async (res) => ({ res, data: await res.json().catch(() => null) }))
      .then(({ res, data }) => { if (alive) setQuestionCtx(res.ok && data?.ok ? { status: 'ready', ...data.context } : { status: 'error', message: data?.message || 'That question could not be opened.' }); })
      .catch(() => { if (alive) setQuestionCtx({ status: 'error', message: 'That question could not be opened.' }); });
    return () => { alive = false; };
  }, [questionRef]);

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages, pending]);

  const withQuestion = questionCtx?.status === 'ready';
  // Arriving from a repair with a question: bring the question card and the composer into view once, so the student can
  // type without first scrolling past the page head. Instant under reduced motion.
  useEffect(() => {
    if (!withQuestion || arrived.current || !askRef.current) return;
    arrived.current = true;
    let reduced = false;
    try { reduced = document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { reduced = true; }
    askRef.current.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
  }, [withQuestion]);
  // While the handed-over question is still being opened, nothing is sent: a reply sent now would go without it and still cost a credit.
  const opening = questionCtx?.status === 'loading';
  // A handed-over question can only be answered by a written reply. When written replies cannot be bought (paused, no credits,
  // credits unreadable) Mobi cannot answer it, so the screen says that once, and offers the record instead. It never says the
  // question can be asked about for free: a record answer cannot discuss a question.
  const blockedQuestion = withQuestion && Boolean(wallet) && wallet.state !== 'available';

  async function send(text = input, isRetry = false) {
    const finalText = String(text || '').trim();
    if (!finalText || inFlight.current || opening || (retry && !isRetry)) return;
    inFlight.current = true;
    setInput('');
    if (!isRetry) setMessages((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text: finalText }]);
    // Questions about the student's own record are answered from the record: free, instant, no model.
    const fromRecord = !isRetry && !withQuestion && (insightsState?.status === 'ready' || insightsState?.status === 'empty')
      ? answerFromInsights(finalText, insightsState.insights ?? { state: 'empty' }, { pro })
      : null;
    const local = isRetry || withQuestion ? null : fromRecord ? { ...fromRecord, origin:'record', cards: [], confidence: 0, deterministic: true } : kind === 'record' ? deterministicReplyFor({ text: finalText, pathname }) : null;
    if (local) {
      setMessages((prev) => [...prev, { id: `a_${Date.now()}`, role: 'assistant', response: {...local,origin:'record'} }]);
      fetch('/api/ai/mentor/local', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, message: finalText, response: local, mode: 'guide' }) })
        .then((res) => res.json()).then((data) => { if (data?.sessionId) setSessionId(data.sessionId); }).catch(() => {});
      inFlight.current = false; return;
    }
    setPending(true);
    // One request id per student action. It is reused only if the last attempt ended with an
    // unknown outcome (network error), so a retry can never be charged twice.
    if (!isRetry) pendingRef.current = { message: finalText, id: crypto.randomUUID().replace(/-/g, ''), mode, kind, questionRef: withQuestion ? questionRef : null };
    try {
      const res = await fetch('/api/ai/mentor/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: finalText, mode: pendingRef.current.mode, replyKind:pendingRef.current.kind, sessionId, requestId: pendingRef.current.id, ...(pendingRef.current.questionRef ? { questionRef: pendingRef.current.questionRef } : {}) }) });
      const data = await res.json();
      if (res.ok && !data?.response?.reply && !data?.reply) throw new Error('Reply outcome unreadable');
      pendingRef.current = null; // the server gave a definite answer
      setRetry(null);
      const response = res.ok ? normalizeResponse({...(data.response || data), runtimeState:data.runtimeState}) : {
        reply: data.message || (res.status === 429 ? 'Too many questions in a short time. Wait a minute and try again.' : 'Mobi could not answer just now. Check your AI credits for the outcome.'),
        origin:'status', actions: res.status === 402 ? [{ label: 'See your AI credits', type: 'navigate', route: '/pricing/ai-credits' }] : [{ label: 'Open Today', type: 'navigate', route: '/today' }],
      };
      setMessages((prev) => [...prev, { id: `a_${Date.now()}`, role: 'assistant', response }]);
      if (data.sessionId) setSessionId(data.sessionId);
    } catch {
      setRetry({...pendingRef.current});
    } finally {
      setPending(false);
      inFlight.current = false;
      readWallet();
    }
  }

  return (
    <section className="pp-ask" ref={askRef} aria-label="Ask Mobi">
      <div className="pp-ask__heading"><div><h2>Ask Mobi</h2></div><span className="pp-ask__balance">{wallet?.known ? `${wallet.total} AI credits` : wallet ? 'AI credits unavailable' : 'Reading AI credits…'}</span></div>
      {questionCtx ? <QuestionContext ctx={questionCtx} blocked={blockedQuestion} costLine={withQuestion && !blockedQuestion && wallet?.state==='available' ? usesLine({ what: 'One written reply', cost: 1, pool: 'ai', balance: wallet.total }) : null} onDrop={() => { setQuestionCtx(null); setKind('record'); }} /> : null}
      {blockedQuestion || withQuestion ? null : <div className="pp-ask__switch" role="group" aria-label="Reply source"><button type="button" aria-pressed={kind==='record'} disabled={pending || Boolean(retry) || withQuestion} onClick={()=>setKind('record')}>About your marks <small>Free</small></button><button type="button" aria-pressed={kind==='model'} disabled={pending || Boolean(retry)} onClick={()=>setKind('model')}>Written guidance <small>1 AI credit</small></button></div>}
      {blockedQuestion || (withQuestion && wallet?.state==='available') ? null : kind==='model' ? <div className="pp-ask__service" role="status"><b>{wallet?.state==='available' ? usesLine({ what: 'One written reply', cost: 1, pool: 'ai', balance: wallet.total }) : wallet?.state==='paused' ? 'Written guidance is paused.' : wallet?.state==='empty' ? `You have no AI credits left. ${POOL_USE.ai}` : 'Written guidance is unavailable until your AI credits can be read.'}</b><p>{wallet?.state==='available' ? (withQuestion ? 'The reply is guidance on this question, not a verified answer key.' : 'Your record is the context. The reply is guidance, not a verified answer key or an admission prediction.') : 'You can still ask about your recorded practice for free. Existing purchased credits are preserved.'}</p>{wallet?.state==='available' && !withQuestion ? <div className="pp-ask__focus"><span id="prepos-focus-label">Focus</span><Listbox id="prepos-focus" labelledBy="prepos-focus-label" sheetTitle="Focus" size="sm" value={mode} disabled={pending || Boolean(retry)} onChange={setMode} options={FOCUS_OPTIONS} /></div> : null}</div> : <p className="pp-note">Answers use your recorded sessions and product rules. No model call, no AI credits.</p>}
      <div ref={transcriptRef} className={`pp-transcript${messages.length === 0 && (withQuestion || opening) ? ' pp-transcript--fit' : ''}`} aria-live="polite" aria-busy={pending}>
        {messages.length === 0 && withQuestion && !blockedQuestion && <div className="pp-ask__empty"><p>Ask about the mistake above. Your reply uses its text, your pick, the key and your rule, and nothing else about you.</p></div>}
        {messages.length === 0 && !withQuestion && <div className="pp-ask__empty"><p>Start with something your record can answer.</p><div className="pp-ask__suggestions">{['Where am I losing marks?', 'Which chapter should I practise?', 'Am I spending too long?'].map(text=><button type="button" key={text} onClick={()=>send(text)} disabled={kind==='model' && wallet?.state!=='available'}>{text}</button>)}</div><small>{current.title}: {current.body}</small></div>}
        {messages.map((m) => m.role === 'user' ? (
          <p key={m.id} className="justify-self-end max-w-[85%] rounded-2xl bg-white/[0.06] px-3 py-2 text-sm text-zinc-100">{m.text}</p>
        ) : (
          <div key={m.id} className="pp-response" data-origin={m.response.origin}>
            <span className="pp-response__source">{m.response.origin==='model' ? 'Mobi, written guidance' : m.response.origin==='record' ? 'From your record, no credits' : m.response.origin==='status' ? 'Service status' : 'Earlier reply, source not recorded'}</span>
            <p>{m.response.reply}</p>
            {m.response.origin==='model' ? <small>{m.response.charged ? usedLine({ cost: m.response.charged, pool: 'ai', balance: wallet?.known ? wallet.total : null }) : 'Check your AI credits for the final charge.'}</small> : null}
            {m.response.actions?.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {m.response.actions.slice(0, 2).map((a) => (
                  <button key={`${a.label}-${a.route}`} type="button" className="btn-outline sm" onClick={() => onNavigate(a.route || a.target)}>{a.label}</button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {pending && <p className="text-sm text-zinc-400" role="status">Mobi is reading your practice record…</p>}
      </div>
      {retry ? <div className="pp-ask__service" role="alert"><b>The reply outcome could not be confirmed.</b><p>Retry the same request to avoid a second charge. Your AI credits page is the record of any credit used.</p><button type="button" className="btn-outline sm" disabled={pending} onClick={()=>send(retry.message,true)}>Retry this question</button></div> : null}
      {blockedQuestion ? null : <form className="pp-composer" onSubmit={(event) => { event.preventDefault(); send(); }}>
        <label htmlFor="prepos-input" className="sr-only">Ask Mobi</label>
        <textarea id="prepos-input" value={input} maxLength={1500} rows={2} disabled={pending || opening || Boolean(retry) || (kind==='model' && wallet?.state!=='available')} onChange={(event) => setInput(event.target.value)} placeholder={withQuestion ? 'What about this mistake is unclear?' : kind==='record' ? 'What does my record show?' : 'What would you like to reason through?'} />
        <div><span>{kind==='record' ? 'Free, from your recorded facts' : usesLine({ what: 'This reply', cost: 1, pool: 'ai', balance: wallet?.known ? wallet.total : null })}</span><button type="submit" className="btn-volt sm" disabled={pending || opening || Boolean(retry) || !input.trim() || (kind==='model' && wallet?.state!=='available')}>{pending ? 'Reading…' : kind==='record' ? 'Ask Mobi, free' : 'Ask Mobi, 1 AI credit'}</button></div>
      </form>}
    </section>
  );
}

function QuestionContext({ ctx, onDrop, blocked = false, costLine = null }) {
  if (ctx.status === 'loading') return <p className="pp-note" role="status">Opening your question…</p>;
  if (ctx.status === 'error') return <div className="pp-ask__service pp-ask__service--q" role="status"><b>{ctx.message}</b><p>You can still ask about your recorded practice.</p><button type="button" className="btn-outline sm" onClick={onDrop}>Ask about my record</button></div>;
  return (
    <div className="pp-ask__service pp-ask__service--q" role="status" aria-label="The mistake you are asking about">
      <b>About the mistake you repaired{ctx.chapter ? `, ${ctx.chapter}` : ''}</b>
      <p>{ctx.question}{ctx.question && ctx.question.length >= 160 ? '…' : ''}</p>
      {ctx.pick ? <p>You picked {ctx.pick.letter}.{ctx.hasKey ? '' : ' The key is being re-checked, so Mobi will not name an answer.'}</p> : null}
      {ctx.rule ? <p>Your rule: {ctx.rule}</p> : null}
      {blocked ? <p className="pp-ask__blocked"><b>Mobi cannot answer this question right now. Nothing was charged.</b></p> : null}
      {costLine ? <p className="pp-ask__qcost"><b>{costLine}</b> The reply is guidance on this question, not a verified answer key.</p> : null}
      <button type="button" className="btn-outline sm" onClick={onDrop}>{blocked ? 'Ask about my record' : 'Ask something else'}</button>
    </div>
  );
}

function ToolsSection({ onNavigate }) {
  const [wallet, setWallet] = useState(null);
  const [practice, setPractice] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/ai/credits', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!alive) return;
        setWallet(walletFromResponse(data, { ok: res.ok }));
        setPractice(res.ok ? data?.practiceCredits || null : null);
      })
      .catch(() => { if (alive) setWallet(walletFromResponse(null, { ok: false })); });
    return () => { alive = false; };
  }, []);

  return (
    <section className="grid gap-5" aria-label="Tools and AI credits">
      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4" role="status" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <div className="font-display text-base font-bold text-zinc-50">AI credits</div>
          {wallet?.known ? <CreditAmount kind="prepos" amount={wallet.total} unit={false} /> : null}
        </div>
        {!wallet ? (
          <p className="text-sm text-zinc-400">Reading your AI credits…</p>
        ) : (
          <>
            {wallet.message ? <p className="text-sm text-zinc-200">{wallet.message}</p> : null}
            {wallet.known ? (
              <>
                <div className="pp-meter">
                  <div className="pp-meter__row"><span>Included this month</span><b>{wallet.includedRemaining} of {wallet.includedMonthlyCredits} left</b></div>
                  <meter min={0} max={Math.max(1, wallet.includedMonthlyCredits)} value={wallet.includedRemaining} aria-label={`Included AI credits left this month: ${wallet.includedRemaining} of ${wallet.includedMonthlyCredits}`} />
                  {wallet.resetAt ? <small>Resets {new Date(wallet.resetAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}. Unused included credits do not carry over.</small> : null}
                </div>
                <dl className="grid grid-cols-2 gap-2 text-center">
                  <WalletFigure label="Purchased, never expire" value={wallet.bonusCredits} />
                  <WalletFigure label="Total available" value={wallet.total} />
                </dl>
              </>
            ) : null}
            <p className="text-xs leading-5 text-zinc-400">
              {wallet.state === 'paused'
                ? 'New top-ups are paused. Purchased credits are preserved and do not expire.'
                : 'AI credits are separate from practice credits.'}
              {practice ? ` ${practice.label}: ${practice.balance}.` : ''}
            </p>
          </>
        )}
      </div>

      <div className="pp-rules">
        <div><b>Free, no credits</b><span>Your marks ledger, top chapters, weekly summary, answers about your marks, the next step, DU eligibility and cutoffs. Pro adds every ranked chapter, pace and changed-answer detail.</span></div>
        <div><b>Costs 1 AI credit</b><span>An optional written reply that goes beyond your record. A reply that fails costs nothing; the credit returns automatically.</span></div>
        <div><b>Your allowance</b><span>10 AI credits a month on Free, 50 on Pro. Separate from practice credits.</span></div>
      </div>

      <div className="grid gap-2">
        <div className="font-display text-base font-bold text-zinc-50">Tools</div>
        {FEATURE_GUIDE.map((f) => (
          <div key={f.key} className="grid gap-1 rounded-2xl border border-white/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-zinc-100">{f.name}</span>
              <Link href={f.route} onClick={(event) => { event.preventDefault(); onNavigate(f.route); }} className="text-xs font-bold text-volt underline-offset-2 hover:underline">{f.actionLabel}</Link>
            </div>
            <p className="text-xs leading-5 text-zinc-400">{f.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function WalletFigure({ label, value }) {
  return (
    <div className="rounded-xl bg-black/30 p-2">
      <dt className="text-[11px] text-zinc-400">{label}</dt>
      <dd className="font-display text-lg font-bold text-zinc-50" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</dd>
    </div>
  );
}

function normalizeResponse(response) {
  const r = response && typeof response === 'object' ? response : {};
  const actions = Array.isArray(r.actions) ? r.actions.filter((a) => a && (a.route || a.target) && a.label) : [];
  return { reply: String(r.reply || ''), actions, origin:r.origin || (r.runtimeState==='live' || r.charge?.kind==='prepos_credit' ? 'model' : r.runtimeState==='record' ? 'record' : r.runtimeState==='paused' ? 'status' : null), charged:Math.max(0,Number(r.charge?.amount)||0) };
}
