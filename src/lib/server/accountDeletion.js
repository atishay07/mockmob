// Account deletion processor core (module B6). Pure planning and orchestration; no Next.js or
// Supabase imports so the operator script and node:test can load it directly.
//
// Where the work happens: the per-user transaction is the SQL function public.account_deletion_run
// (migration 20261013120000_deletion_processor.sql). This file owns the step list (what is deleted,
// anonymised or kept, and why), picks due requests, builds the plan and drives the executor.
//
// Legal/financial rule: payment, order, receipt, credit-ledger and payout records are KEPT because
// they are tied to money. The users row they reference is kept as an anonymised tombstone (a
// delete would cascade into payments), and personal fields inside kept rows are minimised.

const DAY_MS = 86_400_000;

const RAW_ORDER_KEEP = ['id', 'entity', 'amount', 'amount_paid', 'amount_due', 'currency', 'receipt', 'status', 'created_at'];
const RAW_PAYMENT_KEEP = ['id', 'entity', 'amount', 'currency', 'status', 'order_id', 'subscription_id', 'method', 'captured', 'created_at'];
const RAW_SUBSCRIPTION_KEEP = ['id', 'entity', 'plan_id', 'status', 'total_count', 'paid_count', 'current_start', 'current_end', 'start_at', 'end_at', 'created_at'];

const own = (column = 'user_id') => [{ column }];
const viaAttempt = (column = 'attempt_id') => [{ column, parent_table: 'attempts', parent_key: 'id', parent_user: 'user_id' }];

/**
 * Ordered, children before parents (several study and recovery tables reference users or attempts
 * without ON DELETE CASCADE, so order matters). Each step: {table, action, match, set?, why}.
 */
export const DELETION_STEPS = Object.freeze([
  // Study, recovery and learning records.
  { table: 'study_events', action: 'delete', match: own(), why: 'study activity' },
  { table: 'study_card_states', action: 'delete', match: own(), why: 'study card state' },
  { table: 'study_runs', action: 'delete', match: own(), why: 'study runs' },
  { table: 'study_preferences', action: 'delete', match: own(), why: 'study preferences' },
  { table: 'learning_observations', action: 'delete', match: own(), why: 'learning responses' },
  { table: 'learning_episodes', action: 'delete', match: own(), why: 'learning episodes' },
  { table: 'learning_allowances', action: 'delete', match: own(), why: 'learning allowances' },
  { table: 'learning_family_exposure', action: 'delete', match: own(), why: 'exposure history' },
  { table: 'learning_question_exposure', action: 'delete', match: own(), why: 'exposure history' },
  { table: 'recovery_review_queue', action: 'delete', match: own(), why: 'recovery queue' },
  { table: 'recovery_playbook', action: 'delete', match: own(), why: 'recovery playbook' },
  { table: 'revise_cards', action: 'delete', match: own(), why: 'Revise schedule' },
  { table: 'attempt_recalculation_queue', action: 'delete', match: viaAttempt(), why: 'derived from the user\'s attempts' },
  { table: 'attempt_score_revisions', action: 'delete', match: viaAttempt(), why: 'derived from the user\'s attempts' },
  { table: 'recovery_sessions', action: 'delete', match: own(), why: 'recovery and practice sessions' },
  { table: 'session_check_log', action: 'delete', match: own(), why: 'practice answer checks' },
  { table: 'sample_imports', action: 'delete', match: own(), why: 'guest sample import' },
  // Progress, answers, interactions.
  { table: 'question_bookmarks', action: 'delete', match: own(), why: 'bookmarks' },
  { table: 'user_question_progress', action: 'delete', match: own(), why: 'question progress' },
  { table: 'question_votes', action: 'delete', match: own(), why: 'votes' },
  { table: 'question_interactions', action: 'delete', match: own(), why: 'interactions' },
  { table: 'user_question_answer_credits', action: 'delete', match: own(), why: 'per-answer credit markers' },
  { table: 'user_daily_login_credits', action: 'delete', match: own(), why: 'daily login markers' },
  { table: 'attempts', action: 'delete', match: own(), why: 'mock and practice attempts' },
  // AI and mentor.
  { table: 'rival_battle_answers', action: 'delete', match: own(), why: 'rival answers' },
  { table: 'rival_battles', action: 'delete', match: own(), why: 'rival battles' },
  { table: 'mentor_messages', action: 'delete', match: own(), why: 'mentor chat' },
  { table: 'mentor_sessions', action: 'delete', match: own(), why: 'mentor chat' },
  { table: 'ai_reply_reports', action: 'delete', match: own(), why: 'reports about AI replies' },
  { table: 'ai_usage_logs', action: 'delete', match: own(), why: 'AI usage log' },
  { table: 'ai_credit_reservations', action: 'delete', match: own(), why: 'operational credit holds (final charges stay in the ledger)' },
  { table: 'ai_credit_wallets', action: 'delete', match: own(), why: 'wallet balance is forfeited with the account' },
  // App and notifications.
  { table: 'notification_outbox', action: 'delete', match: own(), why: 'queued notifications' },
  { table: 'push_devices', action: 'delete', match: own(), why: 'push tokens' },
  { table: 'notification_prefs', action: 'delete', match: own(), why: 'notification settings' },
  { table: 'study_goal_history', action: 'delete', match: own(), why: 'goal history' },
  { table: 'study_goals', action: 'delete', match: own(), why: 'weekly goal' },
  { table: 'my_colleges', action: 'delete', match: own(), why: 'saved college list' },
  // The Mob (SOCIAL-SPEC P9). The users row is kept as a tombstone, so its foreign keys never cascade: each table is
  // named here, children first. A deleted member leaves the ring; a Mob left with no members can no longer be joined.
  { table: 'mob_nudge_seen', action: 'delete', match: [{ column: 'to_user' }, { column: 'from_user' }], why: 'Mob nudges seen' },
  { table: 'mob_nudges', action: 'delete', match: [{ column: 'from_user' }], why: 'Mob nudges sent' },
  { table: 'mob_sittings', action: 'delete', match: own(), why: 'Mob paper sittings' },
  { table: 'mob_members', action: 'delete', match: own(), why: 'Mob membership and display name' },
  { table: 'mob_blocks', action: 'delete', match: [{ column: 'blocker_id' }, { column: 'blocked_id' }], why: 'Mob blocks' },
  {
    table: 'mob_invites', action: 'anonymise', match: own('created_by'), why: 'invite links keep no creator',
    set: [{ column: 'created_by', value: 'null' }],
  },
  {
    table: 'mob_reports', action: 'anonymise', match: [{ column: 'reporter_id' }, { column: 'reported_id' }],
    why: 'reports keep the reason and the reported name for moderation, with no user link (purged after 180 days)',
    set: [{ column: 'reporter_id', value: 'null' }, { column: 'reported_id', value: 'null' }],
  },
  { table: 'usage_events', action: 'delete', match: own(), why: 'analytics events' },
  { table: 'usage_consent', action: 'delete', match: own(), why: 'analytics consent' },
  // Kept for legal/financial reasons, with personal fields minimised.
  {
    table: 'payments', action: 'anonymise', match: own(),
    why: 'payment records are required by law; raw gateway payloads are cut to non-personal fields',
    set: [
      { column: 'raw_order', value: { scrub_json: RAW_ORDER_KEEP } },
      { column: 'raw_payment', value: { scrub_json: RAW_PAYMENT_KEEP } },
      { column: 'raw_subscription', value: { scrub_json: RAW_SUBSCRIPTION_KEEP } },
    ],
  },
  { table: 'credit_transactions', action: 'keep', match: own(), why: 'credit ledger tied to purchases and spends' },
  { table: 'ai_credit_ledger', action: 'keep', match: own(), why: 'credit ledger tied to purchases and spends' },
  {
    table: 'runtime_ai_requests', action: 'anonymise', match: own(),
    why: 'provider cost records feed the monthly AI budget; the link to the student is removed, the cost rows stay',
    set: [{ column: 'user_id', value: 'null' }],
  },
  {
    table: 'creators', action: 'anonymise', match: own(),
    why: 'payout records are required by law; the account link, email and notes are removed, name and code stay on the payee record',
    set: [
      { column: 'user_id', value: 'null' },
      { column: 'email', value: 'null' },
      { column: 'notes', value: 'null' },
    ],
  },
  {
    table: 'audit_logs', action: 'anonymise', match: own('actor_id'),
    why: 'security trail is kept without the person',
    set: [
      { column: 'actor_id', value: 'tombstone_id' },
      { column: 'actor_email', value: 'null' },
      { column: 'ip_address', value: 'null' },
      { column: 'metadata', value: { json: '{}' } },
    ],
  },
  {
    table: 'questions', action: 'anonymise', match: [{ column: 'author_id' }, { column: 'uploaded_by' }],
    why: 'contributed questions stay in the bank without an author',
    set: [
      { column: 'author_id', value: 'null' },
      { column: 'uploaded_by', value: 'null' },
    ],
  },
  // Last: the user row is the tombstone the kept records point at.
  {
    table: 'users', action: 'anonymise', match: own('id'),
    why: 'kept payment and ledger rows reference this id; every personal field is replaced',
    set: [
      { column: 'email', value: 'tombstone_email' },
      { column: 'username', value: 'tombstone_username' },
      { column: 'name', value: { literal: 'Deleted user' } },
      { column: 'image', value: 'null' },
      { column: 'subjects', value: 'default' },
      { column: 'last_active_at', value: 'null' },
      { column: 'deleted_at', value: 'now' },
    ],
  },
]);

export class DeletionError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

// ---------------------------------------------------------------------------------------------
// Guards and request selection (pure)
// ---------------------------------------------------------------------------------------------

export function parseGraceDays(value, fallback = 0) {
  if (value === undefined || value === null || value === '' || value === true) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 365) throw new DeletionError('bad_grace', 'Grace days must be a number from 0 to 365.');
  return n;
}

/** Requests that are pending and at least graceDays old. Oldest first. */
export function selectDueRequests(rows, { now = Date.now(), graceDays = 0 } = {}) {
  const cutoff = now - graceDays * DAY_MS;
  return (rows || [])
    .filter((r) => r && r.status === 'pending' && Date.parse(r.requested_at) <= cutoff)
    .sort((a, b) => Date.parse(a.requested_at) - Date.parse(b.requested_at) || Number(a.id) - Number(b.id));
}

function pad(n) { return String(n).padStart(2, '0'); }
export function localDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function utcDate(d) { return d.toISOString().slice(0, 10); }

function origin(url) {
  try { const u = new URL(url); return `${u.protocol}//${u.host.toLowerCase()}`; } catch { return null; }
}

/**
 * Decides whether the script may talk to the configured database at all, and whether it may apply.
 * - --target=staging|production is mandatory (dry run reads real data too).
 * - The configured URL must equal MOCKMOB_STAGING_SUPABASE_URL / MOCKMOB_PRODUCTION_SUPABASE_URL.
 * - Applying needs --apply and MOCKMOB_DELETION_CONFIRM equal to today's date (local or UTC).
 */
export function checkRunGuards({ apply = false, target, configuredUrl, env = {}, now = new Date() }) {
  if (target !== 'staging' && target !== 'production') {
    return { ok: false, code: 'target_required', message: 'Pass --target=staging or --target=production explicitly.' };
  }
  const expected = env[target === 'staging' ? 'MOCKMOB_STAGING_SUPABASE_URL' : 'MOCKMOB_PRODUCTION_SUPABASE_URL'];
  const name = target === 'staging' ? 'MOCKMOB_STAGING_SUPABASE_URL' : 'MOCKMOB_PRODUCTION_SUPABASE_URL';
  if (!expected) return { ok: false, code: 'target_url_unset', message: `Set ${name} to the ${target} Supabase URL so the target can be checked.` };
  const configured = origin(configuredUrl);
  if (!configured) return { ok: false, code: 'url_unset', message: 'NEXT_PUBLIC_SUPABASE_URL is missing or not a URL.' };
  if (configured !== origin(expected)) {
    return { ok: false, code: 'target_mismatch', message: `Configured Supabase URL (${configured}) does not match the ${target} URL in ${name}. Nothing was contacted.` };
  }
  if (!apply) return { ok: true, apply: false };
  const confirm = String(env.MOCKMOB_DELETION_CONFIRM || '').trim();
  if (!confirm || (confirm !== localDate(now) && confirm !== utcDate(now))) {
    return { ok: false, code: 'confirm_required', message: `Applying needs MOCKMOB_DELETION_CONFIRM=${localDate(now)} (today's date).` };
  }
  return { ok: true, apply: true };
}

// ---------------------------------------------------------------------------------------------
// Planner and executor
// ---------------------------------------------------------------------------------------------
//
// adapter: {
//   listPendingRequests(): Promise<{id, user_id, requested_at, source, status}[]>,
//   getUser(userId): Promise<{id, email}|null>,
//   run(request, steps, apply): Promise<{steps, unclassified}>   // the SQL function
// }

export function summarisePlan(steps) {
  const totals = { delete: 0, anonymise: 0, keep: 0 };
  for (const s of steps) if (s.present) totals[s.action] += Number(s.rows) || 0;
  return totals;
}

export async function planDeletion(adapter, request) {
  const raw = await adapter.run(request, DELETION_STEPS, false);
  const byTable = new Map((raw.steps || []).map((s) => [s.table, s]));
  const steps = DELETION_STEPS.map((def) => {
    const r = byTable.get(def.table) || {};
    return {
      table: def.table, action: def.action, why: def.why,
      rows: Number(r.rows) || 0, present: r.present !== false && !!byTable.has(def.table),
      skippedColumns: r.skippedColumns || [],
    };
  });
  const unclassified = raw.unclassified || [];
  return {
    requestId: request.id, userId: request.user_id, requestedAt: request.requested_at,
    steps, unclassified, totals: summarisePlan(steps), blocked: unclassified.length > 0,
  };
}

/**
 * Applies one request. Order: resolve the auth identity, delete the auth user (not-found counts as
 * done), then run the data transaction and mark the request completed. The auth user goes first
 * because every later failure is retryable (the request stays pending and a repeat treats an
 * already-removed auth user as success), whereas a data transaction that committed with a live login
 * would let the person recreate an empty profile and leave the request unfinishable.
 * Refuses to touch anything when the plan is blocked by unclassified user data.
 */
export async function executeDeletion({ adapter, request, deleteAuthUser, plan }) {
  const p = plan || await planDeletion(adapter, request);
  if (p.blocked) {
    throw new DeletionError('unclassified_user_data', `Refusing: user data found in unclassified tables (${p.unclassified.map((u) => u.table).join(', ')}). Add them to DELETION_STEPS.`);
  }
  const user = await adapter.getUser(request.user_id);
  let auth = { deleted: false, skipped: true };
  if (deleteAuthUser) auth = { skipped: false, ...(await deleteAuthUser({ userId: request.user_id, email: user?.email || null })) };
  const result = await adapter.run(request, DELETION_STEPS, true);
  return { requestId: request.id, userId: request.user_id, auth, steps: result.steps, totals: summarisePlan(result.steps) };
}

/**
 * Process due requests one by one. In dry-run mode failures are recorded and the run continues. In apply
 * mode the first failure aborts the whole run: the auth user is removed before the data transaction, so a
 * deterministic failure (missing grant, foreign key) would otherwise strip the login of every pending user
 * while their requests stay pending.
 */
export async function processRequests({ adapter, due, apply, deleteAuthUser, onPlan, onDone, onFail }) {
  const results = [];
  let failed = 0;
  let aborted = false;
  for (const request of due) {
    try {
      const plan = await planDeletion(adapter, request);
      if (onPlan) onPlan(plan);
      if (!apply) { results.push({ ...plan, status: plan.blocked ? 'blocked' : 'planned' }); continue; }
      const done = await executeDeletion({ adapter, request, deleteAuthUser, plan });
      if (onDone) onDone(done);
      results.push({ ...plan, status: 'completed', auth: done.auth });
    } catch (e) {
      failed += 1;
      const message = e instanceof DeletionError ? `${e.code}: ${e.message}` : String(e?.message || e);
      if (onFail) onFail(request, message);
      results.push({ requestId: request.id, userId: request.user_id, status: 'failed', error: message });
      if (apply) { aborted = true; break; }
    }
  }
  return { results, failed, aborted, skipped: aborted ? due.length - results.length : 0 };
}

export function formatPlan(plan) {
  const lines = [`request ${plan.requestId}  user ${plan.userId}  requested ${plan.requestedAt}`];
  for (const s of plan.steps) {
    if (!s.present) { lines.push(`  ${s.action.padEnd(9)} ${s.table.padEnd(30)} absent`); continue; }
    if (!s.rows) continue;
    lines.push(`  ${s.action.padEnd(9)} ${s.table.padEnd(30)} ${String(s.rows).padStart(6)}  ${s.why}${s.skippedColumns.length ? `  (cannot clear: ${s.skippedColumns.join(', ')})` : ''}`);
  }
  lines.push(`  totals: delete ${plan.totals.delete}, anonymise ${plan.totals.anonymise}, keep ${plan.totals.keep}`);
  if (plan.blocked) lines.push(`  BLOCKED: unclassified tables hold this user's data: ${plan.unclassified.map((u) => `${u.table} (${u.rows})`).join(', ')}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------
// Supabase adapters (used by the operator script)
// ---------------------------------------------------------------------------------------------

export function supabaseAdapter(client) {
  return {
    async listPendingRequests() {
      const { data, error } = await client.from('account_deletion_requests')
        .select('id, user_id, requested_at, source, status').eq('status', 'pending').order('requested_at', { ascending: true });
      if (error) throw new DeletionError('list_failed', error.message);
      return data || [];
    },
    async getUser(userId) {
      const { data, error } = await client.from('users').select('id, email').eq('id', userId).maybeSingle();
      if (error) throw new DeletionError('user_lookup_failed', error.message);
      return data || null;
    },
    async run(request, steps, apply) {
      const { data, error } = await client.rpc('account_deletion_run', {
        p_request_id: request.id, p_user_id: request.user_id, p_steps: steps, p_apply: !!apply,
      });
      if (error) throw new DeletionError('run_failed', error.message);
      return data;
    },
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Removes the Supabase auth identity. users.id may be a legacy id, so the auth user is found by id
 * (when it is a uuid) and by exact email (paginated listUsers, cached for the run).
 */
export function supabaseAuthDeleter(client) {
  let directory = null;
  async function loadDirectory() {
    if (directory) return directory;
    directory = new Map();
    for (let page = 1; page < 1000; page += 1) {
      const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new DeletionError('auth_list_failed', error.message);
      const users = data?.users || [];
      for (const u of users) if (u.email) directory.set(u.email.toLowerCase(), u.id);
      if (users.length < 1000) break;
    }
    return directory;
  }
  const notFound = (e) => e && (e.status === 404 || /not.?found/i.test(e.message || e.code || ''));
  return async ({ userId, email }) => {
    const ids = new Set();
    if (UUID.test(userId)) ids.add(userId);
    if (email) { const id = (await loadDirectory()).get(email.toLowerCase()); if (id) ids.add(id); }
    const deleted = [];
    for (const id of ids) {
      const { error } = await client.auth.admin.deleteUser(id, false);
      if (error && !notFound(error)) throw new DeletionError('auth_delete_failed', `Auth delete failed for ${id}: ${error.message}`);
      if (!error) deleted.push(id);
    }
    return { deleted: deleted.length > 0, ids: deleted };
  };
}
