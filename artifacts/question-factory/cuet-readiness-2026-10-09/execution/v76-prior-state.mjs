import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadEnvFile} from 'node:process';
const db=new DatabaseSync('data/pipeline-budget.sqlite',{readOnly:true}),requests=db.prepare('SELECT state,reserved,actual FROM requests').all();
const sum=fn=>requests.reduce((s,r)=>s+fn(r),0),settled=sum(r=>r.state==='settled'?r.actual:0),held=sum(r=>r.state==='settled'?0:Math.max(r.reserved,r.actual||0));
const scope=prefix=>db.prepare("SELECT id,state,reservation_id FROM provider_requests WHERE json_extract(request_json,'$.config.candidate_id') LIKE ?").all(prefix+'%');
try{loadEnvFile('.env.local');}catch{}
const prices=JSON.parse(readFileSync('data/pipeline-prices.json')),freeze=JSON.parse(readFileSync('artifacts/question-factory/cuet-readiness-2026-10-09/v76-contract-freeze.json'));
const out={at:new Date().toISOString(),read_only_database:true,lifetime:{settled_usd:settled/1e6,held_usd:held/1e6,remaining_usd:(50e6-settled-held)/1e6,unresolved:requests.filter(r=>r.state==='unresolved').length,requests:requests.length},v75_requests:scope('v75-fresh-cbse2022-2026-10-09:'),v76_requests:scope('v76-qualification-2026-10-09-'),lease_present:existsSync('data/question-factory-runtime/v76-qualification-owner.json'),pricing:{expires_at:prices.expires_at,valid:Date.parse(prices.expires_at)>Date.now()},credentials_present:{openai:Boolean(process.env.CUET_FACTORY_OPENAI_KEY||process.env.OPENAI_API_KEY),gemini:Boolean(process.env.CUET_FACTORY_GEMINI_KEY||process.env.GEMINI_API_KEY)},freeze_sha256:createHash('sha256').update(readFileSync('artifacts/question-factory/cuet-readiness-2026-10-09/v76-contract-freeze.json')).digest('hex')};
db.close();const p=process.argv[2]||'artifacts/question-factory/cuet-readiness-2026-10-09/execution/v76-before-dispatch.json';writeFileSync(p,JSON.stringify(out,null,2));console.log(JSON.stringify({...out,v75_requests:{total:out.v75_requests.length,states:Object.fromEntries([...new Set(out.v75_requests.map(r=>r.state))].map(s=>[s,out.v75_requests.filter(r=>r.state===s).length]))},v76_requests:{total:out.v76_requests.length}}));
