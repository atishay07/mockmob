"use client";
// The one shared next step (Today, Radar, Review, Progress, PrepOS all show the same plan).
// Full form: a time choice, the step, why, and alternatives. Compact form: one slim card.
import { useEffect, useState, useId } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/fetcher';
import { ArrowRight } from 'lucide-react';
import { AppIcon, StatusIcon } from '@/components/ui/Glyph';
import ArenaCompanion from '@/components/brand/ArenaCompanion';
import InstallPractice from './InstallPractice';

const TIMES = [10, 20, 30];

export default function LearningNextAction({ compact = false }) {
  const tonightKey = `tonight-plan-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [plan, setPlan] = useState(null), [minutes, setMinutes] = useState(10), [error, setError] = useState(''), [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    let alive = true;
    apiGet(`/api/learning/plan?minutes=${minutes}`).then(p => { if (alive) { setPlan(p); setError(''); } }).catch(() => { if (alive) setError('Your plan could not be loaded. Your saved attempts are still available in Review.'); });
    return () => { alive = false; };
  }, [minutes, retryCount]);
  const retry = () => { setPlan(null); setError(''); setRetryCount(n => n + 1); };
  const startHref = !compact && plan?.primary.kind === 'ordinary_practice'
    ? `${plan.primary.href}${plan.primary.href.includes('?') ? '&' : '?'}${new URLSearchParams({ tonightKey, tonightMinutes: String(plan.minutes) })}`
    : plan?.primary.href;

  if (compact) {
    return (
      <section className="na na--compact" aria-label="Your next step">
        <span className="na__icon" aria-hidden="true"><AppIcon name="today" size={18} /></span>
        {error ? (
          <div className="na__body"><p className="na__reason" role="alert">{error}</p><button type="button" className="pr-link" onClick={retry}>Try again</button></div>
        ) : !plan ? (
          <div className="na__body"><p className="na__reason" role="status">Loading your next step…</p></div>
        ) : (
          <>
            <div className="na__body"><span className="na__eyebrow">Your next step</span><b className="na__title">{plan.primary.title}</b><p className="na__reason">{plan.primary.reason}</p></div>
            <Link className="btn-volt md na__cta" href={plan.primary.href}>Start<ArrowRight size={16} aria-hidden="true" /></Link>
          </>
        )}
      </section>
    );
  }

  return (<>
    <InstallPractice />
    <section className="na" aria-label="Your next step">
      <ArenaCompanion pose={error ? 'encouraging' : 'attentive'} title={error ? 'Try your record again.' : !plan ? 'Getting your next step.' : 'Your next step is ready.'}> {error ? 'Review still has your saved sessions.' : !plan ? 'Reading your available practice.' : 'Choose the time you have. Start with the step below.'}</ArenaCompanion>
      <div className="na__top">
        <span className="na__eyebrow"><AppIcon name="today" size={14} />Tonight’s plan</span>
        <fieldset className="na__time">
          <legend className="sr-only">Time for practice</legend>
          <div className="na__seg" role="group" aria-label="Time for practice">
            {TIMES.map(n => <button type="button" key={n} aria-pressed={minutes === n} onClick={() => { if(n !== minutes){setPlan(null);setError('');setMinutes(n);} }}>{n} min</button>)}
          </div>
        </fieldset>
      </div>
      {error ? (
        <div className="pr-alert" data-tone="error" role="alert"><StatusIcon kind="error" /><div>{error} <button type="button" className="pr-link" onClick={retry}>Try again</button> <Link className="pr-link" href="/review">Open Review</Link></div></div>
      ) : !plan ? (
        <div className="na__skeleton" role="status" aria-label="Loading your next step"><i /><i /><i /></div>
      ) : (
        <>
          {plan.tonight?.state === 'recorded' ? <div className="pr-alert" data-tone="good" role="status"><AppIcon name="check" size={18} /><div><b>Tonight’s practice is recorded.</b> <Link className="pr-link" href={`/result/${plan.tonight.sessionId}`}>Review that session</Link>{plan.tonight.reviewMinutes ? <p>Your 30-minute plan also includes 10 minutes of review. Recording practice does not mark that review as done.</p> : null}</div></div> : null}
          <h2 className="na__title na__title--lg">{plan.primary.title}</h2>
          <p className="na__reason">{plan.primary.reason}</p>
          <div className="na__actions">
            <Link className="btn-volt md na__cta" href={startHref}>{plan.primary.title}<ArrowRight size={16} aria-hidden="true" /></Link>
            {plan.alternatives.map(a => <Link key={a.kind} className="na__alt" href={a.href}>{a.title}</Link>)}
          </div>
          <p className="na__note">Planned for {plan.minutes || minutes} minutes. Access and credits are checked before the session starts; nothing is charged if it cannot be built.</p>
        </>
      )}
    </section></>
  );
}
