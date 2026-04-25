import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearQueues() {
  console.log('🧹 Clearing Moderator Queue and Auto-Approving questions...');
  
  // 1. Update questions to Verified
  const { error: qError } = await supabase
    .from('questions')
    .update({ 
      verification_state: 'verified',
      ai_tier: 'A',
      quality_band: 'strong',
      exploration_state: 'active'
    })
    .eq('author_id', 'test-user');

  if (qError) console.error('❌ Error updating questions:', qError.message);

  // 2. Mark all jobs as completed
  const { error: jError } = await supabase
    .from('moderation_jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('status', 'queued');

  if (jError) console.error('❌ Error updating jobs:', jError.message);

  console.log('✅ Success! Your moderator queue should now be empty.');
}

clearQueues();
