// Current, read-only ledger/job snapshot. Never dispatches, publishes or releases.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {scopedAccounting} from '../lib/scopedAccounting.mjs';
const root='artifacts/question-factory/cuet-readiness-2026-10-08';
const read=p=>existsSync(p)?JSON.parse(readFileSync(p,'utf8')):null;
const db=new DatabaseSync('data/pipeline-budget.sqlite',{readOnly:true});
const usd=n=>n/1e6;
const cost=a=>{const settled=a.reduce((n,r)=>n+(r.state==='settled'?(r.actual||0):0),0),held=a.reduce((n,r)=>n+(r.state==='settled'?0:Math.max(r.reserved,r.actual||0)),0);return {settled_usd:usd(settled),held_usd:usd(held),gross_usd:usd(settled+held),requests:a.length,receipt_complete:a.every(r=>r.state==='settled')};};
const scoped=prefix=>{const c=scopedAccounting({db},prefix);return {settled_usd:usd(c.settled_micro),held_usd:usd(c.held_micro),gross_usd:usd(c.committed_micro),requests:c.requests.length,receipt_complete:c.receipt_complete};};
let out;
db.exec('BEGIN');
try{
 const all=db.prepare('SELECT id,model,state,reserved,actual FROM requests').all(),lifetime={...cost(all),limit_usd:50,unresolved:all.filter(r=>r.state==='unresolved').length};
 const campaigns=['baseline','improved'].map(arm=>{
  const dir=`artifacts/question-factory/cuet-readiness-${arm}-100-2026-10-08`,campaign=read(dir+'/campaign.json'),profile=read(dir+'/verification-profile.json');
  if(!campaign)return {arm,state:'unregistered'};
  const ids=JSON.stringify(campaign.jobs.map(j=>j.id));
  const rows=db.prepare('SELECT value FROM factory_candidates WHERE id IN (SELECT value FROM json_each(?))').all(ids).map(r=>JSON.parse(r.value));
  const map=new Map(rows.map(r=>[r.id,r])),jobs=campaign.jobs.map(j=>map.get(j.id)||j),eligible=jobs.filter(j=>['eligible','published'].includes(j.state)),rejected=jobs.filter(j=>j.state==='quarantined');
  const attributed=db.prepare(`SELECT r.* FROM requests r JOIN
   (SELECT reservation_id,request_json FROM provider_requests UNION ALL SELECT reservation_id,request_json FROM provider_batches) p ON p.reservation_id=r.id
   WHERE json_extract(p.request_json,'$.config.candidate_id') IN (SELECT value FROM json_each(?))`).all(ids);
  const receiptOnly=db.prepare(`SELECT r.* FROM requests r WHERE json_extract(r.receipt_json,'$.candidate_id') IN (SELECT value FROM json_each(?))
   AND r.id NOT IN (SELECT reservation_id FROM provider_requests UNION SELECT reservation_id FROM provider_batches)`).all(ids);
  const requests=[...new Map([...attributed,...receiptOnly].map(r=>[r.id,r])).values()],costs=cost(requests);
  const denominator=campaign.jobs.length,complete=eligible.length+rejected.length===denominator;
  // A terminal failed request can remain a proven bounded hold. Keep that gross
  // amount, but do not declare usage settled or a point forecast without receipts.
  const cpq=complete&&costs.receipt_complete&&eligible.length?costs.gross_usd/eligible.length:null;
  return {arm,denominator,terminal:eligible.length+rejected.length,machine_eligible:eligible.length,rejected:rejected.length,pending:denominator-eligible.length-rejected.length,complete,cost:costs,cost_per_machine_eligible_usd:cpq,conditional_10000_marginal_usd:cpq?cpq*10000:null,conditional_lifetime_to_10000_usd:cpq?lifetime.gross_usd+(10000-eligible.length)*cpq:null,verifier:profile.verifier_version,topology:profile.topology,measurement_only:profile.measurement_only,newly_published:jobs.filter(j=>j.state==='published').length,quality_claim:'Machine eligibility under the registered contract; not a released or perfectly accurate bank.'};
 });
 const bankProfile=read(root+'/reassessment/profile.json'),bankPath=root+'/reassessment/results.jsonl';
 const bankRows=existsSync(bankPath)?readFileSync(bankPath,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[],bank=[...new Map(bankRows.map(r=>[r.id,r])).values()];
 const reassessment=bankProfile?{denominator:bankProfile.denominator,terminal:bank.filter(r=>r.state!=='provider_error').length,machine_eligible:bank.filter(r=>r.state==='eligible').length,rejected:bank.filter(r=>r.state==='quarantined').length,provider_errors:bank.filter(r=>r.state==='provider_error').length,pending:bankProfile.denominator-bank.filter(r=>r.state!=='provider_error').length,cost:scoped('reassessment:'+bankProfile.contract+':'),publication:'never',verifier:bankProfile.verifier}:null;
 const diagnostic=read(root+'/benchmark/verified-rule-v4/diagnostic72-v2/summary.json'),official=read(root+'/benchmark/official-readiness-study-v1/progress.json');
 const officialRows=Object.values(official?.results||{}),officialStudy=official?{expected_provider_pairs:138,judged:officialRows.filter(r=>r.status==='judged').length,errors:officialRows.filter(r=>r.status==='error').length,attempted:officialRows.length,cost:scoped(official.study_id+':'),scope:'two-subject diagnostic; cannot release all four subjects'}:null;
 out={at:new Date().toISOString(),goal:'active_execution',lifetime,campaigns,reassessment,diagnostic:diagnostic?{...diagnostic,cost:scoped('cuet-readiness-diagnostic72-v2:')}:null,official_study:officialStudy,staging:read(root+'/staging/reassessment-retrieval-proof.json')||read(root+'/staging/current-staging-read-only.json'),new_v7_publications:campaigns.reduce((n,c)=>n+(c.newly_published||0),0),provider_invoices:'not obtained',disclosure:'All costs include failures and reasoning. Gross holds remain committed. Live eligibility is separate from publication and legacy availability. No partial campaign is used for a final yield or forecast.'};
}finally{db.exec('ROLLBACK');db.close();}
writeFileSync(root+'/CURRENT-STATUS.json',JSON.stringify(out,null,2)+'\n');
const lines=[`# CUET-readiness execution checkpoint`, `Captured ${out.at}. This is a read-only ledger/job snapshot, not a completed-run claim.`, `Lifetime: $${out.lifetime.settled_usd.toFixed(6)} settled + $${out.lifetime.held_usd.toFixed(6)} held = $${out.lifetime.gross_usd.toFixed(6)} committed of $50. No provider invoice obtained.`, ...out.campaigns.map(c=>`${c.arm}: ${c.machine_eligible||0} machine-eligible, ${c.rejected||0} rejected, ${c.pending??100} pending / ${c.denominator||100}. Gross $${c.cost?.gross_usd.toFixed(6)||'0'}. ${c.complete?'Terminal denominator complete.':'Incomplete; final yield and forecast withheld.'}`),out.reassessment?`Bank reassessment: ${out.reassessment.machine_eligible} eligible, ${out.reassessment.rejected} rejected, ${out.reassessment.pending} pending / ${out.reassessment.denominator}; gross $${out.reassessment.cost.gross_usd.toFixed(6)}. Current contract is unreleased; no bank publication changes.`:'Bank reassessment not started.',`Newly published v7 questions: ${out.new_v7_publications}. Legacy staging availability has separate evidence.`,out.disclosure];
writeFileSync(root+'/CURRENT-STATUS.md',lines.join('\n\n')+'\n');console.log(JSON.stringify({at:out.at,lifetime:out.lifetime,campaigns:out.campaigns,reassessment:out.reassessment,official:out.official_study}));
