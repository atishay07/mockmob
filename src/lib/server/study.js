import 'server-only';
import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { Database } from '@/../data/db';
import { DEFAULT_PREFERENCES, createStudyRun, preferences, recallQueue, studyTransition, publicStudyItem, requestKeyValid, istDay, SCHEDULER_VERSION } from '@/../data/study_engine';
import { scheduleReview } from '@/../data/study_scheduler.mjs';
import { createEmptyCard } from 'ts-fsrs';
import { canonicalStudyJSON } from '@/../data/study_content';

export const studyContentEnabled = () => process.env.STUDY_CONTENT_ENABLED === 'true';
export const studyRecallEnabled = () => studyContentEnabled() && process.env.STUDY_RECALL_ENABLED === 'true';
const hash = value => createHash('sha256').update(canonicalStudyJSON(value)).digest('hex');
const pilot = () => JSON.parse(readFileSync(`${process.cwd()}/data/study/pilot.json`, 'utf8'));
const proof = () => JSON.parse(readFileSync(`${process.cwd()}/data/study/release.json`, 'utf8'));
const fail = error => { if (error) throw new Error(/conflict/.test(error.message) ? 'REVISION_CONFLICT' : /content changed|reserved/.test(error.message) ? 'STUDY_CONTENT_CHANGED' : 'STUDY_STORAGE_UNAVAILABLE'); };

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
export async function studyRecord(userId,{subject,limit=10,weakConcepts=[],allSubjects=false}={}) {
  const content = pilot();
  if (!studyContentEnabled()) return {state:'disabled',subjects:content.syllabus,units:[],queue:{items:[],dueCount:0,overdueCount:0,newAllowance:0},active:null,progress:{lessonsRead:0,recallReviews:0},recallEnabled:false};
  const [allUnits,prefs,{data:states,error:stateError},{data:runs,error:runError},{data:progress,error:eventsError}] = await Promise.all([
    publishedContent(),getStudyPreferences(userId),supabaseAdmin().from('study_card_states').select('*').eq('user_id',userId),
    supabaseAdmin().from('study_runs').select('id,mode,content,projection,updated_at').eq('user_id',userId).order('updated_at',{ascending:false}).limit(100),
    supabaseAdmin().rpc('study_progress_summary',{p_user:userId})
  ]);
  fail(stateError || runError || eventsError);
  const units = allUnits.filter(u=>(subject ? u.subject===subject : allSubjects || prefs.subjects.includes(u.subject)));
  const allCards=await publishedCards(allUnits);
  const cards=allCards.filter(card=>units.some(unit=>unit.id===card.unitId));
  const queueCards=allSubjects && !subject ? cards.filter(c=>units.some(u=>u.id===c.unitId && prefs.subjects.includes(u.subject))) : cards;
  const queue = recallQueue(queueCards,states || [],Date.now(),(states||[]).filter(s=>s.introduced_day===istDay(Date.now())).length,limit,allCards);
  const validRuns = (runs||[]).filter(r=>r.content.units.every(u=>allUnits.some(current=>current.id===u.id && current.version===u.version && current.contentHash===u.contentHash)));
  const active = validRuns.find(r=>r.projection.state==='active');
  const read = new Set((progress?.completedUnits || []).filter(completed=>allUnits.some(u=>u.id===completed.id && u.version===completed.version && u.contentHash===completed.contentHash)).map(u=>u.id));
  const nextUnit = units.find(u=>weakConcepts.includes(u.conceptId)) || units.find(u=>!read.has(u.id)) || units[0];
  return {state:'ready',subjects:content.syllabus,units:units.map(u=>({id:u.id,version:u.version,subject:u.subject,chapter:u.chapter,conceptId:u.conceptId,title:u.title,summary:u.summary,estimatedMinutes:u.estimatedMinutes,read:read.has(u.id),cardCount:cards.filter(c=>c.unitId===u.id).length})),queue,active:active ? {id:active.id,mode:active.mode} : null,nextUnit:nextUnit ? {id:nextUnit.id,title:nextUnit.title} : null,preferences:prefs,recallEnabled:studyRecallEnabled(),progress:{lessonsRead:read.size,recallReviews:Number(progress?.recallReviews || 0),dueCards:queue.dueCount},states};
}
export async function studyCatalog(userId,options) {
  const {queue,states:_states,...record} = await studyRecord(userId,{...options,allSubjects:true});
  return { ...record,queue:{dueCount:queue.dueCount,overdueCount:queue.overdueCount,newAllowance:queue.newAllowance,availableCount:queue.items.length,pausedNew:queue.pausedNew} };
}
export async function studyUnit(userId,id) {
  const unit = (await publishedContent()).find(u=>u.id===id);
  if (!unit) throw new Error('UNIT_NOT_FOUND');
  // Viewing the teaching content itself is an exposure, even before a study run starts.
  const {error} = await supabaseAdmin().rpc('record_study_exposure',{p_user:userId,p_unit:unit.id,p_version:unit.version,p_hash:unit.contentHash}); fail(error);
  return safeUnit(unit);
}
async function validateRun(row) {
  const units = await publishedContent();
  if (!row.content.units.every(u=>units.some(current=>current.id===u.id && current.version===u.version && current.contentHash===u.contentHash))) throw new Error('STUDY_CONTENT_CHANGED');
  if (row.mode==='recall' && !studyRecallEnabled()) throw new Error('STUDY_RECALL_UNAVAILABLE');
  if (row.mode==='recall') {
    const cards=await publishedCards(units);
    if (!row.content.items.every(item=>cards.some(current=>current.id===item.id && current.version===item.version && hash(current)===hash(item)))) throw new Error('STUDY_CONTENT_CHANGED');
  }
}
function publicRun(row) {
  const projection = row.projection;
  const item = row.content.items[projection.cursor];
  return { ...projection, title:row.content.title,total:row.content.items.length,item:publicStudyItem(item,projection.revealed),feedback:projection.feedback,units:row.content.units.map(u=>({id:u.id,title:u.title,subject:u.subject,chapter:u.chapter})),updatedAt:row.updated_at };
}
async function runRow(userId,id) {
  const {data,error} = await supabaseAdmin().from('study_runs').select('*').eq('user_id',userId).eq('id',id).maybeSingle(); fail(error); if(!data) throw new Error('RUN_NOT_FOUND'); return data;
}
export async function getStudyRun(userId,id) { const row=await runRow(userId,id);await validateRun(row);return publicRun(row); }
export async function startStudyRun(userId,input) {
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
  units=units.filter(u=>customUnitIds ? customUnitIds.includes(u.id) : input.unitId ? u.id===input.unitId : prefs.subjects.includes(u.subject));
  if(input.mode==='learn' && units.length!==1) throw new Error('UNIT_NOT_FOUND');
  let items, states=[];
  if(input.mode==='recall') {
    if(!studyRecallEnabled()) throw new Error('STUDY_RECALL_UNAVAILABLE');
    const {data:stored,error:stateError}=await db.from('study_card_states').select('*').eq('user_id',userId);fail(stateError);
    const allCards=await publishedCards(allUnits);
    const queue=recallQueue(allCards.filter(card=>units.some(unit=>unit.id===card.unitId)),stored || [],Date.now(),(stored || []).filter(s=>s.introduced_day===istDay(Date.now())).length,10,allCards);
    items=queue.items.map(x=>x.card);
    states=queue.items.filter(x=>!x.stored).map(x=>({card_id:x.card.id,content_version:x.card.version,schedule:JSON.parse(JSON.stringify(createEmptyCard())),scheduler_version:SCHEDULER_VERSION}));
  } else items=units[0].blocks.map(b=>({...b,total:units[0].blocks.length,familyId:`study:${units[0].id}:teaching:v${units[0].version}`}));
  units=units.filter(u=>input.mode==='learn' || items.some(i=>i.unitId===u.id));
  const projection=createStudyRun({id:randomUUID(),mode:input.mode,unitIds:units.map(u=>u.id),cardIds:input.mode==='recall'?items.map(i=>i.id):[]});
  const content={title:input.mode==='learn'?units[0].title:'A little recall',units:units.map(u=>({id:u.id,version:u.version,contentHash:u.contentHash,title:u.title,subject:u.subject,chapter:u.chapter})),items};
  const {data,error:startError}=await db.rpc('start_study_run',{p_row:{id:projection.id,user_id:userId,request_key:input.requestKey,request,mode:input.mode,content,projection},p_states:states,p_day:istDay(Date.now())});fail(startError);await validateRun(data);return publicRun(data);
}
export async function studyEvent(userId,id,input) {
  if(!requestKeyValid(input.requestKey) || !Number.isInteger(input.expectedRevision)) throw new Error('INVALID_REQUEST');
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
    projection.lastReview={cardId:item.id,due:schedule.schedule.due,rating,lessonRecommended:(stored.lapse_count || 0)+(rating===1?1:0)>=3,unitId:item.unitId};
  }
  const result=publicRun({...row,projection,updated_at:new Date().toISOString()});
  const {data,error:updateError}=await db.rpc('advance_study_run',{p_user:userId,p_id:id,p_key:input.requestKey,p_event:event,p_revision:input.expectedRevision,p_projection:projection,p_result:result,p_schedule:schedule});fail(updateError);return data;
}
