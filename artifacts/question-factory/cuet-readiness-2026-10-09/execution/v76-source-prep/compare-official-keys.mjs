import {mkdirSync,writeFileSync,readFileSync,existsSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='artifacts/question-factory/cuet-readiness-2026-10-09/execution/v76-source-prep',dir=root+'/acquisition-2021-22';
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const derivations=['coordinator-derivations-v1-PRIVATE.json','independent-derivations-sol-v2.json'].map(name=>({name,sha256:sha(root+'/'+name),modified_at:statSync(root+'/'+name).mtime.toISOString()}));
const receipt=root+'/independent-derivations-sol-v2.json.sha256';
if(!existsSync(receipt)||!readFileSync(receipt,'utf8').includes(sha(root+'/independent-derivations-sol-v2.json')))throw Error('independent_derivations_must_be_frozen_first');
mkdirSync(dir,{recursive:true});
const entries=await Promise.all(['Accountancy','BusinessStudies','Economics'].map(async subject=>{
 const url=`https://cbseacademic.nic.in/web_material/SQP/ClassXII_2021_22/${subject}-MS.pdf`,path=`${dir}/${subject}-MS.pdf`;
 if(!existsSync(path)){const r=await fetch(url);if(!r.ok)throw Error(`${r.status}:${url}`);const bytes=Buffer.from(await r.arrayBuffer());if(bytes.subarray(0,4).toString()!=='%PDF')throw Error('not_pdf');writeFileSync(path,bytes,{flag:'wx'});}
 return {subject,url,path,sha256:sha(path)};
}));
writeFileSync(dir+'/official-key-acquisition-manifest.json',JSON.stringify({at:new Date().toISOString(),blind_derivations_frozen_before_download:true,derivations,entries,usage:'Corroborate the source question concept/key only after independent custody. Adapted candidates retain their own independently solved key; CBSE is not CUET PYQ authentication.'},null,2));console.log(JSON.stringify(entries));
