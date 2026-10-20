"use client";

// Ask Mobi, one panel (ASK-MOBI-1018). Mobi answers one question about what is in front of the student, from their own
// record, and ends with one next move. Top to bottom: header, context row (the subject chip and the record chip), the
// opening (a question's quote and its priced asks, or the free answer already there for a mock, Today or Practice), the
// answers, and the composer with the one wallet line. No tabs, switches or dropdowns before the first answer (D3, D6).
//
// Kept from R4 as it was: free answers from the record (answerFromInsights), the question hand-off (questionRef and
// /api/recovery/ask-context), the price shown before every paid reply (W-060), one request id per student action that is
// reused only after an unknown outcome so a retry can never charge twice, and the wallet broadcast to the top bar.
//
// v13 (C-dec 3 and 3b, D157): a written reply that opens a doubt is a finished job for 1 credit: Mobi's answer, one free
// follow-up (sent with the thread's id) and 2 new CUET-style questions answered right here (DoubtChecks). After the follow-up the
// panel offers "Ask a new doubt (1 credit)". "What should I revise tonight?" is read from the record by the server, free
// (replyKind 'tonight'). Every failure, and a full thread, says nothing was charged.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { walletFromResponse, isPaidUser } from '@/services/credits/aiWalletState';
import { announceWallet, cachedWallet } from '@/components/useWalletSummary';
import { answerFromInsights } from '../../../data/prepos_insights';
import { creditCount, usedLine, usesLine } from '@/lib/creditCopy.mjs';
import { useInsights } from './useInsights';
import { creditLine } from './askDoors.mjs';
import { planStart } from './startPlan.mjs';
import MobiMark from './MobiMark';
import { DoubtChecks, TonightBlock } from './MobiJobParts';
import { JOB_COPY, chatFailure, followUpOpen, isTonightAsk, threadFromReply } from './mobiJobs.mjs';
import {
  answerFree, inSentence, modeFor, openingFor, paidState, priceForText, productAskFor, recordSource, recordSummary, sessionsLabel,
  suggestionsFor,
} from './askSuggestions.mjs';

// Offline: a written reply needs a connection, so nothing is sent and nothing is charged; answers from the record already on
// screen still work.
const subscribeOnline = (cb) => { window.addEventListener('online', cb); window.addEventListener('offline', cb); return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); }; };
const onlineNow = () => navigator.onLine !== false;

const X = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>
);

export default function AskMobiPanel(props) {
  const { user } = useAuth();
  // Remount on account change so no transcript or wallet from another account survives.
  return <Panel key={user?.id || 'guest'} {...props} />;
}

function Panel({ context: opened, onClose, form = 'dock', titleId = 'ask-mobi-title', initial: given = null, doubt = null, onPending = null }) {
  const router = useRouter();
  const { user } = useAuth();
  // An Ask now starter hands over its chapter with the words, so the doubt's 2 questions come from that chapter.
  const initial = useMemo(() => (given && doubt ? { ...given, doubt } : given), [given, doubt]);
  const userId = user?.id || null;
  const pro = isPaidUser(user);
  const offline = !useSyncExternalStore(subscribeOnline, onlineNow, () => true);

  // On the /mentor page (form 'page') the panel is the conversation under Mobi's greeting: closing it is "Ask something new", and
  // leaving through a link never runs that reset.
  const onPage = form === 'page';
  const leave = () => { if (!onPage) onClose?.(); };
  const [context, setContext] = useState(opened);
  const [recordTry, setRecordTry] = useState(0);
  // The page hands over the record it has already read, so a doors ask never depends on a second read that can fail. Without
  // one (the docked panel), the panel reads the record itself.
  const handed = initial?.record && (initial.record.status === 'ready' || initial.record.status === 'empty') ? initial.record : null;
  const fetched = useInsights(handed ? null : userId, recordTry);
  const insightsState = handed || fetched;
  const status = insightsState.status;
  const insights = insightsState.insights;
  const [showRecord, setShowRecord] = useState(opened?.record === true);

  // The wallet: the balance this tab read in the last five minutes paints at once; the server's answer replaces it, and
  // every fresh read is announced so the top bar chip shows the same number (W-060).
  const [wallet, setWallet] = useState(null);
  const walletSequence = useRef(0);
  const readWallet = useCallback(async () => {
    const sequence = ++walletSequence.current;
    try {
      const res = await fetch('/api/ai/credits', { cache: 'no-store' });
      const data = await res.json();
      const next = walletFromResponse(data, { ok: res.ok });
      if (sequence === walletSequence.current) setWallet(next);
      announceWallet(userId, next);
    } catch { if (sequence === walletSequence.current) setWallet(walletFromResponse(null, { ok: false })); }
  }, [userId]);
  useEffect(() => {
    const fence = walletSequence;
    let active = true;
    const cached = cachedWallet(userId);
    if (userId) Promise.resolve().then(() => { if (!active) return; if (cached) setWallet((prev) => prev || cached); readWallet(); });
    return () => { active = false; fence.current++; };
  }, [readWallet, userId]);

  // A question handed over by its reference: its short context is read from the server (free). The reply is written about
  // that one question, so a typed ask with the question attached is always a written reply.
  const questionRef = context?.kind === 'question' ? context.ref : null;
  const [questionCtx, setQuestionCtx] = useState(questionRef ? { status: 'loading' } : null);
  useEffect(() => {
    if (!questionRef) return undefined;
    let alive = true;
    fetch(`/api/recovery/ask-context?q=${encodeURIComponent(questionRef)}`, { cache: 'no-store' })
      .then(async (res) => ({ res, data: await res.json().catch(() => null) }))
      .then(({ res, data }) => { if (alive) setQuestionCtx(res.ok && data?.ok ? { status: 'ready', ...data.context } : { status: 'error' }); })
      .catch(() => { if (alive) setQuestionCtx({ status: 'error' }); });
    return () => { alive = false; };
  }, [questionRef]);

  const withQuestion = Boolean(questionRef) && questionCtx?.status === 'ready';
  const opening = Boolean(questionRef) && questionCtx?.status === 'loading';
  const questionFailed = Boolean(questionRef) && questionCtx?.status === 'error';
  const chapter = context?.chapter || questionCtx?.chapter || null;
  const scoped = useMemo(() => ({ ...context, chapter }), [context, chapter]);
  const qName = context?.number ? `Q${context.number}` : 'this question';
  const paid = paidState(wallet);
  // A typed ask with the question attached is a written reply. When written replies cannot be bought, the composer asks
  // the record instead (free), and says so; it never claims the record can discuss the question.
  const questionTyping = withQuestion && (!wallet || paid.open);

  const [turns, setTurns] = useState([]);
  const [asked, setAsked] = useState([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(null);
  const [retry, setRetry] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  // The open doubt: { id, followUpsLeft, subject, chapter }. Its one follow-up is free; after it, a new doubt is 1 credit.
  const [doubtThread, setDoubtThread] = useState(null);
  const anchorRef = useRef(null);
  const inFlight = useRef(false);
  const pendingRef = useRef(null);
  const bodyRef = useRef(null);
  const fieldRef = useRef(null);

  // The free answer already there when Mobi opens from a mock, Today or Practice (no tap, no credit).
  const first = useMemo(() => openingFor({ context: scoped, insights, status, pro }), [scoped, insights, status, pro]);
  const asks = suggestionsFor({ context: scoped, insights, status, pro, asked, limit: turns.length || first ? 2 : 3 });
  const isNew = status === 'empty' && scoped.kind !== 'question';

  useEffect(() => {
    if (!turns.length && !pending) return;
    const node = bodyRef.current?.querySelector('[data-last]') || null;
    if (!node) return;
    let reduced = false;
    try { reduced = document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { reduced = true; }
    node.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [turns, pending]);

  function navigate(route) {
    if (!route) return;
    router.push(route);
    leave();
  }

  function logLocal(message, response) {
    fetch('/api/ai/mentor/local', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, message, response: { reply: response.reply, actions: response.actions, cards: [], confidence: 0, deterministic: true }, mode: 'guide' }) })
      .then((res) => res.json()).then((data) => { if (data?.sessionId) setSessionId(data.sessionId); }).catch(() => {});
  }

  function pushFree(label, answer) {
    const response = { reply: answer.reply, actions: (answer.actions || []).map((a) => ({ label: a.label, route: a.route })), origin: 'record', source: answer.source };
    setTurns((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text: label }, { id: `a_${Date.now()}`, role: 'assistant', response }]);
    logLocal(label, response);
  }

  function askRow(ask) {
    if (inFlight.current || pending || retry) return;
    if (ask.price !== 'free' && offline) return;
    setAsked((prev) => [...prev, ask.id]);
    if (ask.price === 'free') {
      const answer = answerFree(ask.id, { context: scoped, insights, pro });
      if (answer) { pushFree(ask.label, answer); return; }
    }
    sendPaid(ask.label);
  }

  function submit() {
    const text = input.trim();
    if (!text || inFlight.current || opening || retry) return;
    // An open doubt: the words are its free follow-up, never a record answer (talk inside a job is included).
    if (!questionTyping && followUpOpen(doubtThread)) {
      if (offline) return;
      setInput('');
      sendFree(text, 'followup');
      return;
    }
    const product = !questionTyping ? productAskFor(text) : null;
    if (product) { setInput(''); pushFree(text, answerFree(product, { context: scoped, insights, pro })); return; }
    // Questions about the student's own record are answered from the record: free, instant, no model. Never while a
    // question is attached and written replies are open: a record answer cannot discuss a question.
    const fromRecord = !questionTyping && (status === 'ready' || status === 'empty') ? answerFromInsights(text, insights ?? { state: 'empty' }, { pro }) : null;
    if (fromRecord) {
      setInput('');
      pushFree(text, { reply: fromRecord.reply, actions: (fromRecord.actions || []).slice(0, 1), source: recordSource(insights) });
      return;
    }
    // "What should I revise tonight?": the server reads it from the record, free.
    if (!questionTyping && isTonightAsk(text)) {
      if (offline) return;
      setInput('');
      sendFree(text, 'tonight');
      return;
    }
    if (!paid.open || offline) return;
    setInput('');
    sendPaid(text);
  }

  async function sendPaid(text, isRetry = false) {
    const finalText = String(text || '').trim();
    if (!finalText || inFlight.current || opening || (retry && !isRetry)) return;
    if (!isRetry && !paid.open) return;
    if (!isRetry && offline) return;
    inFlight.current = true;
    if (!isRetry) setTurns((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text: finalText }]);
    // One request id per student action. It is reused only if the last attempt ended with an unknown outcome (network
    // error), so a retry can never be charged twice. A new doubt opens a new thread, so the old one closes here.
    if (!isRetry) pendingRef.current = { message: finalText, id: crypto.randomUUID().replace(/-/g, ''), mode: modeFor(scoped.kind), questionRef: withQuestion ? questionRef : null, anchor: withQuestion ? null : takeAnchor(), kind: 'paid' };
    if (!isRetry && !pendingRef.current.questionRef) setDoubtThread(null);
    await deliver();
  }

  // The follow-up inside an open doubt, and tonight's set from the record: never charged (C-dec 3b). The same request-id
  // rule as a paid reply; Retry sends the same request.
  async function sendFree(text, kind) {
    const finalText = String(text || '').trim();
    if (!finalText || inFlight.current || opening || retry || offline) return;
    if (kind === 'followup' && !followUpOpen(doubtThread)) return;
    inFlight.current = true;
    setTurns((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text: finalText }]);
    pendingRef.current = { message: finalText, id: crypto.randomUUID().replace(/-/g, ''), mode: modeFor(scoped.kind), questionRef: null, anchor: null, kind, threadId: kind === 'followup' ? doubtThread.id : null };
    await deliver();
  }

  function takeAnchor() {
    const anchor = anchorRef.current;
    anchorRef.current = null;
    return anchor;
  }

  async function deliver() {
    const sent = pendingRef.current;
    setPending({ question: Boolean(sent.questionRef), free: sent.kind === 'followup' || sent.kind === 'tonight', kind: sent.kind });
    try {
      const res = await fetch('/api/ai/mentor/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        message: sent.message, mode: sent.mode, replyKind: replyKindOf(sent), sessionId, requestId: sent.id,
        ...(sent.threadId ? { threadId: sent.threadId } : {}),
        ...(sent.anchor?.subject ? { subject: sent.anchor.subject, ...(sent.anchor.chapter ? { chapter: sent.anchor.chapter } : {}) } : {}),
        ...(pendingRef.current.questionRef ? { questionRef: pendingRef.current.questionRef } : {}),
      }) });
      const data = await res.json();
      if (res.ok && !data?.response?.reply && !data?.reply) throw new Error('Reply outcome unreadable');
      const about = pendingRef.current.questionRef;
      pendingRef.current = null; // the server gave a definite answer
      setRetry(null);
      let response;
      if (res.ok) {
        const job = threadFromReply(data);
        response = { ...normalizeResponse({ ...(data.response || data), runtimeState: data.runtimeState }), about, followUp: sent.kind === 'followup', tonight: job.tonight };
        if (job.thread) {
          setDoubtThread(job.thread);
          // The reply that opened the doubt carries its 2 questions; a follow-up keeps the thread's own.
          if (!sent.threadId) Object.assign(response, { thread: job.thread, checks: job.checks, checksNote: job.checksNote });
        }
      } else {
        const failure = chatFailure(res.status, data);
        if (failure.full) setDoubtThread((t) => (t ? { ...t, followUpsLeft: 0 } : t));
        if (failure.gone) setDoubtThread(null);
        response = {
          reply: data.message || res.status === 429 || res.status === 402 ? failure.reply : 'Mobi could not answer just now. Nothing is charged for a reply that fails.',
          origin: 'status', actions: failure.actions,
        };
      }
      setTurns((prev) => [...prev, { id: `a_${Date.now()}`, role: 'assistant', response }]);
      if (data.sessionId) setSessionId(data.sessionId);
    } catch {
      setRetry({ ...pendingRef.current });
    } finally {
      setPending(null);
      inFlight.current = false;
      readWallet();
    }
  }

  // The /mentor doors hand the panel one ask to run as it opens: a starter, a typed doubt or a record question (the page's own
  // answer for "my last paper" comes with it). The same checks as typing here: a record answer waits for the record, a written
  // reply waits for the wallet, and nothing is sent unless the wallet is open and the connection is up. A reply that cannot go
  // says why, in the thread, and says that nothing was charged.
  // The page's Mobi thinks while a written reply is on its way.
  useEffect(() => { onPending?.(Boolean(pending)); }, [pending, onPending]);
  const started = useRef(false);
  const startNow = useRef(null);
  const [failedStart, setFailedStart] = useState(null);
  useEffect(() => {
    startNow.current = () => {
      if (!initial?.text || started.current) return;
      const plan = planStart({ initial, status, insights, pro, wallet, offline, paid });
      anchorRef.current = plan.anchor || null;
      const ask = (reply, actions = []) => setTurns((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text: plan.text }, { id: `a_${Date.now()}`, role: 'assistant', response: { reply, origin: 'status', actions } }]);
      if (plan.kind === 'none' || plan.kind === 'wait') return;
      started.current = true;
      if (plan.kind === 'page') pushFree(plan.text, initial.answer);
      else if (plan.kind === 'product') pushFree(plan.text, answerFree(plan.product, { context: scoped, insights, pro }));
      else if (plan.kind === 'record') pushFree(plan.text, plan.answer);
      else if (plan.kind === 'record-failed') {
        // A "Free" ask is never sent as a written reply: it says what happened, that nothing was charged, and offers Try again.
        const turnId = `u_${Date.now()}`;
        setTurns((prev) => [...prev, { id: turnId, role: 'user', text: plan.text }]);
        setFailedStart({ reply: plan.reply, turnId });
      } else if (plan.kind === 'say') ask(plan.reply, plan.actions);
      else if (plan.kind === 'tonight') sendFree(plan.text, 'tonight');
      else sendPaid(plan.text);
    };
  });
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) startNow.current?.(); });
    return () => { active = false; };
  }, [initial, status, wallet, offline]);
  function tryStartAgain() {
    const failed = failedStart;
    if (!failed) return;
    setFailedStart(null);
    setTurns((prev) => prev.filter((turn) => turn.id !== failed.turnId));
    started.current = false;
    // Handed a record: there is nothing to read again, so the ask runs again now. Otherwise the panel reads the record again,
    // and the ask runs when that read settles (its status changes, which re-runs the effect above).
    if (handed) window.setTimeout(() => startNow.current?.(), 0);
    else setRecordTry((n) => n + 1);
  }

  const dropQuestion = () => { setContext((prev) => ({ ...prev, kind: 'page', ref: null, number: null, pickLabel: null, keyLabel: null })); setQuestionCtx(null); setAsked([]); };
  const threadOpen = !questionTyping && followUpOpen(doubtThread);
  const threadDone = !questionTyping && Boolean(doubtThread) && !threadOpen;
  const price = threadOpen && input.trim() ? 'followup' : !questionTyping && isTonightAsk(input) ? 'free' : priceForText(input, { insights, status, pro, hasQuestion: questionTyping });
  const busy = Boolean(pending) || Boolean(retry);
  const canSend = Boolean(input.trim()) && !busy && !opening && (price === 'free' || (price === 'followup' && !offline) || (paid.open && !offline));
  // The credit line is the page's own words (askDoors.mjs creditLine), docked or on /mentor, so one balance reads one way
  // everywhere: "38 of your 50 free credits left · they refill on 1 Nov".
  const creditWords = creditLine(wallet).first;
  // The balance keeps its tick: the leading number is keyed, so amb-num replays when a credit is spent (release 10's motion).
  const balanceTick = /^(\d[\d,]*)([\s\S]*)$/.exec(creditWords || '');
  const placeholder = onPage ? 'Ask a follow-up' : questionTyping ? `Ask about ${qName}` : scoped.kind === 'mock' ? `Ask about ${inSentence(scoped.label)}` : 'Ask about your record';
  const sessions = sessionsLabel(insights, status);
  const summary = recordSummary(insights, { pro });
  const subjectChip = withQuestion || opening
    ? { name: qName, detail: chapter }
    : scoped.kind === 'mock' ? { name: scoped.label || 'This mock', detail: null }
      : scoped.kind === 'today' ? { name: 'Today', detail: null }
        : scoped.kind === 'practice' ? { name: 'Practice', detail: chapter }
          : null;
  const lastIndex = turns.length - 1;
  const fieldHint = threadOpen ? JOB_COPY.followUpPlaceholder : threadDone ? JOB_COPY.newDoubtPlaceholder : placeholder;
  const newDoubt = () => {
    if (onPage) { onClose?.(); return; }
    setDoubtThread(null);
    fieldRef.current?.focus();
  };

  return (
    <div className="amb" data-form={form}>
      <header className="amb-head">
        <MobiMark size={24} />
        <h2 id={titleId}>Ask Mobi</h2>
        {onPage
          ? <button type="button" className="amb-btn amb-btn--line amb-newask" onClick={onClose} disabled={Boolean(pending)}>Ask something new</button>
          : <button type="button" className="amb-icon" onClick={onClose} aria-label="Close Ask Mobi"><X /></button>}
      </header>

      <div className="amb-ctx">
        {subjectChip ? (
          <span className="amb-chip">
            <b>{subjectChip.name}</b>{subjectChip.detail ? <span><i aria-hidden="true">·</i> {subjectChip.detail}</span> : null}
            <button type="button" onClick={() => (withQuestion || opening ? dropQuestion() : setContext((prev) => ({ ...prev, kind: 'page', lines: [] })))} aria-label={`Stop asking about ${subjectChip.name}`}><X /></button>
          </span>
        ) : null}
        {status === 'unavailable' ? (
          <button type="button" className="amb-chip amb-chip--rec" onClick={() => setRecordTry((n) => n + 1)}>
            <b>Record not loaded</b><span><i aria-hidden="true">·</i> Retry</span>
          </button>
        ) : (
          <button type="button" className="amb-chip amb-chip--rec" aria-expanded={showRecord} aria-controls="amb-record" onClick={() => setShowRecord((v) => !v)} disabled={status === 'loading'}>
            <b>Your record</b><span><i aria-hidden="true">·</i> {status === 'loading' ? 'reading' : sessions}</span>
          </button>
        )}
      </div>

      <div className="amb-body" ref={bodyRef}>
        {showRecord && status !== 'loading' && status !== 'unavailable' ? (
          <section id="amb-record" className="amb-record amb-rise" aria-label="Your record">
            {summary.length ? (
              <dl>{summary.map((row) => <div key={row.id}><dt>{row.label}</dt><dd>{row.text}</dd></div>)}</dl>
            ) : <p>No sessions yet. After one session your record shows your marks ledger, your biggest leak and your pace.</p>}
            <Link href="/mentor?tab=record" className="amb-link" onClick={leave}>Full record</Link>
          </section>
        ) : null}

        {opening ? <p className="amb-quiet" role="status">Opening {qName}</p> : null}
        {questionFailed ? (
          <div className="amb-notice" role="status">
            <b>That question could not be opened.</b>
            <span>You can still ask about your record.</span>
            <button type="button" className="amb-btn amb-btn--line" onClick={dropQuestion}>Ask about my record</button>
          </div>
        ) : null}

        {withQuestion ? (
          <figure className="amb-quote" aria-label={`${qName}, the question you are asking about`}>
            <p>{questionCtx.question}</p>
            <figcaption>
              {questionCtx.pick ? <span className="amb-quote__pick">You picked <b>{questionCtx.pick.letter}{context.pickLabel ? `, ${context.pickLabel}` : ''}</b></span> : <span>You left it blank</span>}
              {questionCtx.hasKey
                ? (context.keyLabel ? <span className="amb-quote__key">Key <b>{context.keyLabel}</b></span> : null)
                : <span>The key is being re-checked, so Mobi will not name an answer.</span>}
            </figcaption>
          </figure>
        ) : null}

        {isNew && !turns.length && !initial ? (
          <div className="amb-new">
            {/* The real character, never cropped. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mascot/attentive.webp" alt="" width="104" height="118" />
            <p>Mobi answers from your own practice. After one session it can show where your marks went.</p>
            <button type="button" className="amb-btn amb-btn--line" onClick={() => navigate('/dashboard?mode=quick&count=10')}>Take a 10-question check</button>
          </div>
        ) : null}

        {first ? (
          <>
            <p className="amb-you">{first.ask}</p>
            <Answer response={{ reply: first.reply, actions: first.actions, origin: 'record', source: first.source }} onNavigate={navigate} />
          </>
        ) : null}

        {turns.map((turn, index) => turn.role === 'user'
          ? <p key={turn.id} className="amb-you amb-rise" data-last={index === lastIndex ? '' : undefined}>{turn.text}</p>
          : <Answer key={turn.id} response={turn.response} qName={qName} wallet={wallet} onNavigate={navigate} last={index === lastIndex} insights={insights} subjects={user?.subjects || []} offline={offline} />)}

        {failedStart ? (
          <div className="amb-notice" role="status" data-last="">
            <span>{failedStart.reply}</span>
            <button type="button" className="amb-btn amb-btn--line" onClick={tryStartAgain}>Try again</button>
          </div>
        ) : null}

        {pending ? (
          <p className="amb-reading" role="status" data-last="">
            <MobiMark size={20} blinking />
            {pending.question ? `Reading ${qName}, your pick and the key` : pending.kind === 'tonight' ? 'Reading your record for tonight' : onPage ? 'Writing a reply' : 'Reading your question and your record'}
          </p>
        ) : null}

        {threadDone && !pending && !retry ? (
          <div className="mj-next">
            <p className="mj-quiet">{JOB_COPY.settled}</p>
            <button type="button" className="amb-btn amb-btn--line" onClick={newDoubt}>{JOB_COPY.newDoubt}</button>
          </div>
        ) : null}

        {retry ? (
          <div className="amb-notice" role="alert" data-last="">
            <b>The reply could not be confirmed.</b>
            <span>Retry sends the same request, so you will not be charged twice. Your credits page shows any credit used.</span>
            <button type="button" className="amb-btn amb-btn--line" disabled={Boolean(pending)} onClick={() => sendPaid(retry.message, true)}>Retry this question</button>
          </div>
        ) : null}

        {/* Why the written asks wait (offline, paused or out of credits), in plain words, right above the rows it explains. */}
        {offline ? (
          <p className="amb-notice" role="status">
            <b>You are offline.</b>
            <span>Questions about your record still work. A written reply needs a connection, so nothing is sent and nothing is charged.</span>
          </p>
        ) : null}

        {!offline && (withQuestion || questionRef === null) && !paid.open && wallet && asks.some((a) => a.price === 'paid') && !busy ? (
          <p className="amb-notice" role="status">{paid.why}</p>
        ) : null}

        {!opening && !questionFailed && asks.length && !pending && !retry && !(initial && !turns.length) ? (
          <section className="amb-asks" aria-label={turns.length || first ? 'Ask next' : withQuestion ? 'Ask about this question' : 'You can ask now'}>
            <h3>{turns.length || first ? 'Ask next' : withQuestion ? 'Ask about this question' : 'You can ask now'}</h3>
            <ul>
              {asks.map((ask, i) => {
                const off = ask.price === 'paid' && (!paid.open || offline);
                return (
                  <li key={ask.id} style={{ '--i': i }}>
                    <button type="button" className="amb-ask" disabled={off} onClick={() => askRow(ask)}>
                      <b>{ask.label}</b>
                      {off ? <span>{offline && paid.open ? 'Needs a connection' : 'Needs a written reply'}</span> : ask.line ? <span>{ask.line}</span> : null}
                      <em data-price={ask.price}>{ask.price === 'free' ? 'Free' : creditCount(1)}</em>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

      </div>

      <form className="amb-compose" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <div className="amb-field">
          <label htmlFor="amb-input" className="sr-only">{fieldHint}</label>
          <textarea
            id="amb-input"
            ref={fieldRef}
            value={input}
            rows={1}
            maxLength={1500}
            placeholder={fieldHint}
            disabled={busy || opening}
            onChange={(event) => { setInput(event.target.value); grow(event.target); }}
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }}
          />
          <button type="submit" className="amb-send" disabled={!canSend}>Ask</button>
        </div>
        <div className="amb-cost">
          {/* The balance, with the wallet one tap away (the balance, its rules and the packs live there). */}
          <Link href="/wallet" className="amb-cost__wallet" onClick={leave}>
            {balanceTick ? <><b key={balanceTick[1]} className="amb-num">{balanceTick[1]}</b>{balanceTick[2]}</> : creditWords}
          </Link>
          <span className="amb-cost__price" aria-live="polite">
            {pending && onPage ? (pending.free ? 'This one is free. Nothing is charged.' : 'This reply uses 1 credit. A reply that fails uses none.') : threadOpen ? JOB_COPY.followUpFree : !price ? 'Record questions are free' : price === 'free' ? 'Free, from your record' : offline ? 'Needs a connection. Nothing is charged.' : paid.open ? `An AI service writes it. ${usesLine({ what: 'This reply', cost: 1, pool: 'ai' })}` : 'Needs a written reply. Nothing is charged from here.'}
          </span>
        </div>
      </form>
    </div>
  );
}

// What the chat route is asked for: tonight's set from the record, the follow-up of an open doubt, a reply about one question,
// or a doubt (an Ask now question; the server opens its thread and never answers it from the record's keywords).
function replyKindOf(sent) {
  if (sent.kind === 'tonight') return 'tonight';
  if (sent.kind === 'followup' || sent.questionRef) return 'model';
  return 'doubt';
}

function grow(node) {
  if (!node) return;
  node.style.height = 'auto';
  node.style.height = `${Math.min(node.scrollHeight, 120)}px`;
}

function Answer({ response, qName = 'this question', wallet = null, onNavigate, last = false, insights = null, subjects = [], offline = false }) {
  const tonight = Boolean(response.tonight);
  const next = tonight ? null : response.actions?.[0];
  let source = response.source || null;
  if (response.origin === 'model') {
    const what = response.about ? `Written reply on ${qName} and its key` : 'Written reply';
    const spent = response.charged ? usedLine({ cost: response.charged, pool: 'ai', balance: wallet?.known ? wallet.total : null }) : 'No credit used.';
    source = response.followUp && !response.charged ? JOB_COPY.followUpSource : `${what}. ${spent}`;
  } else if (response.origin === 'status') source = null;
  else if (tonight) source = JOB_COPY.tonightSource;
  else if (!source) source = 'From your record';
  if (response.origin === 'status') {
    return (
      <div className="amb-notice amb-rise" role="status" data-origin="status" data-last={last ? '' : undefined}>
        {String(response.reply || '').split(/\n{2,}/).map((para, i) => <span key={i}>{para}</span>)}
        {next ? <button type="button" className="amb-btn amb-btn--line" onClick={() => onNavigate(next.route || next.target)}>{next.label}</button> : null}
      </div>
    );
  }
  return (
    <div className="amb-ans amb-rise" data-origin={response.origin} data-last={last ? '' : undefined}>
      {String(response.reply || '').split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
      {tonight ? <TonightBlock tonight={response.tonight} actions={response.actions} onNavigate={onNavigate} /> : null}
      {response.thread ? (
        <DoubtChecks
          threadId={response.thread.id} checks={response.checks || []} note={response.checksNote || null}
          subject={response.thread.subject} chapter={response.thread.chapter} insights={insights} subjects={subjects} offline={offline}
        />
      ) : null}
      {source ? <span className="amb-src"><MobiMark size={15} />{source}</span> : null}
      {next ? <button type="button" className="amb-btn amb-btn--line" onClick={() => onNavigate(next.route || next.target)}>{next.label}</button> : null}
    </div>
  );
}

function normalizeResponse(response) {
  const r = response && typeof response === 'object' ? response : {};
  const actions = Array.isArray(r.actions) ? r.actions.filter((a) => a && (a.route || a.target) && a.label) : [];
  return {
    reply: String(r.reply || ''), actions,
    origin: r.origin || (r.runtimeState === 'live' || r.charge?.kind === 'prepos_credit' ? 'model' : r.runtimeState === 'record' ? 'record' : r.runtimeState === 'paused' ? 'status' : null),
    charged: Math.max(0, Number(r.charge?.amount) || 0),
  };
}
