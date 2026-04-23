const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function queueAudit() {
  console.log("Fetching active questions for audit...");
  const { data, error } = await supabase
    .from('questions')
    .select('id')
    .eq('subject', 'accountancy')
    .eq('exploration_state', 'active');

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Found ${data.length} questions. Queuing for AI re-validation...`);

  const jobs = data.map(q => ({
    question_id: q.id,
    status: 'queued',
    priority: 1, // lower priority than new uploads
    max_retries: 3
  }));

  const chunkSize = 100;
  for (let i = 0; i < jobs.length; i += chunkSize) {
    const chunk = jobs.slice(i, i + chunkSize);
    const { error: insertErr } = await supabase
      .from('moderation_jobs')
      .insert(chunk);
    
    if (insertErr) {
      console.error(`Error queuing chunk ${i}:`, insertErr);
    } else {
      console.log(`Queued ${i + chunk.length} / ${jobs.length}`);
    }
  }
  console.log("Audit queuing complete. Now starting worker...");
}

queueAudit();
