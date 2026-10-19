"use client";
// The one shared next step (Today, Radar, Review, Progress, PrepOS all show the same plan).
// Full form: a time choice, the step, why, and alternatives. Compact form: one slim card.
import { useEffect, useRef, useState, useId } from 'react';
import Link from 'next/link';
import { api, apiGet } from '@/lib/fetcher';
import { StatusIcon } from '@/components/ui/Glyph';
import ArenaCompanion from '@/components/brand/ArenaCompanion';
import { ErrorState } from '@/components/ui/Skeleton';
import { SCREEN_MOMENTS } from '@/lib/mobiScreens';
import { helloToday } from '@/lib/mobiRation';
import { useMobiGate } from '@/lib/mobiHooks';
import { useCountUpState } from '@/lib/motion/useCountUp';
import { useInView } from '@/lib/motion/useInView';
import { SegmentedControl } from '@/components/ui/controls/SegmentedControl';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { practiceForMinutes } from '@/../data/learning_engine';

const TIMES = [10, 20, 30];
const TIME_OPTIONS = TIMES.map((n) => ({ value: n, label: `${n} min` }));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The planned minutes, rolling from the old choice to the new one (the countUp token, 420 ms). It first shows the real value.
function MinutesRoll({ value }) {
  const { value: rolled, ink } = useCountUpState(value, { memoryKey: 'na-planned-minutes' });
  return <span className="na__mins"><span aria-hidden="true" className="mk-num" data-ink={ink || undefined}>{rolled}</span><span className="sr-only">{value}</span> minutes</span>;
}

// The plan's first sentence: what the session is. The engine's later sentences explain its rules.
const firstSentence = (text = '') => { const at = text.indexOf('. '); return at === -1 ? text : text.slice(0, at + 1); };

// A number that counts up to its real value (the app's number memory); the real value is read out. Only the first view
// ever climbs from 0; after that it rolls from the remembered figure, and an unchanged figure does not roll (MOTION.md 1.1).
function Rolled({ value, memoryKey }) {
  const { value: rolled, ink } = useCountUpState(value, { from: 0, memoryKey });
  return <><span aria-hidden="true" className="mk-num" data-ink={ink || undefined}>{rolled}</span><span className="sr-only">{value}</span></>;
}

// The why beside tonight's plan: the chapter where the student's own record has the most marks open,
// with its lamp-lit subject object. Without a ranked chapter it shows the session's shape or the plan's
// own record facts. Nothing here is a projection: every figure is a count from saved sessions.
function NextWhy({ plan, top, planned }) {
  if (plan.primary.kind === 'ordinary_practice' && top) {
    return (
      <aside className="na__why" aria-label="Why this step">
        <span className="na__why-art" aria-hidden="true"><SubjectObject id={top.subject} size={120} lit life={false} /></span>
        <div className="na__why-text">
          <b className="na__why-chapter">{top.subjectName}</b>
          <p className="na__why-marks"><strong><Rolled value={top.open} memoryKey="na-open-marks" /></strong><span>marks these misses were worth</span></p>
          <p className="na__why-detail">{[top.wrong ? `${top.wrong} wrong` : '', top.skip ? `${top.skip} left blank` : ''].filter(Boolean).join(' and ')} of {plural(top.n, 'question')}, over {plural(top.sessions, 'session')}. That is 5 marks each{top.wrong ? '; each wrong answer also cost −1 on its paper' : ''}.</p>
          <Link className="pr-link na__why-link" href="/mentor?tab=record">See your full record</Link>
        </div>
      </aside>
    );
  }
  if (plan.primary.kind === 'ordinary_practice') {
    return (
      <aside className="na__why na__why--shape" aria-label="Tonight’s session">
        <p className="na__why-marks"><strong><Rolled value={planned} memoryKey="na-minutes-tonight" /></strong><span>minutes tonight</span></p>
        <p className="na__why-detail">Marked +5 and −1, the CUET way. Every miss waits in Your papers with its explanation.</p>
      </aside>
    );
  }
  const facts = (plan.primary.facts || []).filter((f) => f.basis === 'record');
  if (!facts.length) return null;
  return (
    <aside className="na__why na__why--facts" aria-label="From your record">
      <span className="na__why-kicker">From your record</span>
      <ul>{facts.map((f) => <li key={f.text}>{f.text}</li>)}</ul>
    </aside>
  );
}

// The card's headline says why the step matters; the start key below says what to do.
function chosenLine(minutes) {
  const { count, review } = practiceForMinutes(minutes);
  return review ? `The set fits it: ${count} questions, then ${review} minutes on what you missed.` : `The set fits it: ${count} questions, about a minute each.`;
}

function daypartHello() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning.' : h < 17 ? 'Good afternoon.' : 'Good evening.';
}

function heroTitle(plan, top, planned) {
  if (plan.primary.kind !== 'ordinary_practice') return plan.primary.reason || plan.primary.title;
  if (top) return `${top.chapter} is where most marks are open.`;
  const { count, review } = practiceForMinutes(planned);
  return review ? `${count} questions, then a look at what you missed.` : `${count} questions against the clock.`;
}

// Compact: the shell's Start key is the volt on every page that shows this card (Progress, Review, Radar), so the card's
// key is always the outline one, and it names the step ("Start 10 practice questions"), not a bare "Start" (AGENT_RULES 7).
// `quiet` (compact only): the page already has its one primary action, so this step is a ruled row with an outline key.
// `moment` (Today): a real moment the page saw, { act, title, line }, e.g. the week's study-day goal met (lib/mobiScreens.js).
// It takes the companion's idle slot once the plan is on screen; a failure, the wait and a time choice still come first.
export default function LearningNextAction({ compact = false, why = null, quiet = false, moment = null, onError = null }) {
  const tonightKey = `tonight-plan-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [plan, setPlan] = useState(null), [minutes, setMinutes] = useState(null), [error, setError] = useState(''), [retryCount, setRetryCount] = useState(0),[choosing,setChoosing]=useState(false);
  // The minutes the held plan was asked for. A new choice keeps the plan on screen (the card never collapses to a
  // skeleton and back); until the new plan arrives the Start key waits.
  const [planKey, setPlanKey] = useState(null);
  const [listening,setListening]=useState(false);
  const listenTimer=useRef(0);
  // While the plan's key is on screen (and not behind the phone's tab bar), the hero says so; the shell's Start key then
  // steps back to an outline (start.css), so one volt action shows at a time (AGENT_RULES 7).
  const [ctaRef, ctaShown] = useInView({ once: false, threshold: 0.6, rootMargin: '0px 0px -84px 0px' });
  const planned = minutes ?? plan?.minutes ?? null;
  const refreshing = Boolean(plan) && minutes !== planKey;
  useEffect(() => () => window.clearTimeout(listenTimer.current), []);
  // Mobi tilts his head when you choose a time: an answer to the tap, then he settles.
  // The first visit of the day earns a hello (asked once, after mount, so the server render has no figure).
  const hello = useMobiGate(() => (compact ? false : helloToday('today')), false);
  const [chosen, setChosen] = useState(null);
  const listen = () => { setListening(false); window.clearTimeout(listenTimer.current); window.requestAnimationFrame(() => { setListening(true); listenTimer.current = window.setTimeout(() => setListening(false), 950); }); };
  useEffect(() => {
    let alive = true;
    apiGet(`/api/learning/plan${minutes===null?'':`?minutes=${minutes}`}`).then(p => { if (alive) { setPlan(p); setPlanKey(minutes); setError(''); } }).catch(() => { if (alive) setError('Your plan could not be loaded. Your saved attempts are still in Your papers.'); });
    return () => { alive = false; };
  }, [minutes, retryCount]);
  const retry = () => { setPlan(null); setError(''); setRetryCount(n => n + 1); };
  // A page that owns the failure (Progress) hears about it; the card then shows nothing of its own.
  const failed = Boolean(error) && !plan;
  useEffect(() => { if (failed && onError) onError(); }, [failed, onError]);
  const chooseTime=async n=>{
    if(choosing || n===(minutes ?? plan?.minutes))return;
    listen(); setChosen(n);
    if(!plan?.study?.preferences){setError('');setMinutes(n);return;}
    setChoosing(true);setError('');
    try{
      const prefs=plan.study.preferences;
      const input={minutes:n,expectedRevision:prefs.revision};
      if(prefs.premium && prefs.weeklyPlan)input.weeklyPlan=prefs.weeklyPlan.map((day,index)=>index===plan.study.weekday?{...day,minutes:n}:day);
      await api('/api/study/preferences',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
      setMinutes(null);setPlan(null);setRetryCount(value=>value+1);
    }catch{setError('Your time preference could not be saved. Reload your plan and try again.');}finally{setChoosing(false);}
  };
  // Ordinary practice opens on the chapter the headline names (Practice preselects a linked subject and chapter).
  const top = !compact && plan?.primary.kind === 'ordinary_practice' && why?.subject && why?.chapter ? why : null;
  const startHref = !compact && !plan?.sequence?.length && plan?.primary.kind === 'ordinary_practice'
    ? `${plan.primary.href}${plan.primary.href.includes('?') ? '&' : '?'}${new URLSearchParams({ ...(top ? { subject: top.subject, chapter: top.chapter } : {}), tonightKey, tonightMinutes: String(plan.minutes) })}`
    : plan?.primary.href;

  if (compact) {
    return (
      failed && onError ? null : <section className={`na na--compact${quiet ? ' na--quiet' : ''}`} aria-label="Your next step">
        {error ? (
          <div className="na__body"><p className="na__reason" role="alert">{error}</p><button type="button" className="pr-link" onClick={retry}>Try again</button></div>
        ) : !plan ? (
          <div className="na__body"><p className="na__reason" role="status">Loading your next step…</p></div>
        ) : (
          <>
            <div className="na__body"><b className="na__title"><span className="na__lead">Your next step: </span>{firstSentence(plan.primary.reason)}</b></div>
            <Link className="btn-outline md na__cta mk-press" href={plan.primary.href}>{plan.primary.title}</Link>
          </>
        )}
      </section>
    );
  }

  // Mobi on Today only for a real moment (lib/mobiScreens.js SCREEN_MOMENTS.today): the first visit of the day, the
  // week's goal met, a time just chosen. A failed plan has its own one figure (ErrorState). Otherwise no figure at all.
  const recorded = plan?.tonight?.state === 'recorded';
  const companion = error || !plan ? null
    : chosen ? { act: listening ? SCREEN_MOMENTS.today.timeChosen : 'idle', title: `${chosen} minutes it is.`, line: chosenLine(chosen) }
    : moment ? moment
    : hello ? { act: SCREEN_MOMENTS.today.firstVisitToday, title: daypartHello(), line: recorded ? 'Anything more tonight is extra.' : 'Tonight’s plan is set from your last sessions.' }
    : null;

  // A plan that never loaded is the shared page-level failed state (as on Review, Progress and Weak chapters): one
  // figure, one sentence, one Try again, standing on its own rather than boxed inside the plan card.
  if (error && !plan) {
    return <ErrorState scene="unreachable" title="Tonight’s plan did not load" message="Your saved sessions are safe in Your papers. Try again in a moment." onRetry={retry} />;
  }

  // Tonight's plan leads the page (the install prompt sits at the foot of Today, below the fold).
  return (<>
    <section className="na na--hero" aria-label="Tonight’s plan" data-cta-shown={ctaShown || undefined}>
      {companion ? <ArenaCompanion act={companion.act} pose="attentive" title={companion.title}>{companion.line}</ArenaCompanion> : null}
      <div className="na__grid">
        <div className="na__plan">
          {plan && !error ? <h2 className="na__title na__title--hero">{recorded ? 'Tonight’s practice is recorded.' : heroTitle(plan, top, planned)}</h2> : null}
          <fieldset className="na__time">
            <legend className="na__time-label">{recorded ? 'More practice tonight' : 'Tonight’s plan'}{planned ? <>, <MinutesRoll value={planned} /></> : null}</legend>
            <SegmentedControl size="sm" label="Time for practice" value={minutes ?? plan?.minutes} busy={choosing} onChange={chooseTime} options={TIME_OPTIONS} />
          </fieldset>
          {error ? (
            // A time that did not save: one line in place, the plan below it unchanged.
            <p className="na__reason" role="alert">Your time was not saved, so your plan is unchanged. <button type="button" className="pr-link" onClick={retry}>Try again</button></p>
          ) : !plan ? (
            <div className="na__skeleton" role="status" aria-label="Loading tonight’s plan"><i /><i /><i /></div>
          ) : (
            <>
              {recorded ? <p className="na__done" role="status"><StatusIcon kind="success" size={18} /><span>{plan.tonight.reviewMinutes ? `Next, ${plan.tonight.reviewMinutes} minutes of review: open the session to see what you missed.` : 'Open the session to see what you missed, or practise more below.'}</span></p> : null}
              {plan.primary.kind === 'ordinary_practice' && top ? <p className="na__reason">{firstSentence(plan.primary.reason)}</p> : null}
              {plan.sequence?.length > 1 ? <ol className="study-sequence" aria-label="Your study session">{plan.sequence.map((step,index)=><li key={`${step.kind}-${index}`}><span aria-hidden="true">{index+1}</span><div><Link href={step.href}>{step.title}</Link>{step.purpose ? <p>{step.purpose}</p> : null}<small>About {step.estimatedMinutes} min{step.done ? `, ${step.done}` : ''}</small></div></li>)}</ol> : null}
              <div className="na__actions">
                {recorded ? <Link className="btn-volt md na__cta mk-press" href={`/result/${plan.tonight.sessionId}`}>Review that session</Link> : null}
                <Link ref={ctaRef} className={`${recorded ? 'btn-outline' : 'btn-volt'} md na__cta mk-press`} href={startHref} aria-busy={refreshing || undefined} data-stale={refreshing || undefined} onClick={refreshing ? (event) => event.preventDefault() : undefined}>{plan.primary.title}</Link>
                {plan.sequence?.[1] && <Link className="na__alt" href={plan.sequence[1].href}>Skip ahead a step</Link>}
                {plan.sequence?.length > 0 && <Link className="na__alt" href="/dashboard?mode=full">Take a mock</Link>}
                {plan.alternatives.map(a => <Link key={a.kind} className="na__alt" href={a.href}>{a.title}</Link>)}
              </div>
            </>
          )}
          <p className="na__note" role="status">{choosing ? 'Saving your time…' : null}</p>
        </div>
        {plan && !error ? <NextWhy plan={plan} top={top} planned={planned || plan.minutes} /> : null}
      </div>
    </section>
    </>
  );
}
