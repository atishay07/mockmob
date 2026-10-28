// No provider calls. All author, blind, and explanation-audit custody precedes this immutable assembly.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { validationContractV713 } from '../lib/contractV713.mjs';
import { loadNcertColumnsOverlayV1, applyNcertColumnsV1 } from '../lib/ncertColumnsRegistryV1.mjs';
import { hashJSON, provenanceReasons } from '../../../data/question_factory_policy.mjs';
import { contentHash } from '../../../data/content_evidence.js';
import { structureVerdict } from '../lib/evidencePipeline.mjs';
import { presentationLint } from '../../../data/question_presentation.mjs';
import { establishFreshCustodyV713 } from '../lib/freshCustodyV713.mjs';
const [inputPath, freezePath, outPath] = process.argv.slice(2);
if (!inputPath || !freezePath || !outPath) throw Error('input_freeze_output_required');
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const freeze = read(freezePath), input = read(inputPath), directory = resolve(outPath);
if (existsSync(resolve(directory, 'frozen.json'))) throw Error('fresh_study_already_frozen');
if (freeze.validation_contract_hash !== validationContractV713()) throw Error('contract_changed_after_freeze');
for (const [p, digest] of Object.entries(freeze.files)) if (sha(p) !== digest) throw Error('execution_freeze_changed:' + p);
if (input.decision_rule !== freeze.decision_rule || input.publication !== 'never') throw Error('fresh_rule_or_publication_changed');
const overlay = loadNcertColumnsOverlayV1('data/question-factory-runtime/source-registry-ncert-columns-v2.json');
const registry = applyNcertColumnsV1(read('data/source_registry.json'), overlay.overlay);
const subjects = ['accountancy', 'business_studies', 'economics', 'english'];
const fixtures = input.fixtures, families = {};
if (!Array.isArray(fixtures) || fixtures.length !== 36 || new Set(fixtures.map(f => f.id)).size !== 36) throw Error('fixed_36_required');
const custody = establishFreshCustodyV713(input, freeze, sha(freezePath));
for (const subject of subjects) {
  if (fixtures.filter(f => f.subject === subject && f.expected_valid === true).length !== 5 ||
      fixtures.filter(f => f.subject === subject && f.expected_valid === false).length !== 4) throw Error('five_valid_four_defects_each_subject_required');
}
for (const f of fixtures) {
  const c = f.candidate;
  f.independent_custody = custody.established.get(f.id);
  if (f.group !== (f.expected_valid ? 'authored_valid' : 'controlled_defect')) throw Error('fixture_denominator_group_invalid:' + f.id);
  if (!c || c.id !== f.id || c.subject !== f.subject || !c.family_id || !Array.isArray(c.source_refs) || !c.source_refs.length ||
      !f.independent_custody?.complete || f.contested || !f.independent_custody.decisive_basis) throw Error('fixture_custody_missing:' + f.id);
  if (f.expected_valid && (f.independent_custody.solved_key !== c.correct_answer || f.independent_custody.mandatory_gates_passed !== true ||
      f.independent_custody.explanation_supported !== true)) throw Error('positive_fixture_not_established:' + f.id);
  if (!f.expected_valid && (!f.defect_category || !f.defect_evidence || f.independent_custody.defect_confirmed !== true)) throw Error('negative_fixture_not_established:' + f.id);
  families[c.family_id] = { state: 'active', version: 1, subject: c.subject, kind: 'original_practice', note: 'fresh V713 qualification fixture; never publish' };
  for (const r of c.source_refs) {
    const s = registry.sources[r.id];
    if (!s || s.state !== 'active' || s.version !== r.version || !s.reuse_permitted || s.supports?.[r.locator] !== r.support_hash ||
        hashJSON(s.facts?.[r.locator]?.text) !== r.support_hash) throw Error('fixture_source_custody_invalid:' + f.id);
    const packet = custody.packet.items.find(p => p.opaque_id === custody.artifacts.sealed_blind_map.rows.find(m => m.fixture_id === f.id).opaque_id);
    if (!packet.excerpts.some(e => e.source_id === r.id && e.locator === r.locator && e.support_hash === r.support_hash && e.text === s.facts[r.locator].text)) throw Error('blind_source_excerpt_changed:' + f.id);
  }
  const local = [...structureVerdict(c).reasons, ...presentationLint(c), ...provenanceReasons(c, { ...registry, families: { ...registry.families, ...families } })];
  if (f.expected_valid && local.length) throw Error('positive_fixture_local_failure:' + f.id + ':' + local.join(','));
  f.content_hash = contentHash(c); f.local_findings = local;
}
const frozen = { id: input.id, created_at: new Date().toISOString(), verifier_contract: validationContractV713(),
  execution_freeze_sha256: sha(freezePath), execution_freeze_path: resolve(freezePath),
  ncert_columns_overlay_sha256: overlay.sha256, denominator: 36, valid_roots: 20, controlled_defects: 16,
  decision_rule: freeze.decision_rule, publication: 'never', custody: input.custody,
  construction: 'Luna authored after freeze; separate source-only blind custody, output frozen before key reveal; explanation/novelty audits before immutable assembly',
  payload_hash: hashJSON(fixtures), fixtures, exclusions: input.exclusions || [] };
mkdirSync(directory, { recursive: true });
writeFileSync(resolve(directory, 'registry.json'), JSON.stringify({ ...registry, families: { ...registry.families, ...families } }, null, 2), { flag: 'wx' });
writeFileSync(resolve(directory, 'frozen.json'), JSON.stringify(frozen, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ frozen: directory, denominator: 36, valid: 20, defects: 16, paid_calls: 0 }));
