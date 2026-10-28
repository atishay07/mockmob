import {readFileSync} from 'node:fs';
import {authorCandidate} from '../lib/factoryCore.mjs';
import {planAnchorBlueprints} from '../lib/factoryBlueprints.mjs';
import {createFactoryEvidence} from '../lib/factoryEvidence.mjs';
import {blindView} from '../lib/evidencePipeline.mjs';
import {contentHash} from '../../../data/content_evidence.js';

// Offline: measures every request body against the guarded input bound without dispatching anything.
const registry=JSON.parse(readFileSync('data/source_registry.json','utf8'));
const prices=JSON.parse(readFileSync('data/pipeline-prices.json','utf8'));
const reserved=new Set(registry.calibration_anchor_ids||[]);
const sizes=[];let current;
const transport={generate:async(provider,body)=>{sizes.push({...current,provider,bytes:Buffer.byteLength(JSON.stringify(body),'utf8'),limit:prices.models[provider==='openai'?'gpt-6-luna':'gemini-3.8-flash'].max_input_tokens});throw new Error('measured');}};
const ledger={getCache:()=>null,setCache:()=>{}};
for(const a of registry.examples.filter(a=>a.generation_ready!==false&&!reserved.has(a.id))){
  for(const [stage,run] of [
    ['blueprint',()=>planAnchorBlueprints(a,4,{registry,transport})],
    ['authoring',()=>authorCandidate({id:'size',subject:a.subject,chapter:a.chapter,anchor_id:a.id,kind:'pyq_adapted',blueprint:{target:'x'.repeat(200),evidence_quotes:['y'.repeat(300)],distractor_plan:['z'.repeat(80),'z'.repeat(80),'z'.repeat(80)]}},{registry,transport})],
    ['evaluation',()=>{const adapters=createFactoryEvidence({registry,ledger,transport});const q={...a,id:'size',provenance:{kind:'pyq_adapted',anchor_id:a.id},explanation:'e'.repeat(800)};
      const view=blindView(q,a.source_refs);view.content_hash=contentHash(q);return adapters.source_support(view);}],
  ]){current={anchor:a.id,stage};try{await run();}catch(e){if(e.message!=='measured')sizes.push({...current,error:e.message});}}
}
const over=sizes.filter(s=>s.error||s.bytes>s.limit*0.92);
console.log(JSON.stringify({measured:sizes.length,max:Math.max(...sizes.filter(s=>s.bytes).map(s=>s.bytes)),near_or_over:over},null,1));
