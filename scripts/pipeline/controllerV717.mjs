// Additive current-profile entry point. Historical controller/llm contracts stay untouched.
// Usage: node --use-system-ca scripts/pipeline/controllerV717.mjs <qualification|pilot> <prepare|report|execute|recover> <directory> [--approved]
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const [kind,action,directory,...flags]=process.argv.slice(2);
if (!['qualification','pilot'].includes(kind) || !['prepare','report','execute',...(kind==='qualification'?['recover']:[])].includes(action) || !directory || flags.some(f=>f!=='--approved')) throw Error('v717_controller_requires_registered_bounded_route');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const runner=resolve(root,'scripts/pipeline/tools',kind==='qualification'?'runQualificationV717.mjs':'runPilotV717.mjs');
const result=spawnSync(process.execPath,['--use-system-ca',runner,action,resolve(directory),...flags],{cwd:root,stdio:'inherit',windowsHide:true});
if (result.error) throw result.error;
process.exitCode=result.status ?? 1;
