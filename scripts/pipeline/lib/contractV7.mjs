import {readFileSync} from 'node:fs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
// Content-hash of every file that decides a CUET-fit verdict. A campaign registers this hash; a change to any listed file
// stops the worker until a new frozen measurement exists. The legacy v6 contract in compactBenchmark.mjs is untouched.
export const CONTRACT_FILES_V7=['factoryEvidenceV7.mjs','verifyV7.mjs','cuetFit.mjs','authorIntegrityV7.mjs','factoryCore.mjs','factoryEvidence.mjs','evidencePipeline.mjs','focusedCoverage.mjs','focusedSources.mjs','../../../data/cuet_fit_rubric.mjs','../../../data/cuet_fit_evidence.mjs','../../../data/content_evidence.js','../../../data/question_factory_policy.mjs','../../../data/question_presentation.mjs','../../../data/canonical_json.mjs'];
export const validationContractV7=()=>hashJSON(CONTRACT_FILES_V7.map(p=>readFileSync(new URL(p,import.meta.url),'utf8')));
// Campaigns are worked in waves of at most ten candidates (owner, 8 Oct 2026).
export const MAX_WAVE_SIZE=10;
