import {sourceMaterial} from './factoryEvidence.mjs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const questionMaterial=text=>/(?:exercises?|test your understanding|do it yourself|short answer type|long answer type|state (?:whether|true)|true or false)/i.test(text);
export function retrieveFocusedSources(registry,brief,ledger){
 const words=[...new Set(norm(brief.topic+' '+brief.chapter).split(' ').filter(w=>w.length>3))];
 const eligible=Object.values(registry.sources).filter(s=>s.kind==='reference'&&s.state==='active'&&s.reuse_permitted&&s.extraction_checked&&s.chapters?.includes(brief.chapter));
 const candidates=eligible.flatMap(s=>Object.entries(s.facts||{}).map(([locator,fact])=>({id:s.id,version:s.version,locator,support_hash:s.supports[locator],text:fact.text})))
  .filter(f=>f.text?.trim()&&!questionMaterial(f.text)&&f.text.length<=4000)
  .map(f=>({...f,rank:words.filter(w=>norm(f.text.slice(0,350)).includes(w)).length*3+words.filter(w=>norm(f.text).includes(w)).length}));
 candidates.sort((a,b)=>b.rank-a.rank||a.id.localeCompare(b.id)||a.locator.localeCompare(b.locator));
 let ranked=candidates;
 const lexical=brief.subject==='english'&&['Vocabulary','Match the Following'].includes(brief.chapter);
 if(lexical){const definitions=candidates.filter(c=>c.id.startsWith('oxford-quality-'));const offset=(brief.variant_index||0)%Math.max(1,definitions.length);ranked=[...definitions.slice(offset),...definitions.slice(0,offset)];}
 const chosen=[];let length=0;for(const c of ranked){if(chosen.length===(lexical?4:2))break;if(length+c.text.length>5000)continue;chosen.push(c);length+=c.text.length;}
 const refs=chosen.map(({id,version,locator,support_hash})=>({id,version,locator,support_hash}));
 const key=hashJSON({contract:'normative-heading-focused-v2',brief:{subject:brief.subject,chapter:brief.chapter,topic:brief.topic},refs});
 const result={key,refs,excerpts:sourceMaterial(registry,refs),state:refs.length?'retrieved_pending_entailment':'source_missing',cost_usd:0,
  selection_contract:'Normative source spans ranked by heading and requested scope. Exercises are excluded. Ranking cannot establish support; blind validators still require the decisive rule and every explanation claim.'};
 ledger?.setCache('research:'+key,result);return result;
}
