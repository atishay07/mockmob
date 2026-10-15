import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { evaluateSignupCount } from '@/lib/server/funnel';

// Postgres 42P01 and PostgREST PGRST205 / PGRST202 mean the table or function is not there yet
// (migration 20261015233000 not applied, or undone): treat as "not set up", not as a crash.
const MISSING = new Set(['42P01', 'PGRST205', 'PGRST202', '42883']);

// Adds 1 to today's counter for (step, platform). Both are whitelisted categories; the database checks
// them again. Nothing else about the request reaches this function.
export async function incrementFunnel(step, platform) {
  try {
    const { error } = await supabaseAdmin().rpc('funnel_increment', { p_step: step, p_platform: platform });
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

// Counts one finished sign-up (signup_complete) under the platform of the request. Called once, where
// the account row is first created (ensureDbUser in src/lib/server/cookieSession.js, wired in
// src/lib/auth.ts). headers is the Headers of the request, or null when none is in scope. It reads the
// User-Agent only to pick a category and keeps nothing else. Never throws, and never blocks sign-up.
export async function countSignup(headers) {
  try {
    const decision = evaluateSignupCount({ headers });
    if (!decision.ok) return { ok: false, skipped: decision.reason };
    return await incrementFunnel(decision.step, decision.platform);
  } catch {
    return { ok: false };
  }
}

// Read-only. fromDay is YYYY-MM-DD; the table is tiny (one row per day, step and platform: at most 35 a day).
export async function loadFunnelRows(fromDay) {
  try {
    const { data, error } = await supabaseAdmin()
      .from('funnel_daily')
      .select('day,step,platform,count')
      .gte('day', fromDay)
      .order('day', { ascending: true })
      .limit(2000);
    if (error) return { rows: [], notSetUp: MISSING.has(error.code), failed: !MISSING.has(error.code) };
    return { rows: data || [], notSetUp: false, failed: false };
  } catch {
    return { rows: [], notSetUp: false, failed: true };
  }
}
