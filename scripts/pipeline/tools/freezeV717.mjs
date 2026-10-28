// Create-only V717 execution freeze: hashes every module reachable from the V717 entry points.
// Usage: node scripts/pipeline/tools/freezeV717.mjs <output.json> "<decision rule text>"
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildExecutionFreezeV717 } from '../lib/executionFreezeV717.mjs';
const [output, decisionRule] = process.argv.slice(2);
if (!output || !decisionRule) throw Error('usage: freezeV717.mjs <output.json> <decision-rule>');
const bytes = JSON.stringify(buildExecutionFreezeV717({ decisionRule }), null, 2) + '\n';
writeFileSync(output, bytes, { flag: 'wx' });
const freeze = JSON.parse(bytes);
console.log(JSON.stringify({ output, sha256: createHash('sha256').update(bytes).digest('hex'), files: freeze.file_count,
  contract_hash: freeze.contract_hash, scorecard_prompt_hash: freeze.scorecard_prompt_hash, generation_prompt_hash: freeze.generation_prompt_hash }, null, 2));
