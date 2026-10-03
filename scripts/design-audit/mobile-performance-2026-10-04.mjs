import {chromium} from 'file:///C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const report=[];
try{for(const mode of ['glass','opaque'])for(let run=1;run<=2;run++){
 const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await c.addInitScript(()=>{localStorage.setItem('mm:theme:v1','light');window.__perf={lcp:0,cls:0};new PerformanceObserver(l=>{for(const e of l.getEntries())window.__perf.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__perf.cls+=e.value}).observe({type:'layout-shift',buffered:true});});
 const p=await c.newPage();const d=await c.newCDPSession(p);await d.send('Network.enable');await d.send('Network.setCacheDisabled',{cacheDisabled:true});await d.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8});await d.send('Emulation.setCPUThrottlingRate',{rate:4});
 await p.goto('http://localhost:3011',{waitUntil:'load',timeout:90000});await p.waitForTimeout(3000);
 const initial=await p.evaluate(()=>({...window.__perf,guide:document.documentElement.dataset.pipGuide}));
 if(mode==='opaque')await p.addStyleTag({content:'html[data-theme] .mm :is(.mm-nav,.mm-dock){backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:var(--paper)!important}'});
 await p.evaluate(()=>{window.__frames=[];window.__sampling=true;let last;function sample(t){if(last)window.__frames.push(t-last);last=t;if(window.__sampling)requestAnimationFrame(sample)}requestAnimationFrame(sample)});
 for(let i=0;i<30;i++){await p.mouse.wheel(0,i<15?240:-240);await p.waitForTimeout(70)}
 const frames=await p.evaluate(()=>{window.__sampling=false;return window.__frames.sort((a,b)=>a-b)});
 const row={mode,run,...initial,frameP95:frames[Math.floor(frames.length*.95)],over33ms:frames.filter(t=>t>33.4).length,sampled:frames.length};report.push(row);console.log(row);await fs.writeFile('artifacts/mobile-refinement-2026-10-04/performance.json',JSON.stringify(report,null,2));await c.close();
}}finally{await b.close()}
