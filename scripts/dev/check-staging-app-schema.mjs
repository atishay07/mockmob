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
const functions = {
  insert_usage_events: { p_user_id: '__schema_check_no_such_user__', p_rows: [] },
  purge_usage_events: { retention_days: 100000 },
};
for (const [name, args] of Object.entries(functions)) {
  const { error } = await db.rpc(name, args);
  const missing = error && (error.code === 'PGRST202' || /could not find the function/i.test(error.message));
  console.log(`${missing ? 'MISSING' : 'ok     '} function ${name}${error && !missing ? `  (responded: ${error.code})` : ''}`);
  if (missing) ok = false;
}
console.log(ok ? 'All app tables and probed functions are present on staging.' : 'Some objects are missing.');
process.exit(ok ? 0 : 1);
