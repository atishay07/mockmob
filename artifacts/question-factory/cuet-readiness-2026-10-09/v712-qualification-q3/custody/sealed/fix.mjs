import fs from 'fs';
const P="C:/Users/atish/AppData/Local/Temp/claude/C--Users-atish-Desktop-mockmob-copy-mockmob-copy/25c3edf2-b29c-4fc7-9e35-73be4428aee6/scratchpad/v712-fresh/sealed/business_studies-authored.json";
const j=JSON.parse(fs.readFileSync(P,"utf8"));
const m={"v1":["F9","F10"],"v2":["F15"],"v3":["F14"],"v4":["F11"],"v5":["F6"],"d1":["F1"],"d2":["F3"],"d3":["F20"],"d4":["F12"]};
for(const it of j.items){it.candidate.fact_refs=m[it.local_id.split("-")[1]];console.log(it.local_id,JSON.stringify(it.candidate.fact_refs));}
fs.writeFileSync(P,JSON.stringify(j,null,1));
JSON.parse(fs.readFileSync(P,"utf8"));console.log("ok");
