import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { canonicalQuestion, contentHash } from '../../../data/content_evidence.js';
import { isValidTopSyllabusPair } from '../../../data/canonical_syllabus.js';
import { verifyAnswerIntegrity } from '../../../data/answer_integrity.js';
import { publicationEligibility } from '../../../data/evidence_registry.js';

function str_key(row){return String(row.correct_answer ?? row.correct_option ?? row.correct_index ?? '');}
export function auditRows(rows) {
  const seen = new Map(); const stems = new Map(); const families = new Map(); const coverage = {};
  const findings = rows.map((row) => {
    const q = canonicalQuestion(row); const reasons = [];
    const text = q.body.toLowerCase().replace(/\s+/g, ' ').trim();
    const shape = text.replace(/\d+(?:\.\d+)?/g, '#');
    const signature = contentHash(row);
    const id = row.id || row.local_id || row.candidate_id || contentHash(row);
    if (!text || q.options.length !== 4 || new Set(q.options.map(o => o.text?.trim().toLowerCase())).size !== 4 || !q.options.some(o => o.key === q.key)) reasons.push('invalid_structure');
    if (seen.has(signature)) reasons.push(`exact_duplicate:${seen.get(signature)}`); else seen.set(signature, id);
    const stemKey=`${q.subject}:${text}`;
    if(stems.has(stemKey) && !reasons.some(r=>r.startsWith('exact_duplicate'))) reasons.push(`likely_duplicate_stem:${stems.get(stemKey)}`); else stems.set(stemKey,id);
    if(!isValidTopSyllabusPair(q.subject,q.chapter)) reasons.push('unsupported_mapping');
    if(!q.explanation.trim()) reasons.push('missing_explanation');
    const integrity=verifyAnswerIntegrity(row);
    if(!integrity.accepted) reasons.push(...integrity.reasons.map(r=>'local_integrity_signal:'+r));
    const family = q.family || `${q.subject}:${shape}`;
    families.set(family, (families.get(family) || 0) + 1);
    if ((row.passage_group_id || row.is_passage_linked) && !q.passage) reasons.push('passage_requires_lookup');
    const verdict = publicationEligibility(row);
    reasons.push(...verdict.reasons);
    const status = reasons.includes('invalid_structure') ? 'invalid' : verdict.eligible && reasons.length === 0 ? 'eligible' : reasons.some(r=>/duplicate|missing_explanation|local_integrity/.test(r)) ? 'repairable' : 'uncertain';
    const route = `${q.subject || 'unknown'} / ${q.chapter || 'unknown'}`;
    coverage[route] ??= { total: 0, eligible: 0 };
    coverage[route].total++; if (status === 'eligible') coverage[route].eligible++;
    return { id, origin:row._audit_origin || 'unspecified', expected_content:q, expected_options:row.options, expected_key:str_key(row), route, subject:q.subject, chapter:q.chapter,
      available_evidence:row.evidence ? 'record_present' : 'none', source: row.source || row.anchor_source_quality || 'unknown',
      generation_version: row.generator_version || 'unknown', content_hash: contentHash(row), family, status, reasons };
  });
  return { created_at: new Date().toISOString(), read_only: true, total: rows.length, coverage,
    statuses: Object.fromEntries(['eligible','repairable','uncertain','invalid'].map(s => [s, findings.filter(f => f.status === s).length])),
    repeated_families: [...families].filter(([, n]) => n > 1).map(([family, count]) => ({ family, count })),
    costs: { local_checks_usd: 0, semantic_checks_usd: null, note: 'Cannot estimate paid checks without verified prices and route yield.' }, findings };
}

async function main() {
  const rows = [];
  const root = resolve('data/offline_question_batches');
  for (const directory of readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory())) {
    for (const file of readdirSync(join(root, directory.name)).filter(n => /^batch_\d+\.json$/.test(n))) {
      rows.push(...JSON.parse(readFileSync(join(root, directory.name, file), 'utf8')).questions.map(q=>({...q,_audit_origin:'local_batch'})));
    }
  }
  let database = 'not_requested';
  if (process.argv.includes('--database')) {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    database = 'complete';
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client.from('questions').select('*').order('id').range(offset, offset + 999);
      if (error) throw new Error(`Database inventory failed: ${error.code || 'network_or_access'}`);
      rows.push(...data.map(q=>({...q,_audit_origin:'database'}))); if (data.length < 1000) break;
    }
  }
  const databaseRows=rows.filter(r=>r._audit_origin==='database');
  const groupIds=[...new Set(databaseRows.map(r=>r.passage_group_id || r.passage_id).filter(Boolean))];
  if(groupIds.length && process.argv.includes('--database')) {
    const {createClient}=await import('@supabase/supabase-js');
    const client=createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
    const passages=new Map();
    for(let i=0;i<groupIds.length;i+=100){const {data,error}=await client.from('passage_groups').select('id,passage_text').in('id',groupIds.slice(i,i+100));if(error)throw new Error('Passage inventory failed: '+error.code);for(const p of data)passages.set(p.id,p.passage_text);}
    for(const row of databaseRows) if(!row.passage_text) row.passage_text=passages.get(row.passage_group_id || row.passage_id) || '';
  }
  const report = { ...auditRows(rows), database };
  const group=(field)=>Object.fromEntries([...new Set(report.findings.map(f=>f[field]))].map(value=>[value,report.findings.filter(f=>f[field]===value).length]));
  report.counts={by_subject:group('subject'),by_source:group('source'),by_generation_version:group('generation_version'),by_available_evidence:group('available_evidence'),by_origin:group('origin')};
  report.semantic_limit='Local signals require further verification. Missing evidence is not proof of an incorrect answer.';
  mkdirSync('artifacts/recovery', { recursive: true });
  writeFileSync('artifacts/recovery/bank-audit.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ total: report.total, statuses: report.statuses, database, report: 'artifacts/recovery/bank-audit.json' }));
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
