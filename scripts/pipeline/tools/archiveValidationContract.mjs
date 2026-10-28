import {mkdirSync,readFileSync,writeFileSync,readdirSync,copyFileSync} from 'node:fs';
const version=process.argv[2];
if(!/^v6[0-9]$/.test(version||''))throw Error('explicit_contract_snapshot_required');
const root='.cache/factory-'+version,dir='artifacts/question-factory/execution-2026-10-07';
for(const path of ['data','scripts/pipeline/lib']){
 mkdirSync(root+'/'+path,{recursive:true});
 for(const name of readdirSync(path).filter(n=>/\.(?:js|mjs|json)$/.test(n)))copyFileSync(path+'/'+name,root+'/'+path+'/'+name);
}
mkdirSync(root+'/scripts/pipeline/tools',{recursive:true});
copyFileSync(dir+'/campaign.json',dir+'/campaign-'+version+'.json');
copyFileSync(dir+'/benchmark.json',dir+'/benchmark-'+version+'.json');
copyFileSync(dir+'/benchmark-results.json',dir+'/benchmark-'+version+'-results.json');
let runner=readFileSync('scripts/pipeline/tools/focusedFactory.mjs','utf8');
runner=runner.replace("read('data/source_registry.json')",`read('${root}/data/source_registry.json')`).replace('campaign.json`','campaign-'+version+'.json`').replace('benchmark.json`','benchmark-'+version+'.json`');
runner=runner.replaceAll('benchmark-results.json','benchmark-'+version+'-results.json').replace("save('data/calibration_manifest.json',output);",'');
writeFileSync(root+'/scripts/pipeline/tools/focusedFactory.mjs',runner);
console.log(JSON.stringify({snapshot:root,paid_requests:0}));
