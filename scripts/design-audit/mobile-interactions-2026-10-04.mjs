import {chromium} from 'file:///C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='artifacts/mobile-refinement-2026-10-04';
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={checks:[],contrast:[],errors:[]};
const contrast=await fs.readFile('scripts/design-audit/contrast-audit.js','utf8');
try {
 for(const width of [320,390]) for(const theme of ['light','dark']) {
  const c=await b.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
  await c.addInitScript(t=>{if(!localStorage.getItem('mm:theme:v1'))localStorage.setItem('mm:theme:v1',t)},theme);
  const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
  for(const skin of ['mockmob','nta']) {
   await p.goto(`http://localhost:3010/preview/arena?view=test&plan=pro&subject=accountancy&mode=nta&interface=${skin}&count=50&generationKey=${width}-${theme}-${skin}`);
   await p.locator('.nta-option').first().waitFor();await p.locator('.nta-option').nth(1).tap();assert.equal(await p.locator('.nta-option.is-selected').count(),1);
   await p.getByRole('button',{name:'Clear',exact:true}).tap();assert.equal(await p.locator('.nta-option.is-selected').count(),0);
   await p.locator('.nta-option').nth(2).tap();await p.getByRole('button',{name:'Mark',exact:true}).tap();
   await p.locator('.nta-mobile-actions').getByRole('button',{name:'Next',exact:true}).tap();
   await p.getByRole('button',{name:'Palette',exact:true}).tap();const sheet=p.getByRole('dialog',{name:'Question palette'});await sheet.waitFor();
   const first=sheet.locator('.nta-palette-chip').first();assert.match(await first.getAttribute('class'),/marked-answered/);await first.tap();assert.equal(await sheet.count(),0);assert.equal(await p.locator('.nta-option.is-selected').count(),1);
   await p.getByRole('button',{name:'Palette',exact:true}).tap();await p.keyboard.press('Escape');assert.equal(await sheet.count(),0);
   assert.equal(await p.getByRole('button',{name:'Palette',exact:true}).evaluate(e=>document.activeElement===e),true);
   await p.getByRole('button',{name:'Palette',exact:true}).tap();let confirmed=false;p.once('dialog',async d=>{confirmed=true;await d.dismiss()});await sheet.getByRole('button',{name:'Submit test',exact:true}).tap();assert.ok(confirmed);assert.equal(await p.evaluate(()=>window.__previewSubmissions.length),0);
   report.checks.push({width,theme,skin,runner:'answer/clear/mark/next/palette/Escape/focus/cancel submission passed'});
  }
  await p.goto('http://localhost:3010');await p.waitForFunction(()=>document.documentElement.dataset.pipGuide);
  const exam=p.locator('.lp-exam-section');await exam.locator('label').nth(1).tap();await exam.getByRole('button',{name:/NTA style/}).tap();assert.equal(await exam.locator('input:checked').count(),1);
  await exam.getByRole('button',{name:'Mark for Review & Next',exact:true}).tap();await exam.getByRole('button',{name:/Preview question 1,/}).tap();assert.equal(await exam.locator('input:checked').count(),1);
  await exam.getByRole('button',{name:'Clear response',exact:true}).tap();assert.equal(await exam.locator('input:checked').count(),0);
  await p.getByRole('switch',{name:'Dark mode',exact:true}).first().tap();await p.waitForTimeout(850);const changed=theme==='dark'?'light':'dark';assert.equal(await p.locator('html').getAttribute('data-theme'),changed);await p.reload();await p.waitForTimeout(500);assert.equal(await p.locator('html').getAttribute('data-theme'),changed);
  report.checks.push({width,theme,landing:'sample state retained across skins; mark/clear; theme/reload passed'});
  await p.goto('http://localhost:3010/preview/arena?view=result&plan=pro');await p.locator('.rp-hero').waitFor();report.contrast.push({width,view:'result',...(await p.evaluate(contrast))});
  for(const data of ['ready','subject-error']) {
   await p.goto(`http://localhost:3010/preview/arena?view=dashboard&plan=free&data=${data}`);
   if(data==='subject-error'){await p.getByRole('alert').waitFor();assert.equal(await p.locator('.pr-summary__cta').count(),0);report.checks.push({width,theme,freeState:data,errorVisible:true,launchAbsent:true});continue;}
   await p.locator('.pr-head').waitFor();await p.waitForTimeout(400);
   const row=await p.locator('.pr-summary').evaluate(e=>({text:e.textContent,overflow:e.scrollWidth-e.clientWidth,height:e.getBoundingClientRect().height,disabled:e.querySelector('button')?.disabled}));assert.ok(row.overflow<=1);report.checks.push({width,theme,freeState:data,...row});
  }
  await c.close();console.log(`Interactions ${width} ${theme} passed`);
 }
 assert.equal(report.errors.length,0);
}finally{await fs.writeFile(`${out}/interactions.json`,JSON.stringify(report,null,2));await b.close()}
