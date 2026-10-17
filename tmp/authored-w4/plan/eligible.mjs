// offline: NTA-admitted supply per subject/chapter/type/difficulty from the committed score tables (agent mean>=8 no blocking flag, fit median>=8 (and >=9), <2 fit flags)
import fs from 'node:fs';
const subjects=['general_test','physics','chemistry','mathematics','biology'];
const out={};
for(const s of subjects){
  const a=JSON.parse(fs.readFileSync(`data/nta_agent_scores/${s}.json`,'utf8')).questions;
  const f=JSON.parse(fs.readFileSync(`data/nta_fit_scores/${s}.json`,'utf8')).questions;
  const rows=[];
  for(const [id,fe] of Object.entries(f)){
    const ae=a[id]; if(!ae) continue;
    const okA=ae.mean>=8 && !ae.blocking && ae.key_agreement!=='none';
    const okF=fe.fit_median>=8 && !fe.blocking;
    rows.push({id,chapter:fe.chapter||fe.db_chapter,type:fe.cuet_type,diff:ae.difficulty?.agreed||ae.difficulty?.label,fit:fe.fit_median,okA,okF,auth:!!(ae.authored||ae.source)});
  }
  out[s]=rows;
}
const summary={};
for(const s of subjects){
  const rows=out[s].filter(r=>r.okA&&r.okF);
  const by=(k)=>rows.reduce((m,r)=>{const v=k(r);m[v]=(m[v]||0)+1;return m},{});
  summary[s]={tableRows:out[s].length,admit8:rows.length,admit9:rows.filter(r=>r.fit>=9).length,byChapter:by(r=>r.chapter),byType:by(r=>r.type),byDiff:by(r=>r.diff),byChapter9:rows.filter(r=>r.fit>=9).reduce((m,r)=>{m[r.chapter]=(m[r.chapter]||0)+1;return m},{})};
}
fs.writeFileSync('tmp/authored-w4/plan/eligible-summary.json',JSON.stringify(summary,null,1));
for(const s of subjects){console.log('==',s,summary[s].tableRows,summary[s].admit8,summary[s].admit9);console.log(JSON.stringify(summary[s].byType),JSON.stringify(summary[s].byDiff));console.log(JSON.stringify(summary[s].byChapter));console.log('fit>=9',JSON.stringify(summary[s].byChapter9))}
