import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const dir='artifacts/question-factory/cuet-readiness-2026-10-09/execution/v76-source-prep/acquisition-2021-22';
mkdirSync(dir,{recursive:true});
const entries=await Promise.all(['Accountancy','BusinessStudies','Economics','EnglishCore'].map(async subject=>{
 const url=`https://cbseacademic.nic.in/web_material/SQP/ClassXII_2021_22/${subject}-SQP.pdf`,path=`${dir}/${subject}-SQP.pdf`;
 if(!existsSync(path)){const response=await fetch(url);if(!response.ok)throw Error(`${response.status}:${url}`);const bytes=Buffer.from(await response.arrayBuffer());if(bytes.subarray(0,4).toString()!=='%PDF')throw Error('not_pdf');writeFileSync(path,bytes,{flag:'wx'});}
 const bytes=readFileSync(path);return {subject,url,path,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
}));
writeFileSync(`${dir}/acquisition-manifest.json`,JSON.stringify({at:new Date().toISOString(),contract_frozen_before_acquisition:true,source_year:'2021-22',key_content_opened:false,prior_registered_family_search_hits:0,entries},null,2));
console.log(JSON.stringify(entries));
