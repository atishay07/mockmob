"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/fetcher';
import ArenaHead from '@/components/arena/ArenaHead';
import { LAUNCH_SUBJECTS } from '@/../shared/recoveryContract';
import { EmptyMobi, FailedMobi } from '@/components/ui/StateMobi';
import { screenAct } from '@/lib/mobiScreens';
export default function RecoveryJourney() {
  const params = useSearchParams();
  const [plan,setPlan] = useState(null), [episode,setEpisode] = useState(null), [value,setValue] = useState(''), [busy,setBusy] = useState(false), [error,setError] = useState(''), [planRetry,setPlanRetry] = useState(0);
  const requestKey = useRef(null);
  function keyFor(payload) {
    const fingerprint = JSON.stringify(payload);
    if (requestKey.current?.fingerprint !== fingerprint) requestKey.current = { fingerprint, key: crypto.randomUUID() };
    return requestKey.current.key;
  }
  useEffect(() => { let alive=true; apiGet('/api/learning/plan').then(p => { if(alive) {setPlan(p);setEpisode(p.episodes.find(e => e.id === params.get('episode')) || null);} }).catch(() => {if(alive)setError('Check your connection and try again, or open Your papers.');}); return()=>{alive=false;}; },[params,planRetry]);
  async function start(conceptId) {
    setBusy(true); setError('');
    try {setEpisode(await apiPost('/api/recovery/episodes',{conceptId,requestKey:keyFor({conceptId})})); requestKey.current=null;}
    catch(e){setError(e.body?.message || 'This pathway is unavailable. Your credits have not been used.');} finally{setBusy(false);}
  }
  async function respond(e) {
    e.preventDefault();setBusy(true);setError('');
    const payload={itemId:episode.step.id,type:episode.step.type,value:episode.step.type==='evidence_span'?value:Number(value)};
    try {const next=await apiPost(`/api/recovery/episodes/${episode.id}/responses`,{...payload,requestKey:keyFor({episodeId:episode.id,...payload})});setEpisode(next);setValue('');requestKey.current=null;}
    catch(e){setError(e.body?.message || 'Your response could not be saved. Try again; your answer is still here.');}finally{setBusy(false);}
  }
  function beginCheck() {
    const subject = episode.subject || plan.supportedConcepts.find(c => c.id === episode.conceptId)?.subject;
    if (!subject) {setError('The pathway is currently unavailable. Your credits have not been used.');return;}
    window.location.assign(`/test?${new URLSearchParams({subject,mode:'quick',count:'5',generationKey:crypto.randomUUID(),episodeId:episode.id})}`);
  }
  // Until a pathway is released the page says so plainly: one action, and a real empty state for a new student.
  const blocked = plan ? plan.pathwayState !== 'available' : false;
  const noRecord = plan ? (plan.ordinaryAttemptCount ?? 1) === 0 : false;
  return <section className="recovery-lab learning-journey">{!plan && error ? <ArenaHead title="This page did not load." lede="Your saved sessions and mistakes are safe." /> : blocked ? <ArenaHead title="Recovery steps open soon." lede="Until then, review your mistakes or keep practising. Nothing you do now is lost." /> : <ArenaHead title="Check one reasoning gap." lede="Practise the missing step, then check it on a fresh question later." />}
    {error && <p role="alert">{error}</p>}{!plan&&!error&&<p role="status">Loading your learning record…</p>}{!plan&&error&&<div className="recovery-next"><FailedMobi size={72} /><button type="button" className="recovery-action" data-page-primary="" onClick={()=>{setError('');setPlanRetry(n=>n+1);}}>Try again</button><Link href="/review">Open Your papers</Link></div>}
    {plan && !episode && <>
      {blocked ? (noRecord
        ? <div className="recovery-next"><EmptyMobi act={screenAct('recovery', 'noRecordYet')} size={72} /><h2>Nothing to review yet</h2><p>Finish a practice session first. Every miss lands in Your papers with its explanation.</p><Link className="recovery-action" data-page-primary="" href="/dashboard">Start practice</Link></div>
        : <div className="recovery-next"><h2>Your mistakes wait in Your papers</h2><p>Each miss there has its explanation and a way to practise the chapter again.</p><Link className="recovery-action" data-page-primary="" href="/review">Review your mistakes</Link><Link href="/dashboard">Start practice</Link></div>) : <>
        <h2>Start with an initial signal</h2><p>Five questions cannot diagnose a whole subject. Your mistakes can identify a distinction worth investigating.</p>
        <div className="learning-alternatives">{LAUNCH_SUBJECTS.map(s => <Link key={s.id} href={`/test?${new URLSearchParams({subject:s.id,count:'5',mode:'quick',purpose:'baseline',generationKey:crypto.randomUUID()})}`}>{s.label} baseline</Link>)}</div>
        <h2>Investigate a concept</h2>{plan.supportedConcepts.map(c => <button className="recovery-record" key={c.id} type="button" disabled={busy} onClick={()=>start(c.id)}>{c.title}</button>)}
      </>}
      {plan.episodes.map(e => <button type="button" className="recovery-record" key={e.id} onClick={()=>setEpisode(e)}><span>{e.title}</span><span>{e.evidenceLabel}</span></button>)}
    </>}
    {episode && <section className="recovery-next" aria-live="polite"><h2>{episode.title}</h2><p>{episode.diagnosisLabel}</p><p>{episode.evidenceLabel} · {episode.sampleSize} qualifying delayed checks</p>
      {episode.explanation&&<p>{episode.explanation}</p>}{episode.workedContrast&&<p>{episode.workedContrast}</p>}
      {episode.feedback&&<p role="status">{episode.feedback}</p>}
      {episode.step ? episode.step.kind==='scored_check' ? <><p>Your next check is unassisted and uses a fresh question family.</p><button className="recovery-action" data-page-primary="" type="button" onClick={beginCheck}>Start fresh check</button></> : <form onSubmit={respond}>
        <fieldset disabled={busy}><legend>{episode.step.prompt}</legend>
          {episode.step.type==='numeric_step' ? <><label htmlFor="reasoning-number">Your calculated value</label><input id="reasoning-number" type="number" step="any" required value={value} onChange={e=>setValue(e.target.value)}/></> : (episode.step.type==='evidence_span'?episode.step.spans:episode.step.options.map((o,i)=>({id:String(i),text:typeof o==='string'?o:o.text}))).map(o=><label className="learning-option" key={o.id}><input type="radio" name="response" required checked={value===String(o.id)} value={o.id} onChange={e=>setValue(e.target.value)}/>{o.text}</label>)}
        </fieldset><button className="recovery-action" data-page-primary="" disabled={busy||value===''}>{busy?'Saving…':'Check this reasoning step'}</button>
      </form> : <p>{episode.state==='blocked_content' || episode.state==='invalidated' ? 'This pathway is unavailable. Your existing history is preserved.' : episode.nextDueAt ? `Next fresh check: ${new Date(episode.nextDueAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST. Only a fresh question counts as a check.` : 'More fresh content is needed before another check can begin.'}</p>}
      <Link href="/today">Return to Today</Link>
    </section>}
  </section>;
}
