import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {inventoryFingerprint} from '../../../data/question_factory_policy.mjs';

// Offline report: costs from the persistent ledger, cohort composition and a cost forecast. No model calls.
// Usage: node scripts/pipeline/tools/reportCampaign.mjs <campaign> <campaign-start ISO (UTC)>
const [campaign='quality-v5',since='2026-10-06T11:30:00Z']=process.argv.slice(2);
const out=`artifacts/question-factory/${campaign}`,read=p=>JSON.parse(readFileSync(p,'utf8'));
const db=new DatabaseSync(resolve(process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite'),{readOnly:true});
const rows=db.prepare('SELECT id,model,reserved,actual,state,created_at,receipt_json FROM requests').all().map(r=>({...r,receipt:JSON.parse(r.receipt_json||'{}'),at:Date.parse(r.created_at.replace(' ','T')+'Z')}));
const usd=list=>+list.reduce((s,r)=>s+(r.state==='settled'?r.actual:r.reserved)/1e6,0).toFixed(6);
const limit=db.prepare('SELECT limit_micro FROM budget').get().limit_micro/1e6;
const lifetime=usd(rows),held=+rows.filter(r=>r.state!=='settled').reduce((s,r)=>s+r.reserved/1e6,0).toFixed(6);
const window=rows.filter(r=>r.at>=Date.parse(since));
const by=(list,key)=>Object.entries(list.reduce((m,r)=>{const k=key(r);(m[k]||=[]).push(r);return m;},{})).map(([k,v])=>({key:k,requests:v.length,usd:usd(v)})).sort((a,b)=>b.usd-a.usd);
const results=existsSync(`${out}/results.json`)?read(`${out}/results.json`):null,jobs=results?.jobs||[];
const ids=new Set(jobs.map(j=>j.id));
const cohortRows=window.filter(r=>ids.has(r.receipt.candidate_id)),blueprintRows=window.filter(r=>r.receipt.stage==='blueprint');
const cohortUsd=+(usd(cohortRows)+usd(blueprintRows)).toFixed(6);
const eligible=jobs.filter(j=>j.state==='eligible'),generated=jobs.filter(j=>j.candidate);
const count=(list,key)=>list.reduce((m,j)=>{const k=key(j)??'unknown';m[k]=(m[k]||0)+1;return m;},{});
const reason=j=>(j.result?.reasons||['unknown'])[0].replace(/:.*$/,s=>s.startsWith(':')&&!/^failed/.test(j.result?.reasons?.[0]||'')?'':s);
// Substantive variety: identical fingerprints and identical normalised stems never count twice.
const norm=t=>String(t||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const fingerprints=new Set(eligible.map(j=>inventoryFingerprint(j.candidate))),stems=new Set(eligible.map(j=>norm(j.candidate.body)));
const perEligible=eligible.length?cohortUsd/eligible.length:null,remaining=+(limit-lifetime).toFixed(6);
const forecast=perEligible?{basis:'Measured real-time cohort cost per eligible question, including blueprints, authoring, every verification sample, repairs, retries and rejected candidates. Excludes calibration and preparation already spent.',
  cost_per_eligible_usd:+perEligible.toFixed(6),published_so_far:0,
  total_lifetime_to_10000_usd:+(lifetime+10000*perEligible).toFixed(2),
  achievable_eligible_with_remaining_budget:Math.floor(remaining/perEligible),
  batch_estimate:{label:'ESTIMATE ONLY: batch execution has not been demonstrated in this campaign; assumes the published 50% batch discount on every request',total_lifetime_to_10000_usd:+(lifetime+10000*perEligible*0.5).toFixed(2),achievable_eligible_with_remaining_budget:Math.floor(remaining/(perEligible*0.5))}}:null;
const report={at:new Date().toISOString(),campaign,window_start:since,
  spend:{lifetime_ceiling_usd:limit,lifetime_gross_usd:lifetime,held_usd:held,remaining_usd:remaining,campaign_window_usd:usd(window),cohort_usd:cohortUsd,
    campaign_by_stage:by(window,r=>`${r.receipt.purpose||'candidate'}:${r.receipt.stage||'unknown'}:${r.model}`),
    google_credit_deductions:'Unverified; all figures are gross provider token cost at recorded rates.'},
  cohort:results?{denominator:jobs.length,generated:generated.length,eligible:eligible.length,quarantined:jobs.filter(j=>j.state==='quarantined').length,published:0,
    eligible_rate:+(eligible.length/jobs.length).toFixed(4),distinct_eligible_fingerprints:fingerprints.size,distinct_eligible_stems:stems.size,
    by_subject:Object.fromEntries(['english','accountancy','business_studies','economics'].map(s=>[s,{total:jobs.filter(j=>j.subject===s).length,eligible:eligible.filter(j=>j.subject===s).length}])),
    by_kind:{total:count(jobs,j=>j.kind),eligible:count(eligible,j=>j.kind)},
    eligible_chapters:count(eligible,j=>`${j.subject}:${j.candidate.chapter}`),eligible_formats:count(eligible,j=>j.candidate.question_type),
    eligible_difficulty:count(eligible,j=>j.candidate.difficulty),eligible_anchor_families:Object.keys(count(eligible,j=>j.anchor_id)).length,
    repaired_and_eligible:eligible.filter(j=>j.attempt===1).length,
    rejection_reasons:count(jobs.filter(j=>j.state!=='eligible'),j=>(j.result?.reasons||['unknown'])[0]),
    passage_groups:[...new Set(jobs.map(j=>j.passage_group_id).filter(Boolean))].map(g=>({id:g,members:jobs.filter(j=>j.passage_group_id===g).length,complete_and_eligible:jobs.filter(j=>j.passage_group_id===g).every(j=>j.state==='eligible')}))}:null,
  forecast,production_changes:0};
writeFileSync(`${out}/cost-and-cohort-report.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,spend:{...report.spend,campaign_by_stage:report.spend.campaign_by_stage.slice(0,14)}},null,1));
