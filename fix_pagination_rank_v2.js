const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Fetching all question scores...");
  const { data, error } = await supabase
    .from('question_scores')
    .select('question_id, rank_score, subject, difficulty, exploration_lane, is_eligible_for_discovery')
    .eq('subject', 'accountancy');

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Found ${data.length} scores. Adding jitter to rank_score...`);

  // Update in chunks to avoid timeout
  const chunkSize = 100;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const updates = chunk.map(s => ({
      ...s,
      rank_score: parseFloat(s.rank_score) + (Math.random() * 0.001)
    }));

    const { error: updateErr } = await supabase
      .from('question_scores')
      .upsert(updates);
    
    if (updateErr) {
      console.error(`Error updating chunk ${i}:`, updateErr);
    } else {
      console.log(`Updated chunk ${i / chunkSize + 1}`);
    }
  }
  console.log("Done!");
}

run();
