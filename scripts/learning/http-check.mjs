// Production-build boundary checks only. No cookies, credentials or live records.
// Protected writes must reject before application work; no payment/model request.
import { writeFileSync } from 'node:fs';
const base=process.env.LEARNING_CHECK_BASE || 'http://localhost:3100';
if (!/^http:\/\/localhost:\d+$/.test(base)) throw new Error('Local inspection server required');
const checks=[
  ['GET','/api/learning/plan',401],
  ['POST','/api/recovery/episodes',401],
  ['POST','/api/recovery/episodes/nonexistent/responses',401],
  ['POST','/api/sessions',401],
  ['PATCH','/api/sessions',401],
  ['POST','/api/ai/mentor/chat',401],
  ['POST','/api/send-email',404],
  ['GET','/preview/recovery',404],
  ['GET','/preview/arena',404],
];
const results=[];
for(const [method,path,expected] of checks) {
  const response=await fetch(`${base}${path}`,{method,headers:method==='GET'?{}:{'Content-Type':'application/json'},...(method==='GET'?{}:{body:'{}'}),signal:AbortSignal.timeout(15000)});
  await response.text();
  results.push({method,path,expected,status:response.status,passed:response.status===expected});
}
const report={generatedAt:new Date().toISOString(),base,mode:'local_production_build_unauthenticated_boundaries',cookiesOrCredentials:false,results};
writeFileSync(new URL('../../docs/brain/reports/learning-http-checks.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
if(results.some(r=>!r.passed))process.exitCode=1;
