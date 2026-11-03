// Read-only helper for authoring benchmark fixtures: list a registered source's locators or show text around a keyword.
import {readFileSync} from 'node:fs';
const [id,keyword,width='700']=process.argv.slice(2);
const registry=JSON.parse(readFileSync('data/source_registry.json','utf8')),source=registry.sources[id];
if(!source){console.log('unknown source');process.exit(1);}
for(const [locator,fact] of Object.entries(source.facts||{})){
  const text=String(fact.text||'');
  if(!keyword){console.log(locator,text.length,text.slice(0,90).replace(/\s+/g,' '));continue;}
  const i=text.toLowerCase().indexOf(keyword.toLowerCase());
  if(i>=0)console.log('['+locator+']',text.slice(Math.max(0,i-150),i+Number(width)).replace(/\s+/g,' '),'\n');
}
