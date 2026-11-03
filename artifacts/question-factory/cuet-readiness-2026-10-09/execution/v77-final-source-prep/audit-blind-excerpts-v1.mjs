import {readFileSync,writeFileSync} from 'node:fs';
const prep='artifacts/question-factory/cuet-readiness-2026-10-09/execution/v77-final-source-prep';
const packet=JSON.parse(readFileSync(prep+'/blind-review-packet-v1.json'));
const norm=s=>String(s||'').normalize('NFKC').replace(/[‘’“”]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
const rows=packet.cases.flatMap(c=>c.sources.map(s=>{
 if(!s.source_url)return{id:c.id,source:s.id,locator:s.locator,scope:'original-stimulus',quote_present:typeof s.quote==='string'&&s.quote.length>0,passage_present:typeof c.passage_text==='string'&&c.passage_text.length>0};
 const code=s.source_url.match(/([^/]+)\.pdf$/)?.[1];
 const pages=JSON.parse(readFileSync(prep+'/ncert/'+code+'.pages.json'));
 const found=pages.filter(p=>norm(p.text).includes(norm(s.quote)));
 return{id:c.id,source:s.id,locator:s.locator,quote_present:typeof s.quote==='string'&&s.quote.length>0,exact_normalized_substring:found.length>0,physical_pages:found.map(p=>p.page)};
}));
const out={at:new Date().toISOString(),scope:'Blind quote extraction audit only; no proposed answers/labels inspected. Normalizes Unicode quotation marks and whitespace; does not assert academic entailment.',rows};
writeFileSync(prep+'/blind-excerpt-audit-v1.json',JSON.stringify(out,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({count:rows.length,failures:rows.filter(r=>r.exact_normalized_substring===false||r.quote_present===false||r.passage_present===false)},null,2));
