"use client";
// Score Recovery · Mistake Repair for one wrong answer. The AI first solves the question and must
// match the answer key; only then does it explain. Disagreement withholds the question instead.
import { useRef, useState } from 'react';
import Link from 'next/link';
import './mistake-repair.css';

const newRequestId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40).padEnd(16, '0');

export default function MistakeRepair({ attemptId, questionId }) {
  const [state, setState] = useState({ status: 'idle' });
  // One request ID per repair attempt: a retry after a lost response reuses it, so it is never charged twice.
  const requestId = useRef(null);

  async function run() {
    requestId.current ??= newRequestId();
    setState({ status: 'loading' });
    let res; let body = null;
    try {
      res = await fetch('/api/recovery/repair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attemptId, questionId, requestId: requestId.current }) });
      body = await res.json().catch(() => null);
    } catch {
      setState({ status: 'error', message: 'The connection dropped. Try again: the same request is reused, so you are never charged twice.' });
      return;
    }
    if (!res.ok || !body?.ok) {
      // A released attempt cannot be reused; the next try starts a fresh request.
      if (body?.error === 'operation_released' || res.status >= 500) requestId.current = null;
      setState({ status: 'error', message: body?.message || 'The repair is unavailable right now. You were not charged.', canRetry: res.status !== 402 && res.status !== 409 && res.status !== 404 && res.status !== 422 });
      return;
    }
    setState({ status: body.status, ...body });
  }

  if (state.status === 'idle') {
    return (
      <div className="mr">
        <button type="button" className="mr-start" onClick={run}>
          <span>Repair this mistake</span>
          <small>AI · 1 PrepOS credit</small>
        </button>
      </div>
    );
  }
  if (state.status === 'loading') {
    return <div className="mr" role="status" aria-live="polite"><p className="mr-wait">Solving the question first, then explaining your pick…</p></div>;
  }
  if (state.status === 'error') {
    return (
      <div className="mr" role="alert">
        <p className="mr-note">{state.message}</p>
        {state.canRetry ? <button type="button" className="mr-retry" onClick={run}>Try again</button> : null}
      </div>
    );
  }
  if (state.status === 'held_for_recheck' || state.status === 'not_explained') {
    return (
      <div className="mr" role="status">
        <p className="mr-note">{state.message}</p>
        {state.practiceHref ? <Link className="mr-practice" href={state.practiceHref}>Practise 5 fresh questions on this chapter</Link> : null}
      </div>
    );
  }
  const r = state.repair || {};
  return (
    <section className="mr mr--done" aria-label="Mistake Repair">
      <header className="mr-head">
        <b>Mistake Repair</b>
        <span>{state.status === 'stored' ? 'Saved · no credit used' : state.charged ? `1 PrepOS credit${state.wallet ? ` · ${state.wallet.total} left` : ''}` : 'No credit used'}</span>
      </header>
      <dl className="mr-steps">
        <div><dt>Why your pick looked right</dt><dd>{r.why_tempting}</dd></div>
        <div><dt>Why it does not work</dt><dd>{r.why_wrong}</dd></div>
        <div><dt>The idea to keep</dt><dd>{r.key_idea}</dd></div>
        <div><dt>Next 10 minutes</dt><dd>{r.next_step}</dd></div>
      </dl>
      {state.practiceHref ? <Link className="mr-practice" href={state.practiceHref}>Prove it: 5 fresh questions on this chapter</Link> : null}
      <p className="mr-fine">Written by AI after it solved the question itself and matched the answer key. It explains your mistake; it never changes your score.</p>
    </section>
  );
}
