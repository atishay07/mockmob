const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Use a query that should work if we have permissions
  const { data, error } = await supabase.from('questions').select('id').limit(1);
  if (error) {
    console.error(error);
    return;
  }
  
  // We can't see the DB type directly, but let's look at another table that references it.
  const { data: mData, error: mError } = await supabase.from('moderation_jobs').select('question_id').limit(1);
  if (mData) {
      console.log("Moderation Job question_id:", mData[0]?.question_id);
  }
}
check();
