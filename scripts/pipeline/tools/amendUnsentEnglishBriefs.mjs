import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {diversifyBrief} from '../lib/briefDiversity.mjs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
loadEnvFile('.env.local');
const dir=process.argv[2];if(!dir)throw Error('unsent_campaign_required');
const campaign=JSON.parse(readFileSync(dir+'/campaign.json')),registry=JSON.parse(readFileSync('data/source_registry.json')),ledger=new BudgetLedger('data/pipeline-budget.sqlite');
try{
 const ids=new Set(campaign.jobs.map(j=>j.id));
 const requests=ledger.db.prepare("SELECT json_extract(request_json,'$.config.candidate_id') AS id FROM provider_batches UNION ALL SELECT json_extract(request_json,'$.config.candidate_id') FROM provider_requests").all();
 if(requests.some(r=>ids.has(r.id)))throw Error('accepted_or_attempted_campaign_is_immutable');
 if(existsSync(dir+'/campaign-before-english-source-amendment.json'))throw Error('pre_dispatch_amendment_already_applied');
 const before=JSON.stringify(campaign,null,2)+'\n',inventory=JSON.parse(readFileSync('artifacts/question-factory/execution-2026-10-07/staging-retrieval.json')),prepared=[],changed=[];
 for(const j of campaign.jobs.filter(j=>j.subject==='english'&&['Para Jumbles','Correct Word Usage'].includes(j.chapter))){
  const research=diversifyBrief(j,registry,inventory,{planned:prepared});if(!research?.refs.length)throw Error('decisive_english_source_missing');
  j.research=research;j.source_refs=research.refs;j.topic=research.topic;prepared.push(j);changed.push(j.id);
 }
 writeFileSync(dir+'/campaign-before-english-source-amendment.json',before);
 campaign.pre_dispatch_amendments=[...(campaign.pre_dispatch_amendments||[]),{at:new Date().toISOString(),reason:'Replace unrelated dictionary-only Para Jumbles material with complete original fictional sequences; identify exact lexical targets for word usage. No candidate requests accepted or attempted; original IDs and denominator retained.',before_hash:hashJSON(JSON.parse(before)),changed_ids:changed,paid_requests_before:0}];
 campaign.last_frozen_at=new Date().toISOString();writeFileSync(dir+'/campaign.json',JSON.stringify(campaign,null,2)+'\n');
 console.log(JSON.stringify({campaign:campaign.id,changed_briefs:changed.length,denominator:100,paid_requests:0}));
}finally{ledger.close();}
