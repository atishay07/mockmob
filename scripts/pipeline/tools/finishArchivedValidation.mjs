import {readFileSync,writeFileSync} from 'node:fs';import {spawn} from 'node:child_process';import {BudgetLedger} from '../lib/budgetLedger.mjs';
const version=process.argv[2];if(!['v60','v61'].includes(version))throw Error('archived_attempt_required');
const dir='artifacts/question-factory/execution-2026-10-07',root='.cache/factory-'+version,path=root+'/scripts/pipeline/tools/focusedFactory.mjs';
let code=readFileSync(path,'utf8');
if(!code.includes('class ArchivedStore')){
 code=code.replace('store=new FactoryStore(ledger,ledgerPath)','store=new ArchivedStore(ledger,ledgerPath)');
 code=code.replace("const ledgerPath=process.env.CUET_BUDGET_LEDGER",`class ArchivedStore extends FactoryStore {get(id){return super.get('${version}:'+id);}set(id,value){return super.set('${version}:'+id,value);}}\nconst ledgerPath=process.env.CUET_BUDGET_LEDGER`);
 writeFileSync(path,code);
 const r=JSON.parse(readFileSync(dir+'/benchmark-'+version+'-results.json')),l=new BudgetLedger('data/pipeline-budget.sqlite');
 try{for(const f of [...r.observations,...r.quality_regression.observations])l.db.prepare('INSERT OR IGNORE INTO factory_candidates VALUES(?,?)').run(version+':'+f.id,JSON.stringify(f));}finally{l.close();}
}
const child=spawn(process.execPath,['--use-system-ca',path,'benchmark'],{stdio:'inherit'});child.on('exit',c=>process.exit(c??1));
