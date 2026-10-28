import {loadEnvFile} from 'node:process';
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {factoryCostReport} from '../lib/factoryCosts.mjs';

// Publish an accounting snapshot only. Never change worker controls, academic
// evidence, questions, student budgets or payment/credit records.
export async function syncProductionFactorySnapshot(report){
 loadEnvFile('.env.local');
 if(process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://isrxrxzjocewrdureyhp.supabase.co')throw Error('production_identity_mismatch');
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const {data:owner,error:ownerError}=await db.from('users').select('role').eq('id',process.env.CUET_CONTENT_AUTHOR_ID).single();
 if(ownerError||owner?.role!=='admin')throw Error('existing_production_admin_required');
 const {data:before,error:readError}=await db.from('question_factory_control').select('snapshot,paused,phase,publication_enabled,updated_at').eq('id',1).single();
 if(readError)throw readError;
 const ledger=new BudgetLedger(process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite');
 let budget,costs;try{ledger.assertHistoryReconciled();budget=ledger.snapshot();costs=factoryCostReport(ledger);}finally{ledger.close();}
 if(budget.limit_micro!==50000000||budget.committed_micro>budget.limit_micro)throw Error('authorized_content_cap_required');
 const original=JSON.parse(readFileSync('artifacts/question-factory/execution-2026-10-07/batch-report.json'));
 const originalItems=JSON.parse(readFileSync('artifacts/question-factory/execution-2026-10-07/all-100.json'));
 if(original.denominator!==100||!original.complete||originalItems.length!==100)throw Error('completed_original_pilot_required');
 const unit=report.economics?.all_completed?.gross_cost_per_approved_usd;
 if(!Number.isFinite(unit)||unit<=0||!Number.isInteger(report.unique_published_staging))throw Error('measured_completed_cohort_economics_required');
 const at=new Date().toISOString(),forecast=budget.committed_micro/1e6+Math.max(0,10000-report.unique_published_staging)*unit;
 const snapshot={...before.snapshot,at,historical_reconciled:true,budget,costs,batch:original,
  forecast_usd:forecast,cost_per_published_usd:unit,cost_measurement_cohort:'all_completed_fixed_cohorts',
  delivery:{at:report.at,registered:report.registered_denominator,completed:report.completed_denominator,pending:report.pending_candidates,usable:report.unique_published_staging},
  pilot:{target:100,total:100,generated:originalItems.filter(j=>j.candidate).length,eligible:original.approved_unique,quarantined:original.rejected,complete:true,cost_per_eligible_usd:original.cost_per_approved_usd}};
 const {data:updated,error:updateError}=await db.from('question_factory_control').update({snapshot,updated_at:at}).eq('id',1).eq('updated_at',before.updated_at).select('paused,phase,publication_enabled').maybeSingle();
 if(updateError)throw updateError;
 const controls=c=>({paused:c.paused,phase:c.phase,publication_enabled:c.publication_enabled});
 if(updated&&JSON.stringify(controls(updated))!==JSON.stringify(controls(before)))throw Error('production_controls_changed_during_snapshot_sync');
 const proof={at,state:updated?'synced':'concurrent_update_skipped',controls_before:controls(before),controls_after:updated?controls(updated):null,budget,forecast_usd:forecast,original_pilot_approved:original.approved_unique,paid_provider_calls:0,question_writes:0,payment_writes:0,student_budget_writes:0};
 const path='artifacts/question-factory/continuation-500/production-accounting-sync.json';
 writeFileSync(path,JSON.stringify(proof,null,2)+'\n');appendFileSync(path.replace('.json','.jsonl'),JSON.stringify(proof)+'\n');
 return proof;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.argv.includes('--approved-production'))throw Error('explicit_production_snapshot_approval_required');
 const report=JSON.parse(readFileSync('artifacts/question-factory/continuation-500/aggregate-report.json'));
 console.log(JSON.stringify(await syncProductionFactorySnapshot(report)));
}
