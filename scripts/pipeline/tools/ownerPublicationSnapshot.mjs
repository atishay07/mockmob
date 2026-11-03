// Read-only production accounting. No auth session creation, paid calls, or writes.
import { loadEnvFile } from 'node:process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { readAllRows } from '../lib/bankSnapshot.mjs';
import { buildStagingWithholdingSelection } from '../lib/reassessmentWithholdingStagingVNext.mjs';

if (!process.argv.includes('--production-read')) throw Error('explicit_production_read_required');
loadEnvFile('.env.local');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (url !== 'https://isrxrxzjocewrdureyhp.supabase.co') throw Error('production_identity_mismatch');
const bounded = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(45000) });
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: bounded },
});
const root = 'artifacts/question-factory/cuet-readiness-2026-10-08';
const snapshot = root + '/execution/reassessment/snapshot-20261008T060712941Z';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const selection = buildStagingWithholdingSelection(read(snapshot + '/bank-reassessment-export.json'), read(snapshot + '/dry-run-withholding-plan.json'));
const [publicationRows, questions] = await Promise.all([
  readAllRows(db, 'question_factory_publications', 'question_id', 'question_id'),
  readAllRows(db, 'questions', 'id,subject,status,is_deleted,verification_state,exploration_state,created_at'),
]);
const publishedIds = new Set(publicationRows.map(row => row.question_id));
const factoryQuestions = questions.filter(row => publishedIds.has(row.id));
const served = new Set(), feedChecks = [];
for (const subject of ['english', 'accountancy', 'business_studies', 'economics']) {
  let offset = 0, pages = 0, ended = false;
  const ids = [];
  while (pages < 40) {
    const response = await bounded(`https://www.mockmob.in/api/questions/feed?subject=${subject}&limit=50&offset=${offset}`);
    if (response.status !== 200) throw Error(`production_feed_http_${response.status}:${subject}`);
    const body = await response.json();
    if (!Array.isArray(body.questions)) throw Error('production_feed_schema_invalid');
    ids.push(...body.questions.map(question => question.id));
    body.questions.forEach(question => served.add(question.id));
    pages++;
    if (!body.hasMore) { ended = true; break; }
    if (!Number.isSafeInteger(body.nextOffset) || body.nextOffset <= offset) throw Error('production_feed_pagination_invalid');
    offset = body.nextOffset;
  }
  if (!ended) throw Error('production_feed_page_bound_exceeded');
  feedChecks.push({ subject, returned: ids.length, unique_returned: new Set(ids).size, pages });
}
const liveFactoryIds = factoryQuestions.filter(row => !row.is_deleted &&
  (row.status === 'live' || (row.verification_state === 'verified' && row.exploration_state === 'active'))).map(row => row.id);
const proof = { at: new Date().toISOString(), production_project: 'isrxrxzjocewrdureyhp',
  publication_receipt_rows: publicationRows.length, distinct_publication_question_ids: publishedIds.size,
  factory_question_rows: factoryQuestions.length, factory_rows_visible_by_database_state: liveFactoryIds.length,
  production_feed_unique: served.size, factory_publications_retrieved: [...publishedIds].filter(id => served.has(id)).length,
  published_ids_not_retrieved: [...publishedIds].filter(id => !served.has(id)), feed_checks: feedChecks,
  reassessment_flagged_with_group_closure: selection.ids.length,
  reassessment_flagged_still_served_in_production: selection.ids.filter(id => served.has(id)).length,
  flagged_still_served_ids: selection.ids.filter(id => served.has(id)),
  current_v7_newly_published: 0,
  academic_limit: 'Production availability under legacy evidence is separate from current CUET qualification. Flagged reassessment is an unreleased contract decision, not a proof every flagged item is wrong.',
  paid_provider_calls: 0, production_writes: 0, auth_sessions_created: 0,
};
writeFileSync(root + '/execution/production-publication-accountability.json', JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify({ ...proof, flagged_still_served_ids: undefined, published_ids_not_retrieved: proof.published_ids_not_retrieved.length }));
