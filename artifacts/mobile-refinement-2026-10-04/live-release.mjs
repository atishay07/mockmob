import {chromium} from 'file:///C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const sha='678229d30e9970571f050b747a8174ead358b8eb',out='artifacts/mobile-refinement-2026-10-04';
const report={sha,status:[],pages:[]};let ready=false;
for(let n=0;n<12;n++){
 const status=await fetch(`https://api.github.com/repos/atishay07/mockmob/commits/${sha}/status`,{headers:{'User-Agent':'MockMob-release-check'}}).then(r=>r.json());
 report.status=(status.statuses||[]).map(s=>({context:s.context,state:s.state,url:s.target_url}));
 const response=await fetch('https://www.mockmob.in/');const html=await response.text();ready=response.status===200&&html.includes('lab-inline');
 console.log(JSON.stringify({attempt:n+1,liveUpdated:ready,checks:report.status.map(s=>`${s.context}: ${s.state}`)}));
 if(ready)break;await new Promise(r=>setTimeout(r,20000));
}
assert.ok(ready,'New homepage must reach the public domain');
const apex=await fetch('https://mockmob.in/');report.apex={status:apex.status,url:apex.url};assert.equal(apex.status,200);
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{for(const width of [320,390,1440])for(const theme of ['light','dark']){
 const c=await b.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});await c.addInitScript(t=>localStorage.setItem('mm:theme:v1',t),theme);const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('https://www.mockmob.in/',{waitUntil:'load'});await p.waitForFunction(()=>document.documentElement.dataset.pipGuide);
 assert.ok(await p.locator('img[alt^="Mobi,"]').count()>0);
 if(width===390&&theme==='light'){
  await p.locator('.ml').evaluate(e=>scrollTo({top:e.getBoundingClientRect().top+scrollY-innerHeight+110,behavior:'instant'}));await p.waitForTimeout(6800);assert.equal(await p.locator('.ml__tile:not(:disabled)').count(),0);
  await p.locator('.ml__panels').evaluate(e=>scrollTo({top:e.getBoundingClientRect().top+scrollY-220,behavior:'instant'}));await p.waitForTimeout(1000);const tiles=await p.locator('.ml__tile:not(:disabled)').count();assert.ok(tiles>0&&tiles<10);report.timing={headingDwell:'zero tiles after 6.8s',visibleTiles:tiles};
 }
 await p.locator('.ml__stage').evaluate(e=>scrollTo({top:e.getBoundingClientRect().top+scrollY-160,behavior:'instant'}));await p.waitForTimeout(500);
 const state=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,guide:document.documentElement.dataset.pipGuide,theme:document.documentElement.dataset.theme}));assert.equal(state.overflow,0);assert.equal(errors.length,0);
 await p.screenshot({path:`${out}/live-${width}-${theme}.png`});report.pages.push({width,theme,...state,errors});await c.close();
}}finally{await b.close();await fs.writeFile(`${out}/live-release.json`,JSON.stringify(report,null,2));}
console.log('LIVE_SMOKE_PASSED');
