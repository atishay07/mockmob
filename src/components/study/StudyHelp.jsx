"use client";
import { useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { apiPost } from '@/lib/fetcher';

export default function StudyHelp({runId,revision,itemId,preview=false}) {
  const [question,setQuestion]=useState('Explain this more simply with an example.'),[busy,setBusy]=useState(false),[reply,setReply]=useState(''),[error,setError]=useState(''),[sent,setSent]=useState(false),[pending,setPending]=useState(false);
  const request=useRef(null),flight=useRef(false);
  const ask=async e=>{
    e.preventDefault(); if(flight.current || sent || !question.trim()) return;
    flight.current=true;setBusy(true);setError('');
    request.current ||= {message:question.trim(),mode:'revision',studyRunId:runId,studyRevision:revision,studyItemId:itemId,requestId:crypto.randomUUID().replaceAll('-','')};
    setPending(true);
    try { const out=await apiPost('/api/ai/mentor/chat',request.current);setReply(out.reply || out.response?.reply || 'Open PrepOS to continue.');setSent(true); }
    catch(e){
      const code=e.message || '';
      setError(e.body?.message || (/insufficient|402/.test(code) ? 'You have no AI credits left. The lesson and recall cards remain free.' : 'The reply could not be confirmed. Retry this same request; it will not start a second paid reply.'));
      if(e.body?.status==='resend' || e.body?.status==='failed') {request.current=null;setPending(false);}
    }finally{flight.current=false;setBusy(false);}
  };
  if(preview) return <p className="sx-small">AI help is available in a saved, signed-in lesson. Standard cards use no AI credits.</p>;
  return <details className="sx-tutor"><summary><Sparkles size={18} aria-hidden="true" />Need another explanation? <span>1 PrepOS credit</span></summary>
    <p className="sx-small">Optional AI help uses this lesson’s published content. It does not change your marks or create review cards.</p>
    {reply ? <p className="sx-tutor__reply" role="status">{reply}</p> : <form onSubmit={ask}><label className="sx-field"><span>Your question</span><textarea value={question} onChange={e=>setQuestion(e.target.value)} disabled={busy || pending} maxLength={500} rows={3} /></label>
      <button type="submit" className="sx-secondary" disabled={busy || !question.trim()}>{busy ? 'Preparing your explanation…' : pending ? 'Retry the same request' : 'Ask AI · 1 credit'}</button></form>}
    {error ? <p className="sx-alert" role="alert">{error} <Link className="sx-link" href="/mentor">Check your PrepOS history</Link></p> : null}
    <p className="sx-small">Use the source lesson to check the reply. Lessons and scheduled review use no AI credits.</p>
  </details>;
}
