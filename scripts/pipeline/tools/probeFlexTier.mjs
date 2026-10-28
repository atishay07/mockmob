// One tiny guarded call asking for service_tier flex, to learn how the provider reports and bills it. Counted by the budget guard.
import {loadEnvFile} from 'node:process';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {createFactoryTransport} from '../lib/factoryTransport.mjs';
import {lunaBody} from '../lib/factoryEvidence.mjs';
try{loadEnvFile('.env.local');}catch{}
const ledger=new BudgetLedger('data/pipeline-budget.sqlite');
const schema={type:'object',additionalProperties:false,required:['ok'],properties:{ok:{type:'boolean'}}};
const transport=createFactoryTransport({ledger,realtimeStages:['flex_probe']});
const nonce=String(Date.now());
try{
 const body={...lunaBody('Reply with JSON {"ok":true}. Flex probe '+nonce,{probe:nonce},'low',64,schema),service_tier:'flex'};
 const payload=await transport.generate('openai',body,{key:'flex-probe-'+nonce,purpose:'provider_probe',stage:'flex_probe'});
 const row=ledger.db.prepare("SELECT actual,receipt_json FROM requests WHERE receipt_json LIKE ? ORDER BY rowid DESC LIMIT 1").get('%flex-probe-'+nonce+'%');
 console.log(JSON.stringify({service_tier:payload.service_tier,usage:payload.usage,recorded_actual_micro:row?.actual}));
}catch(e){console.log(JSON.stringify({error:e.message}));}
ledger.close();
