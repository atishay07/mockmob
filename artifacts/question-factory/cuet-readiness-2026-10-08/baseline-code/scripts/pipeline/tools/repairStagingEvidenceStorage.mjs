import assert from 'node:assert/strict';import {loadEnvFile} from 'node:process';import {readFileSync,writeFileSync} from 'node:fs';import {createClient} from '@supabase/supabase-js';
import {canonicalJSON} from '../../../data/canonical_json.mjs';import {contentHash,evidenceSignature,evaluateEvidence} from '../../../data/content_evidence.js';import {attachBankPassages} from '../lib/bankSnapshot.mjs';
loadEnvFile('.env.local');loadEnvFile('.env.staging');assert.equal(process.env.STAGING_SUPABASE_URL,'https://onwkqxmjqjrhfbjjdydu.supabase.co');
const dir='artifacts/question-factory/execution-2026-10-07',rows=JSON.parse(readFileSync(dir+'/all-100.json')),registry=JSON.parse(readFileSync('data/source_registry.json'));
const db=createClient(process.env.STAGING_SUPABASE_URL,process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),before=[],repaired=[];
for(const job of rows.filter(j=>j.state==='published')){
 const {data:raw,error}=await db.from('questions').select('*').eq('id',job.id).single();if(error)throw error;
 const [q]=await attachBankPassages(db,[raw]);assert.equal(contentHash(q),contentHash(job.candidate));
 const record=q.evidence.record;assert.equal(record.content_hash,contentHash(q));assert.equal(record.state,'published');
 const {state,published_at,...academic}=record,{state:oldState,...original}=job.candidate.evidence.record;
 assert.equal(canonicalJSON(academic),canonicalJSON(original),'Existing record must exactly equal the independently validated receipt apart from publication state/time');
 before.push({id:q.id,evidence:q.evidence});const evidence={...q.evidence,signature:evidenceSignature(record,process.env.CUET_EVIDENCE_SIGNING_KEY)};
 assert.equal(evaluateEvidence({...q,evidence},registry).eligible,true);
 const {data:changed,error:updateError}=await db.from('questions').update({evidence}).eq('id',q.id).eq('updated_at',raw.updated_at).select('id');if(updateError)throw updateError;assert.equal(changed.length,1);repaired.push(q.id);
}
writeFileSync(dir+'/staging/evidence-before-canonical-storage.json',JSON.stringify(before,null,2)+'\n');
const proof={at:new Date().toISOString(),repaired:repaired.length,content_key_explanation_changes:0,provider_receipts_deleted:0,paid_requests:0,production_writes:0,ids:repaired};writeFileSync(dir+'/staging/evidence-storage-repair.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
