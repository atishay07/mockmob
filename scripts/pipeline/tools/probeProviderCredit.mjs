// One tiny guarded realtime call per provider to learn whether credit is available. Counted by the persistent budget guard.
import {loadEnvFile} from 'node:process';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {createFactoryTransport,responseJSON} from '../lib/factoryTransport.mjs';
import {lunaBody} from '../lib/factoryEvidence.mjs';
try{loadEnvFile('.env.local');}catch{}
const ledger=new BudgetLedger('data/pipeline-budget.sqlite'),transport=createFactoryTransport({ledger,realtimeStages:['credit_probe']});
const schema={type:'object',additionalProperties:false,required:['ok'],properties:{ok:{type:'boolean'}}};
const nonce=String(Date.now());
const out={at:new Date().toISOString()};
try{
 const body=lunaBody('Reply with JSON {"ok":true}. Billing smoke probe nonce '+nonce,{probe:nonce},'low',64,schema);
 const payload=await transport.generate('openai',body,{key:'credit-probe-openai-'+nonce,purpose:'provider_probe',stage:'credit_probe'});
 out.openai={available:true,result:responseJSON(payload)};
}catch(e){out.openai={available:false,error:e.message};}
console.log(JSON.stringify(out));ledger.close();
