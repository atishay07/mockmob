"use client";

// Account > Plan. Says exactly what the student has: Free (credits), Pro that renews monthly
// (with a two-step cancel), or Pro access with a fixed end date and nothing to cancel.
import { useState } from 'react';
import Link from 'next/link';
import { AppIcon, CreditAmount, StatusIcon } from '@/components/ui/Glyph';
import { useAuth } from '@/components/AuthProvider';

const fmt = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export function PlanCard() {
  const { user, refreshSession } = useAuth();
  const [phase, setPhase] = useState('idle'); // idle | confirm | working | done | error
  const [message, setMessage] = useState('');
  const pro = Boolean(user?.isPremium);
  const recurring = pro && Boolean(user?.razorpaySubscriptionId);
  const until = user?.premiumUntil || null;

  async function cancelRenewal() {
    setPhase('working');
    try {
      const response = await fetch('/api/billing/cancel', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Cancellation failed.');
      setMessage(data.message || 'Renewals are cancelled.');
      setPhase('done');
      refreshSession?.({ silent: true });
    } catch (error) {
      setMessage(error.message || 'Cancellation failed. Nothing was changed.');
      setPhase('error');
    }
  }

  return (
    <section className="plan-card" aria-labelledby="plan-card-title">
      <div className="plan-card__head">
        <h2 id="plan-card-title">Plan</h2>
        <span className="pr-badge" data-tone={pro ? 'included' : 'muted'}>{pro ? 'Pro' : 'Free'}</span>
      </div>

      {pro ? (
        <>
          <p className="plan-card__lead">
            {recurring
              ? <>Pro renews every month{until ? <>. Paid through <strong>{fmt(until)}</strong></> : null}.</>
              : <>Pro access{until ? <> runs through <strong>{fmt(until)}</strong></> : null}. It does not renew, so there is nothing to cancel.</>}
          </p>
          <div className="plan-card__row"><CreditAmount kind="practice" amount="unlimited" unit={false} /><span>Quick Practice and Full Mock</span></div>
          {recurring && phase === 'idle' && <button type="button" className="plan-card__quiet" onClick={() => setPhase('confirm')}>Cancel renewal</button>}
          {recurring && phase === 'confirm' && (
            <div className="plan-card__confirm" role="group" aria-label="Confirm cancellation">
              <p>Stop renewing? You keep Pro until {until ? fmt(until) : 'the end of the month you paid for'}, then your account moves to Free. Your history and saved questions stay.</p>
              <div>
                <button type="button" className="plan-card__danger" onClick={cancelRenewal}>Yes, stop renewing</button>
                <button type="button" className="plan-card__quiet" onClick={() => setPhase('idle')}>Keep Pro</button>
              </div>
            </div>
          )}
          {phase === 'working' && <p className="plan-card__msg" role="status">Cancelling…</p>}
          {phase === 'done' && <p className="plan-card__msg" role="status"><StatusIcon kind="success" size={15} />{message}</p>}
          {phase === 'error' && <p className="plan-card__msg" data-tone="bad" role="alert"><StatusIcon kind="warning" size={15} />{message}</p>}
        </>
      ) : (
        <>
          <p className="plan-card__lead">Free uses credits: Quick Practice costs 10 and Full Mock costs 50.</p>
          <div className="plan-card__row"><CreditAmount kind="practice" amount={user?.creditBalance || 0} /></div>
          <Link href="/pricing" className="plan-card__cta"><AppIcon name="pricing" size={16} />See Pro</Link>
        </>
      )}
    </section>
  );
}
