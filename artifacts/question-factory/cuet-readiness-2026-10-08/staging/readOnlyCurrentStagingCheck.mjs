// Read-only current staging check. Run from repository root:
// node --use-system-ca artifacts/question-factory/cuet-readiness-2026-10-08/staging/readOnlyCurrentStagingCheck.mjs
// Auth admin.generateLink creates an in-memory sign-in link; this check does not send emails.
import assert from 'node:assert/strict';
import { loadEnvFile } from 'node:process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

loadEnvFile('.env.local'); loadEnvFile('.env.staging');
const base = 'http://localhost:3101', project = process.env.STAGING_SUPABASE_URL;
if (project !== 'https://onwkqxmjqjrhfbjjdydu.supabase.co' || !process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || !process.env.STAGING_SUPABASE_ANON_KEY) throw Error('staging_identity_unavailable');
const boundedFetch = (url, init = {}, ms = 30000) => fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
const db = createClient(project, process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }, global: { fetch: (u, i = {}) => boundedFetch(u, i) } });
async function existingSession(email) {
  const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email }); if (error) throw error;
  let jar = [];
  const auth = createServerClient(project, process.env.STAGING_SUPABASE_ANON_KEY, { global: { fetch: (u, i = {}) => boundedFetch(u, i) }, cookies: { getAll: () => jar, setAll: v => { jar = v; } } });
  const { error: verifyError } = await auth.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: data.properties.verification_type });
  if (verifyError) throw verifyError;
  return jar.map(c => `${c.name}=${c.value}`).join('; ');
}
async function app(path, { cookie, timeout = path.startsWith('/api/admin/question-factory') ? 90000 : 30000 } = {}) {
  const response = await boundedFetch(base + path, { headers: cookie ? { Cookie: cookie } : {} }, timeout);
  let body = null; try { body = await response.json(); } catch {}
  return { status: response.status, body };
}
async function readAll(table, selection, pageSize = 500) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from(table).select(selection).order(table === 'question_factory_publications' ? 'question_id' : 'id').range(from, from + pageSize - 1);
    if (error) throw Error(`${table}_read_failed:${error.message}`);
    rows.push(...data); if (data.length < pageSize) return rows;
  }
}

const anonymous = await app('/api/admin/question-factory'); assert.equal(anonymous.status, 401);
const adminCookie = await existingSession('atishay07jain@gmail.com');
const studentCookie = await existingSession('factory-staging-student@example.com');
const studentAdmin = await app('/api/admin/question-factory', { cookie: studentCookie }); assert.equal(studentAdmin.status, 404);
const admin = await app('/api/admin/question-factory', { cookie: adminCookie }); assert.equal(admin.status, 200); assert.equal(admin.body.available, true);

const publishedRows = await readAll('question_factory_publications', 'question_id,kind,job_id,subject');
const localAll = JSON.parse(readFileSync('artifacts/question-factory/continuation-500/all-candidates.json', 'utf8'));
const expectedPublished = new Map(localAll.filter(r => r.state === 'published').map(r => [r.id, r]));
const currentV7Ids = new Set();
for (const path of ['artifacts/question-factory/cuet-readiness-baseline-100-2026-10-08/all-candidates.json', 'artifacts/question-factory/cuet-readiness-improved-100-2026-10-08/all-candidates.json']) {
  try { for (const row of JSON.parse(readFileSync(path, 'utf8'))) currentV7Ids.add(row.id); } catch { /* Improved arm may not have produced a candidate file yet. */ }
}
const rejectedIds = localAll.filter(r => r.state === 'quarantined').map(r => r.id);
const publicationIds = new Set(publishedRows.map(r => r.question_id));
const publicationStatus = {};
for (let i = 0; i < rejectedIds.length; i += 100) {
  const { data, error } = await db.from('questions').select('id,status,verification_state,is_deleted').in('id', rejectedIds.slice(i, i + 100));
  if (error) throw Error('rejected_bank_status_read_failed:' + error.message);
  for (const row of data) publicationStatus[row.id] = row;
}
const feedIds = new Set(), availableBySubject = {};
for (const subject of ['english', 'accountancy', 'business_studies', 'economics']) {
  let offset = 0, count = 0;
  for (;;) {
    const result = await app(`/api/questions/feed?subject=${subject}&limit=50&offset=${offset}`, { cookie: studentCookie });
    assert.equal(result.status, 200);
    const rows = result.body.questions || [];
    count += rows.length; for (const row of rows) feedIds.add(row.id);
    if (!result.body.hasMore) break;
    assert.ok(Number.isInteger(result.body.nextOffset) && result.body.nextOffset > offset, 'feed pagination must advance'); offset = result.body.nextOffset;
  }
  availableBySubject[subject] = count;
}
const missingPublished = [...expectedPublished.keys()].filter(id => !feedIds.has(id));
const rejectedAvailable = rejectedIds.filter(id => feedIds.has(id));
const rejectedStillStored = Object.values(publicationStatus).filter(r => !r.is_deleted && !['pending', 'quarantined', 'invalid', 'rejected'].includes(r.status) && r.verification_state !== 'disputed').map(r => r.id);
const matchedPublished = publishedRows.filter(r => expectedPublished.has(r.question_id));
const otherPublished = publishedRows.filter(r => !expectedPublished.has(r.question_id));
const currentV7Published = publishedRows.filter(r => currentV7Ids.has(r.question_id));
const currentV7MarkerRows = publishedRows.filter(r => /v7|cuet-readiness|reassessment/i.test(`${r.job_id} ${r.question_id}`));
const { data: ai, error: aiError } = await db.from('runtime_ai_budget').select('monthly_cap_usd').eq('id', 'student_ai').single(); if (aiError) throw aiError;
const registryBytes = readFileSync('data/source_registry.json'), registry = JSON.parse(registryBytes);
const evidence = {
  at: new Date().toISOString(), project_ref: 'onwkqxmjqjrhfbjjdydu', base, read_only: true,
  identities: { reused_existing_admin: true, reused_existing_student: true, emails_sent: 0 },
  authorization_checks: { anonymous_admin_status: anonymous.status, student_admin_status: studentAdmin.status, signed_admin_status: admin.status, admin_available: admin.body.available },
  counts: {
    staging_publications_total: publishedRows.length, admin_reported_total: admin.body.counts.total,
    admin_reported_usable_factory: admin.body.counts.usable_factory,
    legacy_campaign_published_expected: expectedPublished.size, legacy_campaign_published_found_in_publication_table: matchedPublished.length,
    legacy_campaign_published_retrieved_in_student_feed: expectedPublished.size - missingPublished.length,
    legacy_campaign_missing_from_feed: missingPublished.length,
    legacy_campaign_rejected_ids: rejectedIds.length, rejected_ids_available_in_feed: rejectedAvailable.length,
    rejected_ids_still_live_or_eligible_in_database: rejectedStillStored.length,
    additional_staging_publications_outside_legacy_published_set: otherPublished.length,
    new_v7_publications_by_job_or_id_marker: currentV7Published.length,
    v7_candidate_ids_checked: currentV7Ids.size,
    published_rows_with_v7_job_or_id_markers: currentV7MarkerRows.length,
    student_feed_available_by_subject: availableBySubject
  },
  student_ai_monthly_cap_usd: Number(ai.monthly_cap_usd),
  factory_control: admin.body.control ? { paused: admin.body.control.paused, phase: admin.body.control.phase, publication_enabled: admin.body.control.publication_enabled } : null,
  local_registry: { version: registry.version, sha256: createHash('sha256').update(registryBytes).digest('hex') },
  migration: { local_latest_file: '20261005185759_question_factory.sql', monthly_cap_file: '20261004120000_runtime_ai_monthly_cap.sql', applied_remote_version: null, note: 'PostgREST does not expose the Supabase migration ledger; existence of factory tables and monthly cap proves the required features, not the exact latest migration version.' },
  validation: { missing_published_ids: missingPublished.length, rejected_ids_in_feed: rejectedAvailable.length, rejected_ids_still_live_or_eligible: rejectedStillStored.length, passed: admin.body.counts.total === publishedRows.length && missingPublished.length === 0 && rejectedAvailable.length === 0 && rejectedStillStored.length === 0 && Number(ai.monthly_cap_usd) === 25 },
  paid_provider_calls: 0, production_writes: 0
};
writeFileSync('artifacts/question-factory/cuet-readiness-2026-10-08/staging/current-staging-read-only.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
