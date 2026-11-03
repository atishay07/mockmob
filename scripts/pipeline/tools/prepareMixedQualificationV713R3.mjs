// Prospective mixed-role study. No requests, labels changed, outcomes excluded, or source-registry writes.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { establishMixedCustodyV713R3 } from '../lib/mixedCustodyV713R3.mjs';
import { validationContractV713 } from '../lib/contractV713.mjs';
import { loadNcertColumnsOverlayV1, applyNcertColumnsV1 } from '../lib/ncertColumnsRegistryV1.mjs';
import { hashJSON, provenanceReasons } from '../../../data/question_factory_policy.mjs';
import { contentHash } from '../../../data/content_evidence.js';
import { payloadHash } from '../lib/cuetFitBenchmark.mjs';
import { expectedReleaseBindingV713 } from '../lib/releaseEvidenceV713.mjs';
import { structureVerdict } from '../lib/evidencePipeline.mjs';
import { presentationLint } from '../../../data/question_presentation.mjs';
const base = resolve('artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v713');
const custody = resolve(base, 'fresh-custody'), directory = resolve(base, 'qualification-fresh31-regression6');
const legacyBase = resolve('artifacts/question-factory/cuet-readiness-2026-10-09/benchmark/v75-fresh-cbse2022-2026-10-09');
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const save = (p, data) => writeFileSync(p, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
if (existsSync(resolve(directory, 'frozen.json'))) throw Error('mixed_study_already_frozen');
const freezePath = resolve(base, 'CONTRACT-FREEZE.json'), freeze = read(freezePath), freezeSha = sha(freezePath);
if (freeze.validation_contract_hash !== validationContractV713()) throw Error('academic_contract_changed');
for (const [p, h] of Object.entries(freeze.files)) if (sha(p) !== h) throw Error('frozen_dependency_changed:' + p);
const files = { authored: 'sealed/authored-r3.json', sealed_blind_map: 'sealed/map-r3.json', blind_packet: 'blind/packet-r3.json',
  blind_output: 'blind/output-r3.json', blind_freeze: 'blind/blind-freeze-r3.json', reveal: 'sealed/reveal-r3.json',
  explanation_audit: 'sealed/explanation-audit-r3.json', novelty_report: 'sealed/novelty-r3-history-refresh.json',
  explanation_audit_clarification: 'sealed/explanation-audit-clarification-r3.json' };
const refs = Object.fromEntries(Object.entries(files).map(([k, file]) => { const p = resolve(custody, file); return [k, { path: p, sha256: sha(p) }]; }));
if (refs.novelty_report.sha256 !== '80f6d5cfec72f8673abc84543746f87e2a9173eb0230b8ab4cf52dbec9dfec04') throw Error('independently_reviewed_novelty_changed');
if (refs.explanation_audit_clarification.sha256 !== 'f7f89a46a845997126ed97d7995b2b9236ff87ad9b4cc3f3c03cff0df849d7e0') throw Error('independent_audit_clarification_changed');
const author = read(refs.authored.path), map = read(refs.sealed_blind_map.path), output = read(refs.blind_output.path);
const novelty = new Map(read(refs.novelty_report.path).items.map(row => [row.fixture_id, row]));
const mappings = new Map(map.rows.map(row => [row.fixture_id, row.opaque_id]));
const answers = new Map(output.items.map(row => [row.opaque_id, row]));
const input = { id: author.study_id, custody: { schema: 'cuet-v713-custody-v2', study_id: author.study_id,
  freeze_sha256: freezeSha, custody_basis: 'local_delegated_review', artifacts: refs }, fixtures: author.items.map(item => {
    const blind = answers.get(mappings.get(item.id));
    if (!blind) throw Error('blind_coverage_missing');
    return { ...item, subject: item.candidate.subject, contested: false,
      measurement_role: novelty.get(item.id)?.unique === true ? 'fresh' : 'regression',
      category: item.expected_valid ? 'valid_control' : item.defect_category,
      oracle: { key: blind.solved_key, basis: blind.decisive_basis, source_refs: item.candidate.source_refs } };
  }) };
const verified = establishMixedCustodyV713R3(input, freeze, freezeSha);
const overlay = loadNcertColumnsOverlayV1('data/question-factory-runtime/source-registry-ncert-columns-v2.json');
const registry = structuredClone(applyNcertColumnsV1(read('data/source_registry.json'), overlay.overlay));
const legacyFrozenPath = resolve(legacyBase, 'frozen.json'), legacyOverlayPath = resolve(legacyBase, 'scratch-registry-overlay.json');
const legacyPlanPath = resolve(legacyBase, 'run/execution-plan.json'), legacyPlan = read(legacyPlanPath);
const legacyCustodyPath = resolve(legacyBase, 'independent-key-custody.json');
if (hashJSON(legacyPlan.source_registry) !== legacyPlan.source_registry_hash) throw Error('historical_run_snapshot_hash_invalid');
const legacy = structuredClone(read(legacyFrozenPath).fixtures.find(f => f.id === 'v75f-825e60a00f'));
if (!legacy || legacy.expected_valid !== false || legacy.group !== 'controlled_defect') throw Error('historical_label_changed');
const snapshot = read(legacyOverlayPath);
// Only this regression's exact five excerpt records, pack, family enter the test-only registry.
for (const ref of legacy.candidate.source_refs) {
  if (registry.sources[ref.id] || !snapshot.sources[ref.id]) throw Error('historical_source_collision_or_missing');
  if (hashJSON(snapshot.sources[ref.id]) !== hashJSON(legacyPlan.source_registry.sources[ref.id])) throw Error('historical_source_not_original_snapshot');
  registry.sources[ref.id] = structuredClone(snapshot.sources[ref.id]);
}
const packId = legacy.candidate.provenance.source_pack_id, familyId = legacy.candidate.family_id;
if (registry.packs[packId] || registry.families[familyId] || !snapshot.packs[packId] || !snapshot.families[familyId]) throw Error('historical_pack_collision_or_missing');
if (hashJSON(snapshot.packs[packId]) !== hashJSON(legacyPlan.source_registry.packs[packId]) ||
    hashJSON(snapshot.families[familyId]) !== hashJSON(legacyPlan.source_registry.families[familyId])) throw Error('historical_pack_not_original_snapshot');
registry.packs[packId] = structuredClone(snapshot.packs[packId]); registry.families[familyId] = structuredClone(snapshot.families[familyId]);
legacy.subject = legacy.candidate.subject; legacy.measurement_role = 'regression';
legacy.regression_limitation = 'Preserved disputed natural multiple-defensible label. Source-keyed CBSE practice, not fresh CUET evidence. No historical oracle is in provider blind views.';
const fixtures = [...input.fixtures, legacy];
for (const subject of ['accountancy', 'business_studies', 'economics', 'english']) {
  if (input.fixtures.filter(f => f.subject === subject && f.expected_valid).length !== 5 ||
      input.fixtures.filter(f => f.subject === subject && !f.expected_valid).length !== 4) throw Error('original_subject_denominator_changed');
}
for (const f of fixtures) {
  const c = f.candidate;
  if (f.id !== legacy.id) {
    f.independent_custody = verified.established.get(f.id);
    registry.families[c.family_id] = { state: 'active', version: 1, subject: c.subject, kind: 'original_practice', note: 'qualification only; never publish' };
  }
  for (const r of c.source_refs) {
    const s = registry.sources[r.id];
    if (!s || s.state !== 'active' || s.version !== r.version || !s.reuse_permitted || s.supports?.[r.locator] !== r.support_hash ||
        hashJSON(s.facts?.[r.locator]?.text) !== r.support_hash) throw Error('source_custody_invalid:' + f.id);
    if (f.id !== legacy.id) {
      const p = verified.packet.items.find(row => row.opaque_id === mappings.get(f.id));
      if (!p.excerpts.some(e => e.source_id === r.id && e.locator === r.locator && e.support_hash === r.support_hash && e.text === s.facts[r.locator].text)) throw Error('blind_excerpt_changed:' + f.id);
    }
  }
  f.local_findings = [...structureVerdict(c).reasons, ...presentationLint(c), ...provenanceReasons(c, registry)];
  if ((f.expected_valid || f.id === legacy.id) && f.local_findings.length) throw Error('fixture_local_failure:' + f.id + ':' + f.local_findings.join(','));
  f.content_hash = contentHash(c);
}
const roleIds = role => fixtures.filter(f => f.measurement_role === role).map(f => f.id);
if (roleIds('fresh').length !== 31 || roleIds('regression').length !== 6 || fixtures.filter(f => f.expected_valid).length !== 20) throw Error('joint37_required');
const frozen = { id: 'cuet-v713-final-fresh31-regression6', created_at: new Date().toISOString(),
  verifier_contract: validationContractV713(), execution_freeze_path: freezePath, execution_freeze_sha256: freezeSha,
  denominator: 37, valid_roots: 20, controlled_defects: 17, decision_rule: freeze.decision_rule,
  additional_rule: 'Fresh partition alone must also achieve >=85% valid survival pooled and >=70% per subject. The unchanged joint 20-valid gate and zero false accepts across every invalid case still apply.',
  validity_by_role: { fresh: { valid: 18, invalid: 13 }, regression: { valid: 2, invalid: 4 } },
  publication: 'never', exclusions: [], custody: input.custody, role_ids: { fresh: roleIds('fresh'), regression: roleIds('regression') },
  historical_snapshot: { frozen_path: legacyFrozenPath, frozen_sha256: sha(legacyFrozenPath),
    execution_plan_path: legacyPlanPath, execution_plan_sha256: sha(legacyPlanPath), source_registry_hash: legacyPlan.source_registry_hash,
    independent_custody_path: legacyCustodyPath, independent_custody_sha256: sha(legacyCustodyPath),
    overlay_path: legacyOverlayPath, overlay_sha256: sha(legacyOverlayPath), scoped_source_ids: legacy.candidate.source_refs.map(r => r.id) },
  construction: 'Original 36 IDs/labels/content retained. Pre-evaluation independent novelty assigns five nonunique cases (two valid, three invalid) to regression; unchanged historical V75 false accept adds the sixth. Not 37 fresh cases. All 17 invalid count; no model outcome informed roles.',
  limitations: ['Compact targeted study does not establish broad CUET representativeness or a premium-quality rating.',
    'Seven author difficulty bands differ from the frozen independent reviewer; no post-evaluation relabeling is permitted.',
    'All costs including failures and held usage count; one aggregate USD1 stop cap does not guarantee completion.'],
  cap_usd: 1, repairs: 0, replacements: 0, payload_hash: hashJSON(fixtures), fixtures };
mkdirSync(directory, { recursive: true });
save(resolve(directory, 'registry.json'), registry); save(resolve(directory, 'frozen.json'), frozen);
const binding = expectedReleaseBindingV713();
for (const role of ['fresh', 'regression']) {
  const rows = fixtures.filter(f => f.measurement_role === role);
  save(resolve(directory, 'release-' + role + '-envelope.json'), { ...frozen, id: frozen.id + '-' + role,
    denominator: rows.length, fixtures: rows, payload_hash: payloadHash(rows), verifier_version: binding.verifier_version,
    contract_binding: binding, underlying_frozen_path: resolve(directory, 'frozen.json'), underlying_frozen_sha256: sha(resolve(directory, 'frozen.json')),
    release_eligibility: { scope: role === 'fresh' ? 'full_cuet_release' : 'regression', classification: role,
      approved_before_evaluation: true, previously_read: role !== 'fresh', tuned_on: role !== 'fresh',
      preregistration_id: frozen.id, custody_basis: input.custody.custody_basis } });
}
console.log(JSON.stringify({ directory, denominator: 37, fresh: 31, regression: 6, valid: 20, invalid: 17, model_calls: 0 }));
