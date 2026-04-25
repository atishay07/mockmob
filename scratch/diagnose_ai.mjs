import { generateQuestions } from '../scripts/pipeline/lib/llm.mjs';
import { SUBJECTS } from '../data/subjects.js';

async function test() {
  console.log('🧪 Testing AI Connection...');
  const subject = SUBJECTS.find(s => s.id === 'accountancy');
  
  if (!subject) {
    console.error('❌ Could not find subject "accountancy" in data/subjects.js');
    return;
  }

  try {
    const questions = await generateQuestions(subject, 'Share Capital', 1);
    if (questions && questions.length > 0) {
      console.log('✅ AI SUCCESS! Generated Question:');
      console.log(JSON.stringify(questions[0], null, 2));
    } else {
      console.error('❌ AI returned 0 questions.');
    }
  } catch (err) {
    console.error('❌ AI FAILED:', err.message);
  }
}

test();
