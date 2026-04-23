const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ACCOUNTANCY_CHAPTERS = [
  'Partnership Fundamentals', 'Change in Profit Sharing Ratio', 'Admission of Partner',
  'Retirement & Death of Partner', 'Dissolution of Partnership', 'Share Capital',
  'Debentures', 'Financial Statements of Company', 'Analysis of Financial Statements',
  'Cash Flow Statement',
];

async function run() {
  console.log("Seeding accountancy chapters...");
  const rows = ACCOUNTANCY_CHAPTERS.map((name, i) => ({
    id: `acc_${i}`,
    subject_id: 'accountancy',
    name: name,
    sort_order: i
  }));

  const { data, error } = await supabase
    .from('chapters')
    .upsert(rows, { onConflict: 'id' });

  if (error) console.error(error);
  else console.log("Seeding complete.");
}

run();
