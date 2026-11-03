import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {validateCalibrationManifest,officialCalibrationUnit} from '../lib/factoryCalibration.mjs';
import {structureVerdict} from '../lib/evidencePipeline.mjs';

// Adds the reserved-but-never-evaluated official anchors as a fresh held-out set. No model calls.
const root=resolve('data/question-factory-runtime'),path=resolve(root,'commissioning-calibration-v4.json');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const registry=read('data/source_registry.json'),fixtures=read(path);
const used=new Set([...fixtures.development,...fixtures.held_out].map(f=>f.provenance.anchor_id));
const fresh=(registry.calibration_anchor_ids||[]).filter(id=>!used.has(id)).map(id=>registry.examples.find(a=>a.id===id));
const spec=s=>registry.exam_specs[s],added=[];
for(const a of fresh){
  if(!a||a.dropped||!a.final_key_matched||!/^[ABCD]$/.test(a.correct_answer))continue;
  const question={...a,id:`fresh-v4-${a.id}`,explanation:'Explanation preparation pending.',family_id:a.family_id||`pyq:${a.id}`,
    provenance:{kind:'authentic_pyq',anchor_id:a.id,adaptation_family:a.family_id||`pyq:${a.id}`,source_pack_id:a.source_pack_id,source_pack_version:a.source_pack_version,
      syllabus_version:spec(a.subject).syllabus_version,pattern_version:spec(a.subject).pattern_version}};
  if(!structureVerdict(question).passed){console.log(JSON.stringify({skipped:a.id,reasons:structureVerdict(question).reasons}));continue;}
  fixtures.held_out.push({id:`fresh-v4-${a.id}`,split:'held_out',category:{easy:'valid_easy',medium:'valid_medium',hard:'valid_difficult'}[a.difficulty]||'valid_medium',valid:true,
    provenance:{anchor_id:a.id,source_id:a.source_id,source_unit_id:officialCalibrationUnit(a),key_locator:a.key_locator,independently_keyed:true,final_answer:a.correct_answer,fresh_in:'quality-v4'},question});
  added.push(a.id);
}
fixtures.version='official-cuET-calibration-fixtures-v4.0-regression-plus-fresh';
fixtures.limitations=[...new Set([...(fixtures.limitations||[]),'quality-v4 adds reserved official 2024 items that no earlier verifier evaluated; they are fresh to the verifier, not to the 2024 paper.'])];
validateCalibrationManifest(fixtures,registry);
writeFileSync(path,JSON.stringify(fixtures,null,2)+'\n');
console.log(JSON.stringify({added:added.length,held_out:fixtures.held_out.length,valid_held_out:fixtures.held_out.filter(f=>f.valid).length,ids:added}));
