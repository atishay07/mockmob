#!/usr/bin/env node
// Operator script: fulfil pending account_deletion_requests (Google Play requirement).
//
//   node scripts/ops/process-account-deletions.mjs --target=staging            dry run (default)
//   node scripts/ops/process-account-deletions.mjs --target=production --grace-days=0 --user=<id>
//   MOCKMOB_DELETION_CONFIRM=<today YYYY-MM-DD> node scripts/ops/process-account-deletions.mjs --target=staging --apply
//
// Flags: --target=staging|production (required, must match the configured URL)
//        --apply            really delete (needs MOCKMOB_DELETION_CONFIRM=<today's date>)
//        --grace-days=N     only requests at least N days old (default 0, or MOCKMOB_DELETION_GRACE_DAYS)
//        --user=<users.id>  restrict to one user     --limit=N  process at most N requests
//        --json             machine-readable output
// Env:   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from the environment or .env.local),
//        MOCKMOB_STAGING_SUPABASE_URL and MOCKMOB_PRODUCTION_SUPABASE_URL (the URLs --target is checked against).
// Needs migration 20261013120000_deletion_processor.sql applied on the target first.

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  checkRunGuards, formatPlan, parseGraceDays, processRequests,
  selectDueRequests, supabaseAdapter, supabaseAuthDeleter,
} from '../../src/lib/server/accountDeletion.js';

function parseArgs(argv) {
  return Object.fromEntries(argv.map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.length ? rest.join('=') : true];
  }));
}

function loadEnvFile(path = '.env.local') {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(fs.readFileSync(path, 'utf8').split(/\r?\n/)
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = { ...loadEnvFile(), ...process.env };
  const json = args.json === true;
  const say = (text) => { if (!json) console.log(text); };

  const guard = checkRunGuards({
    apply: args.apply === true, target: args.target,
    configuredUrl: env.NEXT_PUBLIC_SUPABASE_URL, env,
  });
  if (!guard.ok) { console.error(`Refused (${guard.code}): ${guard.message}`); process.exit(2); }
  if (!env.SUPABASE_SERVICE_ROLE_KEY) { console.error('Refused (key_unset): SUPABASE_SERVICE_ROLE_KEY is missing.'); process.exit(2); }

  const graceDays = parseGraceDays(args['grace-days'], parseGraceDays(env.MOCKMOB_DELETION_GRACE_DAYS, 0));
  const limit = args.limit && args.limit !== true ? Math.max(1, Number(args.limit) || 0) : Infinity;
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const adapter = supabaseAdapter(client);

  let due = selectDueRequests(await adapter.listPendingRequests(), { graceDays });
  if (args.user && args.user !== true) due = due.filter((r) => r.user_id === args.user);
  due = due.slice(0, limit);

  say(`${guard.apply ? 'APPLY' : 'DRY RUN'} on ${args.target}: ${due.length} due request(s), grace ${graceDays} day(s).`);
  const report = { mode: guard.apply ? 'apply' : 'dry-run', target: args.target, graceDays, requests: [] };
  const deleteAuthUser = guard.apply ? supabaseAuthDeleter(client) : null;

  const run = await processRequests({
    adapter, due, apply: guard.apply, deleteAuthUser,
    onPlan: (plan) => say(formatPlan(plan)),
    onDone: (done) => say(`  completed; auth user ${done.auth.deleted ? `removed (${done.auth.ids.join(', ')})` : 'not found (nothing to remove)'}`),
    onFail: (request, message) => console.error(`  request ${request.id} FAILED, left pending: ${message}`),
  });
  report.requests = run.results;
  const failed = run.failed;
  if (run.aborted) {
    report.aborted = true;
    console.error(`  ABORTING: stopped after the first failed apply; ${run.skipped} remaining request(s) were not touched.`);
  }

  if (json) console.log(JSON.stringify(report, null, 2));
  else if (!guard.apply && due.length) say('Dry run only. Nothing was changed. Re-run with --apply and MOCKMOB_DELETION_CONFIRM=<today> to execute.');
  if (failed) process.exit(1);
}

main().catch((e) => { console.error(e?.message || e); process.exit(1); });
