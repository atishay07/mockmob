import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {officialTopics} from '../lib/officialTopics.mjs';
const registry=JSON.parse(readFileSync('data/source_registry.json'));
test('Planning selects its official unit, without management keywords importing other units',()=>{
 const topics=officialTopics(registry.exam_specs.business_studies,'business_studies','Planning');assert.ok(topics.some(t=>/Planning process/.test(t)));assert.ok(topics.every(t=>!/Fayol|Consumer|staffing|financial management/i.test(t)));
});
test('the two Accountancy Unit V alternatives remain separate',()=>{
 const finance=officialTopics(registry.exam_specs.accountancy,'accountancy','Cash Flow Statement'),computer=officialTopics(registry.exam_specs.accountancy,'accountancy','Computerized Accounting System');assert.ok(finance.some(t=>/Cash Flow/i.test(t)));assert.ok(computer.some(t=>/Computerised/i.test(t)));assert.ok(finance.every(t=>!/Computerised/i.test(t)));assert.ok(computer.every(t=>!/Cash Flow/i.test(t)));
});
test('repeated Economics unit numbers and the missing colon preserve exact entitlement',()=>{
 const micro=officialTopics(registry.exam_specs.economics,'economics','Introduction & Theory of Consumer Behaviour'),macro=officialTopics(registry.exam_specs.economics,'economics','National Income & Related Aggregates'),reforms=officialTopics(registry.exam_specs.economics,'economics','Economic Reforms Since 1991');assert.ok(micro.some(t=>/Consumer/.test(t)));assert.ok(macro.some(t=>/Circular flow/.test(t)));assert.ok(reforms.some(t=>/liberalisation/.test(t)));assert.ok(micro.every(t=>!/Circular flow/.test(t)));
});
