import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadEnvFile} from 'node:process';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
try{loadEnvFile('.env.local');}catch{}
const ledger=new BudgetLedger(process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite');
try{
 const row=ledger.db.prepare('SELECT * FROM requests WHERE id=?').get('5817ba11-47c7-474c-a770-cf6b3c5e8ed9');
 const receipt=JSON.parse(row?.receipt_json||'{}');
 if(row?.state!=='unresolved'||row.reserved!==11096||receipt.provider_request_id!=='req_b4d44cd7e2164c18bda70d533c3683d5'||receipt.http_status!==503)throw Error('saved_503_identity_changed');
 const prices=JSON.parse(readFileSync('data/pipeline-prices.json'));
 const price=prices.models['gpt-6-luna'];
 // This archived reservation was produced by the text-only Responses guard:
 // 32,768 input * max(0.10,0.125) + 14,000 bounded output * 0.50 = 11,096 microUSD.
 // At that reservation size even one $0.01 tool call is impossible. This proof
 // retains the entire bound; it does NOT settle or infer the provider's bill.
 if(price.max_input_tokens!==32768||price.cache_write_per_million!==.125||price.output_per_million!==.5||Date.parse(prices.verified_at)>Date.parse(row.created_at+'Z'))throw Error('historical_rate_bound_unconfirmed');
 const contract=readFileSync('scripts/pipeline/lib/factoryTransport.mjs');
 const proof={model:row.model,input_bound:32768,output_bound:14000,input_rate:.125,output_rate:.5,tool_calls:0,tool_rate:0,
   pricing_source:prices.source_url,contract_hash:createHash('sha256').update(contract).digest('hex'),provider_request_id:receipt.provider_request_id,
   basis:'Historical bounded Responses reservation at the verified 6 October rates. All text input, cache writes and reasoning-inclusive output are conservatively charged at the maximum. No zero-cost assumption or invoice reconciliation.'};
 let usageAccess;
 try{const response=await fetch('https://api.openai.com/v1/organization/usage/completions?start_time=1791302400&end_time=1791410400&bucket_width=1d',{
   headers:{Authorization:`Bearer ${process.env.CUET_FACTORY_OPENAI_KEY||process.env.OPENAI_API_KEY}`},signal:AbortSignal.timeout(30000)});
   usageAccess={http_status:response.status,accessible:response.ok,limitation:'Organization usage is aggregated, not a receipt for a request ID. No usage was inferred from another request.'};
 }catch{usageAccess={accessible:false,limitation:'Provider usage endpoint could not be reached'};}
 const retained=ledger.retainConservativeHold(row.id,proof),report={at:new Date().toISOString(),retained,proof,provider_receipt:receipt,usage_access:usageAccess,
   external_dependency:'Provider usage/billing confirmation for the saved request ID; an ordinary project key cannot establish an individual failed-request invoice.',budget:ledger.snapshot()};
 mkdirSync('artifacts/question-factory/execution-2026-10-07',{recursive:true});writeFileSync('artifacts/question-factory/execution-2026-10-07/503-hold.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{ledger.close();}
