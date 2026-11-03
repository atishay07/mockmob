import test from 'node:test';
import assert from 'node:assert/strict';
import { containsAnchoredPremiseV78, validatePremiseBindingsV78 } from '../lib/premiseBindingV78.mjs';
import { optionResolutionSchemaV78, validateOptionResolutionV78 } from '../lib/optionResolutionV78.mjs';
import { optionResolutionAuditSchemaV78, validateOptionResolutionAuditV78 } from '../lib/optionResolutionAuditV78.mjs';

const quote = 'Profit equals revenue minus expenses.';
const catalog = [{ id: 'E1.1', source_id: 'book-1', locator: 'p. 12', quote, start: 0, end: quote.length }];
const view = {
  candidate_id: 'v78-test-1', content_hash: 'content-hash-1', body: 'Revenue is 12 units. Expenses are 5 units.',
  correct_key: 'B',
  options: [
    { key: 'A', text: 'Profit is 5 units and method is tax efficient.' },
    { key: 'B', text: 'Profit is 7 units.' },
    { key: 'C', text: 'Profit is 12 units.' },
    { key: 'D', text: 'Profit is 17 units.' },
  ],
};
const stemPremises = ['Revenue is 12 units.', 'Expenses are 5 units.'];
const stemOrigins = stemPremises.map(() => ({ kind: 'stem', evidence_ids: [], option: null }));
const evidenceResult = { evidence_ids: ['E1.1'], supporting_spans: [{ source_id: 'book-1', locator: 'p. 12', quote, start: 0, end: quote.length }] };

function makeMatrix() {
  return view.options.map(option => {
    if (option.key === 'A') return { option: 'A', exact_option_text: option.text, clauses: [
      { clause: 'Profit is 5 units', status: 'contradiction', decisive_context: '12 minus 5 is 7, not 5.', rationale: 'Subtracting the stated expenses from revenue gives 7.', basis: 'arithmetic', contradiction_basis: 'arithmetic_result', evidence_ids: [], premises: stemPremises, premise_origins: stemOrigins },
      { clause: ' and method is tax efficient.', status: 'unresolved', decisive_context: 'The prompt and source do not address tax efficiency.', rationale: 'The unsupported remainder is nondecisive because the profit clause is false.', basis: 'excerpt', contradiction_basis: 'none', evidence_ids: ['E1.1'], premises: [quote], premise_origins: [{ kind: 'excerpt', evidence_ids: ['E1.1'], option: null }] },
    ] };
    const status = option.key === 'B' ? 'support' : 'contradiction';
    return { option: option.key, exact_option_text: option.text, clauses: [{ clause: option.text, status,
      decisive_context: status === 'support' ? '12 minus 5 is 7.' : `12 minus 5 is not ${option.text.match(/\d+/u)?.[0]}.`,
      rationale: status === 'support' ? 'The stated values yield the printed result.' : 'The stated values yield 7, not this result.',
      basis: 'arithmetic', contradiction_basis: status === 'support' ? 'none' : 'arithmetic_result', evidence_ids: [],
      premises: stemPremises, premise_origins: stemOrigins }] };
  });
}

function makeResult(solver, matrix = makeMatrix()) {
  return { candidate_id: view.candidate_id, content_hash: view.content_hash, solved_key: 'B', solver, matrix };
}

function makeAuditRow(solver, sourceRow) {
  const wholeStatus = sourceRow.clauses.some(clause => clause.status === 'contradiction') ? 'contradiction'
    : sourceRow.clauses.every(clause => clause.status === 'support') ? 'support' : 'unresolved';
  const isUnresolved = clause => clause.status === 'unresolved';
  return {
    candidate_id: view.candidate_id, content_hash: view.content_hash, solver, option: sourceRow.option,
    exact_option_text: sourceRow.exact_option_text, claimed_whole_status: wholeStatus, audited_whole_status: wholeStatus,
    whole_claim_audit: 'entailed', basis_audit: 'arithmetic', rationale: 'The full option is checked against the stated values.',
    evidence_ids: [], premises: stemPremises, premise_origins: stemOrigins,
    clauses: sourceRow.clauses.map(clause => isUnresolved(clause) ? {
      clause: clause.clause, claimed_status: 'unresolved', audited_status: 'unresolved', claim_audit: 'uncertain', basis_audit: 'source_silence',
      rationale: 'No premise establishes this additional claim; it does not change the contradicted conjunction.', evidence_ids: ['E1.1'], premises: [], premise_origins: [],
    } : {
      clause: clause.clause, claimed_status: clause.status, audited_status: clause.status, claim_audit: 'entailed', basis_audit: 'arithmetic',
      rationale: 'The arithmetic claim is checked against the stated figures.', evidence_ids: [], premises: stemPremises, premise_origins: stemOrigins,
    }),
  };
}

function makeAuditResult(frozen = [makeResult('solver-one'), makeResult('solver-two')]) {
  return { candidate_id: view.candidate_id, content_hash: view.content_hash, ...evidenceResult,
    option_resolution_audits: frozen.flatMap(entry => entry.matrix.map(row => makeAuditRow(entry.solver, row))) };
}

test('normalization folds whitespace only and matches full token-bounded premises', () => {
  assert.equal(containsAnchoredPremiseV78('A total of 12\n units is printed.', '12 units'), true);
  assert.equal(containsAnchoredPremiseV78('The 112 units are printed.', '12 units'), false);
  assert.equal(containsAnchoredPremiseV78('Profit is 7 units.', 'profit is 7 units.'), false);
  assert.equal(containsAnchoredPremiseV78('Profit is 7 units.', 'Profit is 8 units.'), false);
  assert.equal(containsAnchoredPremiseV78('The method does not reduce cost.', 'The method reduces cost.'), false);
  assert.equal(containsAnchoredPremiseV78('The method reduces total cost and waste.', 'The method reduces cost.'), false);
  assert.equal(containsAnchoredPremiseV78('The method reduces total cost and waste.', 'The method ... cost.'), false);
  assert.equal(containsAnchoredPremiseV78('The method does not reduce cost.', 'The method does reduce cost.'), false);
  assert.equal(containsAnchoredPremiseV78('The total is 12 units.', 'The total is 13 units.'), false);
});

test('explicit origins resolve overlapping stem and excerpt text without guessing', () => {
  const overlapView = { ...view, body: `${quote} Given values.` };
  const origins = { premises: [quote], premise_origins: [{ kind: 'excerpt', evidence_ids: ['E1.1'], option: null }],
    basis: 'excerpt_direct', evidence_ids: ['E1.1'], selectedEvidenceIds: ['E1.1'], option: 'B', optionText: view.options[1].text,
    view: overlapView, evidenceCatalog: catalog };
  assert.equal(validatePremiseBindingsV78(origins).ok, true);
  assert.equal(validatePremiseBindingsV78({ ...origins, premise_origins: undefined }).ok, false);
  assert.equal(validatePremiseBindingsV78({ ...origins, premise_origins: [{ kind: 'stem', evidence_ids: [], option: null }], basis: 'stem_direct', evidence_ids: [] }).ok, true);
  assert.equal(validatePremiseBindingsV78({ ...origins, premise_origins: [{ kind: 'excerpt', evidence_ids: ['wrong-id'], option: null }] }).ok, false);
  assert.equal(validatePremiseBindingsV78({ ...origins, premise_origins: [
    { kind: 'excerpt', evidence_ids: ['E1.1'], option: null }, { kind: 'stem', evidence_ids: [], option: null },
  ] }).ok, false);
  assert.equal(validatePremiseBindingsV78({ ...origins, premise_origins: [
    { kind: 'excerpt', evidence_ids: ['E1.1'], option: null }, { kind: 'excerpt', evidence_ids: ['E1.1'], option: null },
  ] }).ok, false);
  assert.equal(validatePremiseBindingsV78({ ...origins, premise_origins: [{ kind: 'excerpt', evidence_ids: ['E1.1'], option: 'B' }] }).ok, false);
  assert.equal(validatePremiseBindingsV78({ ...origins, premises: [quote, quote], premise_origins: [
    { kind: 'excerpt', evidence_ids: ['E1.1'], option: null }, { kind: 'stem', evidence_ids: [], option: null },
  ], basis: 'excerpt_direct', evidence_ids: ['E1.1'] }).ok, true);
  assert.equal(validatePremiseBindingsV78({ ...origins, premise_origins: [
    { kind: 'excerpt', evidence_ids: ['E1.1'], option: null }, { kind: 'stem', evidence_ids: [], option: null },
    { kind: 'stem', evidence_ids: [], option: null },
  ] }).ok, false);
  const bothView = { ...overlapView, body: quote };
  const sameInBoth = { ...origins, view: bothView };
  assert.equal(validatePremiseBindingsV78(sameInBoth).ok, true);
  assert.equal(validatePremiseBindingsV78({ ...sameInBoth, premise_origins: [{ kind: 'stem', evidence_ids: [], option: null }],
    basis: 'stem_direct', evidence_ids: [] }).ok, true);
});

test('source silence requires reviewed selected evidence and excerpt provenance for any quoted premises', () => {
  const base = { basis: 'source_silence', evidence_ids: ['E1.1'], selectedEvidenceIds: ['E1.1'], option: 'B',
    optionText: view.options[1].text, view, evidenceCatalog: catalog };
  assert.equal(validatePremiseBindingsV78({ ...base, premises: [], premise_origins: [] }).ok, true);
  assert.equal(validatePremiseBindingsV78({ ...base, premises: [quote], premise_origins: [
    { kind: 'excerpt', evidence_ids: ['E1.1'], option: null },
  ] }).ok, true);
  assert.equal(validatePremiseBindingsV78({ ...base, premises: [view.body.split('. ')[0] + '.'], premise_origins: [
    { kind: 'stem', evidence_ids: [], option: null },
  ] }).ok, false);
  assert.equal(validatePremiseBindingsV78({ ...base, selectedEvidenceIds: [], premises: [], premise_origins: [] }).ok, false);
  assert.equal(validatePremiseBindingsV78({ ...base, evidence_ids: [], premises: [], premise_origins: [] }).ok, false);
});

test('mixed stem and excerpt premises bind positionally; an arithmetic printed option remains hypothetical', () => {
  const premises = [view.body.split(' ')[0] + ' is 12 units.', quote, 'Profit is 7 units.'];
  const binding = validatePremiseBindingsV78({ premises, premise_origins: [
    { kind: 'stem', evidence_ids: [], option: null },
    { kind: 'excerpt', evidence_ids: ['E1.1'], option: null },
    { kind: 'printed_option_input', evidence_ids: [], option: 'B' },
  ], basis: 'arithmetic', evidence_ids: ['E1.1'], selectedEvidenceIds: ['E1.1'], option: 'B', optionText: view.options[1].text, view, evidenceCatalog: catalog });
  assert.equal(binding.ok, true);
  assert.equal(binding.bindings[2].kind, 'printed_option_input');
  assert.equal(validatePremiseBindingsV78({ premises: ['Profit is 7 units.'], premise_origins: [{ kind: 'printed_option_input', evidence_ids: [], option: 'B' }],
    basis: 'arithmetic', evidence_ids: [], selectedEvidenceIds: ['E1.1'], option: 'B', optionText: view.options[1].text, view, evidenceCatalog: catalog }).ok, false);
  assert.equal(validatePremiseBindingsV78({ premises, premise_origins: [
    { kind: 'stem', evidence_ids: [], option: null }, { kind: 'excerpt', evidence_ids: ['E1.1'], option: null },
    { kind: 'printed_option_input', evidence_ids: [], option: 'A' },
  ], basis: 'arithmetic', evidence_ids: ['E1.1'], selectedEvidenceIds: ['E1.1'], option: 'B', optionText: view.options[1].text, view, evidenceCatalog: catalog }).ok, false);
});

test('resolution keeps identity, exact-option, spans, full clauses, and unique-key gates', () => {
  const result = { candidate_id: view.candidate_id, content_hash: view.content_hash, solved_key: 'B', evidence_selection_valid: true,
    ...evidenceResult, option_resolution_matrix: makeMatrix() };
  assert.deepEqual(validateOptionResolutionV78(result, view, { evidenceCatalog: catalog }), { ok: true, reason: null, matrix: result.option_resolution_matrix });
  assert.equal(optionResolutionSchemaV78(['E1.1']).items.properties.clauses.items.required.includes('premise_origins'), true);
  const missingOrigins = structuredClone(result); delete missingOrigins.option_resolution_matrix[1].clauses[0].premise_origins;
  assert.equal(validateOptionResolutionV78(missingOrigins, view, { evidenceCatalog: catalog }).ok, false);
  const badSpan = structuredClone(result); badSpan.supporting_spans[0].quote = 'not the selected source text';
  assert.equal(validateOptionResolutionV78(badSpan, view, { evidenceCatalog: catalog }).ok, false);
  const partial = structuredClone(result); partial.option_resolution_matrix[2].clauses[0].clause = 'Profit is';
  assert.equal(validateOptionResolutionV78(partial, view, { evidenceCatalog: catalog }).ok, false);
  const malformed = structuredClone(result); malformed.option_resolution_matrix[0].clauses = [null];
  assert.equal(validateOptionResolutionV78(malformed, view, { evidenceCatalog: catalog }).ok, false);
});

test('two independent audits bind every whole option and clause; source silence stays nondecisive', () => {
  const frozen = [makeResult('solver-one'), makeResult('solver-two')];
  const result = makeAuditResult(frozen);
  assert.deepEqual(validateOptionResolutionAuditV78(result, view, { frozen, evidenceCatalog: catalog }), { ok: true, reason: null });
  assert.equal(optionResolutionAuditSchemaV78(['E1.1'], frozen).items.required.includes('premise_origins'), true);
  const forgedOrigin = structuredClone(result);
  forgedOrigin.option_resolution_audits[0].clauses[0].premise_origins[0] = { kind: 'excerpt', evidence_ids: ['E1.1'], option: null };
  assert.equal(validateOptionResolutionAuditV78(forgedOrigin, view, { frozen, evidenceCatalog: catalog }).ok, false);
  const sourceSilenceAsDecision = structuredClone(result);
  sourceSilenceAsDecision.option_resolution_audits[0].clauses[1].claimed_status = 'contradiction';
  sourceSilenceAsDecision.option_resolution_audits[0].clauses[1].audited_status = 'contradiction';
  sourceSilenceAsDecision.option_resolution_audits[0].clauses[1].claim_audit = 'entailed';
  assert.equal(validateOptionResolutionAuditV78(sourceSilenceAsDecision, view, { frozen, evidenceCatalog: catalog }).ok, false);
  const unsupportedConjunction = structuredClone(result);
  unsupportedConjunction.option_resolution_audits[0].audited_whole_status = 'support';
  assert.equal(validateOptionResolutionAuditV78(unsupportedConjunction, view, { frozen, evidenceCatalog: catalog }).ok, false);
  const badCatalog = structuredClone(catalog); badCatalog.push(null);
  assert.equal(validateOptionResolutionAuditV78(result, view, { frozen, evidenceCatalog: badCatalog }).ok, false);
  const malformed = structuredClone(result); malformed.option_resolution_audits[0] = null;
  assert.equal(validateOptionResolutionAuditV78(malformed, view, { frozen, evidenceCatalog: catalog }).ok, false);
});
