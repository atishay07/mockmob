import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRecentQuestions() {
  console.log('🔍 Checking database for recently created questions...');
  
  const { data, count, error } = await supabase
    .from('questions')
    .select('id, subject, chapter, ai_tier, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error querying database:', error.message);
    return;
  }

  console.log(`📊 Total questions in table: ${count}`);
  console.log('🕒 Most recent 10 questions:');
  console.table(data);
  
  const testUserCount = data.filter(q => q.author_id === 'test-user').length;
  console.log(`🤖 Questions found from Autonomous Engine: ${testUserCount} (in top 10)`);
}

checkRecentQuestions();
