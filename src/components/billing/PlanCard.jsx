"use client";

// Account > Plan. Says exactly what the student has: Free (credits), Pro that renews monthly
// (with a two-step cancel), Pro whose renewal is off or whose last payment failed (access runs to the
// paid date), or Pro access with a fixed end date and nothing to cancel.
import { useState } from 'react';
import Link from 'next/link';
import { AppIcon, CreditAmount, StatusIcon } from '@/components/ui/Glyph';
import { useAuth } from '@/components/AuthProvider';
import { DrawnCheck } from '@/components/ui/DrawnCheck';
import { PAYMENT_PLANS } from '@/lib/payments/plans';

const MONTHLY_RUPEES = Math.round(PAYMENT_PLANS.pro_monthly_99.amount / 100);
// Dates are India dates: a paid-through instant of 18:29:59Z is 23:59 IST, and must not read as the next day elsewhere.
const fmt = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
// The lead names the timezone once, beside its date.
// Balances are shown once on Account, in Credits right under this card; the plan says what things cost.
const FREE_COSTS = 'Free uses practice credits: Quick practice costs 10 practice credits and Full mock costs 50. Your balance is under Credits.';
const LeadDate = ({ iso }) => <><strong>{fmt(iso)}</strong> (IST)</>;

export function PlanCard() {
  const { user, refreshSession } = useAuth();
  const [phase, setPhase] = useState('idle'); // idle | confirm | working | done | error
  const [message, setMessage] = useState('');
  const pro = Boolean(user?.isPremium);
  const hasSubscription = Boolean(user?.razorpaySubscriptionId);
  const status = user?.subscriptionStatus || 'free';
  // Once Razorpay has accepted the cancel, the card says so even if the session refresh is slow or fails.
  const cancelledNow = phase === 'done';
  const renewing = pro && hasSubscription && status === 'active' && !cancelledNow;
  const renewalOff = pro && hasSubscription && (status === 'cancelled' || cancelledNow);
  const paymentFailed = hasSubscription && status === 'past_due' && !cancelledNow;
  // Monthly Pro that has ended: nothing is charged any more and the account is on Free.
  const lapsed = !pro && hasSubscription && (status === 'cancelled' || cancelledNow);
  // A cancel is offered while Razorpay may still charge: renewing, or retrying after a failed payment.
  const canCancel = hasSubscription && (status === 'active' || status === 'past_due');
  const until = user?.premiumUntil || null;
  // Not Pro but with an end date on record: Pro was held and has ended (the server clears isPremium at the end).
  const ended = !pro && Boolean(until);

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
        {/* Quiet meta text, not a pill (BADGES-REFINE section 4: only real badges are badge-shaped). */}
        <span className="plan-card__meta">{pro ? 'Pro' : 'Free'}</span>
      </div>

      {pro || paymentFailed ? (
        <>
          {!cancelledNow && <p className="plan-card__lead">
            {renewing && <>Pro renews every month at ₹{MONTHLY_RUPEES}.{until ? <> Paid through <LeadDate iso={until} />. The next payment is due then.</> : null}</>}
            {renewalOff && <>Renewal is off, so no further payment will be taken. Pro stays active{until ? <> until <LeadDate iso={until} /></> : null}, then your account moves to Free.</>}
            {pro && paymentFailed && <>Your last monthly payment did not go through. Pro stays active{until ? <> until <LeadDate iso={until} /></> : null}. Razorpay retries the charge and emails you. Cancel renewal to stop the retries.</>}
            {!pro && paymentFailed && <>Your last monthly payment did not go through, so Pro is off. Razorpay may still retry the charge. Cancel renewal to stop it, then you can start Pro again.</>}
            {pro && !hasSubscription && <>Pro access{until ? <> runs through <LeadDate iso={until} /></> : null}. It does not renew, so there is nothing to cancel.</>}
          </p>}
          {pro && <div className="plan-card__row"><CreditAmount kind="practice" amount="unlimited" unit={false} /><span>Quick practice and Full mock</span></div>}
          {!pro && paymentFailed && <p className="plan-card__lead">{FREE_COSTS}</p>}
          {canCancel && (phase === 'idle' || phase === 'error') && <button type="button" className="plan-card__quiet" onClick={() => setPhase('confirm')}>{phase === 'error' ? 'Try cancelling again' : 'Cancel renewal'}</button>}
          {canCancel && phase === 'confirm' && (
            <div className="plan-card__confirm" role="group" aria-label="Confirm cancellation">
              <p>{pro
                ? <>Stop renewing? You keep Pro until {until ? fmt(until) : 'the end of the month you paid for'}, then your account moves to Free. Your history and saved questions stay.</>
                : <>Stop renewing? No further monthly payments will be taken. Your history and saved questions stay.</>}</p>
              <div>
                <button type="button" className="plan-card__danger" onClick={cancelRenewal}>Yes, stop renewing</button>
                <button type="button" className="plan-card__quiet" onClick={() => setPhase('idle')}>{pro ? 'Keep Pro' : 'Keep renewal'}</button>
              </div>
            </div>
          )}
          {phase === 'working' && <p className="plan-card__msg" role="status">Cancelling</p>}
          {phase === 'done' && <p className="plan-card__msg" role="status"><DrawnCheck size={15} />{message}</p>}
          {phase === 'error' && <p className="plan-card__msg" data-tone="bad" role="alert"><StatusIcon kind="warning" size={15} />{message}</p>}
        </>
      ) : (
        <>
          {lapsed ? <p className="plan-card__lead">Your monthly Pro has ended and no further payment will be taken.{until ? <> It ended on <strong>{fmt(until)}</strong>.</> : null} Your history and saved questions stay.</p> : ended ? <p className="plan-card__lead">Your Pro access ended on <strong>{fmt(until)}</strong>. Your history and saved questions stay.</p> : null}
          <p className="plan-card__lead">{FREE_COSTS}</p>
          <Link href="/pricing" className="plan-card__cta" data-page-primary=""><AppIcon name="pricing" size={16} />{ended || lapsed ? 'See Pro to renew' : 'See Pro'}</Link>
        </>
      )}
    </section>
  );
}
