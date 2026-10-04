import 'server-only';
import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { Database } from '@/../data/db';
import { DEFAULT_PREFERENCES, createStudyRun, preferences, recallQueue, taughtRecallCards, studyTransition, publicStudyItem, requestKeyValid, istDay, SCHEDULER_VERSION, cardItem, NEW_CARDS_PER_DAY } from '@/../data/study_engine';
import { scheduleReview } from '@/../data/study_scheduler.mjs';
import { createEmptyCard } from 'ts-fsrs';
import { canonicalStudyJSON } from '@/../data/study_content';
import { studyHelpEvidence } from '@/../data/study_help';

export const studyContentEnabled = () => process.env.STUDY_CONTENT_ENABLED === 'true';
export const studyRecallEnabled = () => studyContentEnabled() && process.env.STUDY_RECALL_ENABLED === 'true';
const hash = value => createHash('sha256').update(canonicalStudyJSON(value)).digest('hex');
const pilot = () => JSON.parse(readFileSync(`${process.cwd()}/data/study/pilot.json`, 'utf8'));
const proof = () => JSON.parse(readFileSync(`${process.cwd()}/data/study/release.json`, 'utf8'));
const fail = error => { if (error) throw new Error(/conflict/.test(error.message) ? 'REVISION_CONFLICT' : /content changed|reserved/.test(error.message) ? 'STUDY_CONTENT_CHANGED' : 'STUDY_STORAGE_UNAVAILABLE'); };
const DAY = 86400000;

async function publishedContent() {
  if (!studyContentEnabled()) return [];
  const { data, error } = await supabaseAdmin().from('study_units').select('*').eq('publication_state','published');
  fail(error);
  let release; try { release = proof(); } catch { return []; }
  return (data || []).filter(row => release.units?.[`${row.id}@${row.version}`]?.contentHash === row.content_hash && hash(row.content) === row.content_hash).filter((row,_,all) => !all.some(x=>x.id===row.id && x.version>row.version)).map(row=>({ ...row.content, contentHash:row.content_hash }));
}
function safeUnit(unit) {
  return { ...unit, blocks: unit.blocks.map(b=>publicStudyItem(b)), cards: undefined };
}
async function publishedCards(units) {
  if (!studyRecallEnabled() || !units.length) return [];
  const { data, error } = await supabaseAdmin().from('study_cards').select('*').in('unit_id',units.map(u=>u.id)); fail(error);
  const release = proof();
  const order=new Map(Object.keys(release.cards || {}).map((identity,index)=>[identity,index]));
  return (data || []).filter(row => units.some(u=>u.id===row.unit_id && u.version===row.unit_version) && release.cards?.[`${row.id}@${row.version}`]?.contentHash===row.content_hash && hash(row.content)===row.content_hash).filter((row,_,all)=>!all.some(x=>x.id===row.id && x.version>row.version)).sort((a,b)=>order.get(`${a.id}@${a.version}`)-order.get(`${b.id}@${b.version}`)).map(row=>({...row.content,contentHash:row.content_hash}));
}
export async function getStudyPreferences(userId) {
  if (!studyContentEnabled()) return { ...DEFAULT_PREFERENCES, state:'disabled', premium: false };
  const [{ data, error }, user] = await Promise.all([supabaseAdmin().from('study_preferences').select('preferences,revision').eq('user_id',userId).maybeSingle(),Database.getUserById(userId)]);
  fail(error); return { ...DEFAULT_PREFERENCES, ...data?.preferences, revision:data?.revision || 0, premium:!!user?.isPremium, state:'ready' };
}
export async function saveStudyPreferences(userId,input) {
  const previous = await getStudyPreferences(userId);
  if (previous.state !== 'ready') throw new Error('STUDY_STORAGE_UNAVAILABLE');
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision!==previous.revision) throw new Error('REVISION_CONFLICT');
  const next = preferences(input,previous,previous.premium);
  const { data, error } = await supabaseAdmin().rpc('save_study_preferences',{p_user:userId,p_revision:previous.revision,p_preferences:next}); fail(error); return { ...data,revision:previous.revision+1,premium:previous.premium,state:'ready' };
}
const runIsCurrent = (row, units) => row.content.units.every(u=>units.some(current=>current.id===u.id && current.version===u.version && current.contentHash===u.contentHash));
// Per-concept memory status from the scheduler, never a mastery claim.
function unitMemory(unitCards, states, at) {
  const byId = new Map(states.map(s=>[s.card_id,s]));
  const current = unitCards.map(card=>byId.get(card.id)).map((s,i)=>s?.content_version===unitCards[i].version ? s : null);
  const started = current.filter(Boolean);
  const reviewed = started.filter(s=>(s.schedule?.reps || 0) > 0);
  const due = started.filter(s=>+new Date(s.schedule.due) <= at);
  const future = started.map(s=>+new Date(s.schedule.due)).filter(t=>t > at).sort((a,b)=>a-b);
  return { cards: unitCards.length, started: started.length, reviewed: reviewed.length, due: due.length, unseen: unitCards.length - started.length, nextDue: future[0] ? new Date(future[0]).toISOString() : null };
}
export async function studyRecord(userId,{subject,limit=10,weakConcepts=[],weakChapters=[],allSubjects=false}={}) {
  const content = pilot();
  if (!studyContentEnabled()) return {state:'disabled',subjects:content.syllabus,units:[],queue:{items:[],dueCount:0,overdueCount:0,newAllowance:0},active:null,progress:{lessonsRead:0,recallReviews:0},recallEnabled:false};
  const [allUnits,prefs,{data:states,error:stateError},{data:runs,error:runError},{data:progress,error:eventsError}] = await Promise.all([
    publishedContent(),getStudyPreferences(userId),supabaseAdmin().from('study_card_states').select('*').eq('user_id',userId),
    supabaseAdmin().from('study_runs').select('id,mode,content,projection,updated_at').eq('user_id',userId).order('updated_at',{ascending:false}).limit(100),
    supabaseAdmin().rpc('study_progress_summary',{p_user:userId})
  ]);
  fail(stateError || runError || eventsError);
  const at = Date.now();
  const units = allUnits.filter(u=>(subject ? u.subject===subject : allSubjects || prefs.subjects.includes(u.subject)));
  const allCards=await publishedCards(allUnits);
  const cards=allCards.filter(card=>units.some(unit=>unit.id===card.unitId));
  const queueCards=allSubjects && !subject ? cards.filter(c=>units.some(u=>u.id===c.unitId && prefs.subjects.includes(u.subject))) : cards;
  const introducedToday=(states||[]).filter(s=>s.introduced_day===istDay(at)).length;
  const validRuns = (runs||[]).filter(r=>runIsCurrent(r,allUnits));
  const active = validRuns.find(r=>r.projection.state==='active');
  const activeLearn = new Map(validRuns.filter(r=>r.mode==='learn' && r.projection.state==='active').map(r=>[r.content.units[0]?.id,r]));
  const read = new Set((progress?.completedUnits || []).filter(completed=>allUnits.some(u=>u.id===completed.id && u.version===completed.version && u.contentHash===completed.contentHash)).map(u=>u.id));
  const queue = recallQueue(taughtRecallCards(queueCards,states || [],read),states || [],at,introducedToday,limit,allCards);
  const view = u => {
    const memory = unitMemory(allCards.filter(c=>c.unitId===u.id),states || [],at);
    const learning = activeLearn.get(u.id);
    return {id:u.id,version:u.version,subject:u.subject,chapter:u.chapter,conceptId:u.conceptId,title:u.title,summary:u.summary,estimatedMinutes:u.estimatedMinutes,objectives:u.objectives || [],skill:u.skill || null,order:u.order ?? 0,
      read:read.has(u.id),inProgress:learning ? {runId:learning.id,step:learning.projection.cursor+1,total:learning.content.items.length} : null,cardCount:memory.cards,memory,
      status:learning ? 'in_progress' : !read.has(u.id) ? 'new' : memory.due ? 'due' : memory.unseen ? 'lock_in' : 'learned'};
  };
  const ordered = units.slice().sort((a,b)=>(a.order ?? 0)-(b.order ?? 0));
  const weak = ordered.find(u=>!read.has(u.id) && (weakConcepts.includes(u.conceptId) || weakChapters.some(w=>w.subject===u.subject && w.chapter===u.chapter)));
  // Without a mistake to follow, rotate subjects: the subject with the fewest lessons read goes next.
  const readCount = s => ordered.filter(u=>u.subject===s && read.has(u.id)).length;
  const subjectOrder = [...new Set([...prefs.subjects,...ordered.map(u=>u.subject)])].filter(s=>ordered.some(u=>u.subject===s && !read.has(u.id))).sort((a,b)=>readCount(a)-readCount(b));
  const nextUnit = weak || (subjectOrder.length ? ordered.find(u=>u.subject===subjectOrder[0] && !read.has(u.id)) : null) || null;
  const activeView = active ? {id:active.id,mode:active.mode,title:active.content.title,step:active.projection.cursor+1,total:active.content.items.length,unitId:active.content.units[0]?.id} : null;
  return {state:'ready',subjects:content.syllabus,units:units.map(view),queue,active:activeView,
    nextUnit:nextUnit ? {id:nextUnit.id,title:nextUnit.title,subject:nextUnit.subject,chapter:nextUnit.chapter,reason:weak ? `You have missed ${nextUnit.chapter} questions in practice. This lesson covers the idea behind them.` : nextUnit.summary} : null,
    preferences:prefs,recallEnabled:studyRecallEnabled(),newCardsPerDay:NEW_CARDS_PER_DAY,introducedToday,
    progress:{lessonsRead:read.size,lessonsAvailable:allUnits.length,recallReviews:Number(progress?.recallReviews || 0),dueCards:queue.dueCount,cardsStarted:(states||[]).filter(s=>allCards.some(c=>c.id===s.card_id && c.version===s.content_version)).length},states};
}
export async function studyCatalog(userId,options) {
  const {queue,states:_states,...record} = await studyRecord(userId,{...options,allSubjects:true});
  return { ...record,queue:{dueCount:queue.dueCount,overdueCount:queue.overdueCount,newAllowance:queue.newAllowance,availableCount:queue.items.length,newCount:queue.items.length-Math.min(queue.dueCount,queue.items.length),pausedNew:queue.pausedNew} };
}
export async function studyUnit(userId,id) {
  const units = await publishedContent();
  const unit = units.find(u=>u.id===id);
  if (!unit) throw new Error('UNIT_NOT_FOUND');
  // Viewing the teaching content itself is an exposure, even before a study run starts.
  const {error} = await supabaseAdmin().rpc('record_study_exposure',{p_user:userId,p_unit:unit.id,p_version:unit.version,p_hash:unit.contentHash}); fail(error);
  const record = await studyRecord(userId,{subject:unit.subject});
  const progress = record.units.find(u=>u.id===id) || null;
  const siblings = record.units.filter(u=>u.chapter===unit.chapter && u.id!==unit.id).map(({id,title,status})=>({id,title,status}));
  const allCards = await publishedCards(units);
  const lockIn = recallQueue(allCards.filter(c=>c.unitId===id),record.states || [],Date.now(),record.introducedToday,10,allCards);
  return { ...safeUnit(unit), progress, siblings, recall:{available:lockIn.items.length,due:lockIn.dueCount,newAllowance:lockIn.newAllowance,unseen:lockIn.unseenCount,newCardsPerDay:NEW_CARDS_PER_DAY}, active: record.active };
}
async function validateRun(row) {
  const units = await publishedContent();
  if (!runIsCurrent(row,units)) throw new Error('STUDY_CONTENT_CHANGED');
  if (row.mode==='recall' && !studyRecallEnabled()) throw new Error('STUDY_RECALL_UNAVAILABLE');
  if (row.mode==='recall') {
    const cards=await publishedCards(units);
    // Variants are chosen at start; the bound card identity and hash must still be current.
    if (!row.content.items.every(item=>cards.some(current=>current.id===item.id && current.version===item.version && current.contentHash===item.contentHash))) throw new Error('STUDY_CONTENT_CHANGED');
  }
}
function publicRun(row) {
  const projection = row.projection;
  const item = row.content.items[projection.cursor];
  const unit = row.content.units[0];
  return { ...projection, title:row.content.title,total:row.content.items.length,item:publicStudyItem(item,projection.revealed),feedback:projection.feedback,
    units:row.content.units.map(u=>({id:u.id,title:u.title,subject:u.subject,chapter:u.chapter})),
    steps:row.mode==='learn' ? row.content.items.map(i=>({id:i.id,kind:i.kind,title:i.title})) : undefined,
    focus:row.request?.unitId ? {unitId:row.request.unitId,subject:unit?.subject,chapter:unit?.chapter} : null,
    updatedAt:row.updated_at };
}
async function runRow(userId,id) {
  const {data,error} = await supabaseAdmin().from('study_runs').select('*').eq('user_id',userId).eq('id',id).maybeSingle(); fail(error); if(!data) throw new Error('RUN_NOT_FOUND'); return data;
}
export async function getStudyRun(userId,id) {
  const row=await runRow(userId,id);
  try { await validateRun(row); return publicRun(row); }
  catch(error) {
    if(error.message !== 'STUDY_CONTENT_CHANGED') throw error;
    const current=await publishedContent();
    // Return only replacement navigation, never withdrawn teaching or answer keys.
    return {id:row.id,mode:row.mode,state:'invalidated',title:row.content.title,
      units:row.content.units.filter(u=>current.some(c=>c.id===u.id)).map(({id,title,subject,chapter})=>({id,title,subject,chapter}))};
  }
}
export async function studyTutorContext(userId,id,{expectedRevision,itemId}={}) {
  const row=await runRow(userId,id);
  await validateRun(row);
  if(row.revision!==expectedRevision || row.content.items[row.projection.cursor]?.id!==itemId) throw new Error('REVISION_CONFLICT');
  return studyHelpEvidence(row);
}
export async function studyChapterSummary(userId,subject,chapter) {
  const units=(await publishedContent()).filter(u=>u.subject===subject && u.chapter===chapter);
  if(!units.length) throw new Error('CHAPTER_NOT_FOUND');
  for(const unit of units){const {error}=await supabaseAdmin().rpc('record_study_exposure',{p_user:userId,p_unit:unit.id,p_version:unit.version,p_hash:unit.contentHash});fail(error);}
  return {subject,chapter,partial:true,units:units.map(u=>({id:u.id,title:u.title,version:u.version,objectives:u.objectives,sourceRefs:u.sourceRefs,blocks:u.blocks.filter(b=>b.type==='reading').map(b=>publicStudyItem(b))}))};
}
// Close an older active session so a student can open another lesson. History and schedules stay.
async function setAside(userId,row) {
  const key=`set_aside_${randomUUID().replaceAll('-','')}`;
  const event={type:'set_aside',itemId:row.content.items[row.projection.cursor]?.id || null,assisted:false,expectedRevision:row.revision};
  const {projection}=studyTransition(row.projection,null,{...event,requestKey:key});
  const result={...projection,set_aside:true};
  const {error}=await supabaseAdmin().rpc('advance_study_run',{p_user:userId,p_id:row.id,p_key:key,p_event:event,p_revision:row.revision,p_projection:projection,p_result:result,p_schedule:null});
  if(error && !/conflict/.test(error.message)) fail(error);
}
const sameRequest = (row,request) => row.mode===request.mode && (row.request?.unitId || null)===request.unitId && !!row.request?.mixed===request.mixed && canonicalStudyJSON(row.request?.unitIds || null)===canonicalStudyJSON(request.unitIds);
export async function startStudyRun(userId,input,attempt=0) {
  if (!requestKeyValid(input.requestKey) || !['learn','recall'].includes(input.mode)) throw new Error('INVALID_REQUEST');
  const db = supabaseAdmin();
  if(input.unitIds!==undefined && (!Array.isArray(input.unitIds) || !input.unitIds.length || input.unitIds.length>20 || input.unitIds.some(id=>typeof id!=='string' || id.length>100))) throw new Error('INVALID_UNITS');
  const customUnitIds=input.unitIds ? [...new Set(input.unitIds)].sort() : null;
  const request = {mode:input.mode,unitId:input.unitId || null,mixed:input.mixed===true,unitIds:customUnitIds};
  const {data:existing,error} = await db.from('study_runs').select('*').eq('user_id',userId).eq('request_key',input.requestKey).maybeSingle(); fail(error);
  if(existing) {if(canonicalStudyJSON(existing.request)!==canonicalStudyJSON(request)) throw new Error('IDEMPOTENCY_CONFLICT');await validateRun(existing);return publicRun(existing);}
  const allUnits=await publishedContent();let units=allUnits; const prefs=await getStudyPreferences(userId);
  if((request.mixed || customUnitIds) && !prefs.premium) throw new Error('PREMIUM_REQUIRED');
  if(customUnitIds && (input.mode!=='recall' || customUnitIds.some(id=>!units.some(u=>u.id===id)))) throw new Error('STUDY_CONTENT_UNAVAILABLE');
  if(input.unitId && !units.some(u=>u.id===input.unitId)) throw new Error('UNIT_NOT_FOUND');
  // The database resumes any active run of the same mode (two tabs must not build competing queues).
  // A different lesson or a focused recall sets the older session aside first; a matching one resumes.
  const {data:activeRows,error:activeError}=await db.from('study_runs').select('*').eq('user_id',userId).eq('mode',input.mode).eq('projection->>state','active');fail(activeError);
  for(const row of activeRows || []) {
    if(sameRequest(row,request) && runIsCurrent(row,allUnits)) return publicRun(row);
    if(input.mode==='recall' && !request.unitId && !customUnitIds && runIsCurrent(row,allUnits)) return publicRun(row);
    await setAside(userId,row);
  }
  units=units.filter(u=>customUnitIds ? customUnitIds.includes(u.id) : input.unitId ? u.id===input.unitId : prefs.subjects.includes(u.subject));
  if(input.mode==='learn' && units.length!==1) throw new Error('UNIT_NOT_FOUND');
  let items, states=[];
  if(input.mode==='recall') {
    if(!studyRecallEnabled()) throw new Error('STUDY_RECALL_UNAVAILABLE');
    const {data:stored,error:stateError}=await db.from('study_card_states').select('*').eq('user_id',userId);fail(stateError);
    const allCards=await publishedCards(allUnits);
    const record=await studyRecord(userId,{allSubjects:true});
    const selected=allCards.filter(card=>units.some(unit=>unit.id===card.unitId));
    const eligible=taughtRecallCards(selected,stored || [],record.units.filter(u=>u.read).map(u=>u.id));
    if(!eligible.length && selected.length) throw new Error('LESSON_NOT_READ');
    const queue=recallQueue(eligible,stored || [],Date.now(),(stored || []).filter(s=>s.introduced_day===istDay(Date.now())).length,10,allCards);
    if(!queue.items.length) throw new Error(queue.newAllowance===0 && queue.unseenCount ? 'DAILY_NEW_LIMIT_REACHED' : 'NOTHING_DUE');
    items=queue.items.map(x=>cardItem(x.card,x.stored?.schedule?.reps || 0));
    states=queue.items.filter(x=>!x.stored).map(x=>({card_id:x.card.id,content_version:x.card.version,schedule:JSON.parse(JSON.stringify(createEmptyCard())),scheduler_version:SCHEDULER_VERSION}));
  } else items=units[0].blocks.map(b=>({...b,total:units[0].blocks.length,familyId:`study:${units[0].id}:teaching:v${units[0].version}`}));
  units=units.filter(u=>input.mode==='learn' || items.some(i=>i.unitId===u.id));
  const projection=createStudyRun({id:randomUUID(),mode:input.mode,unitIds:units.map(u=>u.id),cardIds:input.mode==='recall'?items.map(i=>i.id):[]});
  const title=input.mode==='learn'?units[0].title:request.unitId?units[0]?.title:customUnitIds?'Mixed revision':'Review';
  const content={title,units:units.map(u=>({id:u.id,version:u.version,contentHash:u.contentHash,title:u.title,subject:u.subject,chapter:u.chapter})),items};
  const {data,error:startError}=await db.rpc('start_study_run',{p_row:{id:projection.id,user_id:userId,request_key:input.requestKey,request,mode:input.mode,content,projection},p_states:states,p_day:istDay(Date.now())});
  if(startError && /daily new card/.test(startError.message)) throw new Error('DAILY_NEW_LIMIT_REACHED');
  fail(startError);
  // Another tab may have started a different session between the check and the insert.
  if(data.id!==projection.id && !sameRequest(data,request) && attempt<1) { await setAside(userId,data); return startStudyRun(userId,{...input,requestKey:`${input.requestKey.slice(0,80)}_r`},attempt+1); }
  await validateRun(data);return publicRun(data);
}
export async function studyEvent(userId,id,input) {
  if(!requestKeyValid(input.requestKey) || !Number.isInteger(input.expectedRevision)) throw new Error('INVALID_REQUEST');
  if(input.type==='set_aside') throw new Error('INVALID_STUDY_ACTION');
  const row=await runRow(userId,id);await validateRun(row);const db=supabaseAdmin();
  const event={type:input.type,itemId:input.itemId,...(input.value!==undefined?{value:input.value}:{}),...(input.rating!==undefined?{rating:input.rating}:{}),assisted:input.assisted===true,expectedRevision:input.expectedRevision};
  const {data:old,error}=await db.from('study_events').select('event,result').eq('run_id',id).eq('request_key',input.requestKey).maybeSingle();fail(error);
  if(old) {if(Object.keys(event).some(k=>JSON.stringify(event[k])!==JSON.stringify(old.event[k]))) throw new Error('IDEMPOTENCY_CONFLICT');return old.result;}
  const item=row.content.items[row.projection.cursor];
  if(!item) throw new Error('STEP_CONFLICT');
  const {projection,rating}=studyTransition(row.projection,item,{...event,requestKey:input.requestKey});
  let schedule=null;
  if(rating) {
    const {data:stored,error:stateError}=await db.from('study_card_states').select('*').eq('user_id',userId).eq('card_id',item.id).eq('content_version',item.version).maybeSingle();fail(stateError);
    if(!stored) throw new Error('CARD_STATE_UNAVAILABLE');
    schedule={...scheduleReview(stored.schedule,rating),cardId:item.id,contentVersion:item.version,expectedRevision:stored.revision};
    const lapses=(stored.lapse_count || 0)+(rating===1?1:0);
    projection.lastReview={cardId:item.id,due:schedule.schedule.due,rating,lessonRecommended:lapses>=3,unitId:item.unitId};
    projection.reviewed=[...(row.projection.reviewed || []),{cardId:item.id,title:item.word || item.title || item.prompt?.slice(0,80),rating,due:schedule.schedule.due,unitId:item.unitId}];
  }
  const result=publicRun({...row,projection,updated_at:new Date().toISOString()});
  const {data,error:updateError}=await db.rpc('advance_study_run',{p_user:userId,p_id:id,p_key:input.requestKey,p_event:event,p_revision:input.expectedRevision,p_projection:projection,p_result:result,p_schedule:schedule});fail(updateError);return data;
}
export const STUDY_DAY_MS = DAY;
