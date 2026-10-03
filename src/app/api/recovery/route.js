import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { supabaseAdmin } from '@/lib/supabase';
import { improvementEvidence } from '@/../data/recovery';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { publicationEligibility } from '@/../data/evidence_registry';
import { excludeHeldFamilies } from '@/../data/evidence_holds';
import { learningRecord } from '@/lib/server/learning';

export async function GET(request) {
  const session=await auth(request);
  if(!session?.user)return Response.json({error:'Unauthorized'},{status:401});
  const allAttempts=await Database.getAttempts(session.user.id);
  const ordinaryReview=allAttempts.map(a=>({id:a.id,subject:a.subject,completedAt:a.completedAt,correct:a.correct,total:a.total,scoringVersion:a.selectionMeta?.scoringVersion || 'historical_device',mistakes:(a.details || []).filter(d=>d.isCorrect!==true).length}));
  const attempts=allAttempts.filter(a=>a.selectionMeta?.scoringVersion==='server_snapshot_v1' && a.selectionMeta?.contentEvidence !== 'legacy_bank');
  const db=supabaseAdmin();
  const [{data:reviews,error:reviewError},{data:playbook,error:playbookError}]=await Promise.all([
    db.from('recovery_review_queue').select('*').eq('user_id',session.user.id).eq('state','pending').order('due_at'),
    db.from('recovery_playbook').select('*').eq('user_id',session.user.id).order('created_at',{ascending:false}),
  ]);
  const questionIds=[...new Set(attempts.flatMap(a=>a.questionsSnapshot.map(q=>q.id)))];
  const currentQuestions=new Map();let evidenceUnavailable=false;
  for(let i=0;i<questionIds.length;i+=300){
    const {data,error}=await db.from('questions').select('*').in('id',questionIds.slice(i,i+300));
    if(error){evidenceUnavailable=true;break;}
    let unheld;try{unheld=await excludeHeldFamilies(data || [],db);}catch{evidenceUnavailable=true;break;}
    for(const q of unheld)if(publicationEligibility(q).eligible)currentQuestions.set(q.id,q.evidence.record.content_hash);
  }
  const concepts={};const seenIds=new Set(),seenFamilies=new Set();let invalidatedChecks=0;
  for(const a of [...attempts].sort((a,b)=>a.completedAt-b.completedAt)) for(const q of a.questionsSnapshot) {
    const d=a.details.find(d=>d.qid===q.id); const concept=q.conceptId || `${a.subject}:${q.chapter}`;
    const current=!evidenceUnavailable && currentQuestions.get(q.id) && currentQuestions.get(q.id)===q.verificationEvidence?.content_hash;
    const fresh=Boolean(current && q.conceptId && !seenIds.has(q.id) && q.familyId && !seenFamilies.has(q.familyId));
    if(!current)invalidatedChecks++;
    concepts[concept]??=[];
    concepts[concept].push({questionId:q.id,familyId:q.familyId,at:a.completedAt,correct:d?.isCorrect===true,assisted:false,fresh});
    seenIds.add(q.id);if(q.familyId)seenFamilies.add(q.familyId);
  }
  const learning = await learningRecord(session.user.id);
  return Response.json({attempts,ordinaryReview,episodes:learning.episodes,reviews:reviews || [],playbook:playbook || [],
    reviewState:reviewError?'unavailable':'ready',playbookState:playbookError?'unavailable':'ready',
    dueReviews:(reviews || []).filter(r=>Date.parse(r.due_at)<=Date.now()).length,invalidatedChecks,
    legacyConceptChecks:Object.entries(concepts).map(([concept,checks])=>({concept,...improvementEvidence(checks)})),
    milestones:learning.milestones,
    progress:learning.episodes.map(e=>({concept:e.title,state:e.state,sampleSize:e.sampleSize,evidenceLabel:e.evidenceLabel})),
    note:evidenceUnavailable?'Current question evidence is unavailable, so improvement claims are paused.':`Fresh delayed checks provide concept evidence, not a causal score gain. ${invalidatedChecks} checks with unavailable or changed question evidence are excluded.`},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request) {
  const session=await auth(request);
  if(!session?.user)return Response.json({error:'Unauthorized'},{status:401});
  if(!checkRateLimit(request,{route:'/api/recovery',limit:20,keyParts:[session.user.id]}).allowed)return Response.json({error:'Too many requests'},{status:429});
  const body=await request.json().catch(()=>null);
  if(!body || !['two_pass','concept_repair','timed_practice'].includes(body.strategy) || typeof body.reflection!=='string' || body.reflection.length>1000)return Response.json({error:'Invalid reflection'},{status:422});
  const attempt=await Database.getAttemptById(body.attemptId);
  if(!attempt || attempt.userId!==session.user.id)return Response.json({error:'Attempt not found'},{status:404});
  if(!['server_snapshot_v1','server_practice_v1'].includes(attempt.selectionMeta?.scoringVersion))return Response.json({error:'A new server-scored session is needed'},{status:422});
  const {error}=await supabaseAdmin().from('recovery_playbook').upsert({user_id:session.user.id,attempt_id:attempt.id,strategy:body.strategy,reflection:body.reflection,evidence_state:'more_evidence_needed'},{onConflict:'user_id,attempt_id,strategy'});
  if(error)return Response.json({error:'Playbook unavailable'},{status:503});
  return Response.json({saved:true,evidenceState:'more_evidence_needed'});
}
