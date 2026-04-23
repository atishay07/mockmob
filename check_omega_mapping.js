const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data } = await supabase.from('questions')
    .select('body, chapter')
    .ilike('body', '%Omega Ltd%')
    .limit(10);
  
  console.log("Omega Ltd questions chapter mapping:");
  data.forEach(q => console.log(`- Chapter: "${q.chapter}" | Body: ${q.body.substring(0, 40)}...`));
}
check();
