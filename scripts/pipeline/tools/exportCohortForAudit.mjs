import {readFileSync,writeFileSync} from 'node:fs';

// Exports the cohort as plain text for an independent human/subscription audit. Audit verdicts are
// recorded separately and are never publication evidence. Usage: <campaign> [eligible|all]
const [campaign='quality-v5',scope='eligible']=process.argv.slice(2);
const out=`artifacts/question-factory/${campaign}`;
const registry=JSON.parse(readFileSync('data/source_registry.json','utf8'));
const {jobs}=JSON.parse(readFileSync(`${out}/results.json`,'utf8'));
const list=jobs.filter(j=>scope==='all'||j.state==='eligible');
const lines=[];
for(const j of list){
  const q=j.candidate||{};
  lines.push(`### ${j.number ?? ''} ${j.id} | ${j.subject} | ${q.chapter} | ${j.kind} | ${q.question_type} | ${q.difficulty} | state=${j.state} | attempt=${j.attempt}`);
  lines.push(`Anchor: ${j.anchor_id}${j.blueprint?.target?` | Blueprint: ${j.blueprint.target}`:''}`);
  if(q.passage_text)lines.push(`PASSAGE: ${q.passage_text}`);
  lines.push(`STEM: ${q.body}`);
  (q.options||[]).forEach((o,i)=>lines.push(`  ${'ABCD'[i]}. ${typeof o==='string'?o:o.text}`));
  lines.push(`KEY: ${q.correct_answer}`);
  lines.push(`EXPLANATION: ${q.explanation}`);
  for(const ref of q.source_refs||[]){
    const s=registry.sources[ref.id];if(!s||s.kind==='paper')continue;
    lines.push(`SOURCE ${ref.id}:${ref.locator}: ${(s.facts?.[ref.locator]?.text||'').replace(/\s+/g,' ').slice(0,1800)}`);
  }
  if(j.state!=='eligible')lines.push(`REJECTED: ${(j.result?.reasons||[]).join(', ')} | ${(j.result?.failure_details||[]).slice(0,4).join(' | ').slice(0,600)}`);
  lines.push('');
}
writeFileSync(`${out}/audit-export-${scope}.txt`,lines.join('\n'));
console.log(JSON.stringify({exported:list.length,file:`${out}/audit-export-${scope}.txt`}));
