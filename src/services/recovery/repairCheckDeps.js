import 'server-only';
// The real dependencies of the repair check (src/services/recovery/repairCheck.js): the Supabase client, the attempt and
// question reads the repair itself uses, and the progress writer.
import { supabaseAdmin } from '@/lib/supabase';
import { Database } from '@/../data/db';
import { createCheckStore } from './repairCheckStore';
import { readQuestionRow } from '@/../data/question_reads';

export function buildCheckDeps() {
  const db = supabaseAdmin();
  return {
    ...createCheckStore({ db, recordProgress: (args) => Database._recordAttemptProgress(args) }),
    loadAttempt: (id) => Database.getAttemptById(id),
    // The row without its signed evidence record (data/question_reads.js); nothing in the repair check reads the record.
    loadQuestion: (id) => readQuestionRow(db, id),
  };
}
