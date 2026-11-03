import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
export async function studyExposures(userId,previous={}) {
  // Includes reservations and teaching exposures. Fail closed for fresh checks.
  const {data,error}=await supabaseAdmin().from('learning_family_exposure').select('family_id').eq('user_id',userId);
  if(error) throw new Error('EXPOSURE_STORAGE_UNAVAILABLE');
  return {...previous,excludeFamilyIds:[...new Set([...(previous.excludeFamilyIds || []),...(data || []).map(row=>row.family_id)])]};
}
