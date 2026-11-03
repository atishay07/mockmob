// Assemble the final pre-evaluation custody manifest. No provider calls or study-label changes.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { establishFreshCustodyV713 } from '../lib/freshCustodyV713.mjs';
const base = resolve('artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v713');
const custody = resolve(base, 'fresh-custody');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const files = { authored: 'sealed/authored-r3.json', sealed_blind_map: 'sealed/map-r3.json',
  blind_packet: 'blind/packet-r3.json', blind_output: 'blind/output-r3.json', blind_freeze: 'blind/blind-freeze-r3.json',
  reveal: 'sealed/reveal-r3.json', explanation_audit: 'sealed/explanation-audit-r3.json',
  novelty_report: 'sealed/novelty-r3-full-history.json' };
const refs = Object.fromEntries(Object.entries(files).map(([name, file]) => {
  const path = resolve(custody, file); return [name, { path, sha256: sha(path) }];
}));
const author = read(refs.authored.path), map = read(refs.sealed_blind_map.path), output = read(refs.blind_output.path);
const mappings = new Map(map.rows.map(row => [row.fixture_id, row.opaque_id]));
const answers = new Map(output.items.map(row => [row.opaque_id, row]));
const freezePath = resolve(base, 'CONTRACT-FREEZE.json'), freeze = read(freezePath);
const input = { id: author.study_id, decision_rule: freeze.decision_rule, publication: 'never', exclusions: [],
  construction_history: { original: resolve(custody, 'sealed/authored.json'), metadata_draft: resolve(custody, 'sealed/authored-r2.json'),
    final_correction: resolve(custody, 'sealed/construction-correction-r3.json'),
    limitation: 'One final construction correction before preregistration/native evaluation; all original IDs and expected labels retained. Independent oracle custody does not itself qualify the validator.' },
  custody: { schema: 'cuet-v713-custody-v2', study_id: author.study_id, freeze_sha256: sha(freezePath),
    custody_basis: 'local_delegated_review', artifacts: refs },
  fixtures: author.items.map(item => {
    const blind = answers.get(mappings.get(item.id));
    if (!blind) throw Error('blind_coverage_missing:' + item.id);
    return { ...item, subject: item.candidate.subject, contested: false,
      category: item.expected_valid ? 'valid_control' : item.defect_category,
      oracle: { key: blind.solved_key, basis: blind.decisive_basis, source_refs: item.candidate.source_refs } };
  }) };
establishFreshCustodyV713(input, freeze, sha(freezePath)); // Fail closed on any contested, non-unique or unestablished case.
const path = resolve(custody, 'sealed/study-input-r3.json');
writeFileSync(path, JSON.stringify(input, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ prepared: path, sha256: sha(path), denominator: input.fixtures.length,
  provider_calls: 0, qualification: 'not_evaluated', publication: 'never' }));
