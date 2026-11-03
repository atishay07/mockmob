import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reviewOptionResolutionStructuralProposal, proposalHashJSON, proposalNormalizeWhitespace } from './optionResolutionStructuralProposal.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../../../../');
const resultPath = path.join(repo, 'artifacts/question-factory/cuet-readiness-2026-10-09/v77-qualification/v77-qualification-2026-10-09-final-fresh-integrated/run/results.json');
const packetPath = path.join(repo, 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/v77-final-source-prep/blind-review-packet-v3c.json');
const results = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
const packet = JSON.parse(fs.readFileSync(packetPath, 'utf8'));

function proposalInput({ options, body = 'Classify using the stated source rule.', quote = 'The rule is three months or less.', rows, solvedKey = 'A', candidateId = 'test-case', contentHash = 'test-content' }) {
  const catalog = [{ id: 'E1', source_id: 'src-1', locator: 'page-1, line 1', quote }];
  const matrix = rows || options.map((o, i) => ({
    option: o.key,
    exact_option_text: o.text,
    clauses: [{ clause: o.text, status: i === 0 ? 'support' : 'contradiction', decisive_context: 'Apply the source rule to the option.',
      rationale: 'The complete option is classified against the source rule.', basis: 'arithmetic',
      contradiction_basis: i === 0 ? 'none' : 'arithmetic_result', evidence_ids: ['E1'],
      premises: [o.text, quote] }],
  }));
  const result = { candidate_id: candidateId, content_hash: contentHash, solved_key: solvedKey, evidence_ids: ['E1'],
    evidence_selection_valid: true, supporting_spans: [{ source_id: catalog[0].source_id, locator: catalog[0].locator, quote }], option_resolution_matrix: matrix };
  const audit = { independent_semantic_audit: true, auditor_id: 'reviewer-independent-01', case_id: candidateId, content_hash: contentHash,
    option_resolution_matrix_sha256: proposalHashJSON(matrix), evidence_catalog_sha256: proposalHashJSON(catalog), whole_option_reviewed: true,
    printed_option_claims_verified: true, selected_key: solvedKey, unique_answer: true,
    option_decisions: options.map((o, i) => ({ option: o.key, whole_option_checked: true, printed_option_claims_verified: true,
      rationale: 'Independently assessed the complete assertion.', status: i === 0 ? 'support' : 'contradiction', evidence_ids: ['E1'],
      stem_premises: [], direct_conflict_verified: i !== 0, source_silence_used: false })) };
  return { proposalOptIn: true, route: 'local_regression_proposal', result, view: { candidate_id: candidateId, content_hash: contentHash, body, options }, evidenceCatalog: catalog, semanticAudit: audit };
}

function actualCase(caseId, provider) {
  const c = packet.cases.find(item => item.id === caseId);
  const evaluation = results.evaluations[caseId][provider];
  const catalog = evaluation.evidence_ids.map((id, i) => ({ id, ...evaluation.supporting_spans[i] }));
  const input = { proposalOptIn: true, route: 'local_regression_proposal',
    view: { candidate_id: c.id, content_hash: evaluation.content_hash, body: c.body, options: c.options },
    result: { candidate_id: evaluation.candidate_id, content_hash: evaluation.content_hash, solved_key: evaluation.solved_key,
      evidence_ids: evaluation.evidence_ids, evidence_selection_valid: evaluation.evidence_selection_valid,
      supporting_spans: evaluation.supporting_spans, option_resolution_matrix: evaluation.option_resolution_matrix },
    evidenceCatalog: catalog, semanticAudit: null };
  return { input, evaluation };
}

test('proposal stays opt-in and cannot grant publication or dispatch eligibility', () => {
  const base = proposalInput({ options: [{ key: 'A', text: '2 months' }, { key: 'B', text: '4 months' }, { key: 'C', text: '5 years' }, { key: 'D', text: '1 year' }] });
  const noOptIn = reviewOptionResolutionStructuralProposal({ ...base, proposalOptIn: false });
  const wrongRoute = reviewOptionResolutionStructuralProposal({ ...base, route: 'publication' });
  assert.equal(noOptIn.publication_eligible, false);
  assert.equal(noOptIn.dispatch_eligible, false);
  assert.ok(noOptIn.structural.issues.includes('proposal_opt_in_required'));
  assert.ok(wrongRoute.structural.issues.includes('publication_route_forbidden'));
  const allRuntime = fs.readFileSync(path.join(repo, 'scripts/pipeline/lib/optionResolutionV77.mjs'), 'utf8');
  assert.equal(allRuntime.includes('optionResolutionStructuralProposal'), false);
});

test('a fully bound arithmetic case passes only with an independent whole-option audit', () => {
  const options = [{ key: 'A', text: '2 months' }, { key: 'B', text: '4 months' }, { key: 'C', text: '5 years' }, { key: 'D', text: '1 year' }];
  const input = proposalInput({ options });
  const evaluated = reviewOptionResolutionStructuralProposal(input);
  assert.equal(evaluated.structural.passed, true, JSON.stringify(evaluated.structural.issues));
  assert.equal(evaluated.semantic.passed, true, JSON.stringify(evaluated.semantic.issues));
  assert.equal(evaluated.passed, true);
  const missingAudit = reviewOptionResolutionStructuralProposal({ ...input, semanticAudit: null });
  assert.equal(missingAudit.passed, false);
  assert.ok(missingAudit.semantic.issues.includes('independent_semantic_audit_required'));
  assert.equal(evaluated.publication_eligible, false);
  assert.equal(evaluated.dispatch_eligible, false);
});

test('source silence remains unresolved and cannot be used to eliminate a rival', () => {
  const options = [{ key: 'A', text: '2 months' }, { key: 'B', text: '4 months' }, { key: 'C', text: '5 years' }, { key: 'D', text: '1 year' }];
  const input = proposalInput({ options });
  input.semanticAudit.option_decisions[1].status = 'unresolved';
  input.semanticAudit.option_decisions[1].source_silence_used = true;
  input.semanticAudit.option_decisions[1].direct_conflict_verified = false;
  input.semanticAudit.option_decisions[1].unresolved_reason = 'The source does not state whether this option has an unmentioned early redemption.';
  const evaluated = reviewOptionResolutionStructuralProposal(input);
  assert.equal(evaluated.passed, false);
  assert.ok(evaluated.semantic.issues.includes('semantic_unresolved_alternative:B'));
  assert.ok(evaluated.semantic.unresolved_options.includes('B'));
});

test('forged spans, partial option coverage, altered numbers and omitted words fail closed', () => {
  const options = [{ key: 'A', text: '2 months' }, { key: 'B', text: '4 months' }, { key: 'C', text: '5 years' }, { key: 'D', text: '1 year' }];
  const forged = proposalInput({ options });
  forged.result.supporting_spans[0].quote = 'A forged statement.';
  assert.ok(reviewOptionResolutionStructuralProposal(forged).structural.issues.some(x => x.startsWith('supporting_spans_mismatch:')));

  const partial = proposalInput({ options });
  partial.result.option_resolution_matrix[0].clauses[0].clause = '2';
  assert.ok(reviewOptionResolutionStructuralProposal(partial).structural.issues.some(x => x.startsWith('whole_option_clause_coverage_mismatch:')));

  const changedNumber = proposalInput({ options });
  changedNumber.result.option_resolution_matrix[0].clauses[0].premises[1] = 'The rule is four months or less.';
  assert.ok(reviewOptionResolutionStructuralProposal(changedNumber).structural.issues.some(x => x.startsWith('premise_unbound:A:')));

  const omittedWords = proposalInput({ options, quote: 'Staffing involves identifying requirement of work force, followed by recruitment and selection.' });
  omittedWords.result.option_resolution_matrix[0].clauses[0].premises[1] = 'Staffing involves identifying requirement ... recruitment and selection.';
  assert.ok(reviewOptionResolutionStructuralProposal(omittedWords).structural.issues.some(x => x.startsWith('premise_unbound:A:')));

  const changedNegation = proposalInput({ options, quote: 'The source does not classify this as a cash inflow.' });
  changedNegation.result.option_resolution_matrix[0].clauses[0].premises[1] = 'The source does classify this as a cash inflow.';
  assert.ok(reviewOptionResolutionStructuralProposal(changedNegation).structural.issues.some(x => x.startsWith('premise_unbound:A:')));
  assert.equal(proposalNormalizeWhitespace('one\n two\tthree'), 'one two three');
});

test('terminal controls: paraphrased context does not erase exact premises; paraphrased source premises still fail', () => {
  const [adOpenAI, cashPurpose, vanGemini, staffingLuna, staffingGemini] = [
    actualCase('v77f-ad344a8b5f2d', 'openai'),
    actualCase('v77f-662880a2c5fb', 'openai'),
    actualCase('v77f-073bdc31e03c', 'gemini'),
    actualCase('v77f-3546cbf8ea19', 'openai'),
    actualCase('v77f-3546cbf8ea19', 'gemini'),
  ];
  const adEval = reviewOptionResolutionStructuralProposal(adOpenAI.input);
  assert.equal(adEval.structural.issues.some(x => x.includes('decisive_context')), false);
  assert.equal(adEval.structural.issues.some(x => x.startsWith('premise_unbound:A:')), false,
    'option text is an explicit hypothetical arithmetic input, subject to semantic audit');
  assert.equal(adOpenAI.evaluation.option_resolution.reason, 'resolution_arithmetic_premises_required:A');
  assert.equal(adEval.semantic.passed, false, 'there is no independent audit here, and source-silence alternatives stay unresolved');

  const purposeEval = reviewOptionResolutionStructuralProposal(cashPurpose.input);
  assert.equal(purposeEval.structural.issues.some(x => x.includes('decisive_context')), false,
    'paraphrased context alone is not a failed premise binding');
  assert.equal(cashPurpose.evaluation.option_resolution.reason, 'resolution_excerpt_premise_invalid:A');

  const vanEval = reviewOptionResolutionStructuralProposal(vanGemini.input);
  assert.ok(vanEval.structural.issues.some(x => x.startsWith('premise_unbound:A:')),
    'a paraphrased or inferred source premise must remain rejected even when the supporting quote is authentic');

  const staffingLunaEval = reviewOptionResolutionStructuralProposal(staffingLuna.input);
  const lunaPremise = staffingLuna.evaluation.option_resolution_matrix[0].clauses[0].premises[0];
  assert.ok(staffingLunaEval.structural.premise_bindings.some(row => row.option === 'A' && row.bindings.some(b => b.kind === 'excerpt' && b.text === lunaPremise)),
    'whitespace-only PDF line wraps retain the exact word sequence and bind to the exact quoted source locator');
  const staffingGeminiEval = reviewOptionResolutionStructuralProposal(staffingGemini.input);
  assert.ok(staffingGeminiEval.structural.issues.some(x => x.startsWith('premise_unbound:A:')),
    'ellipsis and omitted source words are not whitespace normalization');
});

test('matrix and evidence hashes are independently bound by the audit', () => {
  const options = [{ key: 'A', text: '2 months' }, { key: 'B', text: '4 months' }, { key: 'C', text: '5 years' }, { key: 'D', text: '1 year' }];
  const input = proposalInput({ options });
  input.semanticAudit.option_resolution_matrix_sha256 = '0'.repeat(64);
  const evaluated = reviewOptionResolutionStructuralProposal(input);
  assert.ok(evaluated.semantic.issues.includes('semantic_audit_matrix_binding_mismatch'));
  assert.equal(input.semanticAudit.evidence_catalog_sha256, proposalHashJSON(input.evidenceCatalog));
});
