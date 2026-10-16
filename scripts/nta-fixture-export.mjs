// Exports production-shaped NTA fixtures for the end-to-end tests. READ-ONLY: select queries only,
// with the service role from .env.local; nothing is inserted, updated or deleted, no session is
// created and no model is called.
//
//   node --use-system-ca scripts/nta-fixture-export.mjs [outDir=tmp/nta-fixtures]
//
// Writes <outDir>/<internal subject>.json (every live, undeleted question of the subject with all
// columns, as the website's own pool read sees it), <outDir>/shared.json (the passage groups those
// questions point at, every key dispute, every family hold) and <outDir>/manifest.json. The fixtures
// are private data: keep them under tmp/, never commit them.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { assertScriptFullBankRead } from '../data/full_bank_guard.js';

function loadEnv(file = '.env.local') {
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
}
const env = loadEnv();
const { CUET_PUBLIC_ALLOWED_SUBJECTS, toInternalSubjectId } = await import('../data/cuet_controls.js');
const outDir = process.argv[2] || 'tmp/nta-fixtures';
fs.mkdirSync(outDir, { recursive: true });
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
// Reads every live question of every subject with every column: refused against production unless --allow-production (docs/brain/LOCAL-ENV-STAGING.md).
assertScriptFullBankRead('the NTA fixture export', { url });
const db = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PAGE = 1000;

async function pages(build) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

const manifest = { exportedAt: new Date().toISOString(), project: new URL(url).hostname.split('.')[0], readOnly: true, subjects: {} };
const passageIds = new Set();
const families = new Set();
for (const subject of CUET_PUBLIC_ALLOWED_SUBJECTS) {
  const internal = toInternalSubjectId(subject);
  const rows = await pages(() => db.from('questions').select('*').eq('subject', internal).eq('status', 'live').eq('is_deleted', false).order('id'));
  for (const row of rows) {
    if (row.passage_group_id) passageIds.add(row.passage_group_id);
    const family = row.family_id || row.evidence?.record?.family_id;
    if (family) families.add(family);
  }
  fs.writeFileSync(path.join(outDir, `${internal}.json`), JSON.stringify(rows));
  manifest.subjects[subject] = { internal, rows: rows.length, withEvidence: rows.filter((row) => row.evidence).length, withPassage: rows.filter((row) => row.passage_group_id).length };
  console.log(subject, internal, rows.length);
}
const ids = [...passageIds];
const groups = [];
for (let i = 0; i < ids.length; i += 300) {
  const { data, error } = await db.from('passage_groups').select('*').in('id', ids.slice(i, i + 300));
  if (error) throw error;
  groups.push(...(data || []));
}
let disputes = [];
try { disputes = await pages(() => db.from('question_content_disputes').select('*').order('question_id')); } catch (error) { console.warn('disputes unavailable:', error.message); }
const holds = [];
const familyList = [...families];
for (let i = 0; i < familyList.length; i += 300) {
  const { data, error } = await db.from('recovery_family_holds').select('*').in('family_id', familyList.slice(i, i + 300));
  if (error) throw error;
  holds.push(...(data || []));
}
fs.writeFileSync(path.join(outDir, 'shared.json'), JSON.stringify({ passage_groups: groups, question_content_disputes: disputes, recovery_family_holds: holds }));
manifest.shared = { passage_groups: groups.length, question_content_disputes: disputes.length, recovery_family_holds: holds.length };
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest));
