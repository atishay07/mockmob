const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { count: pendingCount } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  console.log("Pending:", pendingCount);
  const { count: liveCount } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('status', 'live');
  console.log("Live:", liveCount);
  const { count: accCount } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', 'accountancy');
  console.log("Accountancy:", accCount);
}
check();
