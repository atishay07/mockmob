#!/usr/bin/env node
// Generate supabase/migrations/0004_cuet_seed.sql from data/subjects.js.
// Produces INSERTs matching the row shape created by scripts/seed.mjs.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUBJECTS } from '../data/subjects.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const esc = (s) => String(s).replace(/'/g, "''");
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const lines = [
  '-- ============================================================',
  '-- MockMob migration 0004 — CUET subjects & chapters seed',
  '-- ============================================================',
  '-- Populates the chapters table (created in 0003) with the full',
  '-- CUET (UG) syllabus: 13 Section IA languages, 27 domain',
  '-- subjects, and the General Test. Subject metadata (name/short/',
  '-- glyph) lives in data/subjects.js and is exposed via /api/subjects.',
  '--',
  '-- Idempotent: safe to re-run. ON CONFLICT (id) DO UPDATE keeps the',
  '-- display name + sort_order in sync if the source list changes.',
  '-- ============================================================',
  '',
  'begin;',
  '',
];

let total = 0;
for (const s of SUBJECTS) {
  const chapters = s.chapters || [];
  if (!chapters.length) continue;
  lines.push(`-- ${s.name} (${s.id}) — ${chapters.length} chapters`);
  lines.push('insert into public.chapters (id, subject_id, name, sort_order) values');
  const rows = chapters.map((name, i) => {
    const id = `${s.id}__${slug(name)}`;
    return `  ('${esc(id)}', '${esc(s.id)}', '${esc(name)}', ${i})`;
  });
  lines.push(rows.join(',\n'));
  lines.push('on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;');
  lines.push('');
  total += chapters.length;
}

lines.push('commit;');
lines.push('');
lines.push('-- Row-count check:');
lines.push('--   select count(*) from public.chapters;');
lines.push(`-- expected: ${total} chapters across ${SUBJECTS.length} subjects.`);

writeFileSync(join(ROOT, 'supabase/migrations/0004_cuet_seed.sql'), lines.join('\n') + '\n');
console.log(`wrote supabase/migrations/0004_cuet_seed.sql — ${total} chapter INSERTs across ${SUBJECTS.length} subjects`);
