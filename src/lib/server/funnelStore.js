import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';

// Postgres 42P01 and PostgREST PGRST205 / PGRST202 mean the table or function is not there yet
// (migration 20261015233000 not applied, or undone): treat as "not set up", not as a crash.
const MISSING = new Set(['42P01', 'PGRST205', 'PGRST202', '42883']);

export async function incrementFunnel(step) {
  try {
    const { error } = await supabaseAdmin().rpc('funnel_increment', { p_step: step });
    if (error) {
      // Only the error code is logged: nothing about the request goes into a log line.
      console.warn('[funnel] increment failed', error.code || 'unknown');
      return { ok: false, notSetUp: MISSING.has(error.code) };
    }
    return { ok: true };
  } catch {
    console.warn('[funnel] increment failed', 'exception');
    return { ok: false, notSetUp: false };
  }
}

// Read-only. fromDay is YYYY-MM-DD; the table is tiny (one row per day and step).
export async function loadFunnelRows(fromDay) {
  try {
    const { data, error } = await supabaseAdmin()
      .from('funnel_daily')
      .select('day,step,count')
      .gte('day', fromDay)
      .order('day', { ascending: true })
      .limit(2000);
    if (error) return { rows: [], notSetUp: MISSING.has(error.code), failed: !MISSING.has(error.code) };
    return { rows: data || [], notSetUp: false, failed: false };
  } catch {
    return { rows: [], notSetUp: false, failed: true };
  }
}
