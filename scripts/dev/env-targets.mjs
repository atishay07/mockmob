// Lists which checkouts point at the production Supabase project, by file and variable NAME only.
// Read-only: it prints no value, no key and no URL.
//
//   node scripts/dev/env-targets.mjs [parentDir]      (default: the folder that holds this checkout)
//
// For every sibling folder it looks at .env.local and the other .env* files (not *.example) and prints one line:
//   <folder>/<file>  production (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_URL)   |   staging (...)   |   neither
// The rule it checks is in docs/brain/LOCAL-ENV-STAGING.md: local .env.local files point at staging.
// Exit code 1 when any .env.local points at production, so it can gate a launcher.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyEnvText } from '../../data/db_target.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const parent = path.resolve(process.argv[2] || path.join(here, '..', '..', '..'));
const names = (list) => (list.length ? ` (${[...new Set(list)].join(', ')})` : '');
let productionLocal = 0;
let lines = 0;
for (const entry of fs.readdirSync(parent, { withFileTypes: true }).filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  const dir = path.join(parent, entry.name);
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => /^\.env/.test(f) && !/\.(example|sample)$/.test(f)).sort(); } catch { continue; }
  for (const file of files) {
    let text = '';
    try { text = fs.readFileSync(path.join(dir, file), 'utf8'); } catch { continue; }
    const found = classifyEnvText(text);
    const verdict = found.production.length ? `production${names(found.production)}` : found.staging.length ? `staging${names(found.staging)}` : 'neither';
    if (file === '.env.local' && found.production.length) productionLocal += 1;
    console.log(`${entry.name}/${file}  ${verdict}`);
    lines += 1;
  }
}
console.log(`\n${lines} env files; ${productionLocal} .env.local file(s) point at production.`);
process.exitCode = productionLocal ? 1 : 0;
