import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Append a row to audit_logs. Best-effort: never throws back into the
 * caller's flow — admin mutations should still succeed even if audit
 * insert fails (and we log to stderr so it's recoverable later).
 *
 * @param {Object} entry
 * @param {string|null} [entry.actorId]     - users.id of the actor (admin or creator)
 * @param {string|null} [entry.actorEmail]  - email at time of action
 * @param {string|null} [entry.actorRole]   - role at time of action ('admin'|'creator'|...)
 * @param {string} entry.action             - e.g. 'creator.create', 'code.disable'
 * @param {string|null} [entry.targetType]  - 'creator', 'discount_code', 'order', etc.
 * @param {string|null} [entry.targetId]    - id of the target row
 * @param {Object} [entry.metadata]         - extra context (sanitised — no secrets)
 * @param {string|null} [entry.ipAddress]
 */
export async function writeAudit(entry) {
  try {
    await supabaseAdmin().from('audit_logs').insert({
      actor_id: entry.actorId || null,
      actor_email: entry.actorEmail || null,
      actor_role: entry.actorRole || null,
      action: entry.action,
      target_type: entry.targetType || null,
      target_id: entry.targetId || null,
      metadata: entry.metadata || {},
      ip_address: entry.ipAddress || null,
    });
  } catch (e) {
    console.error('[audit] failed to write audit log', { entry, error: e?.message });
  }
}
