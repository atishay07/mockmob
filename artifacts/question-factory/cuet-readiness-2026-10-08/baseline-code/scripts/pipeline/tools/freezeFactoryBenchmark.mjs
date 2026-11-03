import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {freezeBenchmark} from '../lib/factoryBenchmark.mjs';
const target=process.argv[2];if(!target)throw Error('Usage: freezeFactoryBenchmark.mjs <new-official-fixtures.json>');
const read=p=>JSON.parse(readFileSync(p,'utf8')),manifest=read(target),registry=read('data/source_registry.json');
const ledger=new BudgetLedger(process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite');
try{
 const runtime='data/question-factory-runtime',previousFixtures=[];
 for(const file of readdirSync(runtime).filter(f=>/\.json$/.test(f)&&resolve(runtime,f)!==resolve(target))){const m=read(resolve(runtime,file));if(Array.isArray(m.development)&&Array.isArray(m.held_out))previousFixtures.push(...m.development,...m.held_out);}
 const previousJobs=[];for(const {name}of ledger.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'factory%'").all()){
  if(!/^[a-z0-9_]+$/.test(name))continue;if(ledger.db.prepare(`PRAGMA table_info(${name})`).all().some(c=>c.name==='value'))for(const r of ledger.db.prepare(`SELECT value FROM ${name}`).all())previousJobs.push(JSON.parse(r.value));
 }
 const registration=freezeBenchmark(manifest,{registry,ledger,previousFixtures,previousJobs});
 manifest.holdout_registration=registration;writeFileSync(target,JSON.stringify(manifest,null,2)+'\n');
 // Held-out source units are never available to authoring/blueprints.
 const reserved=new Set(registry.calibration_anchor_ids||[]);
 for(const f of manifest.held_out){const a=registry.examples.find(a=>a.id===f.provenance.anchor_id);for(const m of registry.examples.filter(e=>e.id===a.id||a.passage_group_id&&e.passage_group_id===a.passage_group_id))reserved.add(m.id);}
 registry.calibration_anchor_ids=[...reserved];writeFileSync('data/source_registry.json',JSON.stringify(registry,null,2)+'\n');
 console.log(JSON.stringify({frozen:manifest.held_out.length,registration:registration.id,api_spend_usd:0,production_changes:0}));
}finally{ledger.close();}
