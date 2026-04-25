const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data: qData, error: qError } = await supabase.from('questions').select('id').limit(1);
  if (qError) {
      console.error(qError);
  } else if (qData && qData.length > 0) {
      console.log("Sample ID:", qData[0].id);
      // We can't easily check the DB type from JS without an RPC, but we can see the format.
      // UUIDs look like '550e8400-e29b-41d4-a716-446655440000'
  } else {
      console.log("No data in questions table.");
  }
}
check();
