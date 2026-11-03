// Isolated disposable-staging check. Uses three fresh software-fixture IDs,
// never changes broad controls, and deletes only rows with this run's IDs.
import assert from 'node:assert/strict';
import { loadEnvFile } from 'node:process';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

loadEnvFile('.env.local');
loadEnvFile('.env.staging');
const project = process.env.STAGING_SUPABASE_URL;
const expectedProject = 'https://onwkqxmjqjrhfbjjdydu.supabase.co';
if (project !== expectedProject || !process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY) throw Error('staging_identity_unavailable');
const db = createClient(project, process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { fetch: (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(30000) }) }
});
const base = 'http://localhost:3101';
const run = randomUUID().replaceAll('-', '');
const prefix = `stg-atomic-vnext-${run}`;
const questionIds = [`${prefix}-single`, `${prefix}-child-a`, `${prefix}-child-b`];
const availabilityId = `${prefix}-legacy-availability`;
const fixtureQuestionIds = [...questionIds, availabilityId];
const availabilityChapter = `Disposable staging availability ${run}`;
const jobIds = [...questionIds];
const groupId = `${prefix}-group`;
const disputeId = `${prefix}-dispute`;
const checks = [];
const checked = async promise => {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
};
const empty = async (table, column, values) => {
  const rows = await checked(db.from(table).select(column).in(column, values));
  assert.equal(rows.length, 0, `collision:${table}`);
};
const countQuestions = async ids => (await checked(db.from('questions').select('id').in('id', ids))).length;
const control = await checked(db.from('question_factory_control').select('paused,phase,publication_enabled').eq('id', 1).single());
if (control.paused || !control.publication_enabled || control.phase === 'pilot') throw Error('staging_publication_control_not_already_enabled');
for (const [table, column, ids] of [
  ['questions', 'id', fixtureQuestionIds],
  ['question_factory_jobs', 'id', jobIds],
  ['question_factory_publications', 'question_id', questionIds],
  ['passage_groups', 'id', [groupId]],
  ['question_content_disputes', 'id', [disputeId]]
]) await empty(table, column, ids);

const cachedAdmin = JSON.parse(readFileSync('.cache/factory-staging-auth.json', 'utf8'));
if (!cachedAdmin.admin?.id) throw Error('existing_staging_admin_identity_missing');
const authorId = cachedAdmin.admin.id;
async function existingStudentCookie() {
  if (!process.env.STAGING_SUPABASE_ANON_KEY) throw Error('staging_anon_key_unavailable');
  const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email: 'factory-staging-student@example.com' });
  if (error) throw error;
  let jar = [];
  const auth = createServerClient(project, process.env.STAGING_SUPABASE_ANON_KEY, {
    global: { fetch: (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(30000) }) },
    cookies: { getAll: () => jar, setAll: value => { jar = value; } }
  });
  const verified = await auth.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: data.properties.verification_type });
  if (verified.error) throw verified.error;
  return jar.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
}
async function readStudentFixtureIds(cookie, chapter = 'Consumer Behaviour') {
  const received = new Set();
  let offset = 0;
  for (;;) {
    const response = await fetch(`${base}/api/questions/feed?subject=economics&chapter=${encodeURIComponent(chapter)}&limit=50&offset=${offset}`, {
      headers: { Cookie: cookie }, signal: AbortSignal.timeout(30000)
    });
    const payload = await response.json();
    assert.equal(response.status, 200, `student feed returned ${response.status}`);
    for (const question of payload.questions || []) received.add(question.id);
    if (!payload.hasMore) return received;
    assert.ok(Number.isInteger(payload.nextOffset) && payload.nextOffset > offset, 'student feed pagination must advance');
    offset = payload.nextOffset;
  }
}
const fixtureRow = (id, passageGroupId = null, passageText = '') => ({
  id,
  author_id: authorId,
  subject: 'economics',
  chapter: 'Consumer Behaviour',
  body: `Disposable software fixture ${id}; not an academic question.`,
  options: ['fixture one', 'fixture two', 'fixture three', 'fixture four'],
  correct_answer: 'A',
  explanation: 'Software-only test receipt; this is not evidence of CUET readiness.',
  difficulty: 'easy',
  family_id: prefix,
  provenance: { kind: 'original_practice' },
  status: 'live',
  verification_state: 'verified',
  exploration_state: 'active',
  evidence: { record: { policy_version: 'cuet-llm-v3', state: 'published' }, signature: `software-only-${run}` },
  ...(passageGroupId ? { passage_group_id: passageGroupId, passage_id: passageGroupId, passage_text: passageText } : {})
});
const passageText = `Disposable registered software fixture passage ${run}.`;
const group = {
  id: groupId,
  subject: 'economics',
  chapter: 'Consumer Behaviour',
  passage_text: passageText,
  title: 'Disposable storage fixture',
  passage_type: 'reading_comprehension',
  status: 'live',
  discoverable: true,
  source: 'software-only-fixture'
};
let report = {
  at: new Date().toISOString(),
  environment: 'separate staging',
  project_ref: 'onwkqxmjqjrhfbjjdydu',
  fixture_type: 'software-only, non-academic, disposable',
  control_changed: false,
  provider_calls: 0,
  production_writes: 0,
  checks
};

try {
  await checked(db.from('question_factory_jobs').insert(jobIds.map((id, index) => ({
    id,
    subject: 'economics',
    chapter: 'Consumer Behaviour',
    kind: 'original_practice',
    state: 'eligible',
    ...(index ? { passage_group_id: groupId } : {})
  }))));

  const single = fixtureRow(questionIds[0]);
  const publishSingle = () => db.rpc('publish_factory_question', {
    p_row: single,
    p_fingerprint: `${prefix}-single-fingerprint`,
    p_job: jobIds[0]
  });
  const firstSingle = await checked(publishSingle());
  const secondSingle = await checked(publishSingle());
  assert.equal(firstSingle, questionIds[0]);
  assert.equal(secondSingle, firstSingle);
  assert.equal(await countQuestions([questionIds[0]]), 1);
  checks.push({ name: 'single publish replay is idempotent', repeated_result_same_id: true, rows_after_replay: 1 });

  const children = [fixtureRow(questionIds[1], groupId, passageText), fixtureRow(questionIds[2], groupId, passageText)];
  const singleChild = await db.rpc('publish_factory_question', {
    p_row: children[0], p_fingerprint: `${prefix}-child-a-fingerprint`, p_job: jobIds[1]
  });
  assert.ok(singleChild.error, 'individual passage child must be rejected');
  assert.equal(await countQuestions(questionIds), 1);
  const badGroup = structuredClone(group);
  const badChildren = structuredClone(children);
  badChildren[1].passage_text = 'Mismatched disposable passage';
  const rolledBack = await db.rpc('publish_factory_passage_group', {
    p_group: badGroup,
    p_rows: badChildren,
    p_fingerprints: [`${prefix}-child-a-fingerprint`, `${prefix}-child-b-fingerprint`],
    p_jobs: jobIds.slice(1)
  });
  assert.ok(rolledBack.error, 'mismatched group must be rejected');
  assert.equal(await countQuestions(questionIds), 1, 'failed group must not publish child rows');
  assert.equal((await checked(db.from('passage_groups').select('id').eq('id', groupId))).length, 0, 'failed group must roll back parent');
  checks.push({ name: 'individual child rejected and failed group rolled back parent plus children' });

  const publishGroup = () => db.rpc('publish_factory_passage_group', {
    p_group: group,
    p_rows: children,
    p_fingerprints: [`${prefix}-child-a-fingerprint`, `${prefix}-child-b-fingerprint`],
    p_jobs: jobIds.slice(1)
  });
  const firstGroup = await checked(publishGroup());
  const secondGroup = await checked(publishGroup());
  assert.equal(firstGroup, groupId);
  assert.equal(secondGroup, firstGroup);
  assert.equal(await countQuestions(questionIds), 3);
  const storedPassage = await checked(db.from('passage_groups').select('id,passage_text').eq('id', groupId).single());
  assert.equal(storedPassage.passage_text, passageText);
  checks.push({ name: 'complete passage group publishes atomically and group replay is idempotent', children: 2, passage_preserved: true });

  const studentCookie = await existingStudentCookie();
  const studentVisible = await readStudentFixtureIds(studentCookie);
  assert.ok(questionIds.every(id => !studentVisible.has(id)), 'software-only fake evidence must not qualify for student availability');
  checks.push({ name: 'student feed excludes software-only publication rows without a measured evidence release', fixture_rows_excluded: questionIds.length });

  const legacyAvailability = fixtureRow(availabilityId);
  delete legacyAvailability.provenance;
  delete legacyAvailability.evidence;
  legacyAvailability.chapter = availabilityChapter;
  await checked(db.from('questions').insert(legacyAvailability));
  const legacyVisible = await readStudentFixtureIds(studentCookie, availabilityChapter);
  assert.ok(legacyVisible.has(availabilityId), 'isolated legacy software fixture should be visible before dispute');
  checks.push({ name: 'signed-in student feed returns an isolated legacy compatibility fixture before dispute', fixture_rows: 1 });

  const disputed = await checked(db.rpc('record_question_dispute', {
    p_id: disputeId,
    p_question: availabilityId,
    p_hash: `fixture-hash-${run}`,
    p_receipt: { scope: 'isolated_staging_software_test', academic_error_alleged: false, provider_calls: 0 }
  }));
  assert.equal(disputed, true);
  const disputedRow = await checked(db.from('questions').select('status,verification_state,exploration_state').eq('id', availabilityId).single());
  assert.deepEqual(disputedRow, { status: 'pending', verification_state: 'disputed', exploration_state: 'pending_review' });
  const studentVisibleAfterDispute = await readStudentFixtureIds(studentCookie, availabilityChapter);
  assert.ok(!studentVisibleAfterDispute.has(availabilityId), 'disputed fixture must disappear from student feed');
  checks.push({ name: 'dispute RPC immediately removes the exact disputed fixture from student feed', fixture_hidden: true });
  report.passed = true;
} finally {
  // Every delete is scoped to collision-checked IDs generated for this run.
  const cleanupErrors = [];
  for (const action of [
    () => db.from('question_content_disputes').delete().eq('id', disputeId),
    () => db.from('question_factory_publications').delete().in('question_id', questionIds),
    () => db.from('questions').delete().in('id', fixtureQuestionIds),
    () => db.from('passage_groups').delete().eq('id', groupId),
    () => db.from('question_factory_jobs').delete().in('id', jobIds)
  ]) {
    try { await checked(action()); } catch (error) { cleanupErrors.push(String(error?.message || error)); }
  }
  report.cleanup = {
    attempted_exact_ids_only: true,
    errors: cleanupErrors,
    fixture_questions_remaining: await countQuestions(fixtureQuestionIds).catch(error => `read_failed:${error.message}`),
    fixture_jobs_remaining: await db.from('question_factory_jobs').select('id').in('id', jobIds).then(({ data, error }) => error ? `read_failed:${error.message}` : data.length),
    fixture_publications_remaining: await db.from('question_factory_publications').select('question_id').in('question_id', questionIds).then(({ data, error }) => error ? `read_failed:${error.message}` : data.length),
    fixture_disputes_remaining: await db.from('question_content_disputes').select('id').eq('id', disputeId).then(({ data, error }) => error ? `read_failed:${error.message}` : data.length),
    fixture_groups_remaining: await db.from('passage_groups').select('id').eq('id', groupId).then(({ data, error }) => error ? `read_failed:${error.message}` : data.length)
  };
  report.cleanup.complete = report.cleanup.errors.length === 0 && [
    report.cleanup.fixture_questions_remaining,
    report.cleanup.fixture_jobs_remaining,
    report.cleanup.fixture_publications_remaining,
    report.cleanup.fixture_disputes_remaining,
    report.cleanup.fixture_groups_remaining
  ].every(value => value === 0);
  writeFileSync('artifacts/question-factory/cuet-readiness-2026-10-08/staging/isolated-atomic-staging-check.json', JSON.stringify(report, null, 2) + '\n');
}

console.log(JSON.stringify(report));
assert.equal(report.cleanup.complete, true, 'disposable staging rows must be fully cleaned up');
assert.equal(report.passed, true, 'all isolated staging checks must pass');
