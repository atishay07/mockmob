import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
const root='data/question-factory-runtime/reference-downloads/',registryPath='data/source_registry.json',registry=JSON.parse(readFileSync(registryPath)),id='ncert-lebs107';
if(registry.sources[id])throw Error('source_already_registered_immutable');
const meta=JSON.parse(readFileSync(root+'lebs107.column-metadata.json')),file=root+'lebs107.pdf',extraction_file=root+'lebs107.column-normalized.txt',raw=readFileSync(extraction_file,'utf8');
const digest=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
if(digest(file)!==meta.identity_sha256||digest(extraction_file)!==meta.extraction_sha256)throw Error('source_identity_changed');
// Focus on actual normative definitions/characteristics, not the introductory
// company example or an entire downloaded textbook mistaken for answer support.
const pages=JSON.parse(readFileSync(root+'lebs107.column-pages.json'));
const full=pages.slice(0,4).map(p=>p.columns.join(' ')).join(' '),start=full.indexOf('In the context of management'),end=full.indexOf('Elements of Directing');
if(start<0)throw Error('decisive_directing_definition_missing');
const material=full.slice(start,end>start?end:full.length),facts={},supports={};
for(let a=0;a<material.length;){let b=Math.min(a+1700,material.length);if(b<material.length){const stop=material.lastIndexOf('. ',b);if(stop>a+700)b=stop+1;}const text=material.slice(a,b).trim();
 if(text.length>=25){if(!raw.replace(/\r?\n/g,' ').includes(text))throw Error('exact_extraction_span_required');const locator='normative-'+hashJSON(text).slice(0,16);facts[locator]={text};supports[locator]=hashJSON(text);}a=b;
}
if(!Object.values(facts).some(f=>f.text.includes('process of instructing, guiding, counselling, motivating and leading')))throw Error('decisive_definition_not_preserved');
registry.sources[id]={id,kind:'reference',state:'active',version:1,chapters:['Directing'],url:meta.source_url,title:'NCERT Business Studies I, Chapter 7: Directing, reprint 2026–27',identity_sha256:meta.identity_sha256,extraction_sha256:meta.extraction_sha256,extraction_checked:true,extraction_review:meta,reuse_permitted:true,file,extraction_file,permission:{basis:'Brief attributed official NCERT excerpts for local educational verification; no unrestricted republication claim',reference:meta.source_url},facts,supports,source_pack_id:'original-business_studies-reference-v1'};
registry.packs['original-business_studies-reference-v1'].document_ids.push(id);
writeFileSync(registryPath,JSON.stringify(registry,null,2)+'\n');writeFileSync('artifacts/question-factory/source-diversity-2026-10-07/directing-registration.json',JSON.stringify({at:new Date().toISOString(),id,source:meta.source_url,exact_normative_spans:Object.keys(facts).length,characters:Object.values(facts).reduce((n,f)=>n+f.text.length,0),paid_requests:0,answer_support:'Pending independent candidate entailment; this retrieval does not certify any question.'},null,2)+'\n');
console.log(JSON.stringify({id,spans:Object.keys(facts).length,paid_requests:0}));
