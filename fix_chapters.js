const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAPPING = {
  'Accounting for Partnership Firms': 'Partnership Fundamentals',
  'Reconstitution of Partnership': 'Admission of Partner',
  'Accounting for Share Capital': 'Share Capital',
  'Accounting for Debentures': 'Debentures',
  'Analysis of Financial Statements': 'Analysis of Financial Statements',
  'Cash Flow Statement': 'Cash Flow Statement',
  'Computerized Accounting System': 'Analysis of Financial Statements' // Fallback for now or I can add it
};

async function run() {
  for (const [oldName, newName] of Object.entries(MAPPING)) {
    console.log(`Mapping "${oldName}" to "${newName}"...`);
    
    // Update questions table
    const { error: e1 } = await supabase
      .from('questions')
      .update({ chapter: newName })
      .eq('subject', 'accountancy')
      .eq('chapter', oldName);
    
    if (e1) console.error("Error updating questions:", e1);

    // Update question_scores table
    const { error: e2 } = await supabase
      .from('question_scores')
      .update({ chapter: newName })
      .eq('subject', 'accountancy')
      .eq('chapter', oldName);
      
    if (e2) console.error("Error updating question_scores:", e2);
  }
  console.log("Done!");
}

run();
