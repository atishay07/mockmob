import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { roadOut } from '@/lib/today/road.mjs';

// The Road to May's exam date and mock target on the account (supabase/migrations/20261017150000_study_road_fields.sql,
// two columns on study_goals). The code ships before the migration is applied, so it feature-detects the columns:
// a missing column reads as { onAccount: false } (the page shows the expected window and a suggested target, with
// the tokens saying the choice is not on the account yet), and a save is refused with ROAD_NOT_ON_ACCOUNT.

const fail = (msg, cause) => Object.assign(new Error(msg), { cause });
/** Postgres undefined_column, or PostgREST's "column not in the schema cache". */
export const missingColumn = (error) => Boolean(error) && (error.code === '42703' || error.code === 'PGRST204' || /exam_date|mock_target/.test(String(error.message || '')) && /does not exist|schema cache/.test(String(error.message || '')));

export async function getRoad(userId, db = supabaseAdmin()) {
  const { data, error } = await db.from('study_goals').select('exam_date,mock_target').eq('user_id', userId).maybeSingle();
  if (missingColumn(error)) return { onAccount: false, examDate: null, mockTarget: null };
  if (error) throw fail('ROAD_UNAVAILABLE', error);
  return { onAccount: true, ...roadOut(data) };
}

/** `patch` is parseRoadInput's checked patch ({ exam_date?, mock_target? }); other study_goals columns keep their values. */
export async function saveRoad(userId, patch, db = supabaseAdmin()) {
  const row = { user_id: userId, ...patch, updated_at: new Date().toISOString() };
  const { data, error } = await db.from('study_goals').upsert(row, { onConflict: 'user_id' }).select('exam_date,mock_target').single();
  if (missingColumn(error)) throw fail('ROAD_NOT_ON_ACCOUNT', error);
  if (error) throw fail('ROAD_UNAVAILABLE', error);
  return { onAccount: true, ...roadOut(data) };
}
