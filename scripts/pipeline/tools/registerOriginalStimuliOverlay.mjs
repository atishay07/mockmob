// Registers reviewed original Para Jumbles stimuli as a source OVERLAY. The base
// data/source_registry.json is left untouched because registered studies bind its hash.
// Campaign preparation merges this overlay explicitly. No provider call.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {hashJSON} from '../../../data/question_factory_policy.mjs';

const input='data/question-factory-runtime/original-parajumble-stimuli-2026-10-09.json';
const overlayPath='data/question-factory-runtime/original-stimuli-overlay-2026-10-09.json';
const directory='artifacts/question-factory/source-diversity-2026-10-09';
const base=JSON.parse(readFileSync('data/source_registry.json','utf8'));
const reviewed=JSON.parse(readFileSync(input,'utf8'));
const overlay=existsSync(overlayPath)?JSON.parse(readFileSync(overlayPath,'utf8')):{contract:'original-stimuli-overlay-v1',sources:{},pack_additions:{'original-english-reference-v1':[]}};
mkdirSync(directory,{recursive:true});
for(const row of reviewed.accepted){
 const text=row.text.trim(),words=text.split(/\s+/).length,sentences=text.split(/(?<=[.?!])\s+/).length;
 if(words>300||sentences<4||sentences>5)throw Error('para_jumble_stimulus_shape:'+row.structure);
 const id='mockmob-original-stimulus-v2-'+hashJSON({chapter:'Para Jumbles',text}).slice(0,20),file=directory+'/'+id+'.txt';
 if(base.sources[id])throw Error('base_registry_collision:'+id);
 if(overlay.sources[id]){if(overlay.sources[id].facts.stimulus.text!==text)throw Error('registered_source_immutable:'+id);continue;}
 writeFileSync(file,text);const digest=createHash('sha256').update(text).digest('hex');
 overlay.sources[id]={id,kind:'reference',state:'active',version:1,chapters:['Para Jumbles'],url:'local://mockmob/original-stimuli/'+id,
  title:'MockMob original reading stimulus ('+row.structure+')',identity_sha256:digest,extraction_sha256:digest,extraction_checked:true,reuse_permitted:true,file,extraction_file:file,
  discourse_structure:row.structure,
  provenance:{created:'2026-10-09',authoring:reviewed.authoring,review:reviewed.review,external_factual_claims:false},
  permission:{basis:'Original prose created for MockMob practice; fictional or general reasoning with no outside factual or publisher claim',reference:file},
  facts:{stimulus:{text}},supports:{stimulus:hashJSON(text)},source_pack_id:'original-english-reference-v1'};
 overlay.pack_additions['original-english-reference-v1'].push(id);
}
writeFileSync(overlayPath,JSON.stringify(overlay,null,2)+'\n');
console.log(JSON.stringify({overlay:overlayPath,stimuli:Object.keys(overlay.sources).length,base_registry_modified:false,paid_requests:0}));
