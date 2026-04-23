const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data } = await supabase.from('questions').select('subject, status');
  const counts = {};
  data.forEach(q => {
    if (q.status === 'live') {
      counts[q.subject] = (counts[q.subject] || 0) + 1;
    }
  });
  console.log("Live questions per subject:", counts);
  
  const { data: scores } = await supabase.from('question_scores').select('subject, is_eligible_for_discovery');
  const discoveryCounts = {};
  scores.forEach(s => {
    if (s.is_eligible_for_discovery) {
      discoveryCounts[s.subject] = (discoveryCounts[s.subject] || 0) + 1;
    }
  });
  console.log("Discovery-eligible per subject:", discoveryCounts);
}
check();
