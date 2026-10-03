import { chromium } from 'file:///C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const p=await b.newPage();
p.on('console', m=>{if(m.type()==='error')console.log('console',m.text().slice(0,250));});
p.on('requestfailed',r=>console.log('failed',r.url(),r.failure()));
await p.goto('http://localhost:3010/preview/arena?view=dashboard&plan=pro');
await p.waitForTimeout(12000);
console.log(await p.evaluate(()=>({fixture:window.__arenaPreviewFetch,ready:!!document.querySelector('.pr-head'),scripts:[...document.scripts].filter(s=>s.src).map(s=>s.src),text:document.body.innerText.slice(0,1000)})));
await b.close();
