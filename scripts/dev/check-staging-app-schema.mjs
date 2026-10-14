// Read-only check that the app migrations exist on the STAGING project. Selects zero rows from each
// new table and probes each new function with arguments that cannot change data (or only reads).
// Usage: node scripts/dev/check-staging-app-schema.mjs
import { loadEnvFile } from 'node:process';
import { createClient } from '@supabase/supabase-js';

loadEnvFile('.env.staging');
const target = 'https://onwkqxmjqjrhfbjjdydu.supabase.co';
if (process.env.STAGING_SUPABASE_URL !== target) throw Error('wrong_staging_project');
const db = createClient(target, process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const tables = ['usage_consent', 'usage_events', 'notification_prefs', 'push_devices', 'study_goals', 'study_goal_history',
  'account_deletion_requests', 'sample_imports', 'session_check_log', 'public_inventory_snapshot'];
let ok = true;
for (const t of tables) {
  const { error } = await db.from(t).select('*', { head: true, count: 'exact' }).limit(0);
  console.log(`${error ? 'MISSING' : 'ok     '} table ${t}${error ? `  (${error.code}: ${error.message})` : ''}`);
  if (error) ok = false;
}
// Functions: an unknown function returns PGRST202; any other answer (including argument errors) means it exists.
// Each probe either only reads or fails before writing (unknown ids, an unknown user for a foreign key).
const functions = {
  insert_usage_events: { p_user_id: '__schema_check_no_such_user__', p_rows: [] },
  purge_usage_events: { retention_days: 100000 },
  finalise_expired_recovery_session: { p_id: '__schema_check_no_such_session__', p_result: {} },
  quarantine_recovery_session: { p_id: '__schema_check_no_such_session__', p_reason: 'schema_check', p_max: 5 },
  account_deletion_run: { p_request_id: -1, p_user_id: '__schema_check_no_such_user__', p_steps: [], p_apply: false },
  save_sample_import: { p_user_id: '__schema_check_no_such_user__', p_import_key: '__schema_check_key__', p_sample_version: 'check',
    p_subject: 'english', p_answers: [], p_correct: 0, p_total: 1 },
};
for (const [name, args] of Object.entries(functions)) {
  const { error } = await db.rpc(name, args);
  const missing = error && (error.code === 'PGRST202' || /could not find the function/i.test(error.message));
  console.log(`${missing ? 'MISSING' : 'ok     '} function ${name}${error && !missing ? `  (responded: ${error.code})` : ''}`);
  if (missing) ok = false;
}
{
  const { error } = await db.from('users').select('deleted_at', { head: true }).limit(0);
  console.log(`${error ? 'MISSING' : 'ok     '} column users.deleted_at${error ? `  (${error.code}: ${error.message})` : ''}`);
  if (error) ok = false;
}
console.log(ok ? 'All app tables and probed functions are present on staging.' : 'Some objects are missing.');
process.exit(ok ? 0 : 1);
