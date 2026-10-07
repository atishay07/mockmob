import test from 'node:test';import assert from 'node:assert/strict';
import {originalQuoteIntegrity} from '../lib/generationIntegrity.mjs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
const text='Inventory turnover equals cost of revenue from operations divided by average inventory.';
const registry={sources:{s:{id:'s',version:1,state:'active',kind:'reference',reuse_permitted:true,extraction_checked:true,identity_sha256:'identity',facts:{formula:{text}},supports:{formula:hashJSON(text)}}}};
const candidate=quotes=>({evidence_quotes:quotes,source_refs:[{id:'s',version:1,locator:'formula',support_hash:hashJSON(text)}]});
test('one real quotation cannot conceal a fabricated second quotation',()=>{
 assert.equal(originalQuoteIntegrity(candidate([text]),registry).passed,true);
 const r=originalQuoteIntegrity(candidate([text,'NCERT says closing inventory alone is always the divisor.']),registry);
 assert.equal(r.passed,false);assert.equal(r.supplied,2);assert.equal(r.verified,1);
});
test('empty author support is withheld and a changed registered excerpt fails closed',()=>{
 assert.equal(originalQuoteIntegrity(candidate([]),registry).passed,false);
 const changed=structuredClone(registry);changed.sources.s.supports.formula='changed';
 assert.throws(()=>originalQuoteIntegrity(candidate([text]),changed),/excerpt_required/);
});
