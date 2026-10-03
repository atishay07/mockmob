import { browser, context } from './round5-browser.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='artifacts/round6', report=[];
await fs.mkdir(out,{recursive:true});
const b=await browser();
const home=process.env.ROUND6_HOME || 'http://localhost:3011';
const fixture='http://localhost:3010/preview/arena?view=prepos&tab=ask&plan=pro';
const interactionsOnly=process.argv.includes('--interaction-only');
async function capture(p,name){await p.screenshot({path:`${out}/${name}.png`});}
async function bounds(p){assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);}
try {
  for(const width of (process.argv.includes('--ask-only') || interactionsOnly ? [] : [320,390,768,1280])) for(const theme of ['dark','light']) {
    const c=await context(b,width,860,{hasTouch:width<800,isMobile:width<600});
    await c.addInitScript(t=>localStorage.setItem('mm:theme:v1',t),theme);
    const p=await c.newPage(); await p.bringToFront(); const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto(home,{waitUntil:'load'}); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(450);
    await bounds(p);assert.match(await p.locator('h1').innerText(),/One mock/);
    assert.equal(await p.locator('.morph-word').count(),0);
    await capture(p,`hero-${width}-${theme}`);
    const stations=await p.locator('[data-pip-station]').evaluateAll(es=>es.map(e=>({id:e.dataset.pipStation,y:e.getBoundingClientRect().top+scrollY})));
    for(const s of [...stations,...stations.slice().reverse()]) {
      await p.evaluate(y=>scrollTo({top:Math.max(0,y-180),behavior:'instant'}),s.y);await p.waitForTimeout(500);
      const state=await p.locator('.pip-guide-flyer .pip-actor').evaluate(e=>({pose:e.dataset.pose,facing:e.dataset.facing,faces:e.querySelectorAll('.pip-pose-in').length,matrix:getComputedStyle(e.querySelector('.pip-art-direction')).transform}));
      assert.ok(!['idle','thinking'].includes(state.pose));assert.equal(state.faces,1);
      if(width>=1100 && state.pose==='pointing'){assert.equal(state.facing,'left');assert.match(state.matrix,/matrix\(-1/);}
      await bounds(p);report.push({width,theme,requested:s.id,...state});
      if(width===1280&&theme==='dark') await capture(p,`station-${report.length}-${s.id}`);
    }
    await p.emulateMedia({reducedMotion:'reduce'});await p.waitForFunction(()=>!document.querySelector('.pip-guide-flyer'));assert.equal(await p.locator('[data-pip-station]').count(),7);
    const fallback=await p.locator('[data-pip-pose="pointing"] .pip-image').evaluateAll(es=>es.map(e=>getComputedStyle(e).transform));assert.equal(fallback.length,2);assert.ok(fallback.every(t=>t.startsWith('matrix(-1')));
    report.push({width,theme,reducedMotion:true});assert.deepEqual(errors,[]);await c.close();
  }
  for(const width of (interactionsOnly ? [] : [320,390,768,1280])) for(const theme of ['dark','light']) {
    const c=await context(b,width,860);await c.addInitScript(t=>localStorage.setItem('mm:theme:v1',t),theme);const p=await c.newPage();await p.bringToFront();
    await p.goto(fixture,{waitUntil:'load'});await p.locator('.pp-ask__balance').filter({hasText:'68 PrepOS credits'}).waitFor();await bounds(p);
    await p.getByRole('button',{name:'Where am I losing marks?',exact:true}).click();await p.getByText('From your record · no credits',{exact:true}).waitFor();
    assert.equal(await p.evaluate(()=>window.__previewChatRequests.length),0);await capture(p,`record-${width}-${theme}`);
    await p.getByRole('button',{name:'Written guidance 1 credit',exact:true}).click();await p.getByText('Written guidance is paused.',{exact:true}).waitFor();assert.equal(await p.getByRole('textbox',{name:'Ask PrepOS',exact:true}).isEnabled(),false);await bounds(p);
    await capture(p,`paused-${width}-${theme}`);report.push({width,theme,freeRecord:true,pausedModel:true});await c.close();
  }
  for(const state of (interactionsOnly ? [] : ['live','network','failure','wallet'])) {
    const c=await context(b,390,860),p=await c.newPage();await p.bringToFront();await p.goto(`${fixture}&${state==='wallet'?'wallet=down':`ai=${state}`}`,{waitUntil:'load'});
    await p.getByRole('button',{name:'Written guidance 1 credit',exact:true}).click();
    if(state==='wallet') {await p.locator('.pp-ask__balance').filter({hasText:'Wallet unavailable'}).waitFor();assert.equal(await p.getByRole('textbox',{name:'Ask PrepOS',exact:true}).isEnabled(),false);report.push({unknownWallet:true});}
    else {
      await p.getByLabel('Focus',{exact:true}).waitFor();await p.getByLabel('Focus',{exact:true}).selectOption('revision');
      await p.getByRole('textbox',{name:'Ask PrepOS',exact:true}).fill('Explain the goodwill adjustment when a new partner joins.');await p.getByRole('button',{name:'Ask · 1 credit',exact:true}).click();
      if(state==='network') {
        await p.getByRole('button',{name:'Retry this question',exact:true}).waitFor();
        // Moving between sections must retain the unresolved operation.
        await p.getByRole('button',{name:'Your record',exact:true}).click();await p.getByRole('button',{name:'Ask',exact:true}).click();
        await p.getByRole('button',{name:'Retry this question',exact:true}).click();
      }
      if(state==='failure') {await p.getByText('Illustrative provider failure. Your reserved credit was restored.',{exact:true}).waitFor();await p.locator('.pp-ask__balance').filter({hasText:'68 PrepOS credits'}).waitFor();}
      else {await p.getByText('1 PrepOS credit used',{exact:true}).waitFor();await p.locator('.pp-ask__balance').filter({hasText:'67 PrepOS credits'}).waitFor();}
      const requests=await p.evaluate(()=>window.__previewChatRequests);assert.equal(requests.length,state==='network'?2:1);assert.ok(requests.every(r=>r.replyKind==='model'&&r.mode==='revision'));if(state==='network')assert.equal(requests[0].requestId,requests[1].requestId);
      report.push({state,requests:requests.length,stableRetry:state==='network',balanceVerified:true});
    }
    await bounds(p);await capture(p,`guidance-${state}`);await c.close();
  }
  if(!interactionsOnly){const c=await context(b,390,860),p=await c.newPage();await p.goto(`${fixture}&ai=live`,{waitUntil:'load'});await p.locator('.pp-ask__balance').filter({hasText:'68 PrepOS credits'}).waitFor();
  await p.getByRole('textbox',{name:'Ask PrepOS',exact:true}).fill('Explain the goodwill adjustment when a new partner joins.');await p.getByRole('button',{name:'Ask your record',exact:true}).click();await p.getByText('From your record · no credits',{exact:true}).waitFor();
  const free=await p.evaluate(()=>window.__previewChatRequests);assert.equal(free.length,1);assert.equal(free[0].replyKind,'record');await p.locator('.pp-ask__balance').filter({hasText:'68 PrepOS credits'}).waitFor();report.push({freeUnknownNeverBilled:true});await c.close();}
  for(const width of [390,1280]) {
    const c=await context(b,width,860),p=await c.newPage();await p.bringToFront();await p.goto(home,{waitUntil:'load'});await p.waitForTimeout(350);
    // Real controls, real keyboard activation: decoration must not slow answering.
    const correct=p.locator('#try-practice').getByRole('button',{name:'Frank',exact:true});await correct.focus();await correct.press('Enter');await p.waitForTimeout(150);
    assert.ok(!(await p.locator('.pip-guide-flyer .pip-actor').getAttribute('data-motion')));report.push({width,keyboardAnswerStill:true});
    await p.reload({waitUntil:'load'});await p.locator('.pip-guide-flyer').waitFor();await p.locator('#try-practice').getByRole('button',{name:'Frank',exact:true}).click();if(width<600){await p.waitForTimeout(450);await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));}await p.waitForFunction(()=>document.querySelector('.pip-guide-flyer .pip-actor')?.dataset.motion?.startsWith('hop'));report.push({width,correctAnswerHop:true});
    await p.reload({waitUntil:'load'});await p.locator('.pip-guide-flyer').waitFor();await p.locator('#try-practice').getByRole('button',{name:'Hidden',exact:true}).click();if(width<600){await p.waitForTimeout(450);await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));}await p.waitForFunction(()=>document.querySelector('.pip-guide-flyer .pip-actor')?.dataset.motion?.startsWith('nod'));assert.equal(await p.locator('.pip-guide-flyer .pip-actor').getAttribute('data-pose'),'attentive');report.push({width,wrongAnswerSupportive:true});
    await p.mouse.wheel(0,2000);await p.waitForTimeout(100);await p.mouse.wheel(0,-1000);await p.waitForTimeout(450);await bounds(p);await capture(p,`wheel-reverse-${width}`);report.push({width,wheelReverse:true});await c.close();
  }
  for(const width of [320,1280]) for(const view of ['dashboard','prepos','review']) {
    const c=await context(b,width,860),p=await c.newPage();await p.bringToFront();await p.goto(`http://localhost:3010/preview/arena?view=${view}&plan=pro`,{waitUntil:'load'});await p.waitForTimeout(200);
    const poses=await p.locator('.arena-companion .pip-image').evaluateAll(es=>es.map(e=>e.dataset.pose));assert.ok(poses.every(v=>v==='attentive'));
    await p.evaluate(()=>document.documentElement.style.fontSize='200%');await bounds(p);await capture(p,`text200-${view}-${width}`);report.push({width,view,text200:true,quietCompanion:true});await c.close();
  }
} finally {await fs.writeFile(`${out}/verification.json`,JSON.stringify(report,null,2));await b.close();}
console.log(JSON.stringify({checks:report.length,passed:true,fixturesOnlyForAI:true}));


