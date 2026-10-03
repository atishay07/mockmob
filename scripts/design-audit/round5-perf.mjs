import { browser, context } from './round5-browser.mjs';
import fs from 'node:fs/promises';
const b = await browser(), report = [];
for (const width of (process.env.ROUND5_WIDTH?[Number(process.env.ROUND5_WIDTH)]:[390,1280])) for (const mode of (process.argv.includes('--ablation')?['no-hero-entry']:['guide','static'])) for(let run=1;run<=2;run++) {
 const c=await context(b,width,860,{hasTouch:width===390,isMobile:width===390});
 await c.addInitScript(mode=>{
  if(mode==='static'){
   const mark=()=>{if(document.documentElement){document.documentElement.setAttribute('data-pip-static','');return true;}return false;};
   if(!mark()){const observer=new MutationObserver(()=>{if(mark())observer.disconnect();});observer.observe(document,{childList:true});}
  }
  if(mode==='no-hero-entry'){
   const style=()=>{if(!document.documentElement)return false;const el=document.createElement('style');el.textContent='.lp-hero [data-hero]{animation:none!important;opacity:1!important;transform:none!important}';document.documentElement.append(el);return true;};
   if(!style()){const observer=new MutationObserver(()=>{if(style())observer.disconnect();});observer.observe(document,{childList:true});}
  }
  window.__metrics={lcp:[],cls:0,long:[],frames:[],sampling:false};
  new PerformanceObserver(list=>{for(const e of list.getEntries())window.__metrics.lcp.push({time:e.startTime,render:e.renderTime,load:e.loadTime,size:e.size,tag:e.element?.tagName,text:e.element?.textContent?.slice(0,100)});}).observe({type:'largest-contentful-paint',buffered:true});
  new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__metrics.cls+=e.value;}).observe({type:'layout-shift',buffered:true});
  new PerformanceObserver(list=>{for(const e of list.getEntries())window.__metrics.long.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});
 },mode);
 const p=await c.newPage(),cdp=await c.newCDPSession(p);
 await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8});
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await p.goto(`http://localhost:${process.env.ROUND5_PORT||3003}`,{waitUntil:'load',timeout:90000});await p.waitForTimeout(4000);
 const initial=await p.evaluate(()=>({...window.__metrics,images:performance.getEntriesByType('resource').filter(e=>e.name.includes('/brand/mascot/')||e.name.includes('%2Fbrand%2Fmascot')).map(e=>({url:e.name,bytes:e.transferSize,encoded:e.encodedBodySize})),guide:document.documentElement.dataset.pipGuide||'static',fonts:document.fonts.status,heroAnimation:getComputedStyle(document.querySelector('.lp-hero [data-hero]')).animationName}));
 await p.evaluate(()=>{window.__metrics.frames=[];window.__metrics.sampling=true;let last;function sample(t){if(last)window.__metrics.frames.push(t-last);last=t;if(window.__metrics.sampling)requestAnimationFrame(sample);}requestAnimationFrame(sample);});
 for(let i=0;i<24;i++){await p.mouse.wheel(0,300);await p.waitForTimeout(70);}
 for(let i=0;i<24;i++){await p.mouse.wheel(0,-300);await p.waitForTimeout(70);}
 const frames=await p.evaluate(()=>{window.__metrics.sampling=false;return window.__metrics.frames;});
 frames.sort((a,b)=>a-b);
 await p.waitForTimeout(1000);
 const idleStart=await p.evaluate(()=>{window.__idleCount=0;const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>raf(t=>{window.__idleCount++;cb(t);});return performance.now();});
 await p.waitForTimeout(2000);
 const idle=await p.evaluate(start=>({callbacks:window.__idleCount,ms:performance.now()-start}),idleStart);
 const row={width,mode,run,...initial,frames:{count:frames.length,p50:frames[Math.floor(frames.length*.5)],p95:frames[Math.floor(frames.length*.95)],over33:frames.filter(n=>n>33.4).length},idle};report.push(row);
 await fs.writeFile(`artifacts/round5/performance${process.argv.includes('--ablation')?'-ablation':process.env.ROUND5_WIDTH?'-desktop-spacing':''}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({width,mode,run,lcp:initial.lcp.at(-1)?.time,cls:initial.cls,frames:row.frames,idle}));await c.close();
}
await b.close();
