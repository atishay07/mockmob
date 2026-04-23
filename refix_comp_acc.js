const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  // We accidentally mapped Computerized Accounting System to Analysis of Financial Statements
  // Let's fix it by checking the body for "computerized" or "Tally/Busy"
  console.log("Fixing Computerized Accounting System mapping...");
  
  const { data } = await supabase.from('questions')
    .select('id, body')
    .eq('subject', 'accountancy')
    .ilike('body', '%computerized%');

  if (data && data.length) {
    const ids = data.map(d => d.id);
    console.log(`Updating ${ids.length} questions to "Computerized Accounting System"...`);
    
    await supabase.from('questions').update({ chapter: 'Computerized Accounting System' }).in('id', ids);
    await supabase.from('question_scores').update({ chapter: 'Computerized Accounting System' }).in('question_id', ids);
  }

  // Also check for "Tally", "Busy", etc.
  const { data: data2 } = await supabase.from('questions')
    .select('id, body')
    .eq('subject', 'accountancy')
    .or('body.ilike.%Tally%,body.ilike.%Busy%,body.ilike.%Zoho%');

  if (data2 && data2.length) {
    const ids = data2.map(d => d.id);
    console.log(`Updating ${ids.length} more questions to "Computerized Accounting System"...`);
    
    await supabase.from('questions').update({ chapter: 'Computerized Accounting System' }).in('id', ids);
    await supabase.from('question_scores').update({ chapter: 'Computerized Accounting System' }).in('question_id', ids);
  }

  console.log("Done!");
}

run();
