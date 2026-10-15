import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { TOP_DAYS, TOP_LIMIT } from '@/lib/server/appErrors';

// Postgres 42P01 and PostgREST PGRST205 / PGRST202 / 42883 mean the table or function is not there yet
// (migration 20261016100000 not applied, or undone): treated as "not set up", not as a crash.
const MISSING = new Set(['42P01', 'PGRST205', 'PGRST202', '42883']);

// The student's consent record. Only the consent fields are read; the id used for the lookup is not kept.
export async function loadConsentFor(userId) {
  try {
    const { data, error } = await supabaseAdmin()
      .from('usage_consent')
      .select('age_band,analytics_allowed,withdrawn_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return { error: true };
    return { consent: data };
  } catch {
    return { error: true };
  }
}

// Stores scrubbed rows (one per hash). Only the error code is logged: nothing about a report goes to a log line.
export async function recordAppErrors(rows) {
  try {
    const { error } = await supabaseAdmin().rpc('app_error_record', { p_rows: rows });
    if (error) {
      console.warn('[app-errors] record failed', error.code || 'unknown');
      return { ok: false, notSetUp: MISSING.has(error.code) };
    }
    return { ok: true };
  } catch {
    console.warn('[app-errors] record failed', 'exception');
    return { ok: false, notSetUp: false };
  }
}

// Read-only, for the admin page.
export async function loadTopAppErrors() {
  try {
    const { data, error } = await supabaseAdmin().rpc('app_errors_top', { p_days: TOP_DAYS, p_limit: TOP_LIMIT });
    if (error) return { rows: [], notSetUp: MISSING.has(error.code), failed: !MISSING.has(error.code) };
    return { rows: data || [], notSetUp: false, failed: false };
  } catch {
    return { rows: [], notSetUp: false, failed: true };
  }
}
