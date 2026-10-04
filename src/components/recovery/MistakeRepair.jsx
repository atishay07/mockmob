"use client";
// Score Recovery Â· Mistake Repair for one wrong answer. The server works the question and must
// match the answer key before any repair is shown; a mismatch holds the question for review instead.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Wrench, Check, ArrowRight } from 'lucide-react';
import { REPAIR_OUTCOMES, hasExplanation, repairRetryPolicy } from '@/../data/repair_presentation.mjs';
import './mistake-repair.css';

const newRequestId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40).padEnd(16, '0');
// The stages the server runs, in order. The display advances on a timer; the result decides the outcome.
const STAGES = ['Working through the question', 'Checking against the answer key', 'Writing your repair'];

export default function MistakeRepair({ attemptId, questionId, chosen, answer, autoStart = false, onSettled, next = null }) {
  const [state, setState] = useState({ status: 'idle' });
  const [stage, setStage] = useState(0);
  // One request ID per repair attempt: a retry after a lost response reuses it, so it is never charged twice.
  const requestId = useRef(null);
  const started = useRef(false);
  const inFlight = useRef(false);

  async function run() {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      requestId.current ??= newRequestId();
      setStage(0);
      setState({ status: 'loading' });
      let res; let body = null;
      try {
        res = await fetch('/api/recovery/repair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attemptId, questionId, requestId: requestId.current }) });
        body = await res.json().catch(() => null);
      } catch {
        setState({ status: 'error', message: 'The connection dropped. Try again: the same request is reused, so you are never charged twice.', canRetry: true });
        return;
      }
      if (!res.ok || !body?.ok) {
        // A released attempt cannot be reused; the next try starts a fresh request.
        const retry = repairRetryPolicy(res.status, body?.error);
        if (retry.resetRequest) requestId.current = null;
        setState({ status: body?.error === 'in_progress' ? 'waiting' : 'error', message: body?.message || 'We could not confirm the repair result. Try again with the same request.', canRetry: retry.canRetry });
        return;
      }
      if (!REPAIR_OUTCOMES.includes(body.status) || (hasExplanation(body.status) && typeof body.repair?.key_idea !== 'string')) {
        setState({ status: 'error', message: 'The repair response was incomplete. Try again with the same request.', canRetry: true });
        return;
      }
      setState({ status: body.status, ...body });
      onSettled?.(questionId, body.status);
    } finally { inFlight.current = false; }
  }

  useEffect(() => {
    if (state.status !== 'loading') return undefined;
    const timer = setInterval(() => setStage(s => Math.min(s + 1, STAGES.length - 1)), 1400);
    return () => clearInterval(timer);
  }, [state.status]);

  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    queueMicrotask(run);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const nextButton = next ? <button type="button" className="mr-next-btn" onClick={next.go}>Next mistake: Q{next.number} <ArrowRight size={16} aria-hidden="true" /></button> : null;
  const pick = chosen ? `option ${chosen}` : 'your answer';

  if (state.status === 'idle') {
    return (
      <div className="mr">
        <button type="button" className="mr-start" onClick={() => { started.current = true; run(); }}>
          <span className="mr-start__icon" aria-hidden="true"><Wrench size={18} strokeWidth={2.4} /></span>
          <span className="mr-start__text"><b>Repair this mistake</b><small>Why {pick} felt right, where it breaks, and the idea to keep</small></span>
          <span className="mr-start__cost">1 credit</span>
        </button>
      </div>
    );
  }
  if (state.status === 'loading') {
    return (
      <div className="mr mr--panel" role="status" aria-live="polite">
        <ol className="mr-stages">
          {STAGES.map((s, i) => <li key={s} data-state={i < stage ? 'done' : i === stage ? 'active' : 'todo'}>{s}</li>)}
        </ol>
      </div>
    );
  }
  if (state.status === 'error' || state.status === 'waiting') {
    return (
      <div className="mr mr--panel" role={state.status === 'waiting' ? 'status' : 'alert'}>
        <p className="mr-note">{state.message}</p>
        {state.canRetry ? <button type="button" className="mr-retry" onClick={run}>{state.status === 'waiting' ? 'Check again' : 'Try again'}</button> : null}
      </div>
    );
  }
  if (state.status === 'held_for_recheck' || state.status === 'not_explained') {
    return (
      <div className="mr mr--panel" role="status" data-tone="warn">
        <b className="mr-title">{state.status === 'held_for_recheck' ? 'Held for review' : 'No repair for this one'}</b>
        <p className="mr-note">{state.message}</p>
        <div className="mr-foot">
          {nextButton}
          {state.practiceHref ? <Link className="mr-practice mr-practice--quiet" href={state.practiceHref}>Practise 5 on this chapter</Link> : null}
        </div>
      </div>
    );
  }
  const r = state.repair || {};
  return (
    <section className="mr mr--panel mr--done" aria-label="Mistake Repair">
      <header className="mr-head">
        <b className="mr-title">Mistake Repair</b>
        <span className="mr-check"><Check size={14} strokeWidth={3} aria-hidden="true" />Checked against the answer key{answer ? ` (${answer})` : ''}</span>
      </header>
      <div className="mr-cards">
        <div className="mr-card" data-kind="trap"><span>Why {pick} felt right</span><p>{r.why_tempting}</p></div>
        <div className="mr-card" data-kind="wrong"><span>Where it breaks</span><p>{r.why_wrong}</p></div>
      </div>
      <div className="mr-idea"><span>The idea to keep</span><p>{r.key_idea}</p></div>
      <div className="mr-next"><span>Do this next Â· 10 minutes</span><p>{r.next_step}</p></div>
      <footer className="mr-foot">
        {nextButton}
        {state.practiceHref ? <Link className={`mr-practice${next ? ' mr-practice--quiet' : ''}`} href={state.practiceHref}>Practise 5 on this chapter</Link> : null}
        <span className="mr-fine">{state.status === 'stored' ? 'Saved repair Â· no credit used' : state.charged ? `1 credit used${state.wallet ? ` Â· ${state.wallet.total} left` : ''}` : 'No credit used'}</span>
      </footer>
    </section>
  );
}
