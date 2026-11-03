import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {hashJSON,provenanceReasons} from '../../../../../data/question_factory_policy.mjs';
import {structureVerdict} from '../../../../../scripts/pipeline/lib/evidencePipeline.mjs';
import {presentationLint} from '../../../../../data/question_presentation.mjs';
import {preparationValueV76} from '../../../../../scripts/pipeline/lib/preparationValueV76.mjs';
const prep='artifacts/question-factory/cuet-readiness-2026-10-09/execution/v77-final-source-prep',sha=x=>createHash('sha256').update(x).digest('hex');
const raw=readFileSync(prep+'/source-overlay-v3b.json'),o=JSON.parse(raw),d=JSON.parse(readFileSync(prep+'/draft-cases-v5-PRIVATE.json')),changes=[];
// Preserve the actual reviewed source text and candidate references. Add only
// aliases for the exact same support hash where constructor/registry locator names differ.
for(const c of d.cases)for(const r of c.candidate.source_refs){
 const s=o.sources[r.id];if(!s||s.version!==r.version)throw Error('missing_source:'+c.id);
 if(!s.facts[r.locator]){
  const matches=Object.entries(s.facts).filter(([k,v])=>hashJSON(v.text)===r.support_hash&&s.supports[k]===r.support_hash);
  if(matches.length!==1)throw Error('nonunique_exact_support_alias:'+c.id+':'+r.id);
  const [from,value]=matches[0];s.facts[r.locator]={...value};s.supports[r.locator]=r.support_hash;changes.push({source:r.id,field:'locator_alias',from,to:r.locator,support_hash:r.support_hash});
 }
 if(hashJSON(s.facts[r.locator].text)!==r.support_hash||s.supports[r.locator]!==r.support_hash)throw Error('support_text_changed');
}
for(const s of Object.values(o.sources)){
 if(!s.permission?.basis)throw Error('permission_basis_missing');
 s.reuse_permitted=true;
 s.reuse_scope='This isolated, owner-authorized local qualification only. Attributed source excerpts/original stimuli; no independently established republication licence or production permission inferred.';
 changes.push({source:s.id,field:'reuse_permitted',before:null,after:true,basis:s.permission.basis,scope:s.reuse_scope});
}
o.schema='v77-final-registry-integration-v4';o.created_at=new Date().toISOString();o.parent_overlay_sha256=sha(raw);o.integration_notice='Exact support aliases and explicitly limited local reuse attestation; source texts, documents, identity digests, candidates and keys unchanged.';
const b=JSON.parse(readFileSync('data/source_registry.json')),r={...b,sources:{...b.sources,...o.sources},families:{...b.families,...o.families},packs:{...b.packs,...o.packs}};
const rows=d.cases.map(f=>({id:f.id,expected_valid:f.expected_valid,structure:structureVerdict(f.candidate).reasons,presentation:presentationLint(f.candidate),provenance:provenanceReasons(f.candidate,r),preparation:preparationValueV76(f.candidate)}));
const failures=rows.filter(x=>x.expected_valid&&(x.structure.length||x.presentation.length||x.provenance.length||x.preparation.blocking));
if(failures.length)throw Error('positive_local_checks:'+JSON.stringify(failures));
writeFileSync(prep+'/source-overlay-v4.json',JSON.stringify(o,null,2)+'\n',{flag:'wx'});
writeFileSync(prep+'/source-registry-integration-v4.json',JSON.stringify({at:o.created_at,parent_sha256:sha(raw),final_sha256:sha(readFileSync(prep+'/source-overlay-v4.json')),source_texts_and_candidate_refs_unchanged:true,changes},null,2)+'\n',{flag:'wx'});
writeFileSync(prep+'/free-final-candidate-checks-v4.json',JSON.stringify({at:o.created_at,source_refs_verified:d.cases.reduce((s,c)=>s+c.candidate.source_refs.length,0),valid_count:16,failures,rows},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:rows.length,positive_failures:failures.length,aliases:changes.filter(x=>x.field==='locator_alias').length,source_refs_verified:d.cases.reduce((s,c)=>s+c.candidate.source_refs.length,0)}));
