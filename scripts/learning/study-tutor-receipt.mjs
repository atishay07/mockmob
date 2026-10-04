// Read-only QA evidence. No dispatch, credit change, prompt or personal record is printed.
import {createClient} from '@supabase/supabase-js';
import {writeFileSync} from 'node:fs';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
if(!url?.includes('isrxrxzjocewrdureyhp.supabase.co')) throw new Error('WRONG_PROJECT');
const db=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const runId=process.argv[2];
const {data:run,error:r}=await db.from('study_runs').select('user_id,created_at').eq('id',runId).single();if(r) throw r;
const {data:reservation,error:e}=await db.from('ai_credit_reservations').select('amount,state,provider_key,receipt,created_at').eq('user_id',run.user_id).eq('action','prepos_revision').gte('created_at',run.created_at).order('created_at',{ascending:false}).limit(1).single();if(e) throw e;
const {data:requests,error:q}=await db.from('runtime_ai_requests').select('state,actual_usd,provider,model,receipt').like('request_key',`${reservation.provider_key}%`);if(q) throw q;
const out={at:new Date().toISOString(),scope:'One owner QA lesson explanation; not evidence of student learning outcomes',studentCreditAmount:reservation.amount,studentCreditState:reservation.state,
  providerRequests:requests.map(x=>({state:x.state,costUsd:x.actual_usd,provider:x.provider,model:x.model})),costUsd:requests.reduce((n,x)=>n+Number(x.actual_usd||0),0)};
writeFileSync('artifacts/study-suite/v3/tutor-receipt.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));
