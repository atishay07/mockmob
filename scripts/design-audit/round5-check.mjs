import {browser,context,shot} from './round5-browser.mjs';
import fs from 'node:fs/promises';
const b=await browser();
for(const width of [1280,390]){
 const c=await context(b,width,860);const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://localhost:3000',{waitUntil:'domcontentloaded',timeout:60000});await p.waitForTimeout(2000);
 const seats=await p.locator('[data-pip-station]').evaluateAll(es=>es.map(e=>({id:e.dataset.pipStation,y:e.getBoundingClientRect().top+scrollY})));
 for(const s of seats){await p.evaluate(y=>scrollTo({top:y-180,behavior:'instant'}),s.y);await p.waitForTimeout(800);await shot(p,`after/${width}-${s.id}`);}
 console.log({width,errors,seats,overflow:await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth)});await c.close();
}
await b.close();

