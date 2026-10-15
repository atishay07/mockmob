'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {apiGet} from '@/lib/fetcher';

export default function MistakeReplay({attemptId}){
  const [data,setData]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const router=useRouter();
  useEffect(()=>{let alive=true;apiGet(`/api/recovery/replay?attemptId=${encodeURIComponent(attemptId)}`).then(d=>{if(alive){setData(d);setError('');}}).catch(()=>{if(alive)setError('Fresh practice could not be checked. Your result is still available.');});return()=>{alive=false;};},[attemptId,retry]);
  return <section className="recovery-lab mistake-replay" aria-labelledby="mistake-replay-title">
    <h2 id="mistake-replay-title">Practise the chapter you missed</h2>
    <p>Five unseen questions from the same chapter, when a set is ready.</p>
    {error?<p role="alert">{error} <button className="pr-link" type="button" onClick={()=>{setError('');setData(null);setRetry(n=>n+1);}}>Try again</button></p>:!data?<p role="status">Looking for a fresh set</p>:data.chapters.length?<ul className="ov-list">{data.chapters.map(c=><li className="ov-row" key={c.chapter}><b>{c.chapter}</b>{c.state==='available'?<button className="recovery-action" type="button" onClick={()=>router.push(`${c.href}&generationKey=${crypto.randomUUID()}`)}>Try five fresh questions</button>:<span>Fresh verified questions are not ready yet.</span>}</li>)}</ul>:<p>No eligible missed chapters in this record.</p>}
    <p className="recovery-note">Reading an explanation and repeating a question do not show the mistake is fixed.</p>
  </section>;
}
