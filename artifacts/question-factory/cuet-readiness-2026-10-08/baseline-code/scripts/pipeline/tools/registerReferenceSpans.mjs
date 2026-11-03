import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {hashJSON,FACTORY_SUBJECTS} from '../../../data/question_factory_policy.mjs';
import {getCanonicalChapters} from '../../../data/canonical_syllabus.js';
import {registerSourcePack} from '../lib/sourcePacks.mjs';
import {validateCalibrationManifest} from '../lib/factoryCalibration.mjs';

// Reusable reference preparation: register each downloaded document once (identity, extraction,
// syllabus version, covered chapters) and attach only exact, section-sized spans to anchors.
// Usage: node scripts/pipeline/tools/registerReferenceSpans.mjs <mapping.json> <artifact-dir> [--dry-run]
// No model calls, no publication.
const [mappingPath,outDir]=process.argv.slice(2),dry=process.argv.includes('--dry-run');
if(!mappingPath||!outDir)throw new Error('mapping_and_output_required');
const root=resolve('data/question-factory-runtime');
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
mkdirSync(outDir,{recursive:true});
if(!dry&&existsSync(`${outDir}/source-registration.json`))throw new Error('sources_already_prepared_for_this_artifact');
const plan=read(mappingPath),meta=read(resolve(root,'reference-downloads/extraction-metadata.json'));
let registry=read('data/source_registry.json');
const packs=new Map(FACTORY_SUBJECTS.map(s=>[s,read(resolve(root,`${s}-authenticated-pack.json`))]));
const touched=new Set(),report={at:new Date().toISOString(),dry_run:dry,documents:[],chapter_maps:[],anchors:[],spans:[]};
// 1. New documents: identity comes from the one-time extraction metadata, never from a fresh download.
for(const d of plan.documents||[]){
  const pack=packs.get(d.subject),m=meta.find(x=>x.id===d.file_id);
  if(!m)throw new Error(`extraction_metadata_missing:${d.file_id}`);
  if(pack.documents.some(x=>x.id===d.id))throw new Error(`document_already_registered:${d.id}`);
  const chapters=d.chapters.filter(c=>getCanonicalChapters(d.subject).includes(c));
  if(chapters.length!==d.chapters.length)throw new Error(`non_canonical_chapter:${d.id}`);
  pack.documents.push({id:d.id,kind:'reference',url:m.source_url,file:`reference-downloads/${d.file_id}.pdf`,identity_sha256:m.identity_sha256,
    extraction_file:`reference-downloads/${d.file_id}.normalized.txt`,extraction_sha256:m.extraction_sha256,extraction_checked:true,version:1,
    syllabus_version:m.syllabus_version,chapters,title:d.title,reuse_permitted:true,
    permission:{basis:'Brief attributed excerpts from official NCERT used for local educational validation; no unrestricted republication claim',reference:m.source_url},facts:[]});
  touched.add(d.subject);report.documents.push({id:d.id,chapters,pages:m.pages,identity_sha256:m.identity_sha256});
}
// 2. Source-backed chapter coverage for already registered documents.
for(const c of (plan.chapter_coverage||[]).flatMap(c=>c.id==='*'?packs.get(c.subject).documents.filter(d=>d.kind==='reference').map(d=>({...c,id:d.id})):[c])){
  const pack=packs.get(c.subject),doc=pack.documents.find(x=>x.id===c.id);
  if(!doc)throw new Error(`document_missing:${c.id}`);
  if(c.chapters.some(ch=>!getCanonicalChapters(c.subject).includes(ch)))throw new Error(`non_canonical_chapter:${c.id}`);
  if(JSON.stringify(doc.chapters)!==JSON.stringify(c.chapters)){doc.chapters=c.chapters;touched.add(c.subject);report.chapter_maps.push({id:c.id,chapters:c.chapters});}
}
function span(pack,docId,start,end,{max}){
  const doc=pack.documents.find(d=>d.id===docId);if(!doc)throw new Error(`source_not_registered:${docId}`);
  const text=readFileSync(resolve(root,doc.extraction_file),'utf8');
  const a=text.indexOf(start);if(a<0)throw new Error(`span_start_missing:${docId}:${start.slice(0,40)}`);
  let b;
  if(end){const e=text.indexOf(end,a);if(e<0)throw new Error(`span_end_missing:${docId}:${end.slice(0,40)}`);b=e+end.length;}
  else{const ill=text.indexOf('Illustration',a+start.length);b=Math.min(ill>0?ill:text.length,a+max);const stop=text.lastIndexOf('. ',b-2);if(stop>a+200)b=stop+1;}
  if(b-a>max)throw new Error(`span_too_long:${docId}:${start.slice(0,40)}:${b-a}`);
  const excerpt=text.slice(a,b),locator=`span-${hashJSON(excerpt).slice(0,12)}`;
  if(!doc.facts.some(f=>f.locator===locator))doc.facts.push({locator,text:excerpt});
  const ref={id:docId,version:doc.version,locator,support_hash:hashJSON(excerpt)};
  report.spans.push({ref,characters:excerpt.length,head:excerpt.slice(0,80),tail:excerpt.slice(-80)});
  return ref;
}
// 3. Anchors receive only the sections they need.
const reserved=new Set(registry.calibration_anchor_ids||[]);
for(const item of plan.anchors||[]){
  const pack=packs.get(item.subject),anchor=pack.anchors.find(a=>a.id===item.anchor_id);
  if(!anchor)throw new Error(`anchor_missing:${item.anchor_id}`);
  if(reserved.has(anchor.id))throw new Error(`reserved_calibration_anchor:${anchor.id}`);
  const refs=item.spans.map(s=>span(pack,s.doc,s.start,s.end,{max:s.max||(s.end?4500:1800)}));
  const isPaper=r=>pack.documents.find(d=>d.id===r.id)?.kind==='paper';
  const keep=item.replace_references?[]:anchor.source_refs.filter(r=>!isPaper(r));
  anchor.source_refs=[...anchor.source_refs.filter(isPaper),...keep,...refs.filter(r=>!keep.some(k=>k.id===r.id&&k.locator===r.locator))];
  anchor.generation_ready=true;
  if(item.original_ready!==undefined)anchor.original_ready=item.original_ready;
  if(item.chapter)anchor.chapter=item.chapter;
  anchor.source_support_state='exact_textbook_spans_pending_blind_validation';
  if(item.guidance)anchor.academic_guidance=[...new Set([...(anchor.academic_guidance||[]),...item.guidance])];
  touched.add(item.subject);report.anchors.push({anchor_id:anchor.id,references:anchor.source_refs.length,original_ready:anchor.original_ready!==false,chapter:anchor.chapter});
}
if(dry){console.log(JSON.stringify(report,null,2));process.exit(0);}
save(`${outDir}/registry-before.json`,registry);
for(const subject of touched){const pack=packs.get(subject);save(`${outDir}/${subject}-pack-before.json`,read(resolve(root,`${subject}-authenticated-pack.json`)));
  pack.version++;registry=registerSourcePack(pack,root,registry);save(resolve(root,`${subject}-authenticated-pack.json`),pack);}
save('data/source_registry.json',registry);
// Calibration fixtures keep their identity; only the pack-version binding follows the registry.
const fixturePath=resolve(root,'commissioning-calibration-v4.json'),fixtures=read(fixturePath);
for(const f of [...fixtures.development,...fixtures.held_out])f.question.provenance.source_pack_version=registry.examples.find(a=>a.id===f.provenance.anchor_id).source_pack_version;
validateCalibrationManifest(fixtures,registry);save(fixturePath,fixtures);
report.registry_version=registry.version;report.production_changes=0;
save(`${outDir}/source-registration.json`,report);
console.log(JSON.stringify({registry:registry.version,documents:report.documents.length,chapter_maps:report.chapter_maps.length,anchors:report.anchors.length,spans:report.spans.length}));
