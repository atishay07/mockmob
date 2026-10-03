import { readFileSync,writeFileSync,readdirSync,existsSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyBatch } from '../lib/evidencePipeline.mjs';
import { pipelineBudget } from '../lib/budgetLedger.mjs';
import { currentRegistry } from '../../../data/evidence_registry.js';

const directory=resolve(process.argv[2] || 'data/offline_question_batches/economics_money_banking');
const adapterPath=process.env.CUET_EVIDENCE_ADAPTER_MODULE;
if(!adapterPath || !process.env.CUET_EVIDENCE_SIGNING_KEY) throw new Error('Evidence adapters and signing key required. No requests dispatched.');
const { adapters,version }=await import(pathToFileURL(resolve(adapterPath)).href);
const normalized=join(directory,'normalized_candidates.json');
const candidates=existsSync(normalized)?JSON.parse(readFileSync(normalized,'utf8')):readdirSync(directory).filter(f=>/^batch_\d+\.json$/.test(f)).flatMap(f=>JSON.parse(readFileSync(join(directory,f),'utf8')).questions);
const ledger=pipelineBudget(); const route='offline:'+directory;
ledger.assertRoute(route);
const results=await verifyBatch(candidates,{registry:currentRegistry(),ledger,adapters,version,secret:process.env.CUET_EVIDENCE_SIGNING_KEY});
ledger.recordBatch(route,results.filter(r=>r.state==='eligible').length);
writeFileSync(join(directory,'evidence_results.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify({candidates:results.length,eligible:results.filter(r=>r.state==='eligible').length,paid_spending:ledger.snapshot()}));
