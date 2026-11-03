import { contentHash } from '../../../data/content_evidence.js';
import { createHash } from 'node:crypto';

export const REASSESSMENT_WITHHOLDING_CONTRACT = 'cuet-bank-reassessment-staging-withholding-v1';
export const EXPECTED_REASSESSMENT = Object.freeze({ denominator: 662, eligible: 536, quarantined: 126, withheld: 127 });
const TARGET = Object.freeze({ status: 'pending', verification_state: 'disputed', exploration_state: 'pending_review' });

const unique = values => [...new Set(values)];
const assert = (condition, code) => { if (!condition) throw new Error(code); };
const groupId = row => row.passage_group_id || row.passage_id || null;
const targetState = row => Object.entries(TARGET).every(([key, value]) => row[key] === value);
const dataHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function buildStagingWithholdingSelection(exportData, planData, sourceHashes = {}) {
  assert(exportData?.schema === 'cuet-bank-reassessment-export-v1', 'reassessment_export_schema_mismatch');
  assert(exportData.run?.complete === true && exportData.run?.status === 'complete', 'reassessment_export_incomplete');
  assert(exportData.run?.contract === '6f27a61131688db75be6686159b77894ee083f0c8abcca47d812a9a0eb20692c', 'reassessment_contract_mismatch');
  assert(exportData.run?.denominator === EXPECTED_REASSESSMENT.denominator && exportData.cases?.length === EXPECTED_REASSESSMENT.denominator, 'reassessment_denominator_mismatch');
  assert(exportData.run?.eligible === EXPECTED_REASSESSMENT.eligible && exportData.run?.quarantined === EXPECTED_REASSESSMENT.quarantined, 'reassessment_outcome_counts_mismatch');
  assert(planData?.mode === 'dry_run_only' && planData.atomic_passage_groups === true && planData.publication_writes === 0, 'withholding_plan_not_dry_run_atomic');
  const cases = new Map();
  for (const item of exportData.cases) {
    assert(typeof item.id === 'string' && /^[a-f0-9]{32}$/.test(item.id), 'invalid_export_question_id');
    assert(typeof item.content_hash === 'string' && /^[a-f0-9]{64}$/.test(item.content_hash), 'invalid_export_content_hash');
    assert(!cases.has(item.id), 'duplicate_export_question_id');
    cases.set(item.id, item);
  }
  const outcomeCounts = { eligible: 0, quarantined: 0 };
  const computedWithhold = new Set();
  const exportedGroups = new Map();
  for (const item of exportData.cases) {
    const state = item.assessment?.state;
    assert(state === 'eligible' || state === 'quarantined', `unexpected_export_assessment_state:${item.id}`);
    outcomeCounts[state]++;
    if (state === 'quarantined') computedWithhold.add(item.id);
    const gid = item.metadata?.passage_group_id;
    if (gid) exportedGroups.set(gid, [...(exportedGroups.get(gid) || []), item.id]);
  }
  assert(outcomeCounts.eligible === EXPECTED_REASSESSMENT.eligible && outcomeCounts.quarantined === EXPECTED_REASSESSMENT.quarantined, 'assessment_outcome_counts_mismatch');
  for (const ids of exportedGroups.values()) if (ids.some(id => computedWithhold.has(id))) for (const id of ids) computedWithhold.add(id);
  const selectedIds = unique(planData.decisions.flatMap(d => d.would_withhold_ids || []));
  assert(selectedIds.length === EXPECTED_REASSESSMENT.withheld, 'withholding_count_mismatch');
  assert(JSON.stringify([...selectedIds].sort()) === JSON.stringify([...computedWithhold].sort()), 'withholding_selection_assessment_mismatch');
  const allDecisionIds = unique(planData.decisions.flatMap(d => d.item_ids || []));
  assert(allDecisionIds.length === cases.size && allDecisionIds.every(id => cases.has(id)), 'plan_export_id_set_mismatch');
  for (const decision of planData.decisions) {
    assert(Array.isArray(decision.item_ids) && decision.item_ids.length > 0, 'empty_plan_decision');
    assert(decision.item_ids.every(id => cases.has(id)), 'plan_references_unknown_id');
    assert(decision.action === 'withhold' || decision.action === 'no_withhold', 'unknown_withholding_action');
    const shouldWithhold = decision.item_ids.some(id => computedWithhold.has(id));
    assert((decision.action === 'withhold') === shouldWithhold, 'withholding_decision_assessment_mismatch');
    assert(JSON.stringify([...(decision.would_withhold_ids || [])].sort()) === JSON.stringify((shouldWithhold ? decision.item_ids : []).slice().sort()), 'partial_group_withholding_forbidden');
    if (decision.passage_group_id) {
      const expectedMembers = exportedGroups.get(decision.passage_group_id) || [];
      assert(JSON.stringify(decision.item_ids.slice().sort()) === JSON.stringify(expectedMembers.slice().sort()), 'plan_passage_group_membership_mismatch');
    }
  }
  const selected = new Set(selectedIds);
  for (const [gid, ids] of exportedGroups) {
    if (ids.some(id => selected.has(id))) assert(ids.every(id => selected.has(id)), `export_passage_group_not_closed:${gid}`);
  }
  return {
    contract: REASSESSMENT_WITHHOLDING_CONTRACT,
    source_contract: exportData.run.contract,
    source_captured_at: exportData.captured_at,
    expected_total: cases.size,
    expected_eligible: outcomeCounts.eligible,
    expected_quarantined: outcomeCounts.quarantined,
    source_hashes: {
      export_sha256: sourceHashes.export_sha256 || dataHash(exportData),
      plan_sha256: sourceHashes.plan_sha256 || dataHash(planData),
    },
    ids: selectedIds.sort(),
    cases,
    affected_groups: [...exportedGroups.entries()].filter(([, ids]) => ids.some(id => selected.has(id))).map(([id, ids]) => ({ id, ids: ids.slice().sort() })).sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function preflightStagingRows(selection, rows) {
  assert(Array.isArray(rows), 'staging_snapshot_invalid');
  const live = new Map();
  for (const row of rows) {
    assert(typeof row.id === 'string' && !live.has(row.id), 'duplicate_or_invalid_staging_id');
    live.set(row.id, row);
  }
  assert([...selection.cases.keys()].every(id => live.has(id)), 'staging_export_id_missing');
  for (const [id, item] of selection.cases) {
    const row = live.get(id);
    assert(contentHash(row) === item.content_hash, `staging_content_hash_mismatch:${id}`);
    assert(groupId(row) === (item.metadata?.passage_group_id || null), `staging_passage_group_mismatch:${id}`);
  }
  const selected = new Set(selection.ids);
  for (const group of selection.affected_groups) {
    const actual = rows.filter(row => groupId(row) === group.id).map(row => row.id).sort();
    assert(JSON.stringify(actual) === JSON.stringify(group.ids), `staging_affected_group_membership_mismatch:${group.id}`);
    assert(group.ids.every(id => selected.has(id)), `staging_affected_group_not_closed:${group.id}`);
  }
  const states = selection.ids.map(id => live.get(id));
  const alreadyWithheld = states.filter(targetState).length;
  assert(alreadyWithheld === 0 || alreadyWithheld === states.length, 'staging_partial_withholding_state');
  const extraUnchangedCount = rows.length - selection.expected_total;
  assert(extraUnchangedCount >= 0, 'staging_export_id_missing');
  return { rows: live, already_withheld: alreadyWithheld === states.length, affected_count: states.length, group_count: selection.affected_groups.length, extra_unchanged_count: extraUnchangedCount };
}

function deterministicDisputeId(sourceContract, id) {
  return `cuet-reassessment-v1-${sourceContract.slice(0, 12)}-${id}`;
}

export async function applyStagingWithholding({ exportData, planData, sourceHashes, db, journal, saveJournal, now = () => new Date().toISOString() }) {
  assert(journal && typeof saveJournal === 'function', 'durable_journal_required');
  const selection = buildStagingWithholdingSelection(exportData, planData, sourceHashes);
  const liveRows = await db.readBankSnapshot();
  const preflight = preflightStagingRows(selection, liveRows);
  const jobRows = await db.readJobs(selection.ids);
  assert(Array.isArray(jobRows), 'staging_job_snapshot_invalid');
  const jobIds = unique(jobRows.map(row => row.id)).sort();
  assert(jobIds.length === selection.ids.length && JSON.stringify(jobIds) === JSON.stringify(selection.ids), 'staging_job_id_set_mismatch');
  assert(journal.contract === REASSESSMENT_WITHHOLDING_CONTRACT || journal.contract == null, 'journal_contract_mismatch');
  assert(journal.source_contract === selection.source_contract || journal.source_contract == null, 'journal_source_contract_mismatch');
  for (const key of ['export_sha256', 'plan_sha256']) assert(journal.source_hashes?.[key] == null || journal.source_hashes[key] === selection.source_hashes[key], `journal_${key}_mismatch`);
  journal.contract = REASSESSMENT_WITHHOLDING_CONTRACT;
  journal.source_contract = selection.source_contract;
  journal.source_captured_at = selection.source_captured_at;
  journal.expected_ids = selection.ids;
  journal.affected_groups = selection.affected_groups;
  journal.source_hashes = selection.source_hashes;
  journal.withhold_update ||= { state: 'not_started' };
  journal.receipts ||= {};
  journal.jobs ||= { state: 'not_started' };
  await saveJournal(journal);

  if (!preflight.already_withheld) {
    assert(journal.withhold_update.state === 'not_started' || journal.withhold_update.state === 'started', 'withhold_update_journal_invalid');
    journal.withhold_update = { state: 'started', started_at: journal.withhold_update.started_at || now(), count: selection.ids.length };
    await saveJournal(journal);
    const { error } = await db.withholdQuestions(selection.ids, TARGET);
    if (error) throw new Error(`staging_bulk_withhold_failed:${error.code || error.message || 'unknown'}`);
    const after = await db.readQuestions(selection.ids);
    assert(after.length === selection.ids.length && after.every(targetState), 'staging_bulk_withhold_verification_failed');
    journal.withhold_update = { state: 'complete', completed_at: now(), count: selection.ids.length };
    await saveJournal(journal);
  } else {
    assert(journal.withhold_update.state === 'started' || journal.withhold_update.state === 'complete', 'unexpected_preexisting_withholding_state');
    journal.withhold_update = { ...journal.withhold_update, state: 'complete', recovered_or_confirmed_at: now(), count: selection.ids.length };
    await saveJournal(journal);
  }

  for (const id of selection.ids) {
    if (journal.receipts[id]?.state === 'complete') continue;
    const item = selection.cases.get(id);
    const receipt = {
      schema: REASSESSMENT_WITHHOLDING_CONTRACT,
      source_contract: selection.source_contract,
      source_captured_at: selection.source_captured_at,
      question_id: id,
      content_hash: item.content_hash,
      validator_state: item.assessment.state,
      reasons: item.assessment.reasons || [],
      passage_group_id: item.metadata?.passage_group_id || null,
      publication_instruction: false,
      academic_truth_claim: false,
    };
    const disputeId = deterministicDisputeId(selection.source_contract, id);
    journal.receipts[id] = { state: 'started', dispute_id: disputeId, started_at: journal.receipts[id]?.started_at || now() };
    await saveJournal(journal);
    const { data, error } = await db.recordDispute({ p_id: disputeId, p_question: id, p_hash: item.content_hash, p_receipt: receipt });
    if (error) throw new Error(`staging_dispute_receipt_failed:${id}:${error.code || error.message || 'unknown'}`);
    assert(data === true, `staging_dispute_question_missing:${id}`);
    const persisted = await db.readDispute(disputeId);
    assert(persisted && persisted.question_id === id && persisted.content_hash === item.content_hash, `staging_dispute_receipt_verification_failed:${id}`);
    assert(persisted.receipt?.schema === receipt.schema && persisted.receipt?.source_contract === receipt.source_contract && persisted.receipt?.question_id === id && persisted.receipt?.publication_instruction === false, `staging_dispute_receipt_content_mismatch:${id}`);
    journal.receipts[id] = { ...journal.receipts[id], state: 'complete', completed_at: now() };
    await saveJournal(journal);
  }

  if (journal.jobs.state !== 'complete') {
    journal.jobs = { state: 'started', started_at: journal.jobs.started_at || now(), count: selection.ids.length };
    await saveJournal(journal);
    const { error } = await db.quarantineJobs(selection.ids, { state: 'quarantined', stage: 'complete', updated_at: now() });
    if (error) throw new Error(`staging_job_update_failed:${error.code || error.message || 'unknown'}`);
    journal.jobs = { state: 'complete', completed_at: now(), count: selection.ids.length };
    await saveJournal(journal);
  }
  journal.completed = true;
  journal.completed_at = now();
  await saveJournal(journal);
  return { withheld_questions: selection.ids.length, affected_groups: selection.affected_groups.length, receipts: Object.keys(journal.receipts).length, jobs_updated: selection.ids.length, resumed_from_existing_withholding: preflight.already_withheld };
}

export function createEmptyStagingWithholdingJournal() {
  return { schema: REASSESSMENT_WITHHOLDING_CONTRACT, contract: REASSESSMENT_WITHHOLDING_CONTRACT, created_at: new Date().toISOString(), completed: false, receipts: {}, withhold_update: { state: 'not_started' }, jobs: { state: 'not_started' } };
}
