import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';

const db = new DatabaseSync('data/pipeline-budget.sqlite', { readOnly: true });
const rows = db.prepare('SELECT state,reserved,actual FROM requests').all();
const settled = rows.reduce((s,r)=>s+(r.state==='settled'?r.actual:0),0);
const held = rows.reduce((s,r)=>s+(r.state==='settled'?0:Math.max(r.reserved,r.actual||0)),0);
const scope = prefix => {
  const records = db.prepare("SELECT id,state,reservation_id FROM provider_requests WHERE json_extract(request_json,'$.config.candidate_id') LIKE ?").all(prefix+'%');
  return { total: records.length, states: Object.fromEntries([...new Set(records.map(r=>r.state))].map(s=>[s,records.filter(r=>r.state===s).length])), unresolved_records: records.filter(r=>r.state!=='complete') };
};
const prices=JSON.parse(readFileSync('data/pipeline-prices.json','utf8'));
const result={at:new Date().toISOString(),read_only_database:true,lifetime:{settled_usd:settled/1e6,held_usd:held/1e6,remaining_usd:(50e6-settled-held)/1e6,unresolved:rows.filter(r=>r.state==='unresolved').length,requests:rows.length},v75:scope('v75-fresh-cbse2022-2026-10-09:'),v76:scope('v76-qualification-2026-10-09-'),v77:scope('v77-qualification-2026-10-09-'),lease_present:existsSync('data/question-factory-runtime/v77-qualification-owner.json'),pricing:{expires_at:prices.expires_at,valid:Date.parse(prices.expires_at)>Date.now()}};
db.close();
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result,null,2));
