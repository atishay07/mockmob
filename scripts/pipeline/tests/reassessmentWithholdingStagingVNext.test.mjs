import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contentHash } from '../../../data/content_evidence.js';
import { applyStagingWithholding, buildStagingWithholdingSelection, createEmptyStagingWithholdingJournal, preflightStagingRows } from '../lib/reassessmentWithholdingStagingVNext.mjs';

const snapshotDir = resolve('artifacts/question-factory/cuet-readiness-2026-10-08/execution/reassessment/snapshot-20261008T060712941Z');
const exportData = JSON.parse(readFileSync(resolve(snapshotDir, 'bank-reassessment-export.json'), 'utf8'));
const planData = JSON.parse(readFileSync(resolve(snapshotDir, 'dry-run-withholding-plan.json'), 'utf8'));
const canonicalFixture = item => item.assessment.full_validation_result?.question || ({
  subject: item.metadata.subject,
  chapter: item.metadata.chapter,
  concept_id: item.metadata.topic || '',
  body: item.question.stem,
  options: item.question.options,
  correct_answer: item.question.key,
  explanation: item.question.explanation,
  passage_text: item.question.passage || '',
});
const makeFixture = () => {
  const rows = exportData.cases.map(item => ({
  ...canonicalFixture(item),
  id: item.id,
  passage_group_id: item.metadata.passage_group_id,
  status: 'live',
  verification_state: 'verified',
  exploration_state: 'explored',
  }));
  const cases = exportData.cases.map((item, index) => ({ ...item, content_hash: contentHash(rows[index]) }));
  return { exportData: { ...exportData, cases }, rows };
};
const setupDb = (rows, { failReceiptAt = null } = {}) => {
  const calls = { bulk: 0, receipts: [], jobs: 0, receiptRows: new Map() };
  return {
    calls,
    readBankSnapshot: async () => rows,
    readJobs: async ids => ids.map(id => ({ id })),
    readQuestions: async ids => rows.filter(row => ids.includes(row.id)),
    withholdQuestions: async (ids, update) => {
      calls.bulk++;
      calls.updateIds = ids.slice();
      for (const row of rows) if (ids.includes(row.id)) Object.assign(row, update);
      return { error: null };
    },
    recordDispute: async args => {
      calls.receipts.push(args);
      if (failReceiptAt && calls.receipts.length === failReceiptAt) return { error: { code: 'test_interruption' } };
      calls.receiptRows.set(args.p_id, { question_id: args.p_question, content_hash: args.p_hash, receipt: args.p_receipt });
      return { data: true, error: null };
    },
    readDispute: async id => calls.receiptRows.get(id) || null,
    quarantineJobs: async (ids, update) => { calls.jobs++; calls.jobIds = ids; calls.jobUpdate = update; return { error: null }; },
  };
};

test('frozen completed export selects exactly 127 items and closes all affected passage groups', () => {
  const selection = buildStagingWithholdingSelection(exportData, planData);
  assert.equal(selection.expected_total, 662);
  assert.equal(selection.ids.length, 127);
  assert.ok(selection.affected_groups.length > 0);
  const selected = new Set(selection.ids);
  for (const group of selection.affected_groups) assert.ok(group.ids.every(id => selected.has(id)));
  const fixture = makeFixture(), fixtureSelection = buildStagingWithholdingSelection(fixture.exportData, planData);
  const preflight = preflightStagingRows(fixtureSelection, fixture.rows);
  assert.equal(preflight.affected_count, 127);
});

test('preflight rejects content drift and passage-group drift before any write', async () => {
  const fixture = makeFixture();
  const selection = buildStagingWithholdingSelection(fixture.exportData, planData);
  for (const mutate of [
    row => { row.explanation += ' changed'; },
    row => { row.passage_group_id = 'unexpected-group'; },
  ]) {
    const rows = structuredClone(fixture.rows);
    mutate(rows.find(row => selection.ids.includes(row.id)));
    const db = setupDb(rows), journal = createEmptyStagingWithholdingJournal();
    let saves = 0;
    await assert.rejects(applyStagingWithholding({ exportData: fixture.exportData, planData, db, journal, saveJournal: async () => { saves++; } }));
    assert.equal(db.calls.bulk, 0);
    assert.equal(db.calls.receipts.length, 0);
    assert.equal(db.calls.jobs, 0);
    assert.equal(saves, 0);
  }
});

test('allows unrelated staging rows, reports them unchanged, and only updates the 127 scoped IDs', async () => {
  const fixture = makeFixture();
  const extras = ['outside-a', 'outside-b', 'outside-c', 'outside-d'].map(id => ({ id, body: 'unrelated staging row', options: [], status: 'live', verification_state: 'verified', exploration_state: 'explored', passage_group_id: null }));
  const rows = [...fixture.rows, ...extras];
  const selection = buildStagingWithholdingSelection(fixture.exportData, planData);
  const preview = preflightStagingRows(selection, rows);
  assert.equal(preview.extra_unchanged_count, 4);
  const db = setupDb(rows), journal = createEmptyStagingWithholdingJournal();
  const result = await applyStagingWithholding({ exportData: fixture.exportData, planData, db, journal, saveJournal: async () => {} });
  assert.equal(result.withheld_questions, 127);
  assert.equal(db.calls.bulk, 1);
  assert.equal(db.calls.updateIds.length, 127);
  assert.ok(extras.every(row => row.status === 'live' && row.verification_state === 'verified'));
});

test('refuses an extra staging child in an affected passage group and a missing exported ID', () => {
  const fixture = makeFixture(), selection = buildStagingWithholdingSelection(fixture.exportData, planData);
  const affected = selection.affected_groups[0];
  const extraChild = { id: 'e'.repeat(32), body: 'extra group child', options: [], passage_group_id: affected.id };
  assert.throws(() => preflightStagingRows(selection, [...fixture.rows, extraChild]), /staging_affected_group_membership_mismatch/);
  assert.throws(() => preflightStagingRows(selection, fixture.rows.slice(1)), /staging_export_id_missing/);
});

test('one atomic bulk update precedes deterministic receipts and staging job quarantine', async () => {
  const fixture = makeFixture(), rows = fixture.rows, db = setupDb(rows), journal = createEmptyStagingWithholdingJournal();
  const saves = [];
  const result = await applyStagingWithholding({ exportData: fixture.exportData, planData, db, journal, saveJournal: async value => saves.push(structuredClone(value)) });
  assert.equal(result.withheld_questions, 127);
  assert.equal(db.calls.bulk, 1);
  assert.equal(db.calls.receipts.length, 127);
  assert.equal(new Set(db.calls.receipts.map(call => call.p_id)).size, 127);
  assert.deepEqual(db.calls.receipts[0].p_receipt.publication_instruction, false);
  assert.equal(db.calls.jobs, 1);
  assert.equal(db.calls.jobIds.length, 127);
  assert.equal(db.calls.jobUpdate.state, 'quarantined');
  assert.equal(db.calls.jobUpdate.stage, 'complete');
  assert.ok(db.calls.jobUpdate.updated_at);
  assert.ok(rows.filter(row => result.withheld_questions && journal.expected_ids.includes(row.id)).every(row => row.status === 'pending' && row.verification_state === 'disputed' && row.exploration_state === 'pending_review'));
  assert.equal(journal.completed, true);
  assert.ok(saves.length > 127);
});

test('resume after a receipt interruption skips the completed bulk update and prior receipts', async () => {
  const fixture = makeFixture(), rows = fixture.rows, journal = createEmptyStagingWithholdingJournal();
  const interrupted = setupDb(rows, { failReceiptAt: 4 });
  await assert.rejects(applyStagingWithholding({ exportData: fixture.exportData, planData, db: interrupted, journal, saveJournal: async () => {} }), /staging_dispute_receipt_failed/);
  assert.equal(interrupted.calls.bulk, 1);
  assert.equal(Object.values(journal.receipts).filter(r => r.state === 'complete').length, 3);

  const resumed = setupDb(rows);
  const result = await applyStagingWithholding({ exportData: fixture.exportData, planData, db: resumed, journal, saveJournal: async () => {} });
  assert.equal(result.resumed_from_existing_withholding, true);
  assert.equal(resumed.calls.bulk, 0);
  assert.equal(resumed.calls.receipts.length, 124);
  assert.equal(resumed.calls.jobs, 1);
  assert.equal(Object.values(journal.receipts).filter(r => r.state === 'complete').length, 127);
  assert.equal(journal.completed, true);
});

test('refuses a partially withheld passage-closed snapshot', () => {
  const fixture = makeFixture(), selection = buildStagingWithholdingSelection(fixture.exportData, planData), rows = fixture.rows;
  const member = selection.ids[0];
  Object.assign(rows.find(row => row.id === member), { status: 'pending', verification_state: 'disputed', exploration_state: 'pending_review' });
  assert.throws(() => preflightStagingRows(selection, rows), /staging_partial_withholding_state/);
});

test('refuses resume when the pinned export or plan hash changes', async () => {
  const fixture = makeFixture(), rows = fixture.rows, db = setupDb(rows);
  const journal = createEmptyStagingWithholdingJournal();
  journal.source_hashes = { export_sha256: 'a'.repeat(64), plan_sha256: 'b'.repeat(64) };
  await assert.rejects(applyStagingWithholding({ exportData: fixture.exportData, planData, db, journal, saveJournal: async () => {} }), /journal_export_sha256_mismatch/);
  assert.equal(db.calls.bulk, 0);
  assert.equal(db.calls.receipts.length, 0);
  assert.equal(db.calls.jobs, 0);
});
