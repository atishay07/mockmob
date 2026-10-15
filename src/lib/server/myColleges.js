import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { fromRows } from '@/lib/colleges/model.mjs';

const fail = (msg, cause) => Object.assign(new Error(msg), { cause });
const COLUMNS = 'programme_id,programme,college,position,added_at';

/** The student's list in order. */
export async function getColleges(userId) {
  const { data, error } = await supabaseAdmin().from('my_colleges').select(COLUMNS).eq('user_id', userId).order('position', { ascending: true }).limit(8);
  if (error) throw fail('COLLEGES_UNAVAILABLE', error);
  return fromRows(data);
}

/** Replace the whole ordered list (already validated) in one transaction. */
export async function replaceColleges(userId, list) {
  const items = list.map(({ programmeId, programme, college }) => ({ programmeId, programme, college }));
  const { error } = await supabaseAdmin().rpc('my_colleges_replace', { p_user_id: userId, p_items: items });
  if (error) throw fail('COLLEGES_UNAVAILABLE', error);
  return getColleges(userId);
}

/** 'added', 'exists' or 'full'. */
export async function addCollege(userId, entry) {
  const { data, error } = await supabaseAdmin().rpc('my_colleges_add', {
    p_user_id: userId, p_programme_id: entry.programmeId, p_programme: entry.programme, p_college: entry.college,
  });
  if (error) throw fail('COLLEGES_UNAVAILABLE', error);
  return data;
}

export async function removeCollege(userId, entry) {
  const { error } = await supabaseAdmin().rpc('my_colleges_remove', { p_user_id: userId, p_programme_id: entry.programmeId, p_college: entry.college });
  if (error) throw fail('COLLEGES_UNAVAILABLE', error);
}
