import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {registerSourcePack} from '../lib/sourcePacks.mjs';
import {validateCalibrationManifest} from '../lib/factoryCalibration.mjs';

// Local source preparation only: exact NCERT excerpts, no model calls, no publication.
const root=resolve('data/question-factory-runtime'),out='artifacts/question-factory/quality-v4';
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const dry=process.argv.includes('--dry-run');
mkdirSync(out,{recursive:true});
if(!dry&&existsSync(`${out}/source-registration.json`))throw new Error('quality_v4_sources_already_prepared');
let registry=read('data/source_registry.json');
const packs=new Map(['business_studies','economics','accountancy'].map(s=>[s,read(resolve(root,`${s}-authenticated-pack.json`))]));
const added=[];
// A span is the exact raw extraction text from its start phrase through its end phrase.
function span(pack,docId,start,end,{max=4500}={}){
  const doc=pack.documents.find(d=>d.id===docId);if(!doc)throw new Error(`source_not_registered:${docId}`);
  const text=readFileSync(resolve(root,doc.extraction_file),'utf8');
  const a=text.indexOf(start);if(a<0)throw new Error(`span_start_missing:${docId}:${start.slice(0,40)}`);
  let b;
  if(end){const e=text.indexOf(end,a);if(e<0)throw new Error(`span_end_missing:${docId}:${end.slice(0,40)}`);b=e+end.length;}
  else{
    // Section span: explanatory text before the first worked illustration, ending on a sentence.
    const ill=text.indexOf('Illustration',a+start.length);b=Math.min(ill>0?ill:text.length,a+max);
    const stop=text.lastIndexOf('. ',b-2);if(stop>a+200)b=stop+1;
  }
  if(b-a>max)throw new Error(`span_too_long:${docId}:${start.slice(0,40)}:${b-a}`);
  const excerpt=text.slice(a,b);
  const locator=`quality-v4-${hashJSON(excerpt).slice(0,12)}`;
  if(!doc.facts.some(f=>f.locator===locator))doc.facts.push({locator,text:excerpt});
  const ref={id:docId,version:doc.version,locator,support_hash:hashJSON(excerpt)};
  added.push({ref,characters:excerpt.length,head:excerpt.slice(0,90),tail:excerpt.slice(-90)});
  return ref;
}
const plan=read('scripts/pipeline/data/quality-v4-anchor-sources.json');
const report={at:new Date().toISOString(),dry_run:dry,anchors:[]};
for(const item of plan.anchors){
  const pack=packs.get(item.subject),anchor=pack.anchors.find(a=>a.id===item.anchor_id);
  if(!anchor)throw new Error(`anchor_missing:${item.anchor_id}`);
  if((registry.calibration_anchor_ids||[]).includes(anchor.id))throw new Error(`reserved_calibration_anchor:${anchor.id}`);
  const refs=item.spans.map(s=>span(pack,s.doc,s.start,s.end,{max:s.max||(s.end?4500:1800)}));
  const paper=anchor.source_refs.filter(r=>pack.documents.find(d=>d.id===r.id)?.kind==='paper');
  const keep=item.replace_references?[]:anchor.source_refs.filter(r=>pack.documents.find(d=>d.id===r.id)?.kind!=='paper');
  anchor.source_refs=[...paper,...keep,...refs.filter(r=>!keep.some(k=>k.id===r.id&&k.locator===r.locator))];
  anchor.generation_ready=true;
  if(item.original_ready!==undefined)anchor.original_ready=item.original_ready;
  if(item.chapter)anchor.chapter=item.chapter;
  if(!anchor.source_support_state||/paper_and_key_only/.test(anchor.source_support_state))anchor.source_support_state='quality_v4_exact_textbook_spans_pending_blind_validation';
  if(item.guidance)anchor.academic_guidance=[...new Set([...(anchor.academic_guidance||[]),...item.guidance])];
  report.anchors.push({anchor_id:anchor.id,references:anchor.source_refs.length,original_ready:anchor.original_ready!==false,chapter:anchor.chapter});
}
report.spans=added;
if(dry){console.log(JSON.stringify(report,null,2));process.exit(0);}
save(`${out}/registry-before-v4.json`,registry);
for(const pack of packs.values()){pack.version++;registry=registerSourcePack(pack,root,registry);save(resolve(root,`${pack.subject}-authenticated-pack.json`),pack);}
save('data/source_registry.json',registry);
const fixtures=read(resolve(root,'commissioning-calibration-v3.2.json'));
fixtures.version='official-cuET-calibration-fixtures-v4.0-regression';
fixtures.limitations=[...(fixtures.limitations||[]),'v4 re-evaluates the frozen v3.2 keyed fixtures under the v4 verifier; previously observed, not a fresh unseen paper benchmark.'];
for(const f of [...fixtures.development,...fixtures.held_out])f.question.provenance.source_pack_version=registry.examples.find(a=>a.id===f.provenance.anchor_id).source_pack_version;
validateCalibrationManifest(fixtures,registry);save(resolve(root,'commissioning-calibration-v4.json'),fixtures);
report.registry_version=registry.version;report.production_changes=0;
save(`${out}/source-registration.json`,report);
console.log(JSON.stringify({registry:registry.version,anchors:report.anchors.length,spans:added.length}));
