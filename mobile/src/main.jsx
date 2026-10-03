import React,{useEffect,useRef,useState} from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Home, BookOpen, RotateCcw, BarChart3, User, ArrowRight } from 'lucide-react';
import { storage } from './storage';
import { LAUNCH_SUBJECTS,createRecoveryApi } from '../../shared/recoveryContract';
import '../../shared/tokens.css';
import './style.css';

const env=import.meta.env;
const configured=Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY && /^https:\/\//.test(env.VITE_API_BASE_URL || ''));
const supabase=configured ? createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY,{auth:{storage,persistSession:true,detectSessionInUrl:false,autoRefreshToken:true}}) : null;
const api=createRecoveryApi({baseUrl:env.VITE_API_BASE_URL,getToken:async()=>(await supabase.auth.getSession()).data.session?.access_token});
const navigation=[['today','Today',Home],['practice','Practice',BookOpen],['review','Review',RotateCcw],['progress','Progress',BarChart3],['account','Account',User]];
// Called only by event handlers and timers, never to derive a render value.
function eventTime(){return Date.now();}
function parseCache(value,fallback){try{return value?JSON.parse(value):fallback;}catch{return fallback;}}
function Beta(){
 const [session,setSession]=useState(null),[ready,setReady]=useState(!configured),[tab,setTab]=useState('today');
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[sent,setSent]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [online,setOnline]=useState(navigator.onLine),[attempts,setAttempts]=useState([]),[draft,setDraft]=useState(null),[index,setIndex]=useState(0),[result,setResult]=useState(null),[now,setNow]=useState(()=>Date.now());
 const draftRef=useRef(null),syncing=useRef(false),ownerRef=useRef(null);
 const cacheKey=session?.user?.id;
 const hasDraft=Boolean(draft);
 async function refreshHistory(uid){
  const key=`reviews:${uid}`;
  try{const list=await api('/api/mobile/attempts');if(ownerRef.current!==uid)return;setAttempts(list);await storage.setItem(key,JSON.stringify(list));}
  catch{const cached=await storage.getItem(key).catch(()=>null);if(ownerRef.current===uid)setAttempts(parseCache(cached,[]));}
 }
 useEffect(()=>{
  if(!supabase)return;
  let alive=true;
  supabase.auth.getSession().then(({data})=>{if(alive){setSession(data.session);setReady(true);}});
  const {data}=supabase.auth.onAuthStateChange((_event,s)=>{ownerRef.current=s?.user?.id || null;setSession(s);setAttempts([]);setResult(null);setDraft(null);draftRef.current=null;});
  const resume=()=>{supabase.auth.startAutoRefresh();setNow(Date.now());};
  let listener;
  if(Capacitor.isNativePlatform()) NativeApp.addListener('appStateChange',({isActive})=>{if(isActive)resume();else supabase.auth.stopAutoRefresh();}).then(h=>{if(alive)listener=h;else h.remove();});
  return()=>{alive=false;data.subscription.unsubscribe();listener?.remove();};
 },[]);
 useEffect(()=>{
  const connected=()=>setOnline(true), disconnected=()=>setOnline(false);
  window.addEventListener('online',connected);window.addEventListener('offline',disconnected);
  return()=>{window.removeEventListener('online',connected);window.removeEventListener('offline',disconnected);};
 },[]);
 useEffect(()=>{
  if(!cacheKey)return;
  let alive=true;ownerRef.current=cacheKey;
  async function hydrate(){
   await refreshHistory(cacheKey);
   const saved=await storage.getItem(`draft:${cacheKey}`).catch(()=>null);
   const d=parseCache(saved,null);
   if(alive && ownerRef.current===cacheKey && Array.isArray(d?.session?.questions) && d.session.questions.length && Array.isArray(d.events)){
    setDraft(d);draftRef.current=d;setIndex(0);setTab('practice');
   }
  }
  hydrate();return()=>{alive=false;};
 },[cacheKey]);
 async function saveDraft(next){draftRef.current=next;setDraft(next);if(cacheKey)try{await storage.setItem(`draft:${cacheKey}`,JSON.stringify(next));}catch{setMessage('This device could not save the session locally. Keep the app open and connected.');}}
 async function synchronize(){
  const d=draftRef.current;if(!d || syncing.current || !navigator.onLine || Date.now()>Date.parse(d.session.expiresAt))return;
  syncing.current=true;
  try{const ack=await api('/api/sessions',{method:'PUT',body:{sessionId:d.session.id,events:d.events}});setMessage(`Saved ${ack.acknowledgedSequence} session events.`);}
  catch{setMessage('Answers are waiting to sync. Reconnect before the timer ends.');}
  finally{syncing.current=false;}
 }
 useEffect(()=>{if(!hasDraft)return;const timer=setInterval(()=>{setNow(Date.now());synchronize();},1500);return()=>clearInterval(timer);},[hasDraft]);
 async function run(action){if(busy)return;setBusy(true);setMessage('');try{await action();}catch(e){setMessage(e.message==='INSUFFICIENT_VERIFIED_CONTENT'?'Verified content is not ready for this selection. No credits were charged.':e.message==='RECOVERY_MIGRATION_REQUIRED'?'The beta backend is being prepared. Please try again after the pilot opens.':e.message);}finally{setBusy(false);}}
 async function start(subject){await run(async()=>{
  const s=await api('/api/sessions',{method:'POST',body:{subject,mode:'quick',count:5,generationKey:crypto.randomUUID()}});
  await saveDraft({session:s,answers:{},events:[{seq:1,qid:s.questions[0].id,type:'visit',at:Math.max(0,Date.now()-Date.parse(s.startedAt))}]});setIndex(0);setResult(null);setTab('practice');
 });}
 async function choose(answer){const d=draftRef.current;if(!d || eventTime()>=Date.parse(d.session.expiresAt))return;
  const q=d.session.questions[index];const last=d.events.at(-1);const e={seq:(last?.seq||0)+1,qid:q.id,type:'answer',answer,at:Math.max(last?.at||0,eventTime()-Date.parse(d.session.startedAt))};
  await saveDraft({...d,answers:{...d.answers,[q.id]:answer},events:[...d.events,e]});synchronize();}
 async function move(next){const d=draftRef.current;const q=d?.session.questions[next];if(!q)return;setIndex(next);if(eventTime()>=Date.parse(d.session.expiresAt))return;const last=d.events.at(-1);await saveDraft({...d,events:[...d.events,{seq:last.seq+1,qid:q.id,type:'visit',at:Math.max(last.at,eventTime()-Date.parse(d.session.startedAt))}]});}
 async function submit(){await run(async()=>{const d=draftRef.current;const a=await api('/api/sessions',{method:'PATCH',body:{sessionId:d.session.id,answers:d.answers,events:d.events}});setResult(a);setDraft(null);draftRef.current=null;await storage.removeItem(`draft:${cacheKey}`);await refreshHistory(cacheKey);setTab('review');});}
 async function reminder(){await run(async()=>{if(!Capacitor.isNativePlatform())throw new Error('Reminders are available in the installed beta.');const p=await LocalNotifications.requestPermissions();if(p.display!=='granted')throw new Error('Notifications were not allowed. You can still review in the app.');await LocalNotifications.schedule({notifications:[{id:1,title:'Your MockMob review',body:'Return to one concept, then try a fresh check.',schedule:{at:new Date(Date.now()+86400000)}}]});setMessage('A review reminder is scheduled for tomorrow.');});}
 if(!ready)return <main><h1>Opening your study plan…</h1></main>;
 if(!configured)return <main><div className="brand">MockMob <small>Beta</small></div><h1>The beta is being prepared.</h1><p>Your bundled app is ready to connect once the pilot backend is configured.</p><p>No purchases are available in this beta.</p></main>;
 if(!session)return <main><div className="brand">MockMob <small>Beta</small></div><h1>Your next useful step starts here.</h1><p>Sign in with an email code to keep your practice and recovery record together.</p>
 <form onSubmit={e=>{e.preventDefault();run(async()=>{if(!sent){await api('/api/mobile/login',{method:'POST',body:{email}});setSent(true);setMessage('Check your email for the login code.');}else{const {error}=await supabase.auth.verifyOtp({email,token:code,type:'email'});if(error)throw error;}});}}>
 <label>Email<input autoComplete="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} disabled={sent}/></label>
 {sent&&<label>Email code<input inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={e=>setCode(e.target.value)}/></label>}
 <button className="primary" disabled={busy}>{busy?'Please wait…':sent?'Verify code':'Send login code'}<ArrowRight size={18}/></button>
 {sent&&<button type="button" onClick={()=>{setSent(false);setCode('');}}>Use another email</button>}</form><p role="status">{message}</p><small>{Capacitor.isNativePlatform()?'Login is stored in the device’s secure storage.':'Browser preview keeps login in memory for this visit.'}</small></main>;
 const active=draft?.session.questions[index],left=draft?Math.max(0,Math.ceil((Date.parse(draft.session.expiresAt)-now)/1000)):0;
 const latest=attempts.find(a=>a.selectionMeta?.scoringVersion==='server_snapshot_v1');
 return <><header><div className="brand">MockMob <small>Beta</small></div><span>{online?'Online':'Offline'}</span></header><main>
 {message&&<p className="notice" role="status">{message}</p>}
 {tab==='today'&&<><h1>One useful move for today.</h1><p>Find a gap, practise a change, then check it on fresh material.</p><div className="study-row"><h2>{latest?'Return to your recovery plan':'Begin with five questions'}</h2><p>{latest?'Your latest result has a replay and a suggested next step.':'The diagnostic opens when enough eligible content is available.'}</p><button className="primary" onClick={()=>{setResult(latest || null);setTab(latest?'review':'practice');}}>Continue<ArrowRight size={18}/></button></div><button onClick={reminder}>Remind me to review tomorrow</button></>}
 {tab==='practice'&&!draft&&<><h1>Choose your starting point.</h1><p>Five questions. Free diagnostic. Online scoring.</p>{LAUNCH_SUBJECTS.map(s=><button className="subject-row" disabled={busy||!online} key={s.id} onClick={()=>start(s.id)}>{s.label}<ArrowRight size={20}/></button>)}</>}
 {tab==='practice'&&draft&&<><div className="session-line"><span>Question {index+1} / {draft.session.questions.length}</span><strong>{Math.floor(left/60)}:{String(left%60).padStart(2,'0')}</strong></div>{active.passageText&&<blockquote>{active.passageText}</blockquote>}<h1 className="question">{active.question}</h1>{active.options.map((o,i)=><button className="option" aria-pressed={draft.answers[active.id]===i} disabled={left===0} key={o.key} onClick={()=>choose(i)}><b>{o.key}</b>{o.text}</button>)}<div className="session-actions"><button disabled={index===0} onClick={()=>move(index-1)}>Previous</button><button disabled={index===draft.session.questions.length-1} onClick={()=>move(index+1)}>Next</button></div><button className="primary" disabled={busy||!online} onClick={submit}>{busy?'Submitting…':'Submit diagnostic'}</button><p className="note">Only events received before the deadline count. Your timer continues while the app is in the background.</p></>}
 {tab==='review'&&<><h1>Review, then practise a change.</h1>{result?<><h2>{result.correct*5-result.wrong} / {result.total*5} marks</h2><p>{result.selectionMeta?.scoringVersion==='server_snapshot_v1'?'Scored from your server session.':'Historical attempt; recovery evidence is unavailable.'}</p>{result.selectionMeta?.recovery&&<div className="study-row"><h2>Score Recovery Lab</h2><p>{result.selectionMeta.recovery.observed.answerChanges.length} recorded answer changes · {result.unattempted} unanswered</p><p>{result.selectionMeta.recovery.recommendation.title}</p><p className="note">A suggested intervention is an inference. Repeated questions cannot establish improvement.</p></div>}{result.questionsSnapshot.map(q=>{const d=result.details.find(d=>d.qid===q.id);return <article className="review-question" key={q.id}><h3>{q.question || q.body}</h3><p>{d?.isCorrect===true?'Correct':d?.isCorrect===false?'Incorrect':'Unanswered'} · Answer {'ABCD'[q.correctIndex]}</p><p>{q.explanation || 'Explanation unavailable'}</p></article>;})}</>:attempts.length?attempts.map(a=><button className="subject-row" key={a.id} onClick={()=>setResult(a)}>{a.subject} · {a.correct}/{a.total}<ArrowRight size={18}/></button>):<p>Complete your first eligible diagnostic to start your review record.</p>}</>}
 {tab==='progress'&&<><h1>Let fresh practice be the evidence.</h1><p>{attempts.filter(a=>a.selectionMeta?.scoringVersion==='server_snapshot_v1').length} server-scored sessions in this record.</p><p>Repeated questions and historical client scores are excluded from strong improvement claims. A calibrated progress view is being prepared.</p></>}
 {tab==='account'&&<><h1>Your account.</h1><p>{session.user.email}</p><p>Free beta · purchases are unavailable.</p><button onClick={()=>run(async()=>{await supabase.auth.signOut();setAttempts([]);setResult(null);setDraft(null);draftRef.current=null;setTab('today');})}>Sign out</button></>}
 </main><nav aria-label="Primary">{navigation.map(([id,label,Icon])=><button aria-current={tab===id?'page':undefined} key={id} onClick={()=>setTab(id)}><Icon size={21}/><span>{label}</span></button>)}</nav></>;
}
createRoot(document.getElementById('root')).render(<Beta/>);
