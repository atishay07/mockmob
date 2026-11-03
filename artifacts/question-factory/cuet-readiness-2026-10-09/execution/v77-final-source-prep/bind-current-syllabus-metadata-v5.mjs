import{readFileSync,writeFileSync}from'node:fs';import{createHash}from'node:crypto';
const p='artifacts/question-factory/cuet-readiness-2026-10-09/execution/v77-final-source-prep/',sha=x=>createHash('sha256').update(x).digest('hex');
const raw=readFileSync(p+'draft-cases-v4-PRIVATE.json'),d=JSON.parse(raw),r=JSON.parse(readFileSync('data/source_registry.json')),changes=[];
for(const c of d.cases){const q=c.candidate,p=q.provenance,s=r.exam_specs[q.subject];if(p.syllabus_version!=='cuet-2026'||s.syllabus_version!=='cuet-2026-provisional-for-2027'||p.pattern_version!==s.pattern_version)throw Error('unexpected_syllabus_metadata');changes.push({id:c.id,field:'candidate.provenance.syllabus_version',before:p.syllabus_version,after:s.syllabus_version,basis:'Same independently reviewed official 2026 syllabus; bind the existing current profile that explicitly requires 2027 revalidation.'});p.syllabus_version=s.syllabus_version;}
d.schema='v77-final-candidate-metadata-v5';d.parent_draft='draft-cases-v4-PRIVATE.json';d.parent_draft_sha256=sha(raw);d.created_at=new Date().toISOString();
writeFileSync(p+'draft-cases-v5-PRIVATE.json',JSON.stringify(d,null,2)+'\n',{flag:'wx'});
writeFileSync(p+'current-syllabus-metadata-v5.json',JSON.stringify({at:d.created_at,parent_sha256:sha(raw),final_sha256:sha(readFileSync(p+'draft-cases-v5-PRIVATE.json')),question_key_explanation_source_and_label_unchanged:true,changes},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:28,metadata_changes:changes.length}));
