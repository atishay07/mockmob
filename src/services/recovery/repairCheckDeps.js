import 'server-only';
// The real dependencies of the repair check (src/services/recovery/repairCheck.js): the Supabase client, the attempt and
// question reads the repair itself uses, and the progress writer.
import { supabaseAdmin } from '@/lib/supabase';
import { Database } from '@/../data/db';
import { createCheckStore } from './repairCheckStore';

export function buildCheckDeps() {
  const db = supabaseAdmin();
  return {
    ...createCheckStore({ db, recordProgress: (args) => Database._recordAttemptProgress(args) }),
    loadAttempt: (id) => Database.getAttemptById(id),
    loadQuestion: (id) => db.from('questions').select('*').eq('id', id).maybeSingle(),
  };
}
