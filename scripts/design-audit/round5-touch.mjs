import {browser,context,shot} from './round5-browser.mjs';
import fs from 'node:fs/promises';
const b=await browser(),c=await context(b,390,844,{hasTouch:true,isMobile:true}),p=await c.newPage();
const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto(`http://localhost:${process.env.ROUND5_PORT||3003}`,{waitUntil:'load'});await p.waitForTimeout(600);
const cdp=await c.newCDPSession(p),positions=[];
for(const reverse of [false,true]){
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:185,y:reverse?180:650}]});
 for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:185,y:reverse?180+i*35:650-i*35}]});await p.waitForTimeout(20);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(900);
 positions.push(await p.evaluate(()=>({y:scrollY,station:document.documentElement.dataset.pipPerch,overflow:document.documentElement.scrollWidth-innerWidth})));
 await shot(p,`journey/touch-${reverse?'reverse':'forward'}`);
}
const lab=await p.locator('[data-pip-station="lab"]').evaluate(e=>e.getBoundingClientRect().top+scrollY);
await p.evaluate(y=>scrollTo({top:y-150,behavior:'instant'}),lab);await p.waitForTimeout(600);
await p.getByRole('button',{name:/Get one next move/}).tap();await p.waitForTimeout(120);
const peak=await p.locator('.pip-guide-flyer .pip-actor').getAttribute('data-motion');
const hit=await p.getByRole('button',{name:/Get one next move/}).evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));});
await shot(p,'journey/touch-lab');
const resting=[];
await p.evaluate(()=>{window.__guideFrames=0;const native=requestAnimationFrame;window.requestAnimationFrame=fn=>native(t=>{if(/scVerifyState/.test(fn.toString()))window.__guideFrames++;fn(t);});});
for(const place of ['hero','footer']){
 await p.evaluate(place=>scrollTo({top:place==='hero'?0:document.body.scrollHeight,behavior:'instant'}),place);await p.waitForTimeout(1300);
 await p.evaluate(()=>window.__guideFrames=0);await p.waitForTimeout(2200);
 resting.push(await p.evaluate(place=>({place,frames:window.__guideFrames,visible:document.documentElement.dataset.pipPerchVisible}),place));
}
await fs.writeFile('artifacts/round5/touch.json',JSON.stringify({positions,peak,hit,errors,resting},null,2));
await b.close();
