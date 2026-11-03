import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {teachingIntervals,normativeFactSpans,quoteInTeachingContext,loadVerifiedPageContext,deriveNormativeRegistry} from '../lib/sourceContextIntegrityVNext.mjs';

const fixture=pages=>({identity_sha256:'fixture-only',extraction_checked:true,reuse_permitted:true,
  facts:Object.fromEntries(pages.map(p=>['pdf-page-'+p.page,{text:p.text}])),supports:Object.fromEntries(pages.map(p=>['pdf-page-'+p.page,hashJSON(p.text)]))});

test('unkeyed exercise mode persists across page boundaries until a teaching heading',()=>{
  const pages=[{page:1,text:'1.1 Teaching A partner loan earns 6% per year. Test your Understanding 2. State true or false: (i) example.'},
    {page:2,text:'(vi) A loan earns 12% if the deed is silent. 1.2 Capital Accounts Capital accounts record the partners contributions and withdrawals in the books of the firm.'}];
  const source=fixture(pages),spans=normativeFactSpans(source,'pdf-page-2',pages).spans;
  assert.equal(spans.length,1);assert.ok(spans[0].text.startsWith('1.2 Capital Accounts'));
  assert.equal(quoteInTeachingContext(source,'pdf-page-2','A loan earns 12%',pages),false);
  assert.equal(quoteInTeachingContext(source,'pdf-page-2','Capital accounts record',pages),true);
  assert.equal(teachingIntervals(pages)[0].ending_mode,'exercise');
});

test('actual NCERT teaching preserves the 6% default and excludes the continued 12% false proposition',()=>{
  const pages=JSON.parse(readFileSync('data/question-factory-runtime/reference-downloads/leac101.pages.json'));
  const registry=JSON.parse(readFileSync('data/source_registry.json')),source=registry.sources['ncert-leac101'];
  const continued=normativeFactSpans(source,'pdf-page-5',pages);
  assert.ok(continued.spans.length);assert.ok(continued.spans.every(s=>!s.text.includes('loan is to be given @ 12%')));
  assert.equal(quoteInTeachingContext(source,'pdf-page-5','Interest on partner’s loan is to be given @ 12% p.a.',pages),false);
  const normative=Object.entries(source.facts).find(([,f])=>f.text.includes('rate of 6 per cent per annum')&&f.text.includes('Test your Understanding'));
  assert.ok(normative);const retained=normativeFactSpans(source,normative[0],pages);
  assert.ok(retained.spans.some(s=>s.text.includes('rate of 6 per cent per annum')));
  assert.ok(retained.spans.every(s=>!s.text.includes('Test your Understanding')));
  for(const span of retained.spans)assert.equal(pages[span.page-1].text.slice(span.page_start,span.page_end),span.text);
});

test('missing adjacent pages, a changed excerpt and an unlocatable fragment cannot establish teaching context',()=>{
  const pages=[{page:1,text:'A factual teaching span is sufficiently long to establish the source context for this isolated software test fixture.'}];
  const source=fixture(pages);assert.throws(()=>normativeFactSpans(source,'pdf-page-1',[{page:2,text:pages[0].text}]),/contiguous_page/);
  source.facts['pdf-page-1'].text='Changed';assert.throws(()=>normativeFactSpans(source,'pdf-page-1',pages),/authenticated_context/);
  source.supports['pdf-page-1']=hashJSON('Changed');assert.equal(normativeFactSpans(source,'pdf-page-1',pages).state,'context_unresolved');
});

test('page context is bound to the actual registered PDF and extraction, so a tampered heading cannot turn a false exercise into teaching',()=>{
  const source=JSON.parse(readFileSync('data/source_registry.json')).sources['ncert-leac101'];
  assert.equal(loadVerifiedPageContext(source).pages.length,47);
  const modifiedRead=(path,encoding)=>{const bytes=readFileSync(path,encoding);if(!path.endsWith('.pages.json'))return bytes;const pages=JSON.parse(bytes);pages[4].text=pages[4].text.replace('(vi) Interest','1.2 Teaching Interest');return JSON.stringify(pages);};
  assert.throws(()=>loadVerifiedPageContext(source,{read:modifiedRead}),/context_pages_not_registered_extraction/);
  assert.throws(()=>loadVerifiedPageContext({...source,file:'../outside.pdf'}),/context_file_outside_runtime/);
});

test('derived teaching facts preserve every original fact and identity while excluding the continued exercise proposition',()=>{
  const registry=JSON.parse(readFileSync('data/source_registry.json')),source=registry.sources['ncert-leac101'];
  const result=deriveNormativeRegistry({sources:{[source.id]:source}}),derived=result.registry.sources[source.id];
  assert.deepEqual(Object.fromEntries(Object.keys(source.facts).map(k=>[k,derived.facts[k]])),source.facts);assert.equal(derived.identity_sha256,source.identity_sha256);
  const selected=result.eligible_locators[source.id].map(k=>derived.facts[k].text);assert.ok(selected.some(t=>t.includes('rate of 6 per cent per annum')));assert.ok(selected.every(t=>!t.includes('loan is to be given @ 12%')));
  assert.ok(result.eligible_locators[source.id].every(k=>derived.normative_context[k].parent_support_hash===source.supports[derived.normative_context[k].parent_locator]));
});
test('a verb in teaching prose is not an exercise heading and retained PAGE n markers are accepted only as the complete extractor representation',()=>{
  const text='Managers exercise control over operations. This teaching paragraph explains control and monitoring with enough text to verify the context.';
  assert.equal(teachingIntervals([{page:1,text}])[0].ending_mode,'teaching');
  const source=JSON.parse(readFileSync('data/source_registry.json')).sources['ncert-leac204'];
  assert.ok(loadVerifiedPageContext(source).pages.length>10);
});

test('an authenticated section spanning physical pages is split into exact teaching text and excludes exercise continuations',()=>{
  const pages=[{page:1,text:'3.9 Death of a Partner A sufficiently long teaching section discusses calculating profit up to the date of death and the treatment of capital balances.'},{page:2,text:'The executor receives the balance due subject to the partnership agreement and the supplied accounts. Test your Understanding State whether this false proposition is true.'}];
  const parent=pages[0].text+' PAGE 2 '+pages[1].text,source=fixture(pages);source.facts.section={text:parent};source.supports.section=hashJSON(parent);
  const spans=normativeFactSpans(source,'section',pages).spans;assert.equal(spans.length,2);assert.ok(spans.every(s=>pages[s.page-1].text.slice(s.page_start,s.page_end)===s.text));assert.ok(spans.every(s=>!s.text.includes('false proposition')));
  source.facts.section.text=parent.replace('executor','beneficiary');source.supports.section=hashJSON(source.facts.section.text);assert.equal(normativeFactSpans(source,'section',pages).state,'context_unresolved');
});

test('retained retirement and column-order directing references resolve without fabricating or overwriting their parent facts',()=>{
  const registry=JSON.parse(readFileSync('data/source_registry.json')),subset={sources:Object.fromEntries(['ncert-leac103','ncert-lebs107'].map(id=>[id,registry.sources[id]]))};
  const context=loadVerifiedPageContext(subset.sources['ncert-lebs107']);assert.equal(context.first_page,2);assert.equal(context.pages[0].page,2);
  const result=deriveNormativeRegistry(subset);for(const s of Object.values(subset.sources)){assert.ok(result.eligible_locators[s.id].length>0);assert.deepEqual(Object.fromEntries(Object.keys(s.facts).map(k=>[k,result.registry.sources[s.id].facts[k]])),s.facts);}
  const added=result.eligible_locators['ncert-lebs107'].map(k=>result.registry.sources['ncert-lebs107'].facts[k].text);assert.ok(added.some(t=>t.includes('directing refers to the process')));
});
