import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const dir='artifacts/question-factory/cuet-readiness-2026-10-09/execution/v76-source-prep/ncert';mkdirSync(dir,{recursive:true});
const registry=JSON.parse(readFileSync('data/source_registry.json'));
const entries=await Promise.all(['leac201','leac101','lebs102','lebs104','lebs203','lebs103','leec103','leec105','leec106','keec101'].map(async name=>{
 const url=`https://www.ncert.nic.in/textbook/pdf/${name}.pdf`,path=`${dir}/${name}.pdf`;
 if(!existsSync(path)){const r=await fetch(url);if(!r.ok)throw Error(`${r.status}:${url}`);const b=Buffer.from(await r.arrayBuffer());if(b.subarray(0,4).toString()!=='%PDF')throw Error('not_pdf');writeFileSync(path,b,{flag:'wx'});}
 const bytes=readFileSync(path),sha256=createHash('sha256').update(bytes).digest('hex'),old=registry.sources[`ncert-${name}`];
 return {name,url,path,sha256,bytes:bytes.length,previous_identity_sha256:old?.identity_sha256||null,matches_previous_identity:sha256===old?.identity_sha256};
}));
writeFileSync(`${dir}/acquisition-manifest.json`,JSON.stringify({at:new Date().toISOString(),purpose:'Decisive normative evidence only; question cases remain newly constructed after V76 freeze',entries},null,2));console.log(JSON.stringify(entries));
