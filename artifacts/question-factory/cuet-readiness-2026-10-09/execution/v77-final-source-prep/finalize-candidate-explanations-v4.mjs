import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const prep='artifacts/question-factory/cuet-readiness-2026-10-09/execution/v77-final-source-prep';
const sha=x=>createHash('sha256').update(x).digest('hex');
const raw=readFileSync(prep+'/draft-cases-v3b-PRIVATE.json'),d=JSON.parse(raw);
const packet=JSON.parse(readFileSync(prep+'/blind-review-packet-v3c.json'));
const explanations={
 'v77f-c6d21440345d':'Instruction that increases an existing employee’s job skills is training, included in training and development. The source defines training as increasing employees’ aptitudes, skills and abilities to perform specific jobs.',
 'v77f-84e9ba57542c':'Customer receipts are investing cash inflows, while proceeds from disposal of a fixed asset are operating cash inflows. Therefore B gives the two classifications.',
 'v77f-59b58a25bbb3':'The stated ready convertibility is sufficient for the investment to be a cash equivalent, so A is correct.',
 'v77f-e77493e30567':'Net operating cash is customer receipts less supplier payments: ₹12,000 − ₹4,500 = ₹8,500. The net amount is therefore ₹8,500.',
 'v77f-1db3dc389725':'Finding the required people, recruiting, selecting and placing them is marketing, so C is correct.',
 'v77f-e9ef75026c19':'The complaint invokes the right to be heard, so A is the single correct answer. Seeking relief after loss does not invoke another consumer right in this scenario.',
 'v77f-3e505228c987':'The description uniquely identifies causal forest estimation, so A is the correct named method.',
 'v77f-63d002be451c':'Marginal utility is the previous total utility minus the new total utility: 28 − 30 = −2. Therefore C is correct.',
 'v77f-98a231fa15fa':'Marginal utility must decline whenever consumption of the good increases, regardless of changes in consumption of other commodities. Therefore B follows.',
 'v77f-fcf957a734d5':'Ranking bundles without numerical measurement is cardinal utility analysis, so A is correct.',
 'v77f-2ca94e8b4e72':'Fresh means recently written, so A is correct. Dev had newly painted the board that morning, which explains why the date was fresh.',
 'v77f-56f266269b74':'A uses the base form be after recommended that; this is the mandative subjunctive. The other clauses do not use that construction.'
};
const changes=[];
for(const c of d.cases){
 const p=packet.cases.find(x=>x.id===c.id); if(!p)throw Error('missing_blind_case');
 for(const field of ['body','options','passage_text','route','question_type'])if(JSON.stringify(c.candidate[field])!==JSON.stringify(p[field]))throw Error('blind_question_changed:'+c.id+':'+field);
 if(JSON.stringify(c.candidate.learning_objective)!==JSON.stringify(p.learning_objective)){changes.push({id:c.id,field:'learning_objective',before:c.candidate.learning_objective,after:p.learning_objective,basis:'Use frozen neutral blind metadata and its two already tested lexical targets.'});c.candidate.learning_objective=p.learning_objective;}
 if(explanations[c.id]){changes.push({id:c.id,field:'candidate.explanation',before:c.candidate.explanation,after:explanations[c.id],basis:c.expected_valid?'Remove independently identified unsupported positive explanation claim.':'Before evaluation, replace constructor defect commentary with an actual candidate explanation containing the independently established defect. No label, key, stem, option or source changes.'});c.candidate.explanation=explanations[c.id];}
 if(c.id==='v77f-3e505228c987'){changes.push({id:c.id,field:'category',before:c.category,after:'unsupported_source_and_objective_mismatch',basis:'Independent audit: underdetermined named method and missing decisive source support; avoid categorical syllabus exclusion. Boolean invalid label unchanged.'});c.category='unsupported_source_and_objective_mismatch';}
 c.group=c.expected_valid?'authored_valid':'controlled_defect';
}
d.schema='v77-final-candidate-construction-v4';d.created_at=new Date().toISOString();d.parent_draft='draft-cases-v3b-PRIVATE.json';d.parent_draft_sha256=sha(raw);d.final_blind_packet='blind-review-packet-v3c.json';d.final_blind_packet_sha256=sha(readFileSync(prep+'/'+d.final_blind_packet));
writeFileSync(prep+'/draft-cases-v4-PRIVATE.json',JSON.stringify(d,null,2)+'\n',{flag:'wx'});
writeFileSync(prep+'/candidate-explanation-construction-v4.json',JSON.stringify({at:d.created_at,before_evaluation:true,parent_sha256:sha(raw),final_draft_sha256:sha(readFileSync(prep+'/draft-cases-v4-PRIVATE.json')),blind_question_fields_unchanged:true,expected_valid_labels_and_keys_unchanged:true,changes},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:d.cases.length,changes:changes.length,final_draft_sha256:sha(readFileSync(prep+'/draft-cases-v4-PRIVATE.json'))}));
