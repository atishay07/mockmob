const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Fetching all question scores...");
  const { data, error } = await supabase
    .from('question_scores')
    .select('question_id, rank_score')
    .eq('subject', 'accountancy');

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Found ${data.length} scores. Updating one by one to avoid constraint issues...`);

  for (let i = 0; i < data.length; i++) {
    const s = data[i];
    const { error: updateErr } = await supabase
      .from('question_scores')
      .update({
        rank_score: parseFloat(s.rank_score) + (Math.random() * 0.001)
      })
      .eq('question_id', s.question_id);
    
    if (updateErr) {
      console.error(`Error updating ${s.question_id}:`, updateErr);
    }
    if (i % 100 === 0) console.log(`Processed ${i}...`);
  }
  console.log("Done!");
}

run();
