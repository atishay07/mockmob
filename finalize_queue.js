const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Updating pending jobs to queued...");
  const { data, error, count } = await supabase
    .from('moderation_jobs')
    .update({ status: 'queued' })
    .eq('status', 'pending');

  if (error) {
    console.error(error);
  } else {
    console.log("Update successful.");
  }
}

run();
