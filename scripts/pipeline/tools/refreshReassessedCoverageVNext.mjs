// Refresh actual separate-staging coverage after complete current reassessment.
// No models, publication, ledger changes, or production access.
import {loadEnvFile} from 'node:process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {readBankSnapshot,readAllRows} from '../lib/bankSnapshot.mjs';
import {reassessedStagingInventory,refreshCoverageWithCurrentReassessment} from '../lib/candidateCRegistration.mjs';
import {detailedCoverage} from '../lib/topicCoverage.mjs';
import {publicationEligibility} from '../../../data/evidence_registry.js';
import {buildStagingWithholdingSelection,preflightStagingRows} from '../lib/reassessmentWithholdingStagingVNext.mjs';
if(!process.argv.includes('--staging'))throw Error('separate_staging_required');
try{loadEnvFile('.env.local');}catch{}loadEnvFile('.env.staging');
if(process.env.STAGING_SUPABASE_URL!=='https://onwkqxmjqjrhfbjjdydu.supabase.co')throw Error('wrong_staging_project');
const root='artifacts/question-factory/cuet-readiness-2026-10-08',snapshot=root+'/execution/reassessment/snapshot-20261008T060712941Z';
const read=p=>JSON.parse(readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const profile=read(root+'/reassessment/profile.json'),history=readFileSync(root+'/reassessment/results.jsonl','utf8');
if(!history.endsWith('\n'))throw Error('reassessment_append_incomplete');
const results=history.trim().split('\n').map(JSON.parse),journal=read(snapshot+'/staging-withholding-journal.json');
if(journal.completed!==true)throw Error('staging_withholding_must_finish');
const selection=buildStagingWithholdingSelection(read(snapshot+'/bank-reassessment-export.json'),read(snapshot+'/dry-run-withholding-plan.json'));
const db=createClient(process.env.STAGING_SUPABASE_URL,process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(90000)})}});
const bank=await readBankSnapshot(db),checked=preflightStagingRows(selection,bank);
if(!checked.already_withheld)throw Error('staging_withholding_not_reflected_in_inventory');
const qualified=reassessedStagingInventory(bank,results,profile),held=await readAllRows(db,'recovery_family_holds','family_id','family_id');
const coverage=refreshCoverageWithCurrentReassessment(detailedCoverage(qualified.inventory,read('data/source_registry.json'),{heldFamilies:held.map(h=>h.family_id),eligible:publicationEligibility}),results,profile);
const out={...coverage,at:new Date().toISOString(),project_ref:'onwkqxmjqjrhfbjjdydu',scope:'Actual available legacy staging bank with exact terminal current reassessment; no unreleased campaign drafts counted.',qualification_basis:qualified.basis,raw_staging_rows:bank.length,reassessment_denominator:profile.denominator,reassessment_excluded:qualified.excluded,complete_passage_units_only:true,held_family_count:held.length,current_verifier_released:false,new_v7_published:0,publication_writes:0,production_writes:0,paid_calls:0,input_hashes:{profile:sha(root+'/reassessment/profile.json'),results:sha(root+'/reassessment/results.jsonl'),export:sha(snapshot+'/bank-reassessment-export.json'),withholding_plan:sha(snapshot+'/dry-run-withholding-plan.json'),withholding_journal:sha(snapshot+'/staging-withholding-journal.json')}};
writeFileSync(root+'/execution/reassessed-staging-coverage.json',JSON.stringify(out,null,2)+'\n');
const zero=out.cells.filter(cell=>cell.usable===0).map(cell=>cell.subject+': '+cell.chapter),unclassified=out.cells.reduce((n,cell)=>n+cell.topic_unclassified,0);
writeFileSync(root+'/execution/reassessed-staging-coverage.md',[
 '# Current available staging coverage',`Captured ${out.at}. ${out.scope}`,`Usable distinct inventory: ${out.total_usable}; raw rows: ${bank.length}; excluded by current reassessment/group closure: ${qualified.excluded}.`,
 'Source/topic classification is coverage metadata, never answer support. No draft campaign item fills inventory. Official2026 rules remain provisional for2027; Accountancy alternative branches are counted separately.',
 `Zero-usable syllabus chapter cells: ${zero.length}. Conservative unclassified topic observations: ${unclassified}.`,...zero.map(cell=>'- '+cell),
 'No publication, production, model or ledger writes were performed.'
].join('\n\n')+'\n');
console.log(JSON.stringify({at:out.at,total_usable:out.total_usable,raw_staging_rows:bank.length,qualified:qualified.inventory.length,excluded:qualified.excluded,zero_chapter_cells:zero.length,topic_unclassified:unclassified,paid_calls:0,production_writes:0}));
