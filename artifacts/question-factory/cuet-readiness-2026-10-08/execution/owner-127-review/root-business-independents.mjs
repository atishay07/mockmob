import fs from 'node:fs';
import {createHash} from 'node:crypto';
const dir=new URL('./',import.meta.url);
const notes2=[
 ['B',['B'],'Specified roles and completion records identify the missed authorisation. Fixing responsibility is the most direct advantage; no dual boss, duplication or predictability problem is described.','easier to fix responsibility',[],'medium'],
 ['D',['D'],'Favourable government officials and representatives are part of the political environment. Stability, consumer preferences and legislation are explicitly unchanged.','attitudes of government',['source_column_interleaving'],'easy'],
 ['D',['D'],'Output: 3*390-1200=-30 (III). Waiting:510/60-8=+0.5 (IV). Defects:9/1500*1000-6=0 (II). Cost:129000-120000=9000 (I). Signed basis, period and scaling assumptions are explicit.','same units in which standards are set',[],'medium'],
 ['A',['A','D'],'A threshold precedes identifying a significant deviation. Reporting then analysing (A-B-C-D) and analysing before escalation (A-B-D-C) are both coherent. The excerpt does not require reporting first or specify who performs analysis.','After identifying the deviations',['nonunique_process_order'],'medium'],
 ['C',['C'],'Goods for resale map to I, commercial services II, household goods III and personal services IV. The latter only escape the stated exclusion; they do not assert full legal eligibility. The stem repeats all answer choices and needs presentation cleanup.','services for resale or commercial',['duplicated_options_in_stem'],'easy'],
 ['D',['D'],'After-sales service, complaint handling and spares are part of the extended product. Physical identity alone does not make the total offers identical. B and C are true.','extended product',[],'easy'],
 ['B',['B','C'],'Beginning with D and ending with A, classifying the social organisation before recalling the general principle is valid. Recalling the principle before classifying the case is also valid. D-B-C-A and D-C-B-A are both logical.','economic, social or political',['nonunique_reasoning_order'],'easy'],
 ['C',['C'],'The direct counterparty rule admits A and D. B and C involve the issuer and fail the given secondary-market definition. No additional buyback or primary-market assumption is necessary.','rather than the issuer',[],'easy'],
 ['A',['A','C'],'Estimating required funds begins and matching ends the given considerations. Estimating timing and identifying possible sources may occur in either order. The excerpt lists considerations, not a strict algorithm; B-D-A-C and B-A-D-C are defensible.','both the quantum as well as the timing',['nonunique_process_order'],'easy'],
 ['B',['B'],'The explicit only links are M to N, N to P and P to Q. Thus B-C-A is the unique directed chain.','flow of authority',[],'easy'],
];
const notes3=[['A',['A'],'20 March 2027 lies inside the inclusive prohibition. No profit or shareholder-vote exception exists, and 31 March is included. Withhold throughout the period is the only compliant choice.','does not violate the terms of the loan agreement',[],'easy']];
for(const [batch,notes] of [[2,notes2],[3,notes3]]){
 const prefix='business_studies-'+String(batch).padStart(2,'0');
 const bytes=fs.readFileSync(new URL(prefix+'.blind.json',dir)),x=JSON.parse(bytes);
 const cases=x.cases.map((c,i)=>{
  const [independent_key,defensible_options,derivation,quote,issues,estimated_difficulty]=notes[i];
  const source_key=c.source_keys.find(k=>x.sources[k].text.includes(quote));
  if(!source_key)throw Error('quote_missing:'+c.id);
  return {id:c.id,content_hash:c.content_hash,independent_key,defensible_options,unique_answer:defensible_options.length===1,
   derivation,support:[{source_key,quote}],issues,estimated_difficulty};
 });
 const out={schema:'owner-127-independent-root-v1',subject:x.subject,batch,at:new Date().toISOString(),
  blind_packet_sha256:createHash('sha256').update(bytes).digest('hex'),saved_before_comparison:true,
  comparison_opened:false,reviewer:'root',cases};
 fs.writeFileSync(new URL(prefix+'.independent.json',dir),JSON.stringify(out,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({frozen:prefix,count:cases.length}));
}
