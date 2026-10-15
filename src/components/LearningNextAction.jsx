"use client";
// The one shared next step (Today, Radar, Review, Progress, PrepOS all show the same plan).
// Full form: a time choice, the step, why, and alternatives. Compact form: one slim card.
import { useEffect, useRef, useState, useId } from 'react';
import Link from 'next/link';
import { api, apiGet } from '@/lib/fetcher';
import { ArrowRight } from 'lucide-react';
import { AppIcon, StatusIcon } from '@/components/ui/Glyph';
import ArenaCompanion from '@/components/brand/ArenaCompanion';
import InstallPractice from './InstallPractice';
import { useCountUpState } from '@/lib/motion/useCountUp';
import { SegmentedControl } from '@/components/ui/controls/SegmentedControl';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { practiceForMinutes } from '@/../data/learning_engine';

const TIMES = [10, 20, 30];
const TIME_OPTIONS = TIMES.map((n) => ({ value: n, label: `${n} min` }));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The planned minutes, rolling from the old choice to the new one. It first shows the real value.
function MinutesRoll({ value }) {
  const { value: rolled, ink } = useCountUpState(value, { duration: 520, memoryKey: 'na-planned-minutes' });
  return <span className="na__mins"><span aria-hidden="true" className="mk-num" data-ink={ink || undefined}>{rolled}</span><span className="sr-only">{value}</span> min</span>;
}

// The plan's first sentence: what the session is. The engine's later sentences explain its rules.
const firstSentence = (text = '') => { const at = text.indexOf('. '); return at === -1 ? text : text.slice(0, at + 1); };

// A number that counts up to its real value (the app's number memory); the real value is read out.
function Rolled({ value, memoryKey }) {
  const { value: rolled, ink } = useCountUpState(value, { from: 0, duration: 900, memoryKey });
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
          <p className="na__why-marks"><strong><Rolled value={top.open} memoryKey="na-open-marks" /></strong><span>marks open in this chapter</span></p>
          <p className="na__why-detail">{[top.wrong ? `${top.wrong} wrong` : '', top.skip ? `${top.skip} left blank` : ''].filter(Boolean).join(' and ')} of {plural(top.n, 'question')}, over {plural(top.sessions, 'session')}.</p>
          <Link className="pr-link na__why-link" href="/mentor?tab=record">See your full record</Link>
        </div>
      </aside>
    );
  }
  if (plan.primary.kind === 'ordinary_practice') {
    return (
      <aside className="na__why na__why--shape" aria-label="Tonight’s session">
        <p className="na__why-marks"><strong><Rolled value={planned} memoryKey="na-minutes-tonight" /></strong><span>minutes tonight</span></p>
        <p className="na__why-detail">Marked +5 and −1, the CUET way. Every miss waits in Review with its explanation.</p>
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
function heroTitle(plan, top, planned) {
  if (plan.primary.kind !== 'ordinary_practice') return plan.primary.reason || plan.primary.title;
  if (top) return `${top.chapter} is where most marks are open.`;
  const { count, review } = practiceForMinutes(planned);
  return review ? `${count} questions, then a look at what you missed.` : `${count} questions against the clock.`;
}

export default function LearningNextAction({ compact = false, why = null }) {
  const tonightKey = `tonight-plan-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [plan, setPlan] = useState(null), [minutes, setMinutes] = useState(null), [error, setError] = useState(''), [retryCount, setRetryCount] = useState(0),[choosing,setChoosing]=useState(false);
  const [listening,setListening]=useState(false);
  const listenTimer=useRef(0);
  const planned = minutes ?? plan?.minutes ?? null;
  useEffect(() => () => window.clearTimeout(listenTimer.current), []);
  // Mobi tilts his head when you choose a time: an answer to the tap, then he settles.
  const listen = () => { setListening(false); window.clearTimeout(listenTimer.current); window.requestAnimationFrame(() => { setListening(true); listenTimer.current = window.setTimeout(() => setListening(false), 950); }); };
  useEffect(() => {
    let alive = true;
    apiGet(`/api/learning/plan${minutes===null?'':`?minutes=${minutes}`}`).then(p => { if (alive) { setPlan(p); setError(''); } }).catch(() => { if (alive) setError('Your plan could not be loaded. Your saved attempts are still available in Review.'); });
    return () => { alive = false; };
  }, [minutes, retryCount]);
  const retry = () => { setPlan(null); setError(''); setRetryCount(n => n + 1); };
  const chooseTime=async n=>{
    if(choosing || n===(minutes ?? plan?.minutes))return;
    listen();
    if(!plan?.study?.preferences){setPlan(null);setError('');setMinutes(n);return;}
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
      <section className="na na--compact" aria-label="Your next step">
        <span className="na__icon" aria-hidden="true"><AppIcon name="today" size={18} /></span>
        {error ? (
          <div className="na__body"><p className="na__reason" role="alert">{error}</p><button type="button" className="pr-link" onClick={retry}>Try again</button></div>
        ) : !plan ? (
          <div className="na__body"><p className="na__reason" role="status">Loading your next step…</p></div>
        ) : (
          <>
            <div className="na__body"><span className="na__eyebrow">Your next step</span><b className="na__title">{plan.primary.title}</b><p className="na__reason">{firstSentence(plan.primary.reason)}</p></div>
            <Link className="btn-volt md na__cta mk-press" href={plan.primary.href}>Start<ArrowRight size={16} aria-hidden="true" /></Link>
          </>
        )}
      </section>
    );
  }

  // Tonight's plan leads the page; the install prompt waits under it.
  return (<>
    <section className="na na--hero" aria-label="Tonight’s plan">
      <ArenaCompanion act={error ? 'oops' : !plan ? 'think' : listening ? 'tilt' : 'idle'} pose={error ? 'encouraging' : 'attentive'} title={error ? 'Try your record again.' : !plan ? 'Reading your record.' : 'Pick the time you have.'}>{error ? 'Review still has your saved sessions.' : !plan ? 'Tonight’s plan is a moment away.' : 'The set fits it, one question a minute.'}</ArenaCompanion>
      <div className="na__grid">
        <div className="na__plan">
          <span className="na__eyebrow"><AppIcon name="today" size={14} />Tonight’s plan{planned ? <MinutesRoll value={planned} /> : null}</span>
          {plan && !error ? <h2 className="na__title na__title--hero">{heroTitle(plan, top, planned)}</h2> : null}
          <fieldset className="na__time">
            <legend className="sr-only">Time for practice</legend>
            <SegmentedControl size="sm" label="Time for practice" value={minutes ?? plan?.minutes} busy={choosing} onChange={chooseTime} options={TIME_OPTIONS} />
          </fieldset>
          {error ? (
            <div className="pr-alert" data-tone="error" role="alert"><StatusIcon kind="error" /><div>{error} <button type="button" className="pr-link" onClick={retry}>Try again</button> <Link className="pr-link" href="/review">Open Review</Link></div></div>
          ) : !plan ? (
            <div className="na__skeleton" role="status" aria-label="Loading tonight’s plan"><i /><i /><i /></div>
          ) : (
            <>
              {plan.tonight?.state === 'recorded' ? <div className="pr-alert" data-tone="good" role="status"><AppIcon name="check" size={18} /><div><b>Tonight’s practice is recorded.</b> <Link className="pr-link" href={`/result/${plan.tonight.sessionId}`}>Review that session</Link>{plan.tonight.reviewMinutes ? <p>Your 30-minute plan also has 10 minutes of review.</p> : null}</div></div> : null}
              {plan.primary.kind === 'ordinary_practice' && top ? <p className="na__reason">{firstSentence(plan.primary.reason)}</p> : null}
              {plan.sequence?.length > 1 ? <ol className="study-sequence" aria-label="Your study session">{plan.sequence.map((step,index)=><li key={`${step.kind}-${index}`}><span aria-hidden="true">{index+1}</span><div><Link href={step.href}>{step.title}</Link>{step.purpose ? <p>{step.purpose}</p> : null}<small>About {step.estimatedMinutes} min{step.done ? ` · ${step.done}` : ''}</small></div></li>)}</ol> : null}
              <div className="na__actions">
                <Link className="btn-volt md na__cta mk-press" href={startHref}>{plan.primary.title}<ArrowRight size={16} aria-hidden="true" /></Link>
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
    <InstallPractice /></>
  );
}
