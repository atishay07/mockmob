import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function promoteQuestions() {
  console.log('🚀 Promoting PENDING questions to Tier A...');
  
  const { data, error } = await supabase
    .from('questions')
    .update({ ai_tier: 'A' })
    .eq('ai_tier', 'PENDING');

  if (error) {
    console.error('❌ Error promoting questions:', error.message);
  } else {
    console.log('✅ Success! All pending questions are now Tier A and should be visible.');
  }
}

promoteQuestions();
