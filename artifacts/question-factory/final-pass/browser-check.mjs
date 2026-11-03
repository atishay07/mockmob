import {chromium} from 'file:///C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out='artifacts/question-factory/final-pass',q=JSON.parse(readFileSync('artifacts/question-factory/quality-v5/results.json','utf8')).jobs.find(j=>j.number===51).candidate;
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],results=[];
try{
 const context=await browser.newContext();
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({question})=>{
   let current=window.fetch.bind(window);
   const wrap=fn=>async(input,init={})=>{
     const response=await fn(input,init),url=new URL(typeof input==='string'?input:input.url,window.location.href);
     if(window.location.pathname==='/preview/arena'&&url.pathname==='/api/sessions'&&init.method==='POST'){
       const payload=await response.json();
       if(payload.questions?.length)payload.questions[0]={...payload.questions[0],chapter:question.chapter,question:question.body,body:question.body,options:question.options,correctIndex:3,correct_answer:question.correct_answer,explanation:question.explanation,sourceKind:'authentic_pyq'};
       return new Response(JSON.stringify(payload),{status:response.status,headers:{'Content-Type':'application/json'}});
     }
     return response;
   };
   Object.defineProperty(window,'fetch',{configurable:true,get:()=>wrap(current),set:fn=>{current=fn;}});
   localStorage.setItem('mm_vote_coach_seen','1');
 },{question:q});
 for(const [label,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:375,height:812}]]){
  await page.setViewportSize(viewport);await page.goto('http://localhost:3010/preview/arena?view=test&plan=pro&subject=accountancy&count=5&mode=quick&generationKey=final-pass-preview-1234',{waitUntil:'networkidle'});
  const title=page.locator('.nta-question-text').first();await title.waitFor({timeout:30000});
  const text=await title.innerText();assert.ok(text.includes('List-I (Meaning)\n(A) Right to command\n(B) Obligation'));
  assert.ok(text.includes('List-II (Term)\n(I) Answerability\n(II) Delegation'));
  const buttons=page.locator('.nta-option');assert.equal(await buttons.count(),4);await buttons.nth(3).click();assert.equal(await buttons.nth(3).getAttribute('aria-pressed'),'true');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
  await title.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/matching-${label}.png`});results.push({label,columns_restored:true,options:4,selection_preserved:true,no_horizontal_overflow:true});
 }
 await page.goto('http://localhost:3010/preview/question-factory',{waitUntil:'networkidle'});
 await page.getByText('Latest reviewed cohort',{exact:true}).waitFor();assert.ok((await page.locator('main').innerText()).includes('49 potential usable drafts'));await page.screenshot({path:`${out}/factory-mobile.png`,fullPage:true});
 results.push({label:'factory-preview',latest_cohort:49,publication_gated:true});assert.deepEqual(errors,[]);
 writeFileSync(`${out}/browser-check.json`,JSON.stringify({results,errors,scope:'Local development preview with the exact frozen matching question substituted into the preview session. No real session, publication or production change.'},null,2)+'\n');console.log(JSON.stringify({results,errors}));
}finally{await browser.close();}
