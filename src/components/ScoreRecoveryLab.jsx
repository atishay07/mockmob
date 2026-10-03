"use client";
import Link from 'next/link';
import { useState } from 'react';
import { apiPost } from '@/lib/fetcher';
import { ArrowRight } from 'lucide-react';
import { attemptScoring, isRecoverySession } from '@/../data/attempt_scoring';
import LearningNextAction from './LearningNextAction';

export default function ScoreRecoveryLab({ attempt }) {
  const [step, setStep] = useState(0);
  const [reflection,setReflection]=useState('');
  const [saveState,setSaveState]=useState('');
  const recovery = attempt.selectionMeta?.recovery;
  if (!recovery || attemptScoring(attempt) !== 'server') return attemptScoring(attempt) === 'server' ? (
    <section className="recovery-lab">
      <h2>Scored on our server</h2><p>This practice session was marked against its question snapshot. A replay is available for new sessions when a valid event record is captured.</p><LearningNextAction compact/>
      <Link href="/dashboard">Choose your next practice <ArrowRight size={18} aria-hidden="true"/></Link></section>
  ) : (
    <section className="recovery-lab">
      <h2>Score Recovery Lab needs more evidence</h2><p>This earlier attempt was scored in your browser before server scoring. Start a new practice session to build your recovery record.</p>
      <Link href="/dashboard">Choose a practice session <ArrowRight size={18} aria-hidden="true"/></Link></section>
  );
  const events = recovery.timeline || [];
  const event = events[step];
  const questionIndex = event ? attempt.questionsSnapshot.findIndex(q => q.id === event.qid) : -1;
  const change = recovery.observed.answerChanges.find(c => c.qid === event?.qid && c.at === event?.at);
  const firstWrong = attempt.details.find(d => d.isCorrect === false);
  const chapter = attempt.questionsSnapshot.find(q => q.id === firstWrong?.qid)?.chapter;
  const practice = () => `/test?${new URLSearchParams({ subject: attempt.subject, count: '5', mode: 'quick',
    generationKey: crypto.randomUUID(), recoveryFrom: attempt.id, ...(chapter ? { chapter } : {}) })}`;
  return <section className="recovery-lab" aria-labelledby="recovery-title">
    
    <h2 id="recovery-title">Score Recovery Lab</h2>
    <LearningNextAction compact/>
    <div className="recovery-facts">
      <div><strong>{attempt.correct * 5 - attempt.wrong}</strong><span>marks scored · +5 / −1</span></div>
      <div><strong>{recovery.observed.answerChanges.length}</strong><span>recorded answer changes</span></div>
      <div><strong>{recovery.observed.unanswered}</strong><span>left unanswered</span></div>
    </div>
    <p>Answer changes are observations from your device. Unanswered questions alone do not tell us whether you ran out of time or chose to skip.</p>
    {Number.isFinite(recovery.observed.netFirstToFinal)&&<p>Net first-to-final effect: {recovery.observed.netFirstToFinal > 0 ? '+' : ''}{recovery.observed.netFirstToFinal} marks under this answer key. Individual changes can help or hurt; this is not a forecast of recoverable marks.</p>}
    <div className="recovery-replay">
      <h3>Replay your decisions</h3>
      {events.length ? <>
        <label htmlFor="recovery-position">Event {step + 1} of {events.length}</label>
        <input id="recovery-position" type="range" min="0" max={events.length - 1} value={step} onChange={e => setStep(Number(e.target.value))}/>
        <p aria-live="polite">{Math.floor(event.at / 60000)}m {Math.floor(event.at / 1000) % 60}s · Question {questionIndex + 1} · {event.type === 'visit' ? 'Visited' : event.answer === null ? 'Cleared answer' : `Selected ${'ABCD'[event.answer]}`}{change ? ` · ${change.markEffect > 0 ? '+' : ''}${change.markEffect} marks from this change` : ''}</p>
      </> : <p>{recovery.telemetry === 'inconsistent' ? 'The event record disagreed with your submitted answers, so replay is unavailable.' : 'No decision timeline was captured. Your score is still available.'}</p>}
    </div>
    <div className="recovery-next">
      <h3>{recovery.recommendation.title}</h3>
      <p>This intervention is a suggestion inferred from your attempt.</p>
      <p>{chapter ? `Review your explanation for ${chapter}, then try five fresh questions.` : 'Try five fresh questions with a first pass for confident answers and a second pass for uncertain ones.'} Compare completion and accuracy before keeping the strategy.</p>
      <a className="recovery-action" href="/dashboard" onClick={e => { e.preventDefault(); window.location.assign(practice()); }}>Start fresh practice <ArrowRight size={18} aria-hidden="true"/></a>
      <p className="recovery-note">Fresh content may be unavailable. Repeated questions do not count as evidence of improvement. Score differences between uncalibrated sets are not proof of a causal gain.</p>
      <form onSubmit={async e=>{e.preventDefault();setSaveState('Saving…');try{await apiPost('/api/recovery',{attemptId:attempt.id,strategy:chapter?'concept_repair':'two_pass',reflection});setSaveState('Saved to your playbook. Fresh checks are still needed.');}catch{setSaveState('Could not save. Your reflection remains here; try again.');}}}>
        <label htmlFor="recovery-reflection">What happened, and what will you try next?</label>
        <textarea id="recovery-reflection" maxLength={1000} value={reflection} onChange={e=>setReflection(e.target.value)} placeholder="For example: I changed my answer without finding a new reason."/>
        <button type="submit" className="recovery-action" disabled={saveState==='Saving…'}>Save to my playbook</button>
        <p role="status">{saveState}</p>
      </form>
    </div>
  </section>;
}
