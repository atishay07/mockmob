// Read-only snapshot export of a frozen bank reassessment. It never dispatches,
// edits the bank, changes eligibility state, or writes a publication manifest.
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {buildReassessmentExport} from '../lib/cuetReassessmentExport.mjs';
import {scopedAccounting} from '../lib/scopedAccounting.mjs';

const root='artifacts/question-factory/cuet-readiness-2026-10-08';
const reassessment=`${root}/reassessment`;
const profilePath=`${reassessment}/profile.json`;
const resultsPath=`${reassessment}/results.jsonl`;
const bankPath='artifacts/question-factory/continuation-500/approved-published.json';
const outputRoot=`${root}/execution/reassessment`;
const readJson=(path)=>JSON.parse(readFileSync(path,'utf8'));
if(!existsSync(profilePath)||!existsSync(bankPath))throw new Error('frozen_reassessment_inputs_required');
const profile=readJson(profilePath);
const bankItems=readJson(bankPath);
const raw=existsSync(resultsPath)?readFileSync(resultsPath,'utf8'):'';
const chunks=raw.split('\n');
const trailingUnterminated=Boolean(raw&&!raw.endsWith('\n'));
const results=[];let trailingPartialLineIgnored=false;
for(let i=0;i<chunks.length;i++){
  const line=chunks[i];if(!line.trim())continue;
  try{results.push(JSON.parse(line));}
  catch(error){
    if(trailingUnterminated&&i===chunks.length-1){trailingPartialLineIgnored=true;continue;}
    throw new Error(`invalid_results_jsonl_line_${i+1}:${error.message}`);
  }
}

const db=new DatabaseSync('data/pipeline-budget.sqlite',{readOnly:true});
let data;
try{
  db.exec('BEGIN');
  const prefix=`reassessment:${profile.contract}:`;
  const scopedCost=scopedAccounting({db},prefix);
  const ids=scopedCost.requests.map(request=>request.reservation_id);
  const rows=db.prepare(`SELECT r.id,r.reserved,r.actual,r.state,h.maximum_micro AS hold_maximum,h.proof_json AS hold_proof
    FROM requests r LEFT JOIN conservative_holds h ON h.reservation_id=r.id
    WHERE r.id IN (SELECT value FROM json_each(?))`).all(JSON.stringify(ids)).map(row=>({
      ...row,hold_proof:row.hold_proof?JSON.parse(row.hold_proof):null,
    }));
  data=buildReassessmentExport({bankItems,results,profile,scopedCost,ledgerRows:rows,trailingPartialLineIgnored:trailingPartialLineIgnored});
}finally{try{db.exec('ROLLBACK');}catch{}db.close();}

const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const outDir=`${outputRoot}/snapshot-${stamp}`;
mkdirSync(outDir,{recursive:true});
writeFileSync(`${outDir}/bank-reassessment-export.json`,JSON.stringify(data,null,2)+'\n',{flag:'wx'});
writeFileSync(`${outDir}/dry-run-withholding-plan.json`,JSON.stringify(data.withholding_plan,null,2)+'\n',{flag:'wx'});
const summary={
  schema:data.schema,captured_at:data.captured_at,run:data.run,
  scoped_cost:{settled_micro:data.scoped_cost.settled_micro,held_micro:data.scoped_cost.held_micro,committed_micro:data.scoped_cost.committed_micro,
    request_count:data.scoped_cost.request_count,receipt_complete:data.scoped_cost.receipt_complete,cost_reconciled:data.scoped_cost.cost_reconciled,
    unattributed_request_count:data.scoped_cost.unattributed_requests.length},
  withholding_plan:{mode:data.withholding_plan.mode,atomic_passage_groups:true,decisions:data.withholding_plan.decisions.length,
    would_withhold_items:data.withholding_plan.decisions.reduce((n,group)=>n+group.would_withhold_ids.length,0)},
  output_directory:outDir,
  side_effects:{database_writes:0,publication_writes:0,provider_calls:0},
};
writeFileSync(`${outDir}/summary.json`,JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(summary));
