import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const packets=JSON.parse(readFileSync('data/study/authored/expansion.json','utf8'));
const registry=JSON.parse(readFileSync('data/study/sources/registry.json','utf8'));
for(const packet of packets){
  const bytes=readFileSync(`data/study/sources/ncert-${packet.source}.pdf`);
  if(bytes.subarray(0,5).toString()!=='%PDF-') throw new Error(`NOT_A_PDF:${packet.source}`);
  const digest=createHash('sha256').update(bytes).digest('hex');
  if(registry.sources[`ncert-${packet.source}`]?.sha256 && registry.sources[`ncert-${packet.source}`].sha256!==digest) throw new Error(`SOURCE_CHANGED_REQUIRES_NEW_VERSION:${packet.source}`);
  registry.sources[`ncert-${packet.source}`]={url:`https://ncert.nic.in/textbook/pdf/${packet.source}.pdf`,version:'NCERT source downloaded 2026-10-05; digest is authoritative',
    permission:'Reference only; factual distinctions/formulas paraphrased with original examples; no textbook page reproduced',
    locator:`${packet.sourceLabel}; PDF pages ${[...new Set(packets.filter(p=>p.source===packet.source).flatMap(p=>p.facts.map(f=>f.page)))].sort((a,b)=>a-b).join(', ')}`,sha256:digest,verifiedOn:'2026-10-05'};
}
writeFileSync('data/study/sources/registry.json',JSON.stringify(registry,null,2)+'\n');
console.log(JSON.stringify({registered:packets.length,productionWrites:0,paidCalls:0}));
