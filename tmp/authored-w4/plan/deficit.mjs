import fs from 'node:fs';
const sum=JSON.parse(fs.readFileSync('tmp/authored-w4/plan/eligible-summary.json','utf8'));
const subjects=['general_test','physics','chemistry','mathematics','biology'];
for(const s of subjects){
  const b=JSON.parse(fs.readFileSync(`data/nta_blueprints/${s}.json`,'utf8'));
  const tgt={};
  for(const v of b.variants){const t={};for(const sec of v.sections)for(const u of sec.units)for(const c of u.chapters){t[c.name]=(t[c.name]||0)+c.target;} for(const [k,x] of Object.entries(t)) tgt[k]=Math.max(tgt[k]||0,x);}
  const sp=sum[s];
  console.log('==',s);
  let totalDef=0;const rows=[];
  for(const [ch,t] of Object.entries(tgt)){
    const a8=sp.byChapter[ch]||0, a9=sp.byChapter9[ch]||0;
    const need=4*t; const def=Math.max(0,need-a8);
    totalDef+=def; rows.push({ch,t,a8,a9,need,def});
  }
  rows.sort((x,y)=>y.def-x.def);
  for(const r of rows) console.log(r.ch.padEnd(52),'target',r.t,'adm8',r.a8,'adm9',r.a9,'need4x',r.need,'deficit',r.def);
  console.log('total deficit',totalDef);
  const q=b.typeQuotas;
  for(const [t,x] of Object.entries(q)){const have=sp.byType[t]||0;console.log('type',t,'target',x.target,'max',x.max,'adm',have,'need4x',4*x.target,'def',Math.max(0,4*x.target-have));}
}
