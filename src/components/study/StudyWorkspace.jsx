"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Volume2, Check, BookOpenText, Brain, Printer } from 'lucide-react';
import { api, apiGet, apiPost } from '@/lib/fetcher';
import ArenaHead from '@/components/arena/ArenaHead';
import { SubjectIcon } from '@/components/ui/Glyph';
import './study.css';

const SUBJECTS = [['english','English'],['accountancy','Accountancy'],['business_studies','Business Studies'],['economics','Economics']];
const friendlyError = error => error?.status===409 ? 'This session changed in another tab. Reload the saved step to continue.' : /CONTENT_CHANGED/.test(error?.message || '') ? 'This lesson has been corrected or withdrawn. Open Learn to start with current material.' : /PREMIUM_REQUIRED/.test(error?.message || '') ? 'A saved weekly plan and custom mixed revision are Pro features. Standard lessons and recall remain free.' : /UNAVAILABLE|NOT_FOUND/.test(error?.message || '') ? 'This activity is not available yet. Choose another published lesson or take a mock.' : 'Your action could not be saved. Keep this page open and retry; your answer is still here.';
export default function StudyWorkspace({unitId=null,runId=null,preview=null,autoRecall=false}) {
  const router=useRouter();
  const [catalog,setCatalog]=useState(null),[unit,setUnit]=useState(null),[run,setRun]=useState(null),[subject,setSubject]=useState('english'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[answer,setAnswer]=useState(''),[selected,setSelected]=useState(null),[assisted,setAssisted]=useState(false),[notice,setNotice]=useState(''),[prefs,setPrefs]=useState(null);
  const pending=useRef(null),startKey=useRef(null),heading=useRef(null),speech=useRef(null);
  const [hasPending,setHasPending]=useState(false);
  const transport=preview?.transport;
  const get = path => transport ? transport('GET',path) : apiGet(path);
  const post = (path,input) => transport ? transport('POST',path,input) : apiPost(path,input);
  const reload=async()=>{
    setError('');setBusy(true);
    try {
      if(runId) {
        const next=await get(`/api/study/runs/${encodeURIComponent(runId)}`);setRun(next);
        if(next.item?.id!==run?.item?.id){setAnswer('');setSelected(null);setAssisted(false);requestAnimationFrame(()=>heading.current?.focus());}
      }
      else if(unitId) setUnit(await get(`/api/study/units/${encodeURIComponent(unitId)}`));
      else { const data=await get('/api/study/catalog');setCatalog(data);setPrefs(data.preferences || null); }
    } catch(e) {setError(friendlyError(e));} finally {setBusy(false);}
  };
  useEffect(()=>{let alive=true;const path=runId?`/api/study/runs/${encodeURIComponent(runId)}`:unitId?`/api/study/units/${encodeURIComponent(unitId)}`:'/api/study/catalog';
    (transport ? transport('GET',path) : apiGet(path)).then(data=>{if(!alive)return;if(runId)setRun(data);else if(unitId)setUnit(data);else {setCatalog(data);setPrefs(data.preferences || null);}}).catch(e=>{if(alive)setError(friendlyError(e));});
    return()=>{alive=false;speech.current?.cancel();};
  },[unitId,runId,transport]);
  const start=async(mode,id,mixed=false)=>{
    setBusy(true);setError('');
    const intent=`${mode}:${id || ''}:${mixed}`;
    if(startKey.current?.intent!==intent) startKey.current={intent,key:crypto.randomUUID()};
    try {const data=await post('/api/study/runs',{mode,unitId:id,requestKey:startKey.current.key,mixed});startKey.current=null;if(transport) {setRun(data);setUnit(null);}else router.push(`/study/${data.id}`);}
    catch(e){setError(friendlyError(e));}finally{setBusy(false);}
  };
  useEffect(()=>{if(autoRecall && catalog?.queue?.availableCount && !run && !startKey.current) { // User followed the explicit recall action from Today.
    const key=crypto.randomUUID();startKey.current={intent:'recall::false',key};
    (transport ? transport('POST','/api/study/runs',{mode:'recall',requestKey:key}) : apiPost('/api/study/runs',{mode:'recall',requestKey:key})).then(data=>{if(transport)setRun(data);else router.push(`/study/${data.id}`);}).catch(e=>setError(friendlyError(e)));
  }},[autoRecall,catalog,run,router,transport]);
  const send=async(event)=>{
    if(!run || busy) return;
    const input=pending.current || {...event,itemId:run.item.id,expectedRevision:run.revision,requestKey:crypto.randomUUID()};
    pending.current=input;setHasPending(true);setBusy(true);setError('');
    try {const next=await post(`/api/study/runs/${run.id}/events`,input);pending.current=null;setHasPending(false);setRun(next);
      if(next.cursor!==run.cursor){setAnswer('');setSelected(null);setAssisted(false);requestAnimationFrame(()=>heading.current?.focus());}
    } catch(e) {setError(friendlyError(e));}finally{setBusy(false);}
  };
  const pronounce=word=>{
    if(!('speechSynthesis' in window)){setNotice('Pronunciation audio is unavailable on this device. The word and meaning remain available.');return;}
    speech.current=window.speechSynthesis;speech.current.cancel();const utterance=new SpeechSynthesisUtterance(word);utterance.lang='en-GB';utterance.rate=0.85;utterance.onerror=()=>setNotice('Audio could not play. Try again or continue without it.');speech.current.speak(utterance);setNotice('Device-generated pronunciation. Voices vary by device.');
  };
  const errorBox=error ? <div className="study-alert" role="alert"><p>{error}</p><button type="button" onClick={()=>{if(pending.current && run)send(pending.current);else reload();}} disabled={busy}>{hasPending?'Retry save':'Reload saved activity'}</button>{hasPending && <button type="button" onClick={()=>{pending.current=null;setHasPending(false);reload();}}>Reload saved step</button>}<Link href="/learn">Open Learn</Link></div> : null;
  if(run) {
    const item=run.item;
    return <div className="study-workspace study-workspace--run">
      <Link className="study-back" href="/learn" onClick={transport?e=>{e.preventDefault();setRun(null);setUnit(null);}:undefined}><ArrowLeft size={16}/>Back to Learn</Link>
      <div className="study-run-head"><span>{run.mode==='recall'?'Recall':'Learn'} · {run.title}</span><span>{run.state==='complete'?'Complete':`${run.cursor+1} of ${run.total}`}</span></div>
      <progress className="study-progress" value={run.cursor} max={run.total} aria-label="Steps completed" />
      {errorBox}
      {run.state==='complete' ? <section className="study-complete"><Check size={30} aria-hidden="true"/><h1 ref={heading} tabIndex={-1}>Saved. A little further along.</h1><p>{run.mode==='recall'?'Your ratings and checked answers have scheduled the next reviews.':'You completed this lesson’s learning activities.'}</p><p className="study-muted">This is study progress. Fresh, unassisted assessments provide separate evidence.</p><div className="study-actions"><Link className="btn-volt md" href="/today">Back to Today</Link><Link className="study-button" href={`/dashboard?subject=${run.units[0]?.subject || unit?.subject || catalog?.units?.find(u=>u.id===run.units[0]?.id)?.subject || 'english'}`}>Choose practice<ArrowRight size={16}/></Link></div></section>
      : <section className="study-stage" aria-busy={busy}>
        <div className="study-stage-label">{item.kind==='knowledge_check'?'Unscored knowledge check':run.mode==='recall'?item.objective:item.kind?.replaceAll('_',' ')}</div>
        <h1 ref={heading} tabIndex={-1}>{item.title || item.prompt}</h1>
        {item.type==='reading' ? <><p className="study-prose">{item.body}</p>{item.rows ? <div className="study-table"><table><caption className="sr-only">Worked share calculation</caption><thead><tr>{item.rows[0].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{item.rows.slice(1).map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table></div> : null}<button className="btn-volt md" type="button" onClick={()=>send({type:'continue'})} disabled={busy || hasPending}>Continue<ArrowRight size={16}/></button></>
        : <>
          {item.title && item.prompt ? <p className="study-prose">{item.prompt}</p>:null}
          {run.revealed ? <div className="study-feedback" role="status" aria-live="polite"><b>{run.feedback?.correct===true?'That’s right.':run.feedback?.correct===false?'Try the distinction again.':'The answer'}</b><p className="study-answer">{run.feedback?.answer}</p><p>{run.feedback?.explanation}</p>{run.feedback?.cue && <p className="study-muted">{run.feedback.cue}</p>}
          {item.word && <button className="study-button" type="button" onClick={()=>pronounce(item.word)}><Volume2 size={18}/>Hear {item.word}</button>}
          {run.mode==='recall' && item.unitId && <Link className="study-button" href={`/learn/${item.unitId}`}><BookOpenText size={18}/>Open the linked lesson</Link>}
          {run.mode==='recall' && item.type==='reveal' ? <fieldset className="study-ratings"><legend>How well did you recall it?</legend>{['Forgot','With effort','Recalled','Easy'].map((label,i)=><button key={label} type="button" onClick={()=>send({type:'rate',rating:i+1})} disabled={busy || hasPending}>{label}</button>)}</fieldset> : <button className="btn-volt md" type="button" onClick={()=>send({type:'continue'})} disabled={busy || hasPending}>Continue<ArrowRight size={16}/></button>}
          </div>
          : item.type==='reveal' ? <><p className="study-muted">Try to answer from memory. Reveal when you’re ready.</p><button className="btn-volt md" type="button" onClick={()=>send({type:'reveal'})} disabled={busy || hasPending}>Reveal answer</button></>
          : <form onSubmit={e=>{e.preventDefault();send({type:'answer',value:item.type==='choice'?selected:answer,assisted});}}>
            {item.type==='choice' ? <fieldset className="study-options"><legend className="sr-only">Choose your answer</legend>{item.options.map((option,i)=><label key={option}><input type="radio" name={item.id} value={i} checked={selected===i} onChange={()=>setSelected(i)} disabled={busy}/><span>{option}</span></label>)}</fieldset> : <label className="study-field">Your answer<input type="text" value={answer} onChange={e=>setAnswer(e.target.value)} maxLength={200} autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={busy}/></label>}
            <label className="study-help"><input type="checkbox" checked={assisted} onChange={e=>setAssisted(e.target.checked)} disabled={busy}/>I used help or looked it up</label>
            <div className="study-actions"><button className="btn-volt md" type="submit" disabled={busy || hasPending || (item.type==='choice'?selected===null:!answer.trim())}>Check answer</button><button className="study-button" type="button" disabled={busy || hasPending} onClick={()=>send({type:'answer',value:item.type==='choice'?-1:'',assisted})}>I don’t know</button></div>
          </form>}
        </>}
        {notice && <p role="status" className="study-muted">{notice}</p>}
      </section>}
      {run.lastReview?.lessonRecommended && <p className="study-alert">This card has been missed several times. <Link href={`/learn/${run.lastReview.unitId}`}>Revisit its lesson</Link> before the next review.</p>}
      <p className="study-save">{busy?'Saving your action…':'Each completed action is saved. You can leave and resume from Today.'}</p>
    </div>;
  }
  if(unit) return <div className="study-workspace"><Link className="study-back" href="/learn" onClick={transport?e=>{e.preventDefault();setUnit(null);}:undefined}><ArrowLeft size={16}/>All lessons</Link><ArenaHead title={unit.title} lede={unit.summary}/><div className="study-lesson-meta"><SubjectIcon id={unit.subject}/>{SUBJECTS.find(s=>s[0]===unit.subject)?.[1]} · {unit.chapter} · About {unit.estimatedMinutes} min</div>{errorBox}
    <div className="study-actions"><button className="btn-volt md" type="button" onClick={()=>start('learn',unit.id)} disabled={busy}>Start / resume lesson<ArrowRight size={16}/></button><button className="study-button" type="button" onClick={()=>start('recall',unit.id)} disabled={busy}>Recall this concept<Brain size={16}/></button><Link className="study-button" href={`/dashboard?${new URLSearchParams({subject:unit.subject,chapter:unit.chapter})}`}>Practise<ArrowRight size={16}/></Link></div>
    <p className="study-muted">Lessons and standard recall use no practice or AI credits. Practice shows access and cost before starting.</p>
    <section className="study-outline"><h2>Inside this lesson</h2><ol>{unit.blocks.map(b=><li key={b.id}><span>{b.title}</span><small>{b.kind.replaceAll('_',' ')}</small></li>)}</ol></section>
    <details className="study-sources"><summary>Sources and content version</summary><p>Version {unit.version} · Self-study companion for your books or coaching.</p>{unit.sourceRefs.map(s=><div key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a><p>{s.permission}</p>{s.license && <pre>{s.license}</pre>}</div>)}</details>
    <button type="button" className="study-button study-print" onClick={()=>window.print()}><Printer size={16}/>Print chapter summary</button><section className="study-print-content"><h2>{unit.title}</h2>{unit.blocks.filter(b=>b.type==='reading').map(b=><div key={b.id}><h3>{b.title}</h3><p>{b.body}</p></div>)}</section>
  </div>;
  return <div className="study-workspace"><ArenaHead title="Learn it. Remember it. Use it." lede="A companion to your books and coaching. Short lessons, deliberate recall, then practice under exam conditions."/>{errorBox}
    {!catalog ? <p role="status">Loading your learning library…</p> : <>
      <section className="study-recall-banner"><div><Brain size={24} aria-hidden="true"/><h2>{catalog.queue.dueCount ? `${catalog.queue.dueCount} cards ready to revisit`:'Make a little room for recall'}</h2><p>{catalog.queue.pausedNew?'A smaller catch-up session. New cards will wait while the backlog reduces.':'Try first. Check the answer. Let your next review follow from today’s recall.'}</p></div><button className="btn-volt md" type="button" disabled={busy || !catalog.queue.availableCount || !catalog.recallEnabled} onClick={()=>start('recall')}>{catalog.active?.mode==='recall'?'Resume recall':'Start recall'}<ArrowRight size={16}/></button></section>
      {catalog.active && <Link className="study-resume" href={`/study/${catalog.active.id}`}>Resume your saved {catalog.active.mode==='learn'?'lesson':'recall'} session<ArrowRight size={16}/></Link>}
      <div className="study-subjects" role="group" aria-label="Subject">{SUBJECTS.map(([id,title])=><button key={id} type="button" aria-pressed={id===subject} onClick={()=>setSubject(id)}><SubjectIcon id={id} size={18}/>{title}</button>)}</div>
      <StudyLibrary key={subject} subject={subject} units={catalog.units.filter(u=>u.subject===subject)} openUnit={transport?id=>get(`/api/study/units/${id}`).then(setUnit).catch(e=>setError(friendlyError(e))):null}/>
      <details className="study-coverage"><summary>See chapter coverage and gaps</summary><p>Based on the existing CUET UG 2026 map. The 2027 syllabus remains provisional. A listed chapter does not mean lessons are available.</p><ul>{catalog.subjects.find(s=>s.subject===subject)?.chapters.map(c=><li key={c.id}><span>{c.title}</span><small>{catalog.units.some(u=>u.subject===subject && u.chapter===c.title)?'Partial lesson coverage':'Lessons pending'}</small></li>)}</ul></details>
      <div className="study-facts"><span><b>{catalog.progress.lessonsRead}</b> lessons completed</span><span><b>{catalog.progress.recallReviews}</b> recall responses</span><Link href="/progress">View assessment results separately<ArrowRight size={16}/></Link></div>
      {prefs && <StudyPreferences prefs={prefs} units={catalog.units} setPrefs={setPrefs} transport={transport} setNotice={setNotice} setError={setError}/>}
      {notice && <p role="status" className="study-muted">{notice}</p>}
      <Link className="study-mock" href="/dashboard?mode=full">Ready for exam conditions? Take a mock<ArrowRight size={18}/></Link>
    </>}
  </div>;
}
function StudyLibrary({subject,units,openUnit}) {
  const [chapter,setChapter]=useState(null);
  const chapters=[...new Set(units.map(unit=>unit.chapter))];
  const visible=chapter ? units.filter(unit=>unit.chapter===chapter) : units;
  return <section className="study-library" aria-label="Learning library"><div className="study-library-head"><h2>{chapter || SUBJECTS.find(s=>s[0]===subject)?.[1]}</h2><span>{units.length} published {units.length===1?'lesson':'lessons'}</span></div>
    {chapter && <button className="study-back" type="button" onClick={()=>setChapter(null)}><ArrowLeft size={16}/>All chapters</button>}
    {!units.length ? <div className="study-empty"><h3>Lessons are still being prepared.</h3><p>Only sourced, validated material appears here. You can keep practising available questions while this library grows.</p><Link className="study-button" href={`/dashboard?subject=${subject}`}>Choose practice<ArrowRight size={16}/></Link></div>
    : chapters.length>1 && !chapter ? chapters.map(name=><button key={name} className="study-chapter-row" type="button" onClick={()=>setChapter(name)}><span><b>{name}</b><small>{units.filter(unit=>unit.chapter===name).length} available concepts</small></span><ArrowRight size={18}/></button>)
    : visible.map(u=><article className="study-lesson-row" key={u.id}><span className="study-lesson-icon"><BookOpenText size={24}/></span><div><small>{u.chapter}</small><h3><Link href={`/learn/${u.id}`} onClick={openUnit?e=>{e.preventDefault();openUnit(u.id);}:undefined}>{u.title}</Link></h3><p>{u.summary}</p><span>{u.read?'Lesson completed · ':'About '+u.estimatedMinutes+' min · '}{u.cardCount} recall cards</span></div><ArrowRight size={18}/></article>)}
  </section>;
}
function StudyPreferences({prefs,units,setPrefs,transport,setNotice,setError}) {
  const [mixedUnits,setMixedUnits]=useState(units.map(u=>u.id));
  const [subjects,setSubjects]=useState(prefs.subjects),[minutes,setMinutes]=useState(prefs.minutes),[saving,setSaving]=useState(false),[weekly,setWeekly]=useState(prefs.weeklyPlan || Array.from({length:7},(_,i)=>({subject:prefs.subjects[i%prefs.subjects.length],minutes:prefs.minutes})));
  const save=async(plan=false)=>{setSaving(true);try{const input={subjects,minutes,expectedRevision:prefs.revision,...(plan?{weeklyPlan:weekly}:{})};const next=transport?await transport('PUT','/api/study/preferences',input):await api('/api/study/preferences',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});setPrefs(next);setNotice('Study preferences saved. Today will use these choices.');}catch(e){setError(friendlyError(e));}finally{setSaving(false);}};
  return <details className="study-preferences"><summary>Study preferences and weekly plan</summary><fieldset><legend>Your subjects</legend>{SUBJECTS.map(([id,title])=><label className="study-help" key={id}><input type="checkbox" checked={subjects.includes(id)} onChange={e=>setSubjects(e.target.checked?[...subjects,id]:subjects.filter(s=>s!==id))}/>{title}</label>)}</fieldset><label className="study-field">Usual time<select value={minutes} onChange={e=>setMinutes(Number(e.target.value))}>{[10,20,30].map(n=><option key={n} value={n}>{n} minutes</option>)}</select></label><button className="study-button" type="button" disabled={saving || !subjects.length} onClick={()=>save()}>Save preferences</button>
    {prefs.premium && <fieldset><legend>Concepts for custom mixed revision</legend>{units.map(u=><label className="study-help" key={u.id}><input type="checkbox" checked={mixedUnits.includes(u.id)} onChange={e=>setMixedUnits(e.target.checked?[...mixedUnits,u.id]:mixedUnits.filter(id=>id!==u.id))}/>{u.title}</label>)}</fieldset>}
    <h3>A realistic week</h3>{prefs.premium ? <><div className="study-week">{['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((day,i)=><div key={day}><span>{day}</span><label><span className="sr-only">{day} subject</span><select value={weekly[i].subject} onChange={e=>setWeekly(weekly.map((d,j)=>j===i?{...d,subject:e.target.value}:d))}>{SUBJECTS.map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label><label><span className="sr-only">{day} minutes</span><select value={weekly[i].minutes} onChange={e=>setWeekly(weekly.map((d,j)=>j===i?{...d,minutes:Number(e.target.value)}:d))}>{[10,20,30].map(n=><option key={n} value={n}>{n} min</option>)}</select></label></div>)}</div><button type="button" className="study-button" disabled={saving || !subjects.length} onClick={()=>save(true)}>Save weekly plan</button><button type="button" className="study-button" disabled={!mixedUnits.length} onClick={()=>transport?transport('POST','/api/study/runs',{mode:'recall',mixed:true,unitIds:mixedUnits,requestKey:crypto.randomUUID()}).then(()=>setNotice('Mixed recall is ready. Open Today to resume.')).catch(e=>setError(friendlyError(e))):apiPost('/api/study/runs',{mode:'recall',mixed:true,unitIds:mixedUnits,requestKey:crypto.randomUUID()}).then(()=>setNotice('Mixed recall is ready. Open Today to resume.')).catch(e=>setError(friendlyError(e)))}>Prepare mixed revision</button></> : <p>Saved weekly planning and custom mixed revision are included with Pro. Essential lessons, standard recall and daily recommendations are Free. <Link href="/pricing">See your current plan options</Link></p>}
  </details>;
}
