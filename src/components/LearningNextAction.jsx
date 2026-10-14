"use client";
// The one shared next step (Today, Radar, Review, Progress, PrepOS all show the same plan).
// Full form: a time choice, the step, why, and alternatives. Compact form: one slim card.
//
// Speed: it asks for the light step view of the plan, shares one request with any other copy on
// the page, and shows the last saved plan at once with its age ("From 4 minutes ago") while the
// current one loads in place. A plan fetched in the last minute (for example by Practice) is
// shown as current with no new request. The loading skeleton has the final card's shape.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/fetcher';
import { AppIcon, StatusIcon } from '@/components/ui/Glyph';
import ArenaCompanion from '@/components/brand/ArenaCompanion';
import { useAuth } from '@/components/AuthProvider';
import { clearCachedPlans, fetchLearningPlan, isFresh, planAgeLabel, planSlot, readCachedPlan, writeCachedPlan } from '@/lib/learningPlanCache';
import InstallPractice from './InstallPractice';
import './learningNextAction.css';

const TIMES = [10, 20, 30];
const LOAD_ERROR = 'Your plan could not be loaded. Your saved attempts are still available in Review.';

function FullSkeleton() {
  return (
    <div className="na-sk" role="status" aria-label="Loading your next step">
      <i className="na-sk__title" /><i className="na-sk__line" /><i className="na-sk__line na-sk__line--short" />
      <span className="na-sk__rows"><i /><i /></span>
      <span className="na-sk__actions"><i className="na-sk__btn" /><i className="na-sk__alt" /></span>
      <i className="na-sk__note" />
    </div>
  );
}

export default function LearningNextAction({ compact = false }) {
  const tonightKey = `tonight-plan-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { user, status } = useAuth();
  const userId = user?.id;
  // view: { plan, savedAt, current } where current means fetched now (no age label needed).
  const [view, setView] = useState(null);
  const [minutes, setMinutes] = useState(null), [pendingMinutes, setPendingMinutes] = useState(null);
  const [error, setError] = useState(''), [refreshFailed, setRefreshFailed] = useState(false);
  const [loading, setLoading] = useState(true), [retryCount, setRetryCount] = useState(0), [choosing, setChoosing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const plan = view?.plan || null;
  // The last plan this card fetched, so a session that confirms after the plan arrived does not
  // ask for it a second time.
  const lastFetch = useRef(null);

  useEffect(() => {
    let alive = true;
    const last = lastFetch.current;
    const reuse = last && last.slot === planSlot(minutes) && last.retry === retryCount && isFresh(last) ? last : null;
    if (reuse && userId) writeCachedPlan({ userId, minutes, plan: reuse.plan, now: reuse.savedAt });
    const saved = reuse || readCachedPlan({ userId, minutes });
    const show = next => { if (alive) setView(next); };
    Promise.resolve().then(() => {
      if (!alive) return;
      setNow(Date.now());
      // No student yet: nothing to ask for. While the session is being confirmed the skeleton
      // stays; once it is known that nobody is signed in (or auth is down) say so instead of
      // leaving a skeleton that never ends.
      if (!userId) {
        if (status === 'loading') return;
        setLoading(false); setPendingMinutes(null); setError(LOAD_ERROR);
        return;
      }
      if (saved) show({ plan: saved.plan, savedAt: saved.savedAt, current: isFresh(saved) });
      if (saved && isFresh(saved) && (retryCount === 0 || saved === reuse)) { setLoading(false); setError(''); setRefreshFailed(false); setPendingMinutes(null); return; }
      setLoading(true);
      fetchLearningPlan({ userId, minutes })
        .then(p => {
          if (!alive) return;
          writeCachedPlan({ userId, minutes, plan: p });
          lastFetch.current = { slot: planSlot(minutes), retry: retryCount, plan: p, savedAt: Date.now() };
          show({ plan: p, savedAt: Date.now(), current: true });
          setError(''); setRefreshFailed(false); setPendingMinutes(null);
        })
        .catch(err => {
          if (!alive) return;
          // While the session is still being confirmed a 401 is not a failure yet: this runs again once it is.
          if (err?.status === 401 && status === 'loading') return;
          setPendingMinutes(null);
          if (saved) setRefreshFailed(true); else setError(LOAD_ERROR);
        })
        .finally(() => { if (alive) setLoading(false); });
    });
    return () => { alive = false; };
  }, [userId, status, minutes, retryCount]);

  // Keep the age label honest while the page stays open.
  useEffect(() => {
    if (!view || view.current) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [view]);

  const retry = useCallback(() => { setError(''); setRefreshFailed(false); setRetryCount(n => n + 1); }, []);
  const chooseTime = async n => {
    // aria-disabled (not disabled) keeps keyboard focus on the button while this runs.
    if (choosing || loading || refreshFailed || n === (minutes ?? plan?.minutes)) return;
    setError('');
    // Without a saved preference the plan stays on screen while the new time loads.
    if (!plan?.study?.preferences) { setPendingMinutes(n); setMinutes(n); return; }
    setChoosing(true); setPendingMinutes(n);
    try {
      const prefs = plan.study.preferences;
      const input = { minutes: n, expectedRevision: prefs.revision };
      if (prefs.premium && prefs.weeklyPlan) input.weeklyPlan = prefs.weeklyPlan.map((day, index) => index === plan.study.weekday ? { ...day, minutes: n } : day);
      await api('/api/study/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      // The saved plan was built for the old time; forget it and load the new one in place.
      clearCachedPlans({ userId });
      setMinutes(null); setRetryCount(value => value + 1);
    } catch { setPendingMinutes(null); setError('Your time preference could not be saved. Reload your plan and try again.'); } finally { setChoosing(false); }
  };
  const startHref = !compact && !plan?.sequence?.length && plan?.primary.kind === 'ordinary_practice'
    ? `${plan.primary.href}${plan.primary.href.includes('?') ? '&' : '?'}${new URLSearchParams({ tonightKey, tonightMinutes: String(plan.minutes) })}`
    : plan?.primary.href;
  const stale = plan && !view.current;
  const age = stale ? planAgeLabel(view.savedAt, now) : '';
  const refreshing = loading && !!plan;

  if (compact) {
    return (
      <section className="na na--compact" aria-label="Your next step" aria-busy={loading}>
        <span className="na__icon" aria-hidden="true"><AppIcon name="today" size={18} /></span>
        {error && !plan ? (
          <div className="na__body"><p className="na__reason" role="alert">{error}</p><button type="button" className="pr-link" onClick={retry}>Try again</button></div>
        ) : !plan ? (
          <div className="na__body na-sk na-sk--compact" role="status" aria-label="Loading your next step"><i className="na-sk__eyebrow" /><i className="na-sk__line" /><i className="na-sk__line na-sk__line--short" /></div>
        ) : (
          <>
            <div className="na__body"><span className="na__eyebrow">Your next step</span><b className="na__title">{plan.primary.title}</b><p className="na__reason">{plan.primary.reason}</p>
              {stale ? <span className="na__age" role="status">{refreshFailed ? <>{age}. It could not be updated. <button type="button" className="pr-link" onClick={retry}>Try again</button></> : `${age}. Updating now.`}</span> : null}
            </div>
            <Link className="btn-volt md na__cta" href={plan.primary.href}>Start</Link>
          </>
        )}
      </section>
    );
  }

  const shownMinutes = pendingMinutes ?? minutes ?? plan?.minutes;
  return (<>
    <InstallPractice />
    <section className="na" aria-label="Your next step" aria-busy={loading || choosing}>
      <ArenaCompanion pose={error && !plan ? 'encouraging' : 'attentive'} title={error && !plan ? 'Try your record again.' : !plan ? 'Getting your next step.' : 'Your next step is ready.'}> {error && !plan ? 'Review still has your saved sessions.' : !plan ? 'Reading your available practice.' : 'Choose the time you have. Start with the step below.'}</ArenaCompanion>
      <div className="na__top">
        <span className="na__eyebrow"><AppIcon name="today" size={14} />Tonight’s plan</span>
        <fieldset className="na__time">
          <legend className="sr-only">Time for practice</legend>
          <div className="na__seg" role="group" aria-label="Time for practice">
            {TIMES.map(n => <button type="button" key={n} aria-pressed={shownMinutes === n} aria-disabled={choosing || loading || refreshFailed || undefined} onClick={() => chooseTime(n)}>{n} min</button>)}
          </div>
        </fieldset>
      </div>
      {stale || refreshing || choosing ? (
        <p className="na__age" role="status">
          {choosing ? 'Saving your time preference…' : pendingMinutes ? `Updating your plan for ${pendingMinutes} minutes…` : refreshFailed ? <>{age}. It could not be updated. <button type="button" className="pr-link" onClick={retry}>Try again</button></> : stale ? `${age}. Updating now.` : 'Updating your plan…'}
        </p>
      ) : null}
      {error && plan ? <div className="pr-alert" data-tone="error" role="alert"><StatusIcon kind="error" /><div>{error} <button type="button" className="pr-link" onClick={retry}>Try again</button></div></div> : null}
      {error && !plan ? (
        <div className="pr-alert" data-tone="error" role="alert"><StatusIcon kind="error" /><div>{error} <button type="button" className="pr-link" onClick={retry}>Try again</button> <Link className="pr-link" href="/review">Open Review</Link></div></div>
      ) : !plan ? (
        <FullSkeleton />
      ) : (
        <div className="na__plan">
          {plan.tonight?.state === 'recorded' ? <div className="pr-alert" data-tone="good" role="status"><AppIcon name="check" size={18} /><div><b>Tonight’s practice is recorded.</b> <Link className="pr-link" href={`/result/${plan.tonight.sessionId}`}>Review that session</Link>{plan.tonight.reviewMinutes ? <p>Your 30-minute plan also includes 10 minutes of review. Recording practice does not mark that review as done.</p> : null}</div></div> : null}
          <h2 className="na__title na__title--lg">{plan.primary.title}</h2>
          <p className="na__reason">{plan.primary.reason}</p>
          {plan.sequence?.length > 1 ? <ol className="study-sequence" aria-label="Your study session">{plan.sequence.map((step, index) => <li key={`${step.kind}-${index}`}><span aria-hidden="true">{index + 1}</span><div><Link href={step.href}>{step.title}</Link>{step.purpose ? <p>{step.purpose}</p> : null}<small>About {step.estimatedMinutes} min{step.done ? `, ${step.done}` : ''}</small></div></li>)}</ol> : null}
          <div className="na__actions">
            <Link className="btn-volt md na__cta" href={startHref}>{plan.primary.title}</Link>
            {plan.sequence?.[1] && <Link className="na__alt" href={plan.sequence[1].href}>Skip to the next step</Link>}
            {plan.sequence?.length > 0 && <Link className="na__alt" href="/dashboard?mode=full">Take a mock</Link>}
            {plan.alternatives.map(a => <Link key={a.kind} className="na__alt" href={a.href}>{a.title}</Link>)}
          </div>
          <p className="na__note">Planned for {plan.minutes || minutes || 10} minutes. Access and credits are checked before the session starts; nothing is charged if it cannot be built.</p>
        </div>
      )}
    </section></>
  );
}
