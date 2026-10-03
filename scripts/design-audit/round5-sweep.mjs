import { browser, context, shot } from './round5-browser.mjs';
import fs from 'node:fs/promises';
const previous=JSON.parse(await fs.readFile('artifacts/round4/sweep/sweep.json','utf8'));
const fixtures=process.argv.includes('--fixtures');
const cases=previous.map(({route,w,h,theme})=>({route,w,h,theme})).filter(c=>!fixtures||c.route.startsWith('/preview/'));
const b=await browser(), results=[];
await fs.mkdir('artifacts/round5/sweep',{recursive:true});
let cursor=0,completed=0;
async function worker(){while(cursor<cases.length){const i=cursor++;
 const item=cases[i];const c=await context(b,item.w,item.h,{hasTouch:item.w<=1024,isMobile:item.w<=600});
 await c.addInitScript(theme=>{localStorage.setItem('mm:theme:v1',theme);},item.theme);
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  const response=await p.goto(`http://localhost:${fixtures?3000:3002}`+item.route,{waitUntil:'domcontentloaded',timeout:45000});
  await p.evaluate(theme=>document.documentElement.dataset.theme=theme,item.theme);
  await p.waitForTimeout(220);
  const data=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,broken:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src),h1:document.querySelector('h1')?.textContent}));
  results.push({...item,status:response.status(),errors,...data});
  if(item.w===390 && item.theme==='dark')await shot(p,`sweep/${item.route.replace(/[^a-z0-9]/gi,'_')}-${item.w}`);
 }catch(e){results.push({...item,error:e.message});}
 await c.close();
 completed++;if(completed%40===0)console.log(`${completed}/${cases.length}`);
}}
await Promise.all([worker(),worker(),worker(),worker()]);
await fs.writeFile(`artifacts/round5/sweep/${fixtures?'fixtures':'results'}.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify({loads:results.length,failures:results.filter(r=>r.error||r.status>=400||r.overflow>0||r.errors?.length).length}));await b.close();
