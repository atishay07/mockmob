import test from 'node:test';
import assert from 'node:assert/strict';
import {authorFormatC,constrainAuthorFormatC} from '../../../artifacts/question-factory/cuet-readiness-2026-10-08/c-draft/scripts/pipeline/lib/authorFormatC.mjs';

const oldRule='If the requested numerical task is unsupported by this topic, produce a supported conceptual task and state the actual format honestly.';
const request=()=>({input:[{role:'system',content:oldRule},{role:'user',content:'source-backed input'}],text:{format:{schema:{properties:{question_type:{type:'string',enum:['numerical_calculation','conceptual_mcq','reading_comprehension']},route:{type:'string',enum:['conceptual','numerical','passage']}}}}}});
test('C numerical briefs keep numerical route and exact format without changing the original request',()=>{
 const original=request(),revised=constrainAuthorFormatC(original,{format:'numerical_calculation'});
 assert.deepEqual(revised.text.format.schema.properties.question_type.enum,['numerical_calculation']);
 assert.deepEqual(revised.text.format.schema.properties.route.enum,['numerical']);
 assert.ok(!revised.input[0].content.includes(oldRule));
 assert.ok(original.input[0].content.includes(oldRule));
 assert.throws(()=>constrainAuthorFormatC(original,{format:'unsupported'}),/requested_format/);
});
test('C rejects a provider format substitution after billing without purchasing verification',async()=>{
 let calls=0;const native={generate:async(_provider,body)=>{calls++;assert.deepEqual(body.text.format.schema.properties.route.enum,['numerical']);return {output_text:JSON.stringify({question_type:'conceptual_mcq',route:'conceptual'})};}};
 await assert.rejects(authorFormatC(native,{format:'numerical_calculation'}).generate('openai',request(),{stage:'authoring',key:'registered'}),/requested_format_mismatch/);
 assert.equal(calls,1);
});
test('C valid exact-format output is unchanged and other stages pass through',async()=>{
 const response={output_text:JSON.stringify({question_type:'numerical_calculation',route:'numerical'})};let captured;
 const native={generate:async(_provider,body,options)=>{captured={body,options};return response;}};
 const adapted=authorFormatC(native,{format:'numerical_calculation'});
 assert.equal(await adapted.generate('openai',request(),{stage:'authoring',key:'prior'}),response);
 assert.notEqual(captured.options.key,'prior');
 const check=request(),opts={stage:'blind_solution',key:'blind'};
 await adapted.generate('openai',check,opts);assert.equal(captured.body,check);assert.equal(captured.options,opts);
});
test('C passage briefs preserve route and conflicting briefs fail before dispatch',()=>{
 const revised=constrainAuthorFormatC(request(),{format:'reading_comprehension',passage_text:'complete printed text'});
 assert.deepEqual(revised.text.format.schema.properties.route.enum,['passage']);
 assert.throws(()=>constrainAuthorFormatC(request(),{format:'numerical_calculation',passage_text:'text'}),/conflicting/);
});
