import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const prep='artifacts/question-factory/cuet-readiness-2026-10-09/execution/v77-final-source-prep',raw=readFileSync(prep+'/blind-review-packet-v3b.json'),packet=JSON.parse(raw);
const sha=x=>createHash('sha256').update(x).digest('hex');
const fixes={'v77f-4c09b80e91ce':'ledger','v77f-2ca94e8b4e72':'fresh'};
const changes=[];for(const [id,target]of Object.entries(fixes)){const c=packet.cases.find(x=>x.id===id);if(!c||c.question_type!=='vocabulary_in_context'||!c.body.toLowerCase().includes(target))throw Error('lexical_target_binding');changes.push({id,field:'learning_objective.target_term',before:c.learning_objective.target_term,after:target,basis:'Name the word already explicitly tested in the stem; generic skill label fails the frozen lexical preparation check.'});c.learning_objective.target_term=target;}
packet.schema='v77-final-blind-review-v3c';packet.created_at=new Date().toISOString();
packet.parent_packet_sha256=sha(raw);packet.metadata_revision_notice='Only the two lexical target_term fields were corrected to words already printed in their stems. All bodies, options, passages, sources and academic objectives remain unchanged. No proposed answers or labels added.';
const body=JSON.stringify(packet,null,2)+'\n';writeFileSync(prep+'/blind-review-packet-v3c.json',body,{flag:'wx'});
writeFileSync(prep+'/lexical-target-correction-v3c.json',JSON.stringify({at:new Date().toISOString(),parent_packet_sha256:sha(raw),packet_sha256:sha(body),changes,body_options_passage_source_changes:0,proposed_answers_or_labels_read_for_correction:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({packet:prep+'/blind-review-packet-v3c.json',sha256:sha(body),metadata_changes:changes.length}));
