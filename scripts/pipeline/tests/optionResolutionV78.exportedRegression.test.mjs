import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { containsAnchoredPremiseV78, validatePremiseBindingsV78 } from '../lib/premiseBindingV78.mjs';
import { validateOptionResolutionV78 } from '../lib/optionResolutionV78.mjs';

// Regression-only projection of immutable V77 exports into the V78 shape.
// Origins are derived locally from the exported stem, option text and exact
// selected source spans; no native field is rewritten or treated as new proof.
const exportPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../artifacts/question-factory/cuet-readiness-2026-10-09/execution/v77-final-export-2026-10-09/all-cases.json');
const exported = JSON.parse(readFileSync(exportPath, 'utf8'));
const CASE_IDS = ['v77f-ad344a8b5f2d', 'v77f-2105354e5de1', 'v77f-662880a2c5fb', 'v77f-073bdc31e03c', 'v77f-3546cbf8ea19'];
const entries = new Map(exported.all_cases.map(entry => [entry.fixture?.id, entry]));

function projectNative(entry, provider) {
  const native = entry.independent_native_solutions?.[provider];
  assert.ok(native?.option_resolution_matrix && Array.isArray(native.evidence_ids) && Array.isArray(native.supporting_spans), `${entry.fixture.id}:${provider} needs exported matrices and source spans`);
  assert.equal(native.evidence_ids.length, native.supporting_spans.length, `${entry.fixture.id}:${provider} span count`);
  for (const span of native.supporting_spans) {
    assert.ok(candidateSourceRefs(entry).some(ref => ref.id === span.source_id), `${entry.fixture.id}:${provider} source identity is declared by the fixture`);
    assert.ok(entry.decisive_excerpts.some(excerpt => excerpt.source_ref?.id === span.source_id && excerpt.text.includes(span.quote)),
      `${entry.fixture.id}:${provider} selected quote is present in the exported source excerpt`);
  }
  const evidenceCatalog = native.evidence_ids.map((id, index) => ({ id, ...native.supporting_spans[index] }));
  const candidate = entry.fixture.candidate;
  const view = { candidate_id: native.candidate_id, content_hash: native.content_hash, body: candidate.body, options: candidate.options };
  const matrix = structuredClone(native.option_resolution_matrix);
  for (const row of matrix) {
    const optionText = candidate.options.find(option => option.key === row.option)?.text || '';
    for (const clause of row.clauses) {
      clause.premise_origins = clause.premises.map(premise => {
        const stemMatch = containsAnchoredPremiseV78(candidate.body, premise);
        const sourceMatches = (clause.evidence_ids || []).filter(id => {
          const evidence = evidenceCatalog.find(item => item.id === id);
          return evidence && containsAnchoredPremiseV78(evidence.quote, premise);
        });
        const optionMatch = containsAnchoredPremiseV78(optionText, premise);
        if (clause.basis === 'stem' && stemMatch) return { kind: 'stem', evidence_ids: [], option: null };
        if (clause.basis === 'excerpt') {
          if (sourceMatches.length) return { kind: 'excerpt', evidence_ids: [sourceMatches[0]], option: null };
          if (stemMatch) return { kind: 'stem', evidence_ids: [], option: null };
          return { kind: 'excerpt', evidence_ids: (clause.evidence_ids || []).slice(0, 1), option: null };
        }
        if (clause.basis === 'arithmetic') {
          if (stemMatch) return { kind: 'stem', evidence_ids: [], option: null };
          if (sourceMatches.length) return { kind: 'excerpt', evidence_ids: [sourceMatches[0]], option: null };
          if (optionMatch) return { kind: 'printed_option_input', evidence_ids: [], option: row.option };
          return clause.evidence_ids?.length ? { kind: 'excerpt', evidence_ids: [clause.evidence_ids[0]], option: null }
            : { kind: 'stem', evidence_ids: [], option: null };
        }
        return { kind: 'stem', evidence_ids: [], option: null };
      });
    }
  }
  const result = { candidate_id: native.candidate_id, content_hash: native.content_hash, solved_key: native.solved_key,
    evidence_ids: native.evidence_ids, supporting_spans: native.supporting_spans, evidence_selection_valid: native.evidence_selection_valid,
    option_resolution_matrix: matrix };
  return { view, result, evidenceCatalog, matrix, native };
}

function candidateSourceRefs(entry) {
  return Array.isArray(entry.fixture.candidate?.source_refs) ? entry.fixture.candidate.source_refs : [];
}

function resolution(entryId, provider) {
  const entry = entries.get(entryId);
  assert.ok(entry, `exported regression case ${entryId} exists`);
  const projected = projectNative(entry, provider);
  return { entry, ...projected, validation: validateOptionResolutionV78(projected.result, projected.view, { evidenceCatalog: projected.evidenceCatalog }) };
}

test('export fixture supplies exactly the five terminal controls used in this local regression', () => {
  assert.equal(exported.terminal, 5);
  for (const id of CASE_IDS) assert.ok(entries.has(id), `missing exported terminal case ${id}`);
  assert.equal(CASE_IDS.filter(id => entries.get(id).validation?.state === 'quarantined').length, 5);
});

test('native case 662880a2c5fb preserves both independently solved keys and accepts paraphrased contexts', () => {
  for (const provider of ['openai', 'gemini']) {
    const check = resolution('v77f-662880a2c5fb', provider);
    assert.equal(check.native.solved_key, 'B');
    assert.equal(check.validation.ok, true, check.validation.reason);
    const selected = check.matrix.find(row => row.option === 'B');
    assert.ok(selected.clauses.some(clause => clause.premises.every(premise => !clause.decisive_context.includes(premise))));
  }
});

test('native case 073bdc31e03c keeps Luna mixed stem/source support and rejects Gemini paraphrased premises', () => {
  const luna = resolution('v77f-073bdc31e03c', 'openai');
  assert.equal(luna.native.solved_key, 'B');
  assert.equal(luna.validation.ok, true, luna.validation.reason);
  const lunaSelected = luna.matrix.find(row => row.option === 'B').clauses[0];
  assert.ok(lunaSelected.premise_origins.some(origin => origin.kind === 'stem'));
  assert.ok(lunaSelected.premise_origins.some(origin => origin.kind === 'excerpt'));

  const gemini = resolution('v77f-073bdc31e03c', 'gemini');
  assert.equal(gemini.native.solved_key, 'B');
  assert.equal(gemini.validation.ok, false);
  assert.match(gemini.validation.reason, /premise_excerpt_origin_mismatch/u);
  assert.ok(gemini.matrix.some(row => row.clauses.some(clause => clause.premises.some(premise =>
    premise.includes('cash outflows from investing activities') && clause.premise_origins.some(origin =>
      origin.kind === 'excerpt' && origin.evidence_ids.some(id => !containsAnchoredPremiseV78(gemini.evidenceCatalog.find(item => item.id === id)?.quote || '', premise)))))));
});

test('native case 3546cbf8ea19 accepts newline-only PDF wrapping and keeps Gemini ellipsis unbound', () => {
  const luna = resolution('v77f-3546cbf8ea19', 'openai');
  assert.equal(luna.validation.ok, true, luna.validation.reason);
  const lineWrapPremise = luna.matrix.flatMap(row => row.clauses).flatMap(clause => clause.premises).find(premise =>
    luna.evidenceCatalog.some(item => !item.quote.includes(premise) && containsAnchoredPremiseV78(item.quote, premise)));
  assert.ok(lineWrapPremise, 'exported Luna premise should match only after whitespace folding');

  const gemini = resolution('v77f-3546cbf8ea19', 'gemini');
  assert.equal(gemini.validation.ok, false);
  assert.match(gemini.validation.reason, /premise_excerpt_origin_mismatch/u);
  assert.ok(gemini.matrix.some(row => row.clauses.some(clause => clause.premises.some(premise => premise.includes('...')))));
});

test('native Luna case 2105354e5de1 still rejects a shortened, altered source quote', () => {
  const luna = resolution('v77f-2105354e5de1', 'openai');
  assert.equal(luna.native.solved_key, 'B');
  assert.equal(luna.validation.ok, false);
  assert.match(luna.validation.reason, /premise_excerpt_origin_mismatch/u);
  const alteredQuote = 'Cash receipt from disposal of fixed assets.';
  const unbound = luna.matrix.some(row => row.clauses.some(clause => clause.premises.includes(alteredQuote) &&
    clause.premise_origins.some(origin => origin.kind === 'excerpt' && origin.evidence_ids.some(id =>
      !containsAnchoredPremiseV78(luna.evidenceCatalog.find(item => item.id === id)?.quote || '', alteredQuote)))));
  assert.equal(unbound, true);
});

test('all five exported terminal cases are exercised without promoting native outputs into new judgments', () => {
  for (const id of CASE_IDS) {
    for (const provider of ['openai', 'gemini']) {
      const check = resolution(id, provider);
      assert.equal(check.result.option_resolution_matrix.length, 4);
      assert.ok(check.result.option_resolution_matrix.every(row => row.clauses.every(clause =>
        clause.premises.length === clause.premise_origins.length)));
    }
  }
  const first = resolution('v77f-ad344a8b5f2d', 'openai');
  assert.equal(first.validation.ok, false);
});

test('the local origin projection itself is still checked by the strict binding validator', () => {
  const projected = resolution('v77f-662880a2c5fb', 'openai');
  const selected = projected.matrix.find(row => row.option === 'B').clauses[0];
  const binding = validatePremiseBindingsV78({ premises: selected.premises, premise_origins: selected.premise_origins,
    basis: selected.basis, evidence_ids: selected.evidence_ids, selectedEvidenceIds: projected.result.evidence_ids,
    option: 'B', optionText: selected.clause, view: projected.view, evidenceCatalog: projected.evidenceCatalog });
  assert.equal(binding.ok, true, binding.reason);
});
