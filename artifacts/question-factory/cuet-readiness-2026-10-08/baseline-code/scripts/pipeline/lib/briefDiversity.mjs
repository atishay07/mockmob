import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {sourceMaterial} from './factoryEvidence.mjs';

const normalized=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const refKey=r=>[r.id,r.version,r.locator,r.support_hash].join(':');
const exercise=text=>/(?:test your understanding|do it yourself|short answer type|long answer type|true or false|exercises?)/i.test(text);

// These rankings prevent repeated briefs; they do not establish entailment.
// Only immutable, permission-backed excerpts enter the blind academic checks.
export function diversifyBrief(brief,registry,inventory,{planned=[]}={}){
 const context=[...inventory,...planned.map(j=>j.candidate||j)],usage=new Map();
 for(const q of context)for(const r of q.source_refs||[])usage.set(refKey(r),(usage.get(refKey(r))||0)+1);
 const documents=Object.values(registry.sources||{}).filter(s=>s.state==='active'&&s.kind==='reference'&&s.reuse_permitted&&s.extraction_checked&&s.chapters?.includes(brief.chapter));
 let spans=documents.flatMap(s=>Object.entries(s.facts||{}).filter(([,f])=>f.text?.length>=25&&f.text.length<=3500&&!exercise(f.text)).map(([locator,f])=>({ref:{id:s.id,version:s.version,locator,support_hash:s.supports[locator]},text:f.text,document:s})));
 const lexical=brief.subject==='english'&&['Vocabulary','Match the Following','Correct Word Usage'].includes(brief.chapter);
 if(lexical)spans=spans.filter(s=>s.document.id.startsWith('oxford-quality-'));
 if(brief.subject==='english'&&brief.chapter==='Para Jumbles')spans=spans.filter(s=>s.document.id.startsWith('mockmob-original-stimulus-diverse-'));
 const words=[...new Set(normalized(brief.topic).split(' ').filter(w=>w.length>4))];
 const usedTargets=new Set(context.filter(q=>q.subject==='english'&&(q.question_type||q.format)===brief.format).flatMap(q=>[...String(q.body||q.topic||'').matchAll(/["“‘']([a-z][a-z-]{1,30})["”’']/gi)].map(m=>normalized(m[1]))));
 const target=s=>s.document.id.replace('oxford-quality-','');
 spans.sort((a,b)=>Number(lexical&&usedTargets.has(target(a)))-Number(lexical&&usedTargets.has(target(b)))||(usage.get(refKey(a.ref))||0)-(usage.get(refKey(b.ref))||0)||words.filter(w=>normalized(b.text).includes(w)).length-words.filter(w=>normalized(a.text).includes(w)).length||hashJSON({campaign:brief.id,ref:a.ref}).localeCompare(hashJSON({campaign:brief.id,ref:b.ref})));
 if(!spans.length)return null;
 const selected=[spans[0]];let chars=spans[0].text.length;
 // Additional lexical definitions support distinct distractors and matching.
 // For Commerce prefer a companion section from the same actual document.
 const others=lexical?spans.slice(1):spans.slice(1).filter(s=>s.document.id===spans[0].document.id);
 for(const s of others){if(selected.length>=(lexical?4:2))break;if(chars+s.text.length>4500)continue;selected.push(s);chars+=s.text.length;}
 const refs=selected.map(s=>s.ref),excerpts=sourceMaterial(registry,refs);
 const topic=brief.chapter==='Para Jumbles'?`${brief.chapter}: write four complete sentences from this supplied original fictional account and ask for their unique coherent order. Keep temporal or referential dependencies explicit; all four sentences and data must be visible in the stem.`:
 lexical&&brief.format!=='matching'?`${brief.chapter}: test "${target(spans[0])}" in the supplied dictionary sense; use a short context where it disambiguates the answer.`:
  `${brief.chapter}: focus on this supplied section: ${spans[0].text.slice(0,180)}. Test a distinct implication, application or calculation supported by it.`;
 const key=hashJSON({contract:'least-used-exact-section-v1',brief_id:brief.id,refs,topic});
 return {key,refs,excerpts,topic,state:'retrieved_pending_entailment',cost_usd:0,selection_contract:'Least-used exact registered sections and unused lexical targets; independent source/key/explanation gates remain mandatory.'};
}
