"use client";

// Ask Mobi (web IA plan 2.2 Review and section 6). One surface, one job: ask about your own record.
//   From your record   free, answered from your recorded sessions, no model
//   Written reply      one optional model reply, 1 AI credit (the cost comes from data/plan_facts.mjs)
// It is the Assistant of section 6: no Next step tab (that is Today), no Your record tab (that is /analytics),
// no tools list (that is You), and no terminal styling: it sits on the shared surfaces like every page.
// The numbers and the words about cost come from askMobiModel.mjs; the wallet is read, never written, here.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { walletFromResponse, isPaidUser } from '@/services/credits/aiWalletState';
import { answerFromInsights } from '../../../data/prepos_insights';
import MobiReact from '@/components/brand/MobiReact';
import { useShrug } from '@/lib/mobiHooks';
import { PLAN_HREF } from '@/lib/navigation';
import { deterministicReplyFor, pageHelpForPath } from './assistantKnowledge';
import { useInsights } from './useInsights';
import {
  ASK_COPY, FOCUS_OPTIONS, REPLY_KINDS, SUGGESTIONS, canWriteReply, composerHint, failureReply, plainServerText,
  replySource, sendLabel, walletLine, writtenReplyNotice,
} from './askMobiModel.mjs';
import './askmobi.css';

export default function MockMobAIHub(props) {
  const { user } = useAuth();
  // Remount on account change so no transcript or wallet from another account survives.
  return <Hub key={user?.id || 'guest'} {...props} />;
}

function Hub({ variant = 'page', onClose }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const isAuthenticated = Boolean(user?.id);
  const pro = isPaidUser(user);
  const isDrawer = variant === 'drawer';
  const insightsState = useInsights(user?.id);
  const [wallet, setWallet] = useState(null);
  const walletSequence = useRef(0);
  const readWallet = useCallback(async () => {
    const sequence = ++walletSequence.current;
    try {
      const res = await fetch('/api/ai/credits', { cache: 'no-store' });
      const data = await res.json();
      if (sequence === walletSequence.current) setWallet(walletFromResponse(data, { ok: res.ok }));
    } catch { if (sequence === walletSequence.current) setWallet(walletFromResponse(null, { ok: false })); }
  }, []);
  useEffect(() => {
    const fence = walletSequence;
    let active = true;
    if (isAuthenticated) Promise.resolve().then(() => { if (active) readWallet(); });
    return () => { active = false; fence.current++; };
  }, [isAuthenticated, readWallet]);

  function navigate(route) {
    if (!route) return;
    router.push(route);
    onClose?.();
  }

  return (
    <section className="am" data-variant={isDrawer ? 'drawer' : 'page'} aria-label={isDrawer ? ASK_COPY.title : undefined}>
      {isDrawer ? (
        <header className="am-bar">
          <h2 className="am-bar__title">{ASK_COPY.title}</h2>
          {onClose ? <button type="button" className="am-close mk-press" onClick={onClose} aria-label="Close Ask Mobi"><X size={20} aria-hidden="true" /></button> : null}
        </header>
      ) : null}
      {isAuthenticated ? (
        <AskSection isDrawer={isDrawer} pathname={pathname} onNavigate={navigate} insightsState={insightsState} pro={pro} wallet={wallet} readWallet={readWallet} />
      ) : (
        <SignedOut isDrawer={isDrawer} />
      )}
    </section>
  );
}

function Head({ isDrawer, act }) {
  if (isDrawer) return null;
  return (
    <header className="am-head">
      <div className="am-head__text">
        <h1 className="am-title">{ASK_COPY.title}</h1>
        <p className="am-lede">{ASK_COPY.lede}</p>
      </div>
      <div className="am-head__mobi"><MobiReact act={act} size={96} label="Mobi" /></div>
    </header>
  );
}

function SignedOut({ isDrawer }) {
  return (
    <>
      <Head isDrawer={isDrawer} act="idle" />
      <div className="am-quiet">
        <p>{ASK_COPY.signedOut}</p>
        <Link className="btn-volt md mk-press" href={`/signup?next=${encodeURIComponent('/mentor?tab=ask')}`}>Create a free account</Link>
      </div>
    </>
  );
}

function AskSection({ isDrawer, pathname, onNavigate, insightsState, pro, wallet, readWallet }) {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [kind, setKind] = useState('record');
  const [mode, setMode] = useState('mentor');
  const [retry, setRetry] = useState(null);
  const inFlight = useRef(false);
  const transcriptRef = useRef(null);
  const pendingRef = useRef(null);
  const current = useMemo(() => pageHelpForPath(pathname), [pathname]);
  const notice = writtenReplyNotice(wallet);
  const writable = canWriteReply(wallet);
  const credits = walletLine(wallet);
  const shrug = useShrug(Boolean(retry), 'ask');
  const mobiAct = shrug ? 'oops' : pending ? 'loading' : input.trim() ? 'listen' : 'idle';

  useEffect(() => {
    let alive = true;
    fetch('/api/ai/mentor/history', { cache: 'no-store' })
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (!alive || !res.ok || !data?.ok) return;
        setSessionId((previous) => previous || data.session?.id || null);
        setMessages((previous) => (previous.length ? previous : (data.messages || []).map((row) => (row.role === 'assistant'
          ? { id: row.id, role: 'assistant', response: normalizeResponse(row.response || { reply: row.text }) }
          : { id: row.id, role: 'user', text: row.text || '' }))));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages, pending]);

  async function send(text = input, isRetry = false) {
    const finalText = String(text || '').trim();
    if (!finalText || inFlight.current || (retry && !isRetry)) return;
    inFlight.current = true;
    setInput('');
    if (!isRetry) setMessages((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text: finalText }]);
    // Questions about the student's own record are answered from the record: free, instant, no model.
    const fromRecord = !isRetry && (insightsState?.status === 'ready' || insightsState?.status === 'empty')
      ? answerFromInsights(finalText, insightsState.insights ?? { state: 'empty' }, { pro })
      : null;
    const local = isRetry ? null : fromRecord ? { ...fromRecord, origin: 'record', cards: [], confidence: 0, deterministic: true } : kind === 'record' ? deterministicReplyFor({ text: finalText, pathname }) : null;
    if (local) {
      setMessages((prev) => [...prev, { id: `a_${Date.now()}`, role: 'assistant', response: { ...local, origin: 'record' } }]);
      fetch('/api/ai/mentor/local', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, message: finalText, response: local, mode: 'guide' }) })
        .then((res) => res.json()).then((data) => { if (data?.sessionId) setSessionId(data.sessionId); }).catch(() => {});
      inFlight.current = false;
      return;
    }
    setPending(true);
    // One request id per student action. It is reused only if the last attempt ended with an
    // unknown outcome (network error), so a retry can never be charged twice.
    if (!isRetry) pendingRef.current = { message: finalText, id: crypto.randomUUID().replace(/-/g, ''), mode, kind };
    try {
      const res = await fetch('/api/ai/mentor/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: finalText, mode: pendingRef.current.mode, replyKind: pendingRef.current.kind, sessionId, requestId: pendingRef.current.id }) });
      const data = await res.json();
      if (res.ok && !data?.response?.reply && !data?.reply) throw new Error('Reply outcome unreadable');
      pendingRef.current = null; // the server gave a definite answer
      setRetry(null);
      const response = res.ok
        ? normalizeResponse({ ...(data.response || data), runtimeState: data.runtimeState })
        : { ...failureReply(res.status, data.message), origin: 'status' };
      setMessages((prev) => [...prev, { id: `a_${Date.now()}`, role: 'assistant', response }]);
      if (data.sessionId) setSessionId(data.sessionId);
    } catch {
      setRetry({ ...pendingRef.current });
    } finally {
      setPending(false);
      inFlight.current = false;
      readWallet();
    }
  }

  const blocked = pending || Boolean(retry);
  const needsCredit = kind === 'model' && !writable;

  return (
    <>
      <Head isDrawer={isDrawer} act={mobiAct} />

      <div className="am-meta">
        <div className="am-kinds" role="group" aria-label="Reply source">
          {REPLY_KINDS.map((k) => (
            <button key={k.id} type="button" className="am-kind mk-press" aria-pressed={kind === k.id} disabled={blocked} onClick={() => setKind(k.id)}>
              <span>{k.label}</span><small>{k.cost}</small>
            </button>
          ))}
        </div>
        <p className="am-credits" aria-live="polite">{credits || (wallet ? 'AI credits unavailable just now.' : 'Reading your AI credits.')} <Link className="am-link" href={PLAN_HREF} onClick={(event) => { if (isDrawer) { event.preventDefault(); onNavigate(PLAN_HREF); } }}>Plan and credits</Link></p>
      </div>

      {kind === 'model' ? (
        <div className="am-notice" role="status">
          <b>{notice.title}</b>
          <p>{notice.body}</p>
          {notice.ok ? (
            <label className="am-focus" htmlFor="am-focus">Focus
              <select id="am-focus" value={mode} disabled={blocked} onChange={(e) => setMode(e.target.value)}>
                {FOCUS_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      <div ref={transcriptRef} className="am-transcript" aria-live="polite" aria-busy={pending}>
        {messages.length === 0 ? (
          <div className="am-empty">
            <p>{ASK_COPY.empty}</p>
            <ul className="am-suggest">
              {SUGGESTIONS.map((text) => (
                <li key={text}><button type="button" className="mk-press" onClick={() => send(text)} disabled={blocked || needsCredit}>{text}</button></li>
              ))}
            </ul>
            <small>{current.title}: {current.body}</small>
          </div>
        ) : null}
        {messages.map((m) => (m.role === 'user' ? (
          <p key={m.id} className="am-you">{m.text}</p>
        ) : (
          <div key={m.id} className="am-reply" data-origin={m.response.origin || undefined}>
            <span className="am-reply__source">{replySource(m.response)}</span>
            <p>{plainServerText(m.response.reply)}</p>
            {m.response.actions?.length ? (
              <div className="am-reply__actions">
                {m.response.actions.slice(0, 2).map((a) => (
                  <button key={`${a.label}-${a.route || a.target}`} type="button" className="am-act mk-press" onClick={() => onNavigate(a.route || a.target)}>{plainServerText(a.label)}</button>
                ))}
              </div>
            ) : null}
          </div>
        )))}
        {pending ? <p className="am-reading" role="status">{ASK_COPY.reading}</p> : null}
      </div>

      {retry ? (
        <div className="am-notice" role="alert">
          <b>{ASK_COPY.retryTitle}</b>
          <p>{ASK_COPY.retryBody}</p>
          <button type="button" className="am-act mk-press" disabled={pending} onClick={() => send(retry.message, true)}>Retry this question</button>
        </div>
      ) : null}

      <form className="am-composer" onSubmit={(event) => { event.preventDefault(); send(); }}>
        <label htmlFor="am-input" className="sr-only">Ask Mobi</label>
        <textarea id="am-input" value={input} maxLength={1500} rows={2} disabled={blocked || needsCredit} onChange={(event) => setInput(event.target.value)}
          placeholder={kind === 'record' ? ASK_COPY.placeholderRecord : ASK_COPY.placeholderModel} />
        <div className="am-composer__foot">
          <span>{composerHint(kind)}</span>
          <button type="submit" className="btn-volt md mk-press" disabled={blocked || needsCredit || !input.trim()}>{sendLabel(kind, { pending })}</button>
        </div>
      </form>
    </>
  );
}

function normalizeResponse(response) {
  const r = response && typeof response === 'object' ? response : {};
  const actions = Array.isArray(r.actions) ? r.actions.filter((a) => a && (a.route || a.target) && a.label) : [];
  return {
    reply: String(r.reply || ''),
    actions,
    origin: r.origin || (r.runtimeState === 'live' || r.charge?.kind === 'prepos_credit' ? 'model' : r.runtimeState === 'record' ? 'record' : r.runtimeState === 'paused' ? 'status' : null),
    charged: Math.max(0, Number(r.charge?.amount) || 0),
  };
}
