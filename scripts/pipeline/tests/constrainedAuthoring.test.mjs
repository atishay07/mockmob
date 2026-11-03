import test from 'node:test';
import assert from 'node:assert/strict';
import {authorQuoteCatalog,constrainedAuthoring,QUOTE_AUTHOR_CONTRACT,LEGACY_QUOTE_AUTHOR_CONTRACT} from '../lib/constrainedAuthoring.mjs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
test('new catalog avoids provider-rejected newlines while retaining exact contiguous source substrings',()=>{
 const text='This is the first decisive source line.\nThis is the second decisive source line.\r\nA short\tnote.';
 const quotes=authorQuoteCatalog([{text}]);assert.equal(quotes.length,2);
 assert.ok(quotes.every(q=>text.includes(q)&&!/[\u0000-\u001f]/.test(q)));
});
test('accepted v2 requests preserve the full revised body and its original persistent key',async()=>{
 const calls=[],transport={generate:async(...args)=>calls.push(args)},text='This is the first decisive source line.\nThis is the second decisive source line.';
 const body={input:[{role:'system',content:'Original rules.'},{role:'user',content:JSON.stringify({references:[{text}]})}],text:{format:{schema:{properties:{evidence_quotes:{items:{type:'string'}}}}}}};
 await constrainedAuthoring(transport,{author_contract:LEGACY_QUOTE_AUTHOR_CONTRACT}).generate('openai',body,{key:'accepted',stage:'authoring'});
 const revised=calls[0][1];assert.deepEqual(revised.text.format.schema.properties.evidence_quotes.items.enum,[text]);
 assert.equal(JSON.parse(revised.input[1].content).author_contract,LEGACY_QUOTE_AUTHOR_CONTRACT);
 assert.equal(calls[0][2].key,hashJSON({contract:LEGACY_QUOTE_AUTHOR_CONTRACT,prior_key:'accepted',body:revised}));
});
test('quote choices are bounded exact source substrings, never invented text',()=>{
 const text='A checked rule with a decisive qualification. '.repeat(35),catalog=authorQuoteCatalog([{text}]);
 assert.ok(catalog.length>0&&catalog.length<=24);assert.ok(catalog.every(q=>q.length>=25&&q.length<=320&&text.includes(q)));
 assert.deepEqual(authorQuoteCatalog([{kind:'paper',text}]),[]);
});
test('old requests and all validation stages preserve their original transport contract',async()=>{
 const calls=[],transport={generate:async(...args)=>calls.push(args)},body={model:'gpt-6-luna'};
 assert.equal(constrainedAuthoring(transport,{}),transport);
 await constrainedAuthoring(transport,{author_contract:QUOTE_AUTHOR_CONTRACT}).generate('openai',body,{key:'saved',stage:'blind_solution'});
 assert.equal(calls[0][1],body);assert.equal(calls[0][2].key,'saved');
});
test('new authoring schema and full revised body bind the persistent cache key',async()=>{
 const calls=[],transport={generate:async(...args)=>{calls.push(args);return 'pending';}},text='A decisive rule copied exactly from the supplied source.';
 const body={input:[{role:'system',content:'Original rules.'},{role:'user',content:JSON.stringify({job_id:'new',references:[{text}]})}],text:{format:{schema:{properties:{evidence_quotes:{items:{type:'string'}}}}}},reasoning:{effort:'high'},max_output_tokens:6500};
 const wrapped=constrainedAuthoring(transport,{author_contract:QUOTE_AUTHOR_CONTRACT});
 await wrapped.generate('openai',body,{key:'original',stage:'authoring',batch:true,cacheOnly:true});
 assert.deepEqual(calls[0][1].text.format.schema.properties.evidence_quotes.items.enum,[text]);assert.notEqual(calls[0][2].key,'original');assert.equal(calls[0][2].cacheOnly,true);assert.equal(calls[0][2].batch,true);assert.equal(body.text.format.schema.properties.evidence_quotes.items.enum,undefined);
 await wrapped.generate('openai',body,{key:'original',stage:'authoring',batch:true});assert.equal(calls[0][2].key,calls[1][2].key);
});
