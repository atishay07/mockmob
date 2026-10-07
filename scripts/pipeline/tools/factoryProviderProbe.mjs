import { loadEnvFile } from 'node:process';
import { mkdirSync,writeFileSync } from 'node:fs';
import { BudgetLedger } from '../lib/budgetLedger.mjs';
import { FactoryStore } from '../lib/factoryStore.mjs';
import { createFactoryTransport,BatchPending,responseJSON } from '../lib/factoryTransport.mjs';
import { factoryCostReport } from '../lib/factoryCosts.mjs';
import { lunaBody } from '../lib/factoryEvidence.mjs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { providerPreflight,providerBlocker } from './providerPreflight.mjs';

try{loadEnvFile('.env.local');}catch{ /* inherited environment */ }
const path=process.env.CUET_BUDGET_LEDGER || 'data/pipeline-budget.sqlite';
const ledger=new BudgetLedger(path),store=new FactoryStore(ledger,path),transport=createFactoryTransport({ledger});
const input={scope:'Software transport probe, not a question for publication or academic calibration.',question:'Which number equals 17 + 26?',options:['41','42','43','44']};
const schema={type:'object',additionalProperties:false,required:['answer'],properties:{answer:{type:'string',enum:['A','B','C','D']}}};
const system='Solve the supplied arithmetic question. Return only the required JSON. This is a transport/billing smoke probe; do not claim academic certification.';
const revised=process.argv.includes('--schema-v2');
const requests=revised?{gemini:{systemInstruction:{parts:[{text:`${system} Return the option letter A, B, C or D in answer, never the numeric value. Options are labelled by array position.`}]},contents:[{role:'user',parts:[{text:JSON.stringify(input)}]}],generationConfig:{maxOutputTokens:512,thinkingConfig:{thinkingLevel:'MEDIUM'},responseFormat:{text:{mimeType:'APPLICATION_JSON',schema}}}}}:{openai:lunaBody(system,input,'high',512,schema),gemini:{systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:JSON.stringify(input)}]}],generationConfig:{maxOutputTokens:512,thinkingConfig:{thinkingLevel:'MEDIUM'},responseMimeType:'application/json',responseJsonSchema:schema}}};
const report={at:new Date().toISOString(),scope:'guarded_native_batch_transport_probe',prompt_version:revised?'v2':'v1',academic_evidence:false,inventory_count:0,providers:{}};
try{
  store.claim();
  const preflight=await providerPreflight(),blocker=providerBlocker(preflight);
  if(blocker)throw new Error(blocker);
  ledger.assertHistoryReconciled();
  for(const [provider,body] of Object.entries(requests)){
    const key=hashJSON({provider,body,prompt:revised?'factory-800-probe-v2':'factory-800-probe-v1'});
    try{
      await transport.reconcile(key);
      const payload=await transport.generate(provider,body,{key,purpose:'provider_probe',stage:'transport_probe'});
      const answer=responseJSON(payload);
      const schemaValid=/^[ABCD]$/.test(answer.answer || '') && Object.keys(answer).length===1;
      report.providers[provider]={state:'complete',schema_valid:schemaValid,correct:schemaValid && answer.answer==='C',returned_answer:answer.answer,key};
    }catch(error){report.providers[provider]={state:error instanceof BatchPending?'waiting':'blocked',reason:error.message,key};}
    if(ledger.snapshot().unresolved)break;
  }
}catch(error){report.blocker=error.message;}
finally{
  report.budget=ledger.snapshot();report.costs=factoryCostReport(ledger);store.release();ledger.close();
  mkdirSync('artifacts/question-factory',{recursive:true});writeFileSync(`artifacts/question-factory/provider-live-probe${revised?'-v2':''}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
