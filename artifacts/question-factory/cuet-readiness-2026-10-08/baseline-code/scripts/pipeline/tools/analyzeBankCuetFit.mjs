// Deterministic CUET-fit audit of the retained approved bank against authenticated PYQs. No provider call, no bank change.
// node scripts/pipeline/tools/analyzeBankCuetFit.mjs   -> artifacts/question-factory/cuet-fit-2026-10-07/bank-cuet-fit-findings.{json,csv}
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {readingWords,PYQ_MAX_READING_WORDS} from '../../../data/cuet_fit_rubric.mjs';
const out='artifacts/question-factory/cuet-fit-2026-10-07';mkdirSync(out,{recursive:true});
const registry=JSON.parse(readFileSync('data/source_registry.json','utf8')),all=JSON.parse(readFileSync('artifacts/question-factory/continuation-500/all-candidates.json','utf8'));
const approved=all.filter(c=>c.state==='published'),pyq=registry.examples.filter(e=>e.final_key_matched&&!e.dropped);
const pct=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(p*s.length))];};
const stats=a=>a.length?{n:a.length,median:pct(a,.5),p90:pct(a,.9),p95:pct(a,.95),max:Math.max(...a)}:null;
const nonPassagePyq=pyq.filter(e=>!e.passage_text);
const normalize={match_type:'matching',match_following:'matching',matching:'matching',statement_selection:'statement_selection',statement_based:'statement_selection',sequence_ordering:'sequence_ordering',sequence:'sequence_ordering',para_jumble:'sequence_ordering',
 numerical_calculation:'numerical',numerical_one_step:'numerical',numerical_case:'numerical',case_application:'case_application',case_based:'case_application',application_based:'case_application',conceptual_mcq:'direct_or_conceptual',direct_mcq:'direct_or_conceptual',direct_recall:'direct_or_conceptual',
 concept_identification:'direct_or_conceptual',factual_recall:'direct_or_conceptual',fill_in_blank:'direct_or_conceptual',reading_comprehension:'passage',passage_comprehension:'passage',synonym:'vocabulary',antonym:'vocabulary',vocabulary_in_context:'vocabulary',correct_word_usage:'vocabulary',word_usage:'vocabulary','contextual vocabulary':'vocabulary',vocabulary_meaning:'vocabulary','meaning in context':'vocabulary','direct MCQ':'direct_or_conceptual'};
const family=t=>normalize[t]||t;
const share=(rows,f)=>{const o={};for(const r of rows){const k=f(r);o[k]=(o[k]||0)+1;}const n=rows.length;return Object.fromEntries(Object.entries(o).map(([k,v])=>[k,{n:v,pct:Math.round(1000*v/n)/10}]));};
const rows=approved.map(c=>{const q=c.candidate,w=readingWords({body:q.body,options:q.options,passage_text:q.passage_text});return {id:c.id,subject:c.subject,chapter:q.chapter,format:q.question_type,family:family(q.question_type),difficulty:q.difficulty,reading_words:w,over_pyq_max:!q.passage_text&&w>PYQ_MAX_READING_WORDS||Boolean(q.passage_text)&&w>PYQ_MAX_READING_WORDS};});
const bySubject={};
for(const subject of ['english','accountancy','business_studies','economics']){
  const p=nonPassagePyq.filter(e=>e.subject===subject).map(e=>readingWords({body:e.body,options:e.options})),b=rows.filter(r=>r.subject===subject);
  bySubject[subject]={pyq_non_passage_reading_words:stats(p),bank_reading_words:stats(b.map(r=>r.reading_words)),bank_over_pyq_max:{n:b.filter(r=>r.over_pyq_max).length,pct:Math.round(1000*b.filter(r=>r.over_pyq_max).length/b.length)/10},
    pyq_format_mix:share(pyq.filter(e=>e.subject===subject),e=>family(e.question_type)),bank_format_mix:share(b,r=>r.family)};
}
const byFormat={};for(const r of rows){const k=r.format;(byFormat[k]??={n:0,over:0,words:[]});byFormat[k].n++;byFormat[k].words.push(r.reading_words);if(r.over_pyq_max)byFormat[k].over++;}
const rank=a=>{const idx=a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]),r=Array(a.length);for(let i=0;i<idx.length;){let j=i;while(j+1<idx.length&&idx[j+1][0]===idx[i][0])j++;for(let k=i;k<=j;k++)r[idx[k][1]]=(i+j)/2+1;i=j+1;}return r;};
const spearman=(x,y)=>{const a=rank(x),b=rank(y),n=a.length,ma=a.reduce((s,v)=>s+v,0)/n,mb=b.reduce((s,v)=>s+v,0)/n;let num=0,da=0,db=0;for(let i=0;i<n;i++){num+=(a[i]-ma)*(b[i]-mb);da+=(a[i]-ma)**2;db+=(b[i]-mb)**2;}return da&&db?num/Math.sqrt(da*db):null;};
const legacy=approved.map(c=>({l:c.candidate?.evidence?.record?.checks?.blind_solution?.item_quality_score,g:c.candidate?.evidence?.record?.checks?.independent_evaluation?.item_quality_score})).filter(x=>Number.isInteger(x.l)&&Number.isInteger(x.g));
const findings={at:new Date().toISOString(),basis:'Deterministic. Authenticated CUET 2024 questions in data/source_registry.json versus the 662 approved published questions in continuation-500/all-candidates.json. Labels are the pipeline\'s own question_type strings mapped to families; they are approximate.',
 pyq_reading_words_non_passage:stats(nonPassagePyq.map(e=>readingWords({body:e.body,options:e.options}))),cap_used_by_rubric:PYQ_MAX_READING_WORDS,
 bank:{approved:rows.length,over_pyq_max_reading_words:rows.filter(r=>r.over_pyq_max).length,over_pct:Math.round(1000*rows.filter(r=>r.over_pyq_max).length/rows.length)/10,reading_words:stats(rows.map(r=>r.reading_words))},
 by_subject:bySubject,by_format:Object.fromEntries(Object.entries(byFormat).map(([k,v])=>[k,{n:v.n,over_pyq_max:v.over,median_words:pct(v.words,.5)}])),
 difficulty:{pyq_labels:share(pyq,e=>e.difficulty||'unlabelled'),bank_labels:share(rows,r=>r.difficulty),note:'Difficulty labels on both sides are model labels from earlier pipeline stages, not measured item statistics.'},
 legacy_craft_scores:{published_with_both:legacy.length,luna_distribution:share(legacy,x=>x.l),gemini_distribution:share(legacy,x=>x.g),exact_agreement_pct:Math.round(1000*legacy.filter(x=>x.l===x.g).length/legacy.length)/10,within_one_pct:Math.round(1000*legacy.filter(x=>Math.abs(x.l-x.g)<=1).length/legacy.length)/10,spearman:spearman(legacy.map(x=>x.l),legacy.map(x=>x.g)),
  reading:'Two judges rating the same items with the same prompt agree on the exact 7–10 score only for the share shown and are weakly rank-correlated, so the previous overall rating is a judge-dependent label, not a measurement of CUET fit.'}};
writeFileSync(`${out}/bank-cuet-fit-findings.json`,JSON.stringify(findings,null,2)+'\n');
writeFileSync(`${out}/bank-reading-load-flags.csv`,['id,subject,chapter,format,difficulty,reading_words,over_pyq_max',...rows.map(r=>[r.id,r.subject,'"'+r.chapter+'"',r.format,r.difficulty,r.reading_words,r.over_pyq_max].join(','))].join('\n')+'\n');
console.log(JSON.stringify({pyq:findings.pyq_reading_words_non_passage,bank:findings.bank,legacy:findings.legacy_craft_scores,by_format:findings.by_format},null,1));
