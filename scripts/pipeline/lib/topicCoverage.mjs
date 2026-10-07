import {coverageSnapshot} from './focusedCoverage.mjs';
import {syllabusForChapter} from './factoryEvidence.mjs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
// Topic classification never establishes answer support. It reuses the two
// existing independently validated syllabus tags and leaves ambiguous tags open.
export function detailedCoverage(rows,registry,options={}){
 const snapshot=coverageSnapshot(rows,options),byId=new Map(rows.map(q=>[q.id,q]));
 for(const cell of snapshot.cells){
  const spec=registry.exam_specs[cell.subject],syllabus=syllabusForChapter(spec,cell.subject,cell.chapter);
  const raw=(syllabus.relevant_units||[syllabus.text||'']).flatMap(text=>text.split(/[•]/)).map(s=>s.replace(/PAGE \d+/g,'').replace(/\s+/g,' ').trim()).filter(s=>s.length>20&&s.length<400);
  const topics=[...new Set(raw)].map(text=>({id:hashJSON({subject:cell.subject,chapter:cell.chapter,text}).slice(0,20),text,usable:0,formats:{},difficulties:{}}));
  cell.topics=topics;cell.topic_unclassified=0;cell.validated_topic_observations=[];
  for(const idea of cell.ideas){const q=byId.get(idea.id),checks=q.evidence?.record?.checks;
   const tags=[checks?.blind_solution?.syllabus_topic,checks?.independent_evaluation?.syllabus_topic];
   cell.validated_topic_observations.push({id:q.id,tags,format:q.question_type||'unclassified',difficulty:q.difficulty||'unclassified',official_topic_assigned:false});
   const matches=tags.map(tag=>!tag?[]:topics.filter(t=>normalize(t.text).includes(normalize(tag))||normalize(tag).includes(normalize(t.text))));
   if(matches.some(m=>m.length!==1)||matches[0][0]?.id!==matches[1][0]?.id){cell.topic_unclassified++;continue;}
   const topic=matches[0][0];topic.usable++;topic.formats[q.question_type||'unclassified']=(topic.formats[q.question_type||'unclassified']||0)+1;
   cell.validated_topic_observations.at(-1).official_topic_assigned=true;
   topic.difficulties[q.difficulty||'unclassified']=(topic.difficulties[q.difficulty||'unclassified']||0)+1;
  }
 }
 return {...snapshot,topic_contract:'official-syllabus-exact-tag-agreement-v1',topic_assignment:'A topic fills only when both existing blind validators identify the same unique official syllabus topic. Ambiguous or legacy tags stay unclassified.'};
}
