const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Fetching ALL columns for accountancy scores...");
  const { data, error } = await supabase
    .from('question_scores')
    .select('*')
    .eq('subject', 'accountancy');

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Found ${data.length} scores. Batch upserting with jitter...`);

  const chunkSize = 200;
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
