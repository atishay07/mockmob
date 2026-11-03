import test from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {evidenceSignature,evaluateEvidence} from '../../../data/content_evidence.js';
import {normalizeAnswerOptions,resolveAnswerCorrectIndex} from '../../../data/answer_integrity.js';
test('evidence signatures survive nested JSONB key ordering while array order and content remain bound',()=>{
 const a={state:'eligible',sources:[{version:2,id:'source'}],checks:{solver:{passed:true,key:'B'}}};
 const b={checks:{solver:{key:'B',passed:true}},sources:[{id:'source',version:2}],state:'eligible'};
 assert.equal(evidenceSignature(a,'test-secret'),evidenceSignature(b,'test-secret'));
 b.sources[0].version=3;assert.notEqual(evidenceSignature(a,'test-secret'),evidenceSignature(b,'test-secret'));
});
test('valid legacy signatures remain accepted as signatures, while a modified record is untrusted',()=>{
 const record={state:'eligible',checks:{},sources:[]},signature=createHmac('sha256','test-secret').update(JSON.stringify(record)).digest('hex');
 const q={evidence:{record,signature}};assert.ok(!evaluateEvidence(q,{secret:'test-secret'}).reasons.includes('untrusted_evidence'));
 record.state='published';assert.ok(evaluateEvidence(q,{secret:'test-secret'}).reasons.includes('untrusted_evidence'));
});
test('a nullable database index cannot override a real letter key',()=>{
 const row={options:['First','Second','Third','Fourth'],correct_answer:'C',correct_index:null,correct_option_index:null};
 assert.equal(resolveAnswerCorrectIndex(row,normalizeAnswerOptions(row.options,row)),2);
 row.correct_index=0;assert.equal(resolveAnswerCorrectIndex(row,normalizeAnswerOptions(row.options,row)),0);
});
