import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,relative,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {registerSourcePack} from '../lib/sourcePacks.mjs';
import {validateCalibrationManifest} from '../lib/factoryCalibration.mjs';

// Local, reviewable reference registration only; never publish or call a model.
const root=resolve('data/question-factory-runtime'),read=p=>JSON.parse(readFileSync(p,'utf8'));
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const digest=s=>createHash('sha256').update(s,'utf8').digest('hex');
const rel=p=>relative(root,resolve(p)).replaceAll('\\','/');
const bounded=p=>{const full=resolve(p);if(relative(root,full).startsWith('..'))throw new Error('reference_outside_runtime');return full;};
const norm=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
let registry=read('data/source_registry.json');const reserved=new Set(registry.calibration_anchor_ids||[]),report={at:new Date().toISOString(),draft_only:true,production_changes:0,attached:[],excluded:[]};
const inputs=[['english','english-auth-work/generation-reference-drafts.json'],['accountancy','accountancy-auth-work/generation-reference-drafts.json'],['other','business-economics-auth-work/generation-reference-drafts.json']];
const packs=new Map();
for(const [kind,name]of inputs){const inputFile=resolve(root,name);if(!existsSync(inputFile))continue;const data=read(inputFile);
  const items=kind==='english'?data.candidates:kind==='accountancy'?data.drafts:(data.drafts||data.candidates||[]);
  for(const item of items){
    const subject=kind==='other'?item.subject:kind,number=String(item.question_id??item.question_number??item.id);
    if(item.record_type==='textbook_derived_generation_reference'){report.excluded.push({subject,id:item.id,reason:'new_practice_draft_not_authenticated_PYQ_anchor'});continue;}
    // These captures establish only a topic, a statutory edition, or generic
    // grammar; they do not establish the whole keyed claim.
    if(subject==='accountancy'&&['6','19'].includes(number)||subject==='english'&&number==='12'){report.excluded.push({subject,number,reason:'insufficient_or_time_sensitive_reference_support'});continue;}
    if(!packs.has(subject))packs.set(subject,read(resolve(root,`${subject}-authenticated-pack.json`)));
    const pack=packs.get(subject),anchor=pack.anchors.find(a=>a.official_question_id===number);
    if(!anchor||reserved.has(anchor.id))throw new Error(`noncalibration_authenticated_anchor_required:${subject}:${number}`);
    const answer=item.official_answer_option??item.official_key?.answer_position;
    if(answer&&'ABCD'[Number(answer)-1]!==anchor.correct_answer)throw new Error('generation_reference_key_changed');
    if(item.options&&JSON.stringify(item.options.map(o=>norm(typeof o==='string'?o:o.text)))!==JSON.stringify(anchor.options.map(norm)))throw new Error(`generation_reference_options_changed:${subject}:${number}`);
    const refs=item.references||item.subject_matter_support||item.ncert_contexts||[];
    if(!Array.isArray(refs)||!refs.length)throw new Error('generation_references_required');
    for(const ref of refs){
      let document,locator,text;
      if(kind==='english'){
        if(ref.opened_directly!==true||digest(ref.exact_excerpt)!==ref.excerpt_utf8_sha256)throw new Error('opened_reference_capture_required');
        const id=`${pack.id}-q${number}-capture-${hashJSON(ref.url).slice(0,12)}`;
        const capture=resolve(root,`english-auth-work/${id}.json`);writeFileSync(capture,JSON.stringify({url:ref.url,title:ref.title,exact_excerpt:ref.exact_excerpt,opened_directly:true,capture_origin:rel(inputFile),capture_origin_sha256:sha(inputFile),scope:'Researcher-preserved excerpt; identity hash binds this capture, not the complete remote HTML'},null,2));
        locator='checked-excerpt';text=ref.exact_excerpt;
        document={id,kind:'reference',url:ref.url,file:rel(capture),identity_sha256:sha(capture),extraction_file:rel(capture),extraction_sha256:sha(capture),extraction_checked:true,version:1,facts:[{locator,text}],capture_scope:'bounded_research_excerpt_not_remote_binary',reuse_permitted:true,permission:{basis:'Brief attributed quotation for local validation; no unrestricted republication claim',reference:ref.url}};
      }else{
        const file=bounded(ref.local_pdf_file),extraction=bounded(ref.normalized_extraction_file);
        if(sha(file)!==ref.source_pdf_sha256||sha(extraction)!==ref.normalized_extraction_sha256)throw new Error('generation_reference_file_changed');
        const pages=read(file.replace(/\.pdf$/,'.pages.json')),page=pages.find(p=>p.page===ref.pdf_page_1based);
        if(!page||digest(page.text)!==ref.page_text_sha256||page.text.slice(ref.span_start_char,ref.span_end_char_exclusive)!==ref.context_exact_excerpt||digest(ref.context_exact_excerpt)!==ref.context_sha256||ref.visually_checked_page!==true)throw new Error('generation_reference_page_span_changed');
        locator=`pdf-page-${page.page}`;text=page.text;const id=`ncert-${basename(file,'.pdf')}`;
        document=pack.documents.find(d=>d.id===id);
        if(!document){
          // JSON page artifacts escape quotes/newlines; preserve verified page
          // text in a plain extraction for the registry's substring contract.
          const plain=resolve(root,`${id}-generation-normalized.txt`);writeFileSync(plain,pages.map(p=>p.text).join('\n'));
          document={id,kind:'reference',url:ref.source_url,file:rel(file),identity_sha256:sha(file),extraction_file:rel(plain),extraction_sha256:sha(plain),extraction_checked:true,version:1,facts:[],reuse_permitted:true,permission:{basis:'Brief attributed official NCERT educational validation context; no unrestricted republication claim',reference:ref.source_url}};
        }
        if(!document.facts.some(f=>f.locator===locator))document.facts.push({locator,text});
      }
      if(!pack.documents.some(d=>d.id===document.id))pack.documents.push(document);
      if(!anchor.source_refs.some(r=>r.id===document.id&&r.locator===locator))anchor.source_refs.push({id:document.id,version:document.version,locator,support_hash:hashJSON(text)});
    }
    anchor.generation_ready=true;anchor.source_support_state='reference_curated_pending_blind_validation';
    if(item.explanation){anchor.explanation=item.explanation;anchor.explanation_source_matched=true;}
    report.attached.push({subject,anchor_id:anchor.id});
  }
}
for(const pack of packs.values()){pack.version=Number(pack.version)+1;registry=registerSourcePack(pack,root,registry);}
// Existing fixture identities stay reserved; update only pack-version binding.
const fixtures=read(resolve(root,'calibration-fixtures.json'));
for(const f of [...fixtures.development,...fixtures.held_out]){const anchor=registry.examples.find(a=>a.id===f.provenance.anchor_id);f.question.provenance.source_pack_version=anchor.source_pack_version;}
validateCalibrationManifest(fixtures,registry);
for(const pack of packs.values())writeFileSync(resolve(root,`${pack.subject}-authenticated-pack.json`),JSON.stringify(pack,null,2));
writeFileSync(resolve(root,'source-registry-generation-draft.json'),JSON.stringify(registry,null,2));
writeFileSync(resolve(root,'calibration-fixtures.json'),JSON.stringify(fixtures,null,2));
report.source_registry_version=registry.version;writeFileSync('artifacts/question-factory/generation-reference-preparation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
