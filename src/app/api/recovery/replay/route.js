import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { missedChapters, replayExposures } from '@/../data/mistake_replay';
import { isValidTopSyllabusPair } from '@/../data/canonical_syllabus';
import { LAUNCH_SUBJECTS } from '@/../shared/recoveryContract';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { studyExposures } from '@/lib/server/studyExposure';
import { actionFromHref } from '@/lib/server/actionFields';

// Read-only inventory check. Launch rechecks evidence, freshness and access atomically.
export async function GET(request) {
  const headers = {'Cache-Control':'no-store'};
  const session = await auth(request);
  if(!session?.user?.id)return Response.json({error:'Unauthorized'},{status:401,headers});
  if(!(await checkPersistentRateLimit(request,{route:'/api/recovery/replay',limit:30,keyParts:[session.user.id]})).allowed)return Response.json({error:'Please wait before checking again.'},{status:429,headers});
  const id=new URL(request.url).searchParams.get('attemptId');
  if(!id || id.length>100)return Response.json({error:'Invalid attempt'},{status:422,headers});
  try{
    const attempt=await Database.getAttemptById(id);
    if(!attempt || attempt.userId!==session.user.id)return Response.json({error:'Attempt not found'},{status:404,headers});
    const chapters=missedChapters(attempt);
    if(!LAUNCH_SUBJECTS.some(s=>s.id===attempt.subject))return Response.json({chapters:[],state:'unsupported'},{headers});
    const exposures=await studyExposures(session.user.id,replayExposures(await Database.getAttempts(session.user.id, { columns: ['questions_snapshot'] })));
    const rows=[];
    for(const chapter of chapters){
      if(!isValidTopSyllabusPair(attempt.subject,chapter)){rows.push({chapter,state:'unavailable'});continue;}
      const result=await Database.getQuestions(attempt.subject,5,{mode:'quick',count:5,requestedCount:5,userId:session.user.id,chapter,returnMeta:true,requireEvidence:true,...exposures});
      const href=result.questions.length===5?`/test?${new URLSearchParams({subject:attempt.subject,mode:'quick',count:'5',chapter,recoveryFrom:attempt.id})}`:null;
      rows.push({chapter,state:href?'available':'unavailable',
        ...(href?{href,action:actionFromHref(href)}:{})});
    }
    return Response.json({chapters:rows,state:'ready',delayedCheckHref:'/recovery',delayedCheckAction:actionFromHref('/recovery')},{headers});
  }catch{return Response.json({error:'Fresh practice could not be checked. Your result is still available.'},{status:503,headers});}
}
