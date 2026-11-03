import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Documentation integrity only. No application imports, ledger writes or providers.
const directory = path.dirname(fileURLToPath(import.meta.url));
const base = path.resolve(directory, '../..');
const root = path.resolve(base, '../../..');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const documents = ['CLAUDE-HANDOFF-2026-10-09.md', 'CLAUDE-START-PROMPT-2026-10-09.md'];
const links = [];
for (const name of documents) {
  const body = fs.readFileSync(path.join(base, name), 'utf8');
  for (const match of body.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^https?:/.test(target)) throw new Error('Unexpected external handoff reference');
    const resolved = path.resolve(base, target);
    if (!fs.existsSync(resolved)) throw new Error(`Missing link: ${name}: ${target}`);
    links.push({ document: name, target });
  }
}
const freezes = [
  ['v78-local-contract-freeze.json', ['file_sha256', 'test_sha256']],
  ['v77-local-contract-freeze.json', ['file_sha256']],
  ['v77-local-transport-freeze.json', ['files']],
  ['execution/v77-final-source-prep/receipt-recovery-freeze.json', ['files']],
];
const bindings = [];
for (const [name, groups] of freezes) {
  const manifest = read(path.join(base, name));
  for (const group of groups) {
    if (!manifest[group]) throw new Error(`Missing frozen hash group: ${name}:${group}`);
    for (const [relative, expected] of Object.entries(manifest[group])) {
      const actual = sha(path.join(root, relative));
      if (actual !== expected) throw new Error(`Frozen bytes changed: ${relative}`);
      bindings.push({ freeze: name, path: relative, sha256: actual });
    }
  }
}
const freeze = read(path.join(base, 'v78-local-contract-freeze.json'));
const exportName = 'execution/v77-final-export-2026-10-09/all-cases.json';
if (sha(path.join(base, exportName)) !== freeze.preservation.inspected_native_export_sha256) {
  throw new Error('Inspected native export changed');
}
const required = [
  'AGENTS.md', 'PRODUCT.md', 'DESIGN.md', 'docs/brain/README.md',
  'docs/brain/STATUS.md', 'docs/brain/QUALITY.md', 'docs/brain/GENERATOR-OPERATING-RULES.md',
  'scripts/pipeline/tools/ledgerSummary.mjs',
];
for (const name of required) if (!fs.existsSync(path.join(root, name))) throw new Error(`Missing ${name}`);
if (freeze.qualification_state !== 'unqualified' || freeze.dispatch_eligible ||
    freeze.publication_eligible || freeze.native_provider_calls !== 0) throw new Error('Snapshot state changed');
const ledger = read(path.join(directory, 'current-ledger.json'));
const result = {
  created_at: new Date().toISOString(),
  scope: 'Documentation links and immutable-file integrity; not academic qualification or a new test run.',
  checked_links: links.length,
  links,
  checked_frozen_bindings: bindings.length,
  bindings,
  native_export_unchanged: true,
  independent_document_review: 'GPT-6 Luna medium: no factual/authorization correction against reviewed evidence; spacing improved.',
  qualification: 'V7.8 local, frozen and unqualified; final V7.7 mathematically cannot pass.',
  ledger_snapshot_at: ledger.at,
  lifetime: ledger.lifetime,
  v77_scope: ledger.scope,
  provider_calls: 0,
  ledger_writes: 0,
  files: Object.fromEntries([
    ...documents.map(name => [name, sha(path.join(base, name))]),
    ...['current-ledger.json', 'current-process-state.json', 'dirty-checkout-at-handoff.txt', 'verifyHandoff.mjs']
      .map(name => [`execution/claude-handoff-2026-10-09/${name}`, sha(path.join(directory, name))]),
  ]),
};
fs.writeFileSync(path.join(directory, 'verification.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ checked_links: links.length, checked_frozen_bindings: bindings.length,
  native_export_unchanged: true, provider_calls: 0, ledger_writes: 0, result: path.join(directory, 'verification.json') }));
