const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data } = await supabase.from('questions')
    .select('chapter')
    .eq('subject', 'accountancy');
  
  const counts = {};
  data.forEach(q => {
    counts[q.chapter] = (counts[q.chapter] || 0) + 1;
  });
  console.log("Chapters in database for accountancy:", counts);
}
check();
