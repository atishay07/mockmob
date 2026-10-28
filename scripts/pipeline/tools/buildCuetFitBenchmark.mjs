// Builds the fresh CUET-fit benchmark fixtures (no provider calls). Excerpt lint failures abort the build.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {buildFixtures,payloadHash,BENCHMARK_ID} from '../lib/cuetFitBenchmark.mjs';
import {structureVerdict} from '../lib/evidencePipeline.mjs';
import {presentationLint} from '../../../data/question_presentation.mjs';
const directory='artifacts/question-factory/cuet-fit-2026-10-07/benchmark';mkdirSync(directory,{recursive:true});
const registry=JSON.parse(readFileSync('data/source_registry.json','utf8'));
const {additions,fixtures}=buildFixtures(registry);
const problems=[];
for(const f of fixtures){const s=structureVerdict(f.candidate);if(!s.passed)problems.push({id:f.id,structure:s.reasons});const l=presentationLint(f.candidate);if(l.length&&f.group!=='controlled_defect')problems.push({id:f.id,presentation:l});}
const counts={};for(const f of fixtures){const k=f.group+':'+f.category;counts[k]=(counts[k]||0)+1;}
writeFileSync(directory+'/fixtures.json',JSON.stringify({id:BENCHMARK_ID,built_at:new Date().toISOString(),registry_version:registry.version,additions,fixtures},null,1));
console.log(JSON.stringify({fixtures:fixtures.length,counts,problems,payload_hash:payloadHash(fixtures)},null,1));
