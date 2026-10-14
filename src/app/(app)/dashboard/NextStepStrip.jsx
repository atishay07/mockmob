"use client";
// The compact next-step strip at the top of Practice. It reads the plan through the same cache as
// Today (learningPlanCache), so a fresh saved plan shows at once with no request, and the request
// Practice does make warms Today.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppIcon } from '@/components/ui/Glyph';
import { stripReason } from '@/../data/practice_landing.mjs';
import { fetchLearningPlan, isFresh, readCachedPlan } from '@/lib/learningPlanCache';

/** Reads the plan once while `enabled` and a student is known. state: idle | loading | ready | error. */
export function usePracticePlan(enabled, userId) {
  const [result, setResult] = useState({ state: 'idle', plan: null });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!enabled || !userId) return undefined;
    let alive = true;
    const saved = readCachedPlan({ userId });
    // Deferred a tick so the effect itself sets no state synchronously.
    queueMicrotask(() => { if (alive) setResult(saved ? { state: 'ready', plan: saved.plan } : { state: 'loading', plan: null }); });
    if (saved && isFresh(saved) && nonce === 0) return () => { alive = false; };
    fetchLearningPlan({ userId })
      .then((plan) => { if (alive) setResult({ state: 'ready', plan }); })
      .catch(() => { if (alive && !saved) setResult({ state: 'error', plan: null }); });
    return () => { alive = false; };
  }, [enabled, userId, nonce]);
  return { ...result, retry: () => setNonce((n) => n + 1) };
}

/**
 * strip: loading | error | setup | step (from practiceLead). `dominant` makes the step's button
 * the filled primary; `setupMatches` says the suggested setup is already the one below.
 */
export default function NextStepStrip({ strip, plan, dominant, setupMatches, onApplySetup, onRetry }) {
  if (strip === 'hidden') return null;

  if (strip === 'loading') {
    return (
      <section className="pl-strip" data-kind="loading" aria-label="Your next step" aria-busy="true">
        <span className="pl-strip__icon" aria-hidden="true"><AppIcon name="today" size={18} /></span>
        <div className="pl-strip__body pl-strip__skeleton" role="status"><span className="sr-only">Loading your next step</span><i /><i /></div>
      </section>
    );
  }

  if (strip === 'error') {
    return (
      <section className="pl-strip" data-kind="error" aria-label="Your next step">
        <span className="pl-strip__icon" aria-hidden="true"><AppIcon name="today" size={18} /></span>
        <div className="pl-strip__body"><p className="pl-strip__reason" role="status">Your next step could not be loaded. You can still start practice below.</p></div>
        <button type="button" className="pr-link pl-strip__retry" onClick={onRetry}><AppIcon name="refresh" size={14} />Try again</button>
      </section>
    );
  }

  const step = plan?.primary;
  if (!step) return null;
  const reason = stripReason(step);

  if (strip === 'setup') {
    return (
      <section className="pl-strip" data-kind="setup" aria-label="Your next step">
        <span className="pl-strip__icon" aria-hidden="true"><AppIcon name="today" size={18} /></span>
        <div className="pl-strip__body">
          <b className="pl-strip__title">{step.title}</b>
          {reason ? <p className="pl-strip__reason">{reason}</p> : null}
        </div>
        {/* Stays mounted once applied so keyboard focus is not dropped. */}
        <button type="button" className="btn-outline md pl-strip__cta" aria-disabled={setupMatches ? 'true' : undefined} onClick={setupMatches ? undefined : onApplySetup}>
          {setupMatches ? 'Set up below' : 'Use this setup'}
        </button>
      </section>
    );
  }

  return (
    <section className="pl-strip" data-kind="step" aria-label="Your next step">
      <span className="pl-strip__icon" aria-hidden="true"><AppIcon name="today" size={18} /></span>
      <div className="pl-strip__body">
        <p className="pl-strip__reason">{reason ? <><b>Next step:</b> {reason}</> : <b>Your next step</b>}</p>
      </div>
      <Link className={`${dominant ? 'btn-volt' : 'btn-outline'} md pl-strip__cta`} href={step.href}>{step.title}</Link>
    </section>
  );
}
