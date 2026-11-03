// Actual isolated staging rendering; no synthetic questions, publication, mail or
// paid model calls. Cookies stay in process memory and are never exported.
import {chromium} from 'file:///C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
import {loadEnvFile} from 'node:process';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
loadEnvFile('.env.staging');
const url=process.env.STAGING_SUPABASE_URL,base='http://localhost:3101',dir='artifacts/question-factory/cuet-readiness-2026-10-08/staging';
const version=process.argv.includes('--v74')?'v74':'v73';
const verifier=version==='v74'?'cuet-fit-validator-v7.4':'cuet-fit-validator-v7.3';
assert.equal(url,'https://onwkqxmjqjrhfbjjdydu.supabase.co');mkdirSync(dir,{recursive:true});
const boundedFetch=(url,init={})=>fetch(url,{...init,signal:AbortSignal.timeout(30000)});
const db=createClient(url,process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false},global:{fetch:boundedFetch}});
const {data,error}=await db.auth.admin.generateLink({type:'magiclink',email:'atishay07jain@gmail.com'});if(error)throw error;
let jar=[];const identity=createServerClient(url,process.env.STAGING_SUPABASE_ANON_KEY,{global:{fetch:boundedFetch},cookies:{getAll:()=>jar,setAll:values=>{jar=values;}}});
const {error:loginError}=await identity.auth.verifyOtp({token_hash:data.properties.hashed_token,type:data.properties.verification_type});if(loginError)throw loginError;
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],errors=[];
try{
 const context=await browser.newContext();await context.addCookies(jar.map(c=>({name:c.name,value:c.value,url:base})));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const [label,width,height]of[['desktop',1440,1000],['mobile',390,844]]){
  await page.setViewportSize({width,height});await page.goto(base+'/admin/question-factory',{waitUntil:'domcontentloaded',timeout:90000});
  await page.getByRole('heading',{name:'Question factory',exact:true}).waitFor({timeout:90000});
  const validationText=await page.getByText('Current generation validation:',{exact:false}).innerText();
  assert.ok(validationText.includes(verifier));
  const refreshed=page.waitForResponse(r=>r.url().includes('/api/admin/question-factory')&&r.request().method()==='GET',{timeout:90000});
  await page.getByRole('button',{name:'Refresh',exact:true}).click();const refreshedResponse=await refreshed;assert.equal(refreshedResponse.status(),200);
  const overview=await refreshedResponse.json();assert.equal(overview.current_validation.verifier_version,verifier);
  assert.equal(overview.current_validation.ready,false,'unreleased_current_validator_must_remain_blocked');
  const summary=page.getByText('Inspect chapter coverage',{exact:true}).first();await summary.click();
  assert.equal(await summary.evaluate(el=>el.closest('details').open),true);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);
  await page.screenshot({path:dir+`/current-${version}-dashboard-${label}.png`,fullPage:true});
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:dir+`/current-${version}-dashboard-${label}-viewport.png`});
  checks.push({label,width,height,authenticated_heading:true,refresh_status:200,coverage_expanded:true,no_horizontal_overflow:true,current_validation:overview.current_validation,observed_usable_factory:overview.counts.usable_factory,rendered_validation_text:validationText});
 }
 assert.equal(errors.length,0);
 const proof={at:new Date().toISOString(),base,project_ref:'onwkqxmjqjrhfbjjdydu',checks,page_errors:errors,paid_provider_calls:0,publication_writes:0,production_writes:0,emails_sent:0};
 writeFileSync(dir+`/current-${version}-dashboard-render.json`,JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}finally{await browser.close();}
