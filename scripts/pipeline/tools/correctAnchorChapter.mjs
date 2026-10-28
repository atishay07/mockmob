import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {registerSourcePack} from '../lib/sourcePacks.mjs';
import {validateCalibrationManifest} from '../lib/factoryCalibration.mjs';
import {getCanonicalChapters} from '../../../data/canonical_syllabus.js';

// Corrects our chapter metadata for an anchor when its cited sources and the syllabus contradict the tag.
// The official stem, options and key are never edited. Usage: <anchor_id> <chapter> <basis> <artifact-dir>
const [anchorId,chapter,basis,outDir]=process.argv.slice(2);
if(!anchorId||!chapter||!basis||basis.length<30||!outDir)throw new Error('anchor_chapter_basis_and_output_required');
const root=resolve('data/question-factory-runtime'),read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
let registry=read('data/source_registry.json');
const anchor=registry.examples.find(a=>a.id===anchorId);if(!anchor)throw new Error('anchor_missing');
if(!getCanonicalChapters(anchor.subject).includes(chapter))throw new Error('non_canonical_chapter');
const covered=[...new Set(anchor.source_refs.flatMap(r=>registry.sources[r.id]?.chapters||[]))];
if(!covered.includes(chapter))throw new Error(`chapter_not_covered_by_cited_sources:${covered.join(',')}`);
mkdirSync(outDir,{recursive:true});
const packPath=resolve(root,`${anchor.subject}-authenticated-pack.json`),pack=read(packPath);
save(`${outDir}/${anchor.subject}-pack-before-chapter-correction.json`,pack);
const a=pack.anchors.find(x=>x.id===anchorId),from=a.chapter;a.chapter=chapter;pack.version++;
registry=registerSourcePack(pack,root,registry);save(packPath,pack);save('data/source_registry.json',registry);
const fixturePath=resolve(root,'commissioning-calibration-v4.json'),fixtures=read(fixturePath);
for(const f of [...fixtures.development,...fixtures.held_out]){
  f.question.provenance.source_pack_version=registry.examples.find(x=>x.id===f.provenance.anchor_id).source_pack_version;
  if(f.provenance.anchor_id===anchorId)f.question.chapter=chapter;
}
fixtures.reclassifications=[...(fixtures.reclassifications||[]),{anchor:anchorId,field:'chapter',from,to:chapter,at:new Date().toISOString(),basis,official_item_unchanged:true}];
validateCalibrationManifest(fixtures,registry);save(fixturePath,fixtures);
const log={at:new Date().toISOString(),anchor:anchorId,from,to:chapter,covered,basis,registry_version:registry.version};
save(`${outDir}/chapter-correction-${anchorId}.json`,log);console.log(JSON.stringify(log));
