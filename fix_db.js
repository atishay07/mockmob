const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Fixing subject name...");
  // Update subject accounts -> accountancy
  const { data: d1, error: e1 } = await supabase
    .from('questions')
    .update({ subject: 'accountancy' })
    .eq('subject', 'accounts');
  
  if (e1) console.error("Error updating subject:", e1);
  else console.log("Subject updated.");

  console.log("Fixing question_scores subject name...");
  const { data: ds, error: es } = await supabase
    .from('question_scores')
    .update({ subject: 'accountancy' })
    .eq('subject', 'accounts');
  if (es) console.error("Error updating question_scores subject:", es);
  else console.log("question_scores subject updated.");

  console.log("Fixing status for active questions...");
  // Update status for active questions so My Uploads UI shows them correctly
  const { data: d2, error: e2 } = await supabase
    .from('questions')
    .update({ status: 'live' })
    .eq('exploration_state', 'active');
    
  if (e2) console.error("Error updating status:", e2);
  else console.log("Status updated.");
  
  console.log("Done!");
}

run();
