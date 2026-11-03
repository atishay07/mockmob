// Bound the actual needed teaching excerpts before the first paid dispatch.
// Preserve the oversized draft and plan; never enlarge provider byte bounds.
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {hashJSON} from '../../../../../data/question_factory_policy.mjs';
import {payloadHash} from '../../../../../scripts/pipeline/lib/cuetFitBenchmark.mjs';
const dir=dirname(fileURLToPath(import.meta.url)),read=p=>JSON.parse(readFileSync(dir+'/'+p)),save=(p,x)=>writeFileSync(dir+'/'+p,JSON.stringify(x,null,2)+'\n'),sha=p=>createHash('sha256').update(readFileSync(dir+'/'+p)).digest('hex');
if(existsSync(dir+'/run/results.json')||existsSync(dir+'/run/independent-key-audit.json'))throw Error('pre_dispatch_only');
const registry=JSON.parse(readFileSync('data/source_registry.json')),frozen=read('frozen.json'),overlay=read('scratch-registry-overlay.json'),blind=read('blind-review-packet.json'),support=read('blind-source-excerpts.json'),plan=read('run/execution-plan.json');
const id='fresh-v5r-planning-normative-excerpts',parent=registry.sources['ncert-lebs104-focused-v1'],text=parent.facts.definition.text;
if(overlay.sources[id])throw Error('already_trimmed');
const spans=[['Single-use Plan:','Single ‑use and standing plans are part'],['polIcy Policies','programme Programmes']].map(([from,to])=>{const start=text.indexOf(from),end=text.indexOf(to,start+1);if(start<0||end<=start)throw Error('exact_source_boundaries_missing:'+from);return{start,end,text:text.slice(start,end)};});
const exact=spans.map(s=>s.text).join('\n\n'),hash=hashJSON(exact);
if(exact.length>=7000||spans.some(s=>!text.includes(s.text)))throw Error('concise_exact_excerpt_required');
overlay.sources[id]={...parent,id,source_pack_id:'fresh-v5r-business_studies-overlay',facts:{teaching:{text:exact}},supports:{teaching:hash},parent_source_ref:{id:parent.id,version:parent.version,locator:'definition',support_hash:parent.supports.definition},selection_contract:'exact teaching spans only; no fabricated claims or changed document identity',selected_spans:spans.map(({start,end})=>({start,end})),origin:'registered_source_subspans'};
overlay.packs['fresh-v5r-business_studies-overlay'].document_ids.push(id);
const ref={id,version:parent.version,locator:'teaching',support_hash:hash};
for(const f of frozen.fixtures)for(let i=0;i<f.candidate.source_refs.length;i++)if(f.candidate.source_refs[i].id===parent.id){f.candidate.source_refs[i]=ref;f.oracle.source_refs=f.candidate.source_refs;}
for(const c of blind.items){c.source_refs=structuredClone(frozen.fixtures.find(f=>f.id===c.id).candidate.source_refs);support.by_candidate[c.id]=c.source_refs.map(r=>{const s=overlay.sources[r.id]||registry.sources[r.id];return{...r,title:s.title,url:s.url,kind:s.kind,permission:s.permission,exact_excerpt:s.facts[r.locator].text};});}
frozen.payload_hash=payloadHash(frozen.fixtures);frozen.construction_history.concise_preflight_source={at:new Date().toISOString(),source:id,parent_ref:overlay.sources[id].parent_source_ref,exact_spans:overlay.sources[id].selected_spans,bytes:Buffer.byteLength(exact),paid_calls_before_change:0};
const history='preflight-history-v1';mkdirSync(dir+'/'+history);for(const p of ['frozen.json','scratch-registry-overlay.json','blind-review-packet.json','blind-source-excerpts.json','run/execution-plan.json','run/preflight.json'])copyFileSync(dir+'/'+p,dir+'/'+history+'/'+p.replaceAll('/','--'));
save('frozen.json',frozen);save('scratch-registry-overlay.json',overlay);save('blind-review-packet.json',blind);save('blind-source-excerpts.json',support);
plan.source_registry={...registry,sources:{...registry.sources,...overlay.sources},packs:{...registry.packs,...overlay.packs},families:{...registry.families,...overlay.families}};
plan.hashes={frozen:sha('frozen.json'),overlay:sha('scratch-registry-overlay.json'),blind_packet:sha('blind-review-packet.json'),blind_sources:sha('blind-source-excerpts.json')};plan.pre_dispatch_revision=frozen.construction_history.concise_preflight_source;save('run/execution-plan.json',plan);
console.log(JSON.stringify({exact_excerpt_bytes:Buffer.byteLength(exact),denominator:frozen.fixtures.length,payload_hash:frozen.payload_hash,paid_calls:0}));
