import { chromium } from 'file:///C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'artifacts/mobile-refinement-2026-10-04';
await fs.mkdir(out, {recursive:true});
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report = {pages:[],timing:[],interactions:[],errors:[]};
const base = 'http://localhost:3010';
async function setup(width, theme, height=844, reduced=false) {
 const c=await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:width<600,reducedMotion:reduced?'reduce':'no-preference'});
 await c.addInitScript(t=>localStorage.setItem('mm:theme:v1',t),theme);
 const p=await c.newPage();p.on('pageerror',e=>report.errors.push({width,theme,message:e.message}));return {c,p};
}
async function scroll(p,selector,offset=110) {await p.locator(selector).first().evaluate((e,o)=>scrollTo({top:e.getBoundingClientRect().top+scrollY-o,behavior:'instant'}),offset);await p.waitForTimeout(200);}
async function state(p) {return p.evaluate(()=>({step:document.querySelector('.ml__steps [aria-current]')?.getAttribute('aria-label'),tiles:document.querySelectorAll('.ml__tile:not(:disabled)').length,running:document.querySelector('.ml')?.dataset.playing,overflow:document.documentElement.scrollWidth-innerWidth,guide:document.documentElement.dataset.pipGuide}));}
async function geometry(p,selector) {return p.locator(selector).evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {cls:e.className,height:Math.round(r.height),width:Math.round(r.width),top:Math.round(r.top),scrollHeight:e.scrollHeight};}));}
try {
 for(const width of [320,360,390,430,768,1024,1440]) for(const theme of ['dark','light']) {
  const {c,p}=await setup(width,theme);await p.goto(base);await p.waitForFunction(()=>document.documentElement.dataset.pipGuide);await p.waitForTimeout(400);
  if([390,1440].includes(width)) await p.screenshot({path:`${out}/${width}-${theme}-hero.png`});
  await scroll(p,'.ml__panels',180);await p.waitForTimeout(600);
  const lab=await geometry(p,'.ml, .ml__stage, .ml__panel[data-active=true]');
  if([320,390,1440].includes(width)) await p.screenshot({path:`${out}/${width}-${theme}-lab.png`});
  report.pages.push({width,theme,view:'home',state:await state(p),lab});
  for(const [name,selector] of [['exam','.lp-exam'],['compass','.cl'],['pricing','#pricing']]) {
   await scroll(p,selector); if(width===390) await p.screenshot({path:`${out}/${width}-${theme}-${name}.png`});
  }
  for(const view of ['dashboard','result','test']) {
   const extra=view==='test'?'&subject=accountancy&mode=quick&count=5&generationKey=mobile-refinement':'';
   await p.goto(`${base}/preview/arena?view=${view}&plan=pro${extra}`);
   await p.locator(view==='dashboard'?'.pr-head':view==='result'?'.rp-hero':'.nta-option').first().waitFor();
   const selector=view==='dashboard'?'.pr-summary':view==='result'?'.srl-step':'.nta-option';
   await scroll(p,selector);await p.waitForTimeout(400);
   report.pages.push({width,theme,view,state:await state(p),geometry:await geometry(p,selector)});
   if([320,390,1440].includes(width)) await p.screenshot({path:`${out}/${width}-${theme}-${view}.png`});
   if(view==='result' && width<600) {
    const toggle=p.locator('.srl-find-toggle');await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');await toggle.click();
   }
   if(view==='dashboard' && width<1024) {
    const y=await p.evaluate(()=>scrollY); const more=p.getByRole('button',{name:'More',exact:true});await more.click();await p.waitForTimeout(100);
    const openedY=await p.evaluate(()=>scrollY);const g=await geometry(p,'#arena-sheet');
    assert.ok(g[0].top>=0 && g[0].top+g[0].height<=844-60, 'Menu must be visible above the dock');
    await p.keyboard.press('Escape');assert.equal(await p.locator('#arena-sheet').count(),0);
    assert.equal(await more.evaluate(e=>document.activeElement===e),true);assert.equal(openedY,y);
    report.interactions.push({width,theme,menu:'More/no-jump/Escape/focus passed',geometry:g});
   }
  }
  await c.close();console.log(`Layout ${width} ${theme} complete`);
 }
 for(const width of [390,1440]) {
  const {c,p}=await setup(width,'light');await p.goto(base);await p.waitForFunction(()=>document.documentElement.dataset.pipGuide);
  await p.locator('.ml').evaluate(e=>scrollTo({top:e.getBoundingClientRect().top+scrollY-innerHeight+110,behavior:'instant'}));
  await p.waitForTimeout(6800);const before=await state(p);assert.equal(before.tiles,0);assert.equal(before.step,'Replay the session');
  await scroll(p,'.ml__panels',180);await p.waitForTimeout(850);const playing=await state(p);assert.ok(playing.tiles>0 && playing.tiles<10);
  await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await p.waitForTimeout(150);const paused=await state(p);await p.waitForTimeout(2200);assert.deepEqual(await state(p),paused);
  await scroll(p,'.ml__panels',180);await p.waitForTimeout(450);const resumed=await state(p);assert.ok(resumed.tiles>=paused.tiles);assert.equal(resumed.step,'Replay the session');
  await p.getByRole('button',{name:'Find where marks leaked',exact:true}).click();await p.waitForTimeout(6500);assert.equal((await state(p)).step,'Find where marks leaked');
  await p.getByRole('button',{name:'Replay',exact:true}).click();await scroll(p,'.ml__panels',180);await p.waitForTimeout(150);assert.equal((await state(p)).step,'Replay the session');
  report.timing.push({width,before,playing,paused,resumed,manualAndRestart:'passed'});await c.close();
 }
 for(const [width,height,reduced] of [[390,844,true],[844,390,false]]) {
  const {c,p}=await setup(width,'light',height,reduced);await p.goto(base);await p.waitForTimeout(700);await scroll(p,'.ml__panels');
  if(reduced){assert.equal((await state(p)).tiles,10);assert.equal((await state(p)).running,'false');assert.equal(await p.locator('.pip-guide-flyer,.pip-guide-local').count(),0);}
  report.pages.push({width,height,reduced,state:await state(p)});await p.screenshot({path:`${out}/special-${width}-${height}-${reduced}.png`});
  if(reduced){await p.addStyleTag({content:'html {font-size:200% !important}'});await scroll(p,'.ml__panels');report.pages.push({width,textZoom:'200%',state:await state(p),geometry:await geometry(p,'.ml__panels,.ml__panel')});await p.screenshot({path:`${out}/text-200.png`});}
  await c.close();
 }
 assert.equal(report.errors.length,0);assert.ok(report.pages.every(p=>p.state.overflow<=1));
} finally {await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
