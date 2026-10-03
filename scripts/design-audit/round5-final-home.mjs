import {browser,context,shot} from './round5-browser.mjs';
import fs from 'node:fs/promises';
const previous=JSON.parse(await fs.readFile('artifacts/round4/sweep/sweep.json','utf8')).filter(r=>r.route==='/');
const b=await browser(),results=[];
for(const {w,h,theme} of previous){
 const c=await context(b,w,h,{hasTouch:w<=1024,isMobile:w<=600});
 await c.addInitScript(theme=>localStorage.setItem('mm:theme:v1',theme),theme);
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(`http://localhost:${process.env.ROUND5_PORT||3004}`,{waitUntil:'load'});await p.waitForTimeout(400);
 results.push({w,h,theme,errors,...await p.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,leadAnimation:getComputedStyle(document.querySelector('.lp-lead')).animationName,stations:document.querySelectorAll('[data-pip-station]').length}))});await c.close();
}
for(const width of [1280,390]){
 const c=await context(b,width,860),p=await c.newPage();await p.goto(`http://localhost:${process.env.ROUND5_PORT||3004}`,{waitUntil:'load'});
 const seats=await p.locator('[data-pip-station]').evaluateAll(es=>es.map(e=>({id:e.dataset.pipStation,y:e.getBoundingClientRect().top+scrollY})));
 for(const s of seats){await p.evaluate(y=>scrollTo({top:y-180,behavior:'instant'}),s.y);await p.waitForTimeout(700);await shot(p,`after/${width}-${s.id}`);}await c.close();
}
await fs.writeFile('artifacts/round5/final-home.json',JSON.stringify(results,null,2));await b.close();
