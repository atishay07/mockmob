const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('questions')
    .select('ai_tier, count(*)')
    .group('ai_tier');
    
  if (error) {
    console.error(error);
  } else {
    console.log("AI Tiers distribution:", data);
  }
}
check();
