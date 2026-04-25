import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deepScan() {
  console.log('🔍 DEEP SCAN: Investigating the 20 questions in your queue...');
  
  const { data: jobs, error: jErr } = await supabase
    .from('moderation_jobs')
    .select(`
      id,
      status,
      question_id,
      questions (
        id,
        subject,
        chapter,
        author_id,
        verification_state,
        ai_tier
      )
    `)
    .eq('status', 'queued')
    .limit(20);

  if (jErr) {
    console.error('❌ Error fetching jobs:', jErr.message);
    return;
  }

  if (!jobs || jobs.length === 0) {
    console.log('❓ The database says your queue is EMPTY. If your UI says 20, there might be a sync/caching issue.');
  } else {
    console.log(`📡 Found ${jobs.length} queued jobs in database.`);
    console.table(jobs.map(j => ({
      job_id: j.id.substring(0,8),
      q_id: j.questions?.id.substring(0,8),
      subject: j.questions?.subject,
      author: j.questions?.author_id,
      state: j.questions?.verification_state
    })));
  }
}

deepScan();
