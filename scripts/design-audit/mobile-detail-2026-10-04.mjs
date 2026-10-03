import { chromium } from 'file:///C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report=[];
try {
 for(const width of [320,390]) {
  const c=await b.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
  await c.addInitScript(()=>localStorage.setItem('mm:theme:v1','light'));
  const p=await c.newPage();
  for(const view of ['dashboard','result']) {
   await p.goto(`http://localhost:3010/preview/arena?view=${view}&plan=pro`);
   await p.locator(view==='result'?'.rp-hero':'.pr-head').waitFor();
   const selector=view==='result'?'.srl-step':'.pr-summary';
   await p.locator(selector).first().evaluate(e=>scrollTo({top:e.getBoundingClientRect().top+scrollY-100,behavior:'instant'}));
   await p.waitForTimeout(1000);
   const geometry=await p.locator(`${selector}, .srl-obs, .srl-chapters, .pr-summary__reason, .pr-summary__cta`).evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {cls:e.className,height:Math.round(r.height),width:Math.round(r.width),top:Math.round(r.top),display:s.display,grid:s.gridTemplateRows,opacity:s.opacity,text:e.textContent.trim().slice(0,100)};}));
   await p.screenshot({path:`artifacts/mobile-audit-2026-10-04/detail-${width}-${view}.png`});
   report.push({width,view,geometry});
   if(view==='dashboard') {
    const open=p.getByRole('button',{name:'Open navigation menu',exact:true});
    await open.tap(); await p.locator('#arena-sheet').waitFor();
    await p.screenshot({path:`artifacts/mobile-audit-2026-10-04/detail-${width}-menu.png`});
    const opened=await p.getByRole('button',{name:'Close navigation menu',exact:true}).getAttribute('aria-expanded'); await p.keyboard.press('Escape');
    report.push({width,menuOpened:opened,menuClosed:await p.locator('#arena-sheet').count()===0});
   }
  }
  await c.close();
 }
} finally {await fs.writeFile('artifacts/mobile-audit-2026-10-04/details.json',JSON.stringify(report,null,2));await b.close();}
