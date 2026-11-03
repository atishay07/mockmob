// Read-only check for complete visible JSON in terminal incomplete responses.
// No parser rescue, cache write, verdict replacement or provider request.
import {DatabaseSync} from 'node:sqlite';
import {writeFileSync} from 'node:fs';
import {evalSchemaV7} from '../lib/factoryEvidenceV7.mjs';
const db=new DatabaseSync('data/pipeline-budget.sqlite',{readOnly:true}),prefix='cuet-readiness-diagnostic72-v2:';
try{
 const rows=db.prepare(`SELECT p.id,p.request_json,p.response_json,r.state,r.actual FROM provider_requests p
  JOIN requests r ON p.reservation_id=r.id WHERE p.provider='gemini' AND substr(json_extract(p.request_json,'$.config.candidate_id'),1,?)=?`).all(prefix.length,prefix);
 const incomplete=[];
 for(const r of rows){const response=JSON.parse(r.response_json||'null'),finish=response?.candidates?.[0]?.finishReason;if(finish!=='MAX_TOKENS')continue;
  const text=(response.candidates[0].content?.parts||[]).filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join('');
  let parsed=null;try{parsed=JSON.parse(text);}catch{}
  const requiredMissing=parsed?evalSchemaV7.required.filter(k=>!(k in parsed)):evalSchemaV7.required;
  incomplete.push({native_key:r.id,case_id:JSON.parse(r.request_json).config.candidate_id.slice(prefix.length),finish,visible_bytes:Buffer.byteLength(text),valid_json:Boolean(parsed),required_missing:requiredMissing,receipt_state:r.state,settled_usd:(r.actual||0)/1e6,verdict_replaced:false});
 }
 const out={at:new Date().toISOString(),incomplete,provider_calls:0,ledger_writes:0};writeFileSync('artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/verified-rule-v4/diagnostic72-v2/incomplete-output-inspection.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));
}finally{db.close();}
