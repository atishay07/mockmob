import {browser,context,shot} from './round5-browser.mjs';
import fs from 'node:fs/promises';
const b=await browser(),report=[];
try{
const c=await context(b),p=await c.newPage();
for(let v=1;v<=3 && process.argv.includes('--prototypes');v++){
 await p.goto(`http://localhost:3000/preview/round5?v=${v}`,{waitUntil:'domcontentloaded'});await p.waitForTimeout(300);
 await shot(p,`prototypes/${v}-opening`);
 await p.mouse.wheel(0,2100);await p.waitForTimeout(300);await shot(p,`prototypes/${v}-handover`);
 await p.keyboard.press('ArrowRight');
 report.push({prototype:v,picker:await p.locator('.proto-picker-item[data-active]').textContent()});
}
await c.close();
for(const width of [1280,390]){
 const c=await context(b,width,860,{hasTouch:width===390,isMobile:width===390});const p=await c.newPage();
 await p.goto('http://localhost:3000',{waitUntil:'domcontentloaded'});await p.waitForTimeout(700);
 const seats=await p.locator('[data-pip-station]').evaluateAll(es=>es.map(e=>({id:e.dataset.pipStation,y:e.getBoundingClientRect().top+scrollY})));
 for(const dir of [1,-1]){
  const list=dir===1?seats:seats.slice().reverse();
  for(let i=0;i<list.length-1;i++){
   for(const fraction of [0,.25,.5,.75,1]){
    const y=list[i].y+(list[i+1].y-list[i].y)*fraction-180;
    await p.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);await p.waitForTimeout(110);
    await shot(p,`journey/${width}-${dir}-${list[i].id}-${list[i+1].id}-${fraction}`);
    report.push(await p.evaluate(()=>({width:innerWidth,y:scrollY,station:document.documentElement.dataset.pipPerch,visible:document.documentElement.dataset.pipPerchVisible,transform:document.querySelector('.pip-guide-flyer')?.style.transform})));
   }
  }
 }
 await p.evaluate(y=>scrollTo({top:y-150,behavior:'instant'}),seats.find(s=>s.id==='lab').y);await p.waitForTimeout(700);
 await p.getByRole('button',{name:/Get one next move/}).click();await p.waitForTimeout(100);
 report.push({width,labPeak:await p.locator('.pip-guide-flyer .pip-actor').getAttribute('data-motion')});await shot(p,`journey/${width}-lab-peak`);
 await p.keyboard.press('PageDown');await p.waitForTimeout(500);
 await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await p.mouse.wheel(0,2200);await p.waitForTimeout(80);await p.mouse.wheel(0,-1100);await p.waitForTimeout(500);
 await shot(p,`journey/${width}-wheel-reverse`);
 await c.close();
}
const reduced=await context(b,390,844,{reducedMotion:'reduce'}),rp=await reduced.newPage();await rp.goto('http://localhost:3000',{waitUntil:'domcontentloaded'});await rp.waitForTimeout(500);report.push({reducedGuide:await rp.locator('.pip-guide-flyer').count(),staticPerches:await rp.locator('[data-pip-station]').count()});await shot(rp,'journey/reduced');await reduced.close();
for(const view of ['today','dashboard','review','prepos','saved','result']){
 const c=await context(b,390,844),p=await c.newPage();await p.goto(`http://localhost:3000/preview/arena?view=${view}`,{waitUntil:'domcontentloaded'});await p.waitForTimeout(800);await shot(p,`arena/${view}`);
 await p.evaluate(()=>{document.documentElement.style.fontSize='200%';document.body.style.fontSize='200%';});await shot(p,`arena/${view}-text200`);report.push({view,text200Overflow:await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth)});await c.close();
}
}finally{await fs.writeFile('artifacts/round5/interactions.json',JSON.stringify(report,null,2));await b.close();}

