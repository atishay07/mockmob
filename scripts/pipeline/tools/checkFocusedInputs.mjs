import {readFileSync,writeFileSync} from 'node:fs';
import {authorOriginal} from '../lib/factoryCore.mjs';
import {constrainedAuthoring} from '../lib/constrainedAuthoring.mjs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
const dir=process.argv[2];if(!dir)throw Error('campaign_directory_required');
const campaign=JSON.parse(readFileSync(dir+'/campaign.json')),registry=JSON.parse(readFileSync('data/source_registry.json')),prices=JSON.parse(readFileSync('data/pipeline-prices.json')),rows=[];
for(const job of campaign.jobs){
 const transport={generate:async(provider,body)=>{rows.push({id:job.id,subject:job.subject,provider,input_bytes:Buffer.byteLength(JSON.stringify(body),'utf8'),maximum_input_tokens:prices.models['gpt-6-luna'].max_input_tokens,maximum_output_tokens:body.max_output_tokens,reasoning:body.reasoning,body_hash:hashJSON(body),quote_choices:body.text.format.schema.properties.evidence_quotes.items.enum?.length||0});throw Error('offline_input_measured');}};
 try{await authorOriginal(job,{registry,transport:constrainedAuthoring(transport,job)});}catch(e){if(e.message!=='offline_input_measured')throw e;}
}
if(rows.length!==100||rows.some(r=>r.input_bytes>r.maximum_input_tokens))throw Error('campaign_guarded_input_bound_failure');
const report={at:new Date().toISOString(),campaign:campaign.id,paid_requests:0,candidates_measured:rows.length,maximum_bytes:Math.max(...rows.map(r=>r.input_bytes)),all_input_bounds_pass:true,quote_constraint_present:rows.every(r=>r.quote_choices>0),rows};
writeFileSync(dir+'/input-preflight.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,rows:undefined}));
