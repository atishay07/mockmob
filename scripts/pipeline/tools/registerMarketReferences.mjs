import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
const path='data/source_registry.json',registry=JSON.parse(readFileSync(path)),folder='artifacts/question-factory/source-diversity-2026-10-07/';
// Both official pages were opened and these bounded normative excerpts inspected
// on 7 October. No textbook, current regulation, IPO detail or PYQ is asserted.
const rows=[
 {id:'nism-primary-market-definition',url:'https://www.nism.ac.in/revamp-nism/investor-education/what-is-securities-market/',title:'NISM: What is securities market?',scope:'First normative primary-market clause; examples omitted',text:'One of the main objectives of the primary market is to allow companies to raise capital through the issuance of securities'},
 {id:'sebi-secondary-market-definition',url:'https://investor.sebi.gov.in/securities-stockmarket.html',title:'SEBI Investor: Investment in Securities Market',scope:'Complete first secondary-market definition sentence',text:'The Secondary Market is a place where an investor can buy/sell shares or securities from another investor rather than the issuer.'}
];
const added=[];
for(const row of rows){
 if(row.text.split(/\s+/).length>25)throw Error('bounded_excerpt_required');
 if(registry.sources[row.id]){if(registry.sources[row.id].facts.definition.text!==row.text)throw Error('registered_source_immutable');continue;}
 const file=folder+row.id+'.json',capture={...row,captured_at:new Date().toISOString(),opened_directly:true,identity_scope:'Exact inspected excerpt capture, not full remote HTML'};
 writeFileSync(file,JSON.stringify(capture,null,2)+'\n');const digest=createHash('sha256').update(readFileSync(file)).digest('hex');
 registry.sources[row.id]={id:row.id,kind:'reference',state:'active',version:1,chapters:['Financial Markets'],url:row.url,title:row.title,file,extraction_file:file,identity_sha256:digest,extraction_sha256:digest,extraction_checked:true,reuse_permitted:true,
  permission:{basis:'Brief attributed official investor-education excerpt for local educational verification; no unrestricted republication claim',reference:row.url},facts:{definition:{text:row.text}},supports:{definition:hashJSON(row.text)},source_pack_id:'original-business_studies-reference-v1',capture_scope:row.scope};
 registry.packs['original-business_studies-reference-v1'].document_ids.push(row.id);added.push(row.id);
}
writeFileSync(path,JSON.stringify(registry,null,2)+'\n');writeFileSync(folder+'market-registration.json',JSON.stringify({at:new Date().toISOString(),added,registered:rows.map(r=>r.id),paid_requests:0,answer_support:'Independent candidate entitlement and entailment still required.'},null,2)+'\n');
console.log(JSON.stringify({added,paid_requests:0}));
