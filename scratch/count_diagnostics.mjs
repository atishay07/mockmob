import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function countSubjects() {
  console.log('📊 COUNTING QUESTIONS BY SUBJECT...');
  
  const { data, error } = await supabase
    .from('questions')
    .select('subject, id')
    .eq('is_deleted', false);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  const counts = {};
  data.forEach(q => {
    counts[q.subject] = (counts[q.subject] || 0) + 1;
  });

  console.table(Object.entries(counts).map(([subject, count]) => ({ subject, count })));

  console.log('\n🕒 LAST 5 INSERTED QUESTIONS (EXACT TIMESTAMPS):');
  const { data: recent } = await supabase
    .from('questions')
    .select('id, subject, chapter, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.table(recent);
}

countSubjects();
