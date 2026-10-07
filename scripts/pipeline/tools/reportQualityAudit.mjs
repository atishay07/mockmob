import {readFileSync,writeFileSync} from 'node:fs';
import {contentHash} from '../../../data/content_evidence.js';
const root='artifacts/question-factory/quality-uplift',read=p=>JSON.parse(readFileSync(`${root}/${p}`,'utf8'));
const blind=read('english-blind.json'),keys=read('english-keys.json');
const findings={
 '24281d99-3989-401c-8119-f06de936e756':{solved_key:'D',verdict:'approve',reasons:['Sullen contrasts with genial; supplied primary definitions support the antonym.']},
 '720ab503-fa80-4e36-8838-de942a3487f7':{solved_key:'C',verdict:'suspect',reasons:['Sycophantic means flattering in context, but the underlined target is not marked in the extracted stem. Specify the target or restore faithful presentation before use.']},
 'afe7332b-0e12-467f-990a-74053d984bde':{solved_key:'D',verdict:'suspect',reasons:['Genial fits the description. The antonym-in-context label does not describe this choosing-a-word task. Definitions of the three distractors are not directly supported by the supplied excerpts.']},
 '0f45611a-97a5-4954-84ff-ac48135d7b78':{solved_key:'A',verdict:'suspect',reasons:['Intended meaning of ingratiating is correct. Raw HTML is exposed in the stem and the supplied definitions cover sycophantic/flatter, not the changed target ingratiating.']},
 '81e67374-a170-407d-9bc2-d3cdfd2fe884':{solved_key:'C',verdict:'approve',reasons:['Redoubtable matches formidable; the primary definition supports the target sense.']}
};
const questions=blind.questions.map(q=>({...q,...findings[q.id],recorded_key:keys.find(k=>k.id===q.id).key,answer_match:findings[q.id].solved_key===keys.find(k=>k.id===q.id).key}));
writeFileSync(`${root}/english-audit.json`,JSON.stringify({subject:'english',method:'Root independently solved supplied blind stems before comparing the separate keys; direct excerpt and presentation review.',counts:{questions:5,answer_matches:5,approve:2,suspect:3,incomplete:0},questions},null,2));
const audits=['english','accountancy','business_studies','economics'].map(s=>read(`${s}-audit.json`));
const items=audits.flatMap(a=>(a.questions||a.items).map(q=>({...q,subject:a.subject}))),baseline=read('baseline100.json');
if(items.length!==48||new Set(items.map(q=>q.id)).size!==48)throw new Error('audit_coverage_required');
for(const q of items){const job=baseline.jobs.find(j=>j.id===q.id);if(job.state!=='eligible'||contentHash(job.candidate)!==q.content_hash)throw new Error('audit_hash_binding_required');}
const counts=Object.fromEntries(['approve','suspect','incomplete'].map(v=>[v,items.filter(i=>i.verdict===v).length]));
const report={at:new Date().toISOString(),reviewed:48,intended_key_matches:48,counts,scope:'Frozen previous commissioning passing hashes; independent subscription review, not publication evidence.',perfect:false,production_changes:0,items};
writeFileSync(`${root}/AUDIT-48.json`,JSON.stringify(report,null,2));
const md=['# Independent audit of the previous 48 passing drafts','',`**${counts.approve} have no blocking defect found; ${counts.suspect} require correction; ${counts.incomplete} lacks sufficient evidence.** All intended keys matched, but matching a key does not establish uniqueness or exact mapping. These questions cannot honestly be called 100% perfect.`,
 '', 'The old report is frozen. No question has been published. Earlier evidence is withheld by the new evidence-policy version; audit approval is not a publication receipt. The 2026 syllabus remains provisional for 2027.',
 '', '| Subject | Reviewed | No blocking defect | Needs correction | Incomplete |','| --- | ---: | ---: | ---: | ---: |',...audits.map(a=>{const qs=a.questions||a.items;return `| ${a.subject} | ${qs.length} | ${qs.filter(q=>q.verdict==='approve').length} | ${qs.filter(q=>q.verdict==='suspect').length} | ${qs.filter(q=>q.verdict==='incomplete').length} |`;}),
 '', '## Defects and implementation response','',
 '- Economics: overlapping answers (zero is also less than one), AND instead of OR for capital receipts, invented terminology, unidentified chapter references, overgeneralised two-sector assumptions and an unsupported Fisher relationship.',
 '- Accountancy: incorrect/narrower chapter assignment, unpaid-premium and fully-paid-instalment assumptions, missing direct definitions, OCR leakage and matching tables that render as literal Markdown.',
 '- English: lost target emphasis, wrong task label, raw HTML and a changed lexical target without its own dictionary support.',
 '- Business Studies: no blocking academic defect found in the 11 supplied items. Direct locators, inferred subtopics and historical-law wording still need precise qualifications.',
 '', 'Review findings are hash-bound and independent of paid factory receipts. They do not prove psychometric quality, complete subject coverage, a released 2027 syllabus or rendered production UI acceptance. See the subject JSON files for every item and its sources.'];
writeFileSync(`${root}/AUDIT-48.md`,md.join('\n')+'\n');console.log(JSON.stringify({reviewed:48,counts}));
