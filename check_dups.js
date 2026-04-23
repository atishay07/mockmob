const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data } = await supabase.from('questions').select('id');
  const ids = data.map(d => d.id);
  const seen = new Set();
  const dups = [];
  ids.forEach(id => {
    if (seen.has(id)) dups.push(id);
    seen.add(id);
  });
  console.log("Duplicate IDs in questions table:", dups.length);
  if (dups.length > 0) console.log("First 5 dups:", dups.slice(0, 5));
}
check();
