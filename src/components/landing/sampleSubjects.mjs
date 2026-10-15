// The landing sample's subject picker: every subject MockMob offers practice for (data/cuet_controls.js,
// CUET_PUBLIC_ALLOWED_SUBJECTS), as public ids. The first five show as chips; "More subjects" opens the rest,
// so a visitor without the commerce combination is never stuck. Each id has five questions in sampleBank.mjs.
export const SAMPLE_SUBJECTS = Object.freeze([
  { id: 'accountancy', name: 'Accountancy', featured: true },
  { id: 'business_studies', name: 'Business Studies', featured: true },
  { id: 'economics', name: 'Economics', featured: true },
  { id: 'english', name: 'English', featured: true },
  { id: 'general_test', name: 'General Test', featured: true },
  { id: 'mathematics', name: 'Mathematics', featured: false },
  { id: 'physics', name: 'Physics', featured: false },
  { id: 'chemistry', name: 'Chemistry', featured: false },
  { id: 'biology', name: 'Biology', featured: false },
  { id: 'computer_science', name: 'Computer Science', featured: false },
  { id: 'history', name: 'History', featured: false },
  { id: 'political_science', name: 'Political Science', featured: false },
  { id: 'geography', name: 'Geography', featured: false },
  { id: 'psychology', name: 'Psychology', featured: false },
  { id: 'sociology', name: 'Sociology', featured: false },
]);

export const SAMPLE_SIZE = 5;

export function sampleSubject(id) {
  return SAMPLE_SUBJECTS.find((subject) => subject.id === id) || null;
}
