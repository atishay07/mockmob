// Public release checks; no sign-in, learner writes, model calls or credit mutations.
import {writeFileSync} from 'node:fs';
const origin='https://www.mockmob.in';
const paths=['/','/learn','/learn/summary?subject=business_studies&chapter=Planning','/api/study/catalog','/api/study/summary?subject=business_studies&chapter=Planning','/api/auth/providers','/preview/study'];
const checks=await Promise.all(paths.map(async path=>{
  const response=await fetch(origin+path,{headers:{'Cache-Control':'no-cache'},redirect:'manual'});
  const out={path,status:response.status};
  if(path==='/api/auth/providers'){const providers=await response.json();out.providers=Object.keys(providers);out.demoRemoved=!providers.credentials;}
  return out;
}));
const apex=await fetch('https://mockmob.in/',{redirect:'manual'});
const out={at:new Date().toISOString(),checks,apex:{status:apex.status,location:apex.headers.get('location')},scope:'Public/authentication checks only; does not establish signed-in flows or deployment commit'};
writeFileSync('artifacts/study-suite/v3/public-live-receipt.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));
if(checks.some(c=>c.status!==(c.path.startsWith('/api/study/')?401:c.path==='/preview/study'?404:200)) || !checks.find(c=>c.demoRemoved) || ![301,302,307,308].includes(apex.status) || !out.apex.location?.startsWith('https://www.mockmob.in/'))process.exit(1);
