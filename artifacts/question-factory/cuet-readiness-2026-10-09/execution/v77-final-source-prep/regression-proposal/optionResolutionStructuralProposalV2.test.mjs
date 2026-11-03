import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reviewOptionResolutionStructuralProposalV2 as review, proposalV2HashJSON as hashJSON, proposalV2NormalizeWhitespace as normalizeWhitespace } from './optionResolutionStructuralProposalV2.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../../../../');
const exportPath = path.join(repo, 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/v77-final-export-2026-10-09/all-cases.json');
const packetPath = path.join(repo, 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/v77-final-source-prep/blind-review-packet-v3c.json');
const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
const packet = JSON.parse(fs.readFileSync(packetPath, 'utf8'));

function makeInput({ options, body = 'Classify the complete option using the supplied rule.', quote = 'The rule excludes four months and above.', rows } = {}) {
  const evidenceCatalog = [{ id: 'E1', source_id: 'source-1', locator: 'page-1, paragraph-1', quote, identity_sha256: 'a'.repeat(64), start: 0, end: quote.length }];
  const matrix = rows || options.map((o, i) => ({
    option: o.key,
    exact_option_text: o.text,
    clauses: [{ clause: o.text, status: i === 0 ? 'support' : 'contradiction', decisive_context: 'Apply the cited rule to the printed input.',
      rationale: 'The exact source rule and whole option determine this clause.', basis: 'arithmetic',
      contradiction_basis: i === 0 ? 'none' : 'arithmetic_result', evidence_ids: ['E1'], premises: [o.text, quote] }],
  }));
  const contentHash = 'b'.repeat(64);
  const result = { candidate_id: 'fixture-case', content_hash: contentHash, solved_key: 'A', evidence_ids: ['E1'], evidence_selection_valid: true,
    supporting_spans: [{ source_id: evidenceCatalog[0].source_id, locator: evidenceCatalog[0].locator, quote, start: 0, end: quote.length }],
    option_resolution_matrix: matrix };
  const view = { candidate_id: 'fixture-case', content_hash: contentHash, body, options };
  const base = { proposalOptIn: true, route: 'local_regression_proposal', result, view, evidenceCatalog, semanticAudit: null };
  const structural = review(base).structural;
  const clauseReviews = [];
  for (const row of matrix) for (const clause of row.clauses || []) {
    const bindings = structural.premise_bindings.find(x => x.option === row.option && x.clause === clause.clause)?.bindings || [];
    clauseReviews.push({ option: row.option, exact_option_text: row.exact_option_text, clause: clause.clause, status: clause.status,
      basis: clause.basis, contradiction_basis: clause.contradiction_basis, evidence_ids: clause.evidence_ids, premises: clause.premises,
      premise_bindings: bindings, whole_claim_checked: true, printed_option_claims_verified: true, rationale: 'Independently reviewed this exact clause against its bound premises.',
      direct_conflict_verified: clause.status === 'contradiction', source_silence_used: false,
      ...(clause.status === 'unresolved' ? { unresolved_reason: 'The source is silent on this separate detail.' } : {}) });
  }
  const wholeOptions = matrix.map(row => ({ option: row.option,
    status: row.clauses.some(c => c.status === 'contradiction') ? 'contradiction' : row.clauses.some(c => c.status === 'unresolved') ? 'unresolved' : 'support',
    whole_option_checked: true, rationale: 'Reviewed the complete printed option and combined its clause statuses.' }));
  base.semanticAudit = { independent_semantic_audit: true, auditor_id: 'synthetic-reviewer-fixture', case_id: view.candidate_id,
    content_hash: view.content_hash, option_resolution_matrix_sha256: hashJSON(matrix), evidence_catalog_sha256: hashJSON(evidenceCatalog),
    whole_option_reviewed: true, printed_option_claims_verified: true, selected_key: 'A', clause_reviews: clauseReviews, whole_options: wholeOptions };
  return base;
}

function actualInput(caseId, provider) {
  const item = exported.all_cases.find(c => c.fixture.id === caseId);
  const native = item.independent_native_solutions[provider];
  const spanById = new Map(native.evidence_ids.map((id, i) => [id, native.supporting_spans[i]]));
  const blindCase = packet.cases.find(c => c.id === caseId);
  const evidenceCatalog = native.evidence_ids.map(id => {
    const span = spanById.get(id);
    const source = blindCase.sources.find(s => s.id === span?.source_id);
    return { id, ...span, identity_sha256: source?.identity_sha256 };
  });
  const view = { candidate_id: item.fixture.id, content_hash: native.content_hash, body: item.fixture.candidate.body, options: item.fixture.candidate.options };
  const result = { candidate_id: native.candidate_id, content_hash: native.content_hash, solved_key: native.solved_key, evidence_ids: native.evidence_ids,
    evidence_selection_valid: native.evidence_selection_valid, option_resolution_matrix: native.option_resolution_matrix,
    supporting_spans: native.supporting_spans };
  return { proposalOptIn: true, route: 'local_regression_proposal', result, view, evidenceCatalog, semanticAudit: null };
}

const options = [{ key: 'A', text: 'Two months' }, { key: 'B', text: 'Four months' }, { key: 'C', text: 'Five years' }, { key: 'D', text: 'One year' }];

test('positive arithmetic fixture passes all structural and clause-audit bindings but cannot publish', () => {
  const output = review(makeInput({ options }));
  assert.equal(output.structural.passed, true, JSON.stringify(output.structural.issues));
  assert.equal(output.semantic.passed, true, JSON.stringify(output.semantic.issues));
  assert.equal(output.passed, true);
  assert.equal(output.publication_eligible, false);
  assert.equal(output.dispatch_eligible, false);
});

test('excerpt clauses may bind exact source premises plus exact stem facts, but never option inputs', () => {
  const input = actualInput('v77f-073bdc31e03c', 'openai');
  const output = review(input);
  const row = output.structural.premise_bindings.find(x => x.option === 'A');
  assert.ok(row?.bindings.some(b => b.kind === 'stem' && b.premise === 'A company pays cash to acquire a delivery van for use over several years.'));
  assert.ok(row?.bindings.some(b => b.kind === 'excerpt' && b.premise === 'Cash payments to acquire fixed assets including intangibles and capitalised research and development.'));
  assert.equal(output.structural.issues.some(x => x.includes('excerpt_requires_bound_source')), false);
  assert.equal(output.structural.issues.some(x => x.startsWith('premise_unbound:A')), false);

  const forgedExcerpt = makeInput({ options, rows: [
    { option: 'A', exact_option_text: options[0].text, clauses: [{ clause: options[0].text, status: 'support', decisive_context: 'context', rationale: 'reason', basis: 'excerpt', contradiction_basis: 'none', evidence_ids: ['E1'], premises: [options[0].text, 'The rule excludes four months and above.'] }] },
    ...options.slice(1).map(o => ({ option: o.key, exact_option_text: o.text, clauses: [{ clause: o.text, status: 'contradiction', decisive_context: 'context', rationale: 'reason', basis: 'arithmetic', contradiction_basis: 'arithmetic_result', evidence_ids: ['E1'], premises: [o.text, 'The rule excludes four months and above.'] }] }))
  ] });
  const forgedResult = review(forgedExcerpt);
  assert.ok(forgedResult.structural.issues.some(x => x.startsWith('premise_unbound:A')),
    'an option phrase must not be laundered into an excerpt premise merely because another cited premise is exact');
});

test('stem basis requires all premises from body; printed options are arithmetic inputs only', () => {
  const input = makeInput({ options, body: 'This stem states only a dated investment.' });
  input.result.option_resolution_matrix[1].clauses[0].basis = 'stem';
  input.result.option_resolution_matrix[1].clauses[0].contradiction_basis = 'explicit_stem_negation';
  input.result.option_resolution_matrix[1].clauses[0].premises = ['Four months'];
  const output = review(input);
  assert.ok(output.structural.issues.some(x => x.startsWith('premise_unbound:B')));
  assert.ok(output.structural.issues.some(x => x.startsWith('stem_requires_all_premises_from_body:B')));
});

test('whole-option audit must match every matrix clause, its exact provenance and status', () => {
  const statusMismatch = makeInput({ options });
  const contradictoryClaim = statusMismatch.semanticAudit.clause_reviews.find(c => c.option === 'A');
  contradictoryClaim.status = 'contradiction';
  contradictoryClaim.contradiction_basis = 'source_contradiction';
  contradictoryClaim.direct_conflict_verified = true;
  statusMismatch.semanticAudit.whole_options[0].status = 'contradiction';
  const mismatch = review(statusMismatch);
  assert.ok(mismatch.semantic.issues.some(x => x.startsWith('semantic_clause_does_not_match_claimed_matrix:A')));
  assert.ok(mismatch.semantic.issues.includes('semantic_whole_option_uniqueness_failed'));

  const provenanceMismatch = makeInput({ options });
  provenanceMismatch.semanticAudit.clause_reviews[0].premise_bindings[0].kind = 'excerpt';
  assert.ok(review(provenanceMismatch).semantic.issues.some(x => x.startsWith('semantic_clause_does_not_match_claimed_matrix:A')));

  const missingClause = makeInput({ options });
  missingClause.semanticAudit.clause_reviews.pop();
  assert.ok(review(missingClause).semantic.issues.includes('semantic_audit_requires_every_matrix_clause_once'));
});

test('a proven false clause may defeat a rival that has a separate truthful unresolved detail', () => {
  const baseRows = options.map((o, i) => ({ option: o.key, exact_option_text: o.text, clauses: [{ clause: o.text,
    status: i === 0 ? 'support' : 'contradiction', decisive_context: 'context', rationale: 'reason', basis: 'arithmetic',
    contradiction_basis: i === 0 ? 'none' : 'arithmetic_result', evidence_ids: ['E1'], premises: [o.text, 'The rule excludes four months and above.'] }] }));
  baseRows[1].clauses = [
    { clause: 'Four months', status: 'contradiction', decisive_context: 'context', rationale: 'The quoted cutoff excludes four months.', basis: 'arithmetic', contradiction_basis: 'arithmetic_result', evidence_ids: ['E1'], premises: ['Four months', 'The rule excludes four months and above.'] },
    { clause: ' (unlisted redemption feature)', status: 'unresolved', decisive_context: 'context', rationale: 'The source does not state this detail.', basis: 'excerpt', contradiction_basis: 'none', evidence_ids: ['E1'], premises: ['The rule excludes four months and above.'] },
  ];
  baseRows[1].exact_option_text = 'Four months (unlisted redemption feature)';
  const expandedOptions = [options[0], { key: 'B', text: 'Four months (unlisted redemption feature)' }, options[2], options[3]];
  const input = makeInput({ options: expandedOptions, rows: baseRows });
  const reviewB = input.semanticAudit.clause_reviews.filter(c => c.option === 'B');
  reviewB[1].status = 'unresolved';
  reviewB[1].source_silence_used = true;
  reviewB[1].unresolved_reason = 'No source statement addresses the extra redemption feature.';
  input.semanticAudit.whole_options.find(d => d.option === 'B').status = 'contradiction';
  const output = review(input);
  assert.equal(output.structural.passed, true, JSON.stringify(output.structural.issues));
  assert.equal(output.semantic.passed, true, JSON.stringify(output.semantic.issues));
  assert.equal(output.semantic.unresolved_options.includes('B'), false,
    'the conjunction is decisively false even though a separate nondecisive clause remains unresolved');
});

test('PDF line wraps normalize; omitted words, ellipses, changed numbers and negation do not', () => {
  const lineWrap = makeInput({ options, quote: 'Staffing has been described as the function of filling\nand keeping filled the positions. This is achieved by identifying\nrequirement of work force, followed by recruitment, selection.' });
  lineWrap.result.option_resolution_matrix[0].clauses[0].basis = 'excerpt';
  lineWrap.result.option_resolution_matrix[0].clauses[0].premises = ['Staffing has been described as the function of filling and keeping filled the positions. This is achieved by identifying requirement of work force, followed by recruitment, selection.'];
  const lineOutput = review(lineWrap);
  assert.ok(lineOutput.structural.premise_bindings.some(r => r.option === 'A' && r.bindings.some(b => b.kind === 'excerpt')));
  assert.equal(normalizeWhitespace('word\n wrap\tquote'), 'word wrap quote');

  const rejectedPairs = [
    ['Staffing has been described as the function of filling and keeping filled the positions. This is achieved by identifying requirement of work force, followed by recruitment, selection.', 'Staffing has been described as ... identifying requirement and selection.'],
    ['The rule excludes four months and above.', 'The rule excludes five months and above.'],
    ['The rule does not include four months and above.', 'The rule does include four months and above.'],
  ];
  for (const [sourceQuote, changedPremise] of rejectedPairs) {
    const input = makeInput({ options, quote: sourceQuote });
    if (sourceQuote.startsWith('Staffing')) {
      input.result.option_resolution_matrix[0].clauses[0].basis = 'excerpt';
      input.result.option_resolution_matrix[0].clauses[0].premises = [changedPremise];
    } else input.result.option_resolution_matrix[0].clauses[0].premises = ['Two months', changedPremise];
    const out = review(input);
    assert.ok(out.structural.issues.some(x => x.startsWith('premise_unbound:A')), changedPremise);
  }
});

test('identity hashes, source spans, row shapes and clause shapes fail closed without throwing', () => {
  const forged = makeInput({ options });
  forged.evidenceCatalog[0].identity_sha256 = 'bad';
  assert.ok(review(forged).structural.issues.includes('evidence_identity_catalog_invalid'));

  const malformedCatalog = makeInput({ options });
  malformedCatalog.evidenceCatalog.push(null);
  assert.ok(review(malformedCatalog).structural.issues.includes('evidence_identity_catalog_invalid'));

  const forgedSpan = makeInput({ options });
  forgedSpan.result.supporting_spans[0].quote = 'forged';
  assert.ok(review(forgedSpan).structural.issues.some(x => x.startsWith('supporting_spans_mismatch:')), JSON.stringify(review(forgedSpan).structural.issues));

  const nullClause = makeInput({ options });
  nullClause.result.option_resolution_matrix[0].clauses = [null];
  assert.doesNotThrow(() => review(nullClause));
  assert.ok(review(nullClause).structural.issues.some(x => x.startsWith('option_clauses_required_or_malformed:A')));

  const nullRow = makeInput({ options });
  nullRow.result.option_resolution_matrix[0] = null;
  assert.doesNotThrow(() => review(nullRow));
  assert.ok(review(nullRow).structural.issues.includes('matrix_requires_all_four_options'));

  const nullAudit = makeInput({ options });
  nullAudit.semanticAudit.whole_options[0] = null;
  assert.doesNotThrow(() => review(nullAudit));
  assert.ok(review(nullAudit).semantic.issues.includes('semantic_audit_requires_all_four_whole_options'));

  assert.doesNotThrow(() => review(null));
  assert.ok(review(null).structural.issues.includes('proposal_opt_in_required'));

  const nullPrintedText = makeInput({ options });
  nullPrintedText.view.options[0].text = null;
  nullPrintedText.result.option_resolution_matrix[0].exact_option_text = null;
  assert.doesNotThrow(() => review(nullPrintedText));
  assert.ok(review(nullPrintedText).structural.issues.includes('exactly_four_printed_options_required'));
});

test('malformed word substrings do not bind inside larger source words', () => {
  const input = makeInput({ options, quote: 'The source uses the word cashflow.' });
  input.result.option_resolution_matrix[0].clauses[0].premises = ['Two months', 'cash'];
  assert.ok(review(input).structural.issues.some(x => x.startsWith('premise_unbound:A')));
});

test('overlapping source and stem phrases require explicit provenance instead of a silent priority guess', () => {
  const repeated = 'The exact phrase appears in both places.';
  const input = makeInput({ options, body: repeated, quote: repeated });
  input.result.option_resolution_matrix[0].clauses[0].basis = 'excerpt';
  input.result.option_resolution_matrix[0].clauses[0].premises = [repeated];
  const output = review(input);
  assert.ok(output.structural.issues.includes('premise_provenance_ambiguous:A'));
  assert.equal(output.structural.premise_bindings.find(r => r.option === 'A').bindings[0].kind, 'ambiguous');
});

test('actual controls preserve context/source distinctions and test V2 against frozen imports', () => {
  const van = review(actualInput('v77f-073bdc31e03c', 'openai'));
  assert.equal(van.structural.issues.some(x => x.startsWith('premise_unbound:A')), false,
    'mixed stem facts plus an exact source rule bind for the OpenAI van matrix');
  const vanGemini = review(actualInput('v77f-073bdc31e03c', 'gemini'));
  assert.ok(vanGemini.structural.issues.some(x => x.startsWith('premise_unbound:A')),
    'Gemini paraphrased premise remains unbound');
  const staffingOpenAI = review(actualInput('v77f-3546cbf8ea19', 'openai'));
  assert.equal(staffingOpenAI.structural.issues.some(x => x.startsWith('premise_unbound:A')), false);
  const staffingGemini = review(actualInput('v77f-3546cbf8ea19', 'gemini'));
  assert.ok(staffingGemini.structural.issues.some(x => x.startsWith('premise_unbound:A')));
  const resolver = fs.readFileSync(path.join(repo, 'scripts/pipeline/lib/optionResolutionV77.mjs'), 'utf8');
  assert.equal(resolver.includes('optionResolutionStructuralProposalV2'), false);
});
