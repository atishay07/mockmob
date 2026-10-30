#!/usr/bin/env node
// Prints the SQL that applies the Syllabus v2 re-tag file through the migration's hook (public.apply_syllabus_retag).
//   node scripts/syllabus/retag-sql.mjs [data/syllabus/retag-2026-10-31.json] > retag.sql
// It checks every item against data/cuet_syllabus.js first and refuses the whole file on any bad item. It never connects
// to a database; running the printed SQL is the orchestrator's step.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveChapter } from '../../data/cuet_syllabus.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const RETAG_FILE = join(root, 'data', 'syllabus', 'retag-2026-10-31.json');

/** Problems with a re-tag list ([] when it is good). `to` must be a live chapter's stored name; `from` must differ. */
export function retagProblems(items) {
  if (!Array.isArray(items)) return ['the file must hold an array'];
  const problems = [];
  const seen = new Set();
  items.forEach((item, i) => {
    const where = `item ${i}${item?.id ? ` (${item.id})` : ''}`;
    if (!item || typeof item !== 'object') { problems.push(`${where}: not an object`); return; }
    for (const field of ['id', 'subject', 'from', 'to', 'why']) if (typeof item[field] !== 'string' || !item[field].trim()) problems.push(`${where}: ${field} missing`);
    const live = resolveChapter(item.subject, item.to);
    if (!live || live.retired || live.name !== item.to) problems.push(`${where}: "${item.to}" is not a live chapter name of ${item.subject}`);
    if (item.from === item.to) problems.push(`${where}: from and to are the same`);
    if (seen.has(item.id)) problems.push(`${where}: id listed twice`);
    seen.add(item.id);
  });
  return problems;
}

export function retagSql(items) {
  const json = JSON.stringify(items.map(({ id, subject, from, to }) => ({ id, subject, from, to }))).replace(/'/g, "''");
  return `-- Syllabus v2 re-tag: ${items.length} question(s). Needs migration 20261031130000_syllabus_v2.\nselect public.apply_syllabus_retag('${json}'::jsonb) as moved;\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = process.argv[2] || RETAG_FILE;
  const items = JSON.parse(readFileSync(file, 'utf8'));
  const problems = retagProblems(items);
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  process.stdout.write(retagSql(items));
}
