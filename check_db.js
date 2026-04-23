const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data: q1, error: e1 } = await supabase.from('questions').select('id, exploration_state, subject, ai_tier').limit(10);
  console.log("Sample questions:", q1);
  
  const { data: c1 } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('exploration_state', 'pending');
  console.log("Total pending:", c1);

  const { data: c2 } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('exploration_state', 'active');
  console.log("Total active:", c2);
  
  const { data: c3 } = await supabase.from('moderation_jobs').select('*', { count: 'exact', head: true }).eq('status', 'queued');
  console.log("Total queued jobs:", c3);
}

check();
