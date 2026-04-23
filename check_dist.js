const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data } = await supabase.from('question_scores')
    .select('difficulty, is_eligible_for_discovery')
    .eq('subject', 'accountancy');
  
  const dist = {};
  data.forEach(s => {
    const key = `${s.difficulty || 'null'}_${s.is_eligible_for_discovery}`;
    dist[key] = (dist[key] || 0) + 1;
  });
  console.log("Difficulty distribution for accountancy in question_scores:", dist);
}
check();
