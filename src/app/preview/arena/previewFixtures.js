// Original examples for layout and interaction checks. Never content-bank records.
const SUBJECTS = [
  { id: 'accountancy', name: 'Accountancy', practice: 'supported' },
  { id: 'economics', name: 'Economics', practice: 'supported' },
  { id: 'business_studies', name: 'Business Studies', practice: 'supported' },
  { id: 'english', name: 'English', practice: 'supported' },
];
const EXAMPLES = [
  { chapter: 'Partnership Fundamentals', body: 'Goodwill brought in by an incoming partner is shared by old partners in:', options: ['New ratio', 'Old ratio', 'Sacrificing ratio', 'Equal ratio'], answer: 'C', explanation: 'The sacrificing partners are compensated, so goodwill is shared in the sacrificing ratio.' },
  { chapter: 'Accounting Equation', body: 'Assets are ₹80,000 and liabilities are ₹30,000. What is the owner’s equity?', options: ['₹30,000', '₹50,000', '₹80,000', '₹1,10,000'], answer: 'B', explanation: 'Equity = assets − liabilities = ₹50,000.' },
];
const SUBJECT_EXAMPLES = {
  accountancy: EXAMPLES,
  economics: [
    { chapter: 'Money and Banking', body: 'Which of these is NOT a function of the Reserve Bank of India?', options: ['Banker to the government', 'Issuing currency', 'Accepting public deposits', 'Controlling credit'], answer: 'C', explanation: 'The RBI is the central bank. It does not accept deposits from the general public.' },
    { chapter: 'Introduction to Microeconomics', body: 'The value of the next best alternative forgone is called:', options: ['Fixed cost', 'Opportunity cost', 'Sunk cost', 'Total cost'], answer: 'B', explanation: 'Opportunity cost describes the next best alternative given up when making a choice.' },
  ],
  business_studies: [
    { chapter: 'Controlling', body: 'Comparing actual performance with a planned standard is part of which management function?', options: ['Staffing', 'Controlling', 'Organising', 'Directing'], answer: 'B', explanation: 'Controlling compares performance with standards and considers corrective action.' },
    { chapter: 'Staffing', body: 'Selecting people for the right jobs belongs to which function?', options: ['Controlling', 'Planning', 'Staffing', 'Financing'], answer: 'C', explanation: 'Staffing covers finding, selecting and developing people for jobs.' },
  ],
  english: [
    { chapter: 'Vocabulary', body: 'Choose the option nearest in meaning to CANDID:', options: ['Hidden', 'Frank', 'Careful', 'Sweet'], answer: 'B', explanation: 'Candid means frank or honest in expression.' },
    { chapter: 'Grammar', body: 'Choose the correct sentence:', options: ['She have a book.', 'She has a book.', 'She having a book.', 'She has an books.'], answer: 'B', explanation: 'The singular subject she takes has; a book is singular.' },
  ],
};
export const FIXTURE_SUBJECTS = SUBJECTS.map((subject) => ({ ...subject, chapters: (SUBJECT_EXAMPLES[subject.id] || EXAMPLES).map((question) => question.chapter) }));
export const fixtureFeed = (subject, long = false) => Array.from({ length: 29 }, (_, index) => {
  const example = (SUBJECT_EXAMPLES[subject] || EXAMPLES)[index % 2];
  return { id: `fixture-${subject}-${index + 1}`, subject, chapter: example.chapter, body: example.body + (long && index === 0 ? '\nA deliberately long line for layout checks: ' + 'WorkingCapitalAndPartnershipAccounting'.repeat(7) : ''), options: example.options.map((text, optionIndex) => ({ key: 'ABCD'[optionIndex], text })), correct_answer: example.answer, explanation: example.explanation, difficulty: ['easy', 'medium', 'hard'][index % 3], score: index % 7, userVote: null, saved: false };
});
export function fixtureChapters(subject) {
  const chapters = (SUBJECT_EXAMPLES[subject] || EXAMPLES).map((example, index) => ({ id: `${subject}-chapter-${index}`, name: example.chapter }));
  return subject === 'accountancy' ? { grouped: true, units: [{ id: 'fixture-unit', name: 'Original illustrative examples', chapters }] } : { grouped: false, chapters };
}
export function fixtureUploads() {
  return fixtureFeed('accountancy').slice(0, 4).map((question, index) => ({ ...question, question: question.body, status: ['pending_moderation', 'live', 'quarantined', 'rejected'][index], createdAt: '2026-10-02T18:00:00.000Z' }));
}
export function fixtureAttempt() {
  const rows = fixtureFeed('accountancy').slice(0, 5);
  return { id: 'fixture-attempt', subject: 'accountancy', score: 56, correct: 3, wrong: 1, unattempted: 1, total: 5, completedAt: '2026-10-02T18:00:00.000Z', questionsSnapshot: rows.map((question) => ({ ...question, question: question.body, options: question.options.map((option) => option.text), correctIndex: 'ABCD'.indexOf(question.correct_answer) })), details: rows.map((question, index) => ({ qid: question.id, isCorrect: index < 3 ? true : index === 3 ? false : null, givenIndex: index < 3 ? 'ABCD'.indexOf(question.correct_answer) : index === 3 ? 0 : null, timeMs: 40000 })) };
}
