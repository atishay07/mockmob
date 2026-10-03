import { scoreSession } from '../../../../data/recovery';
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
// A 10-question practice session shaped like a real hard one: 3 right, 6 wrong, 1 blank, two answer
// changes (one right to wrong, one wrong to right) and several fast wrong picks. Scored by the real engine.
const ADMISSION = { chapter: 'Admission of a Partner', body: 'A and B share profits 3:2. C is admitted and the new ratio is 2:2:1. The sacrificing ratio of A and B is:', options: ['3:2', '1:0', '1:1', '2:3'], answer: 'B', explanation: 'A gives up 3/5 − 2/5 = 1/5; B gives up 2/5 − 2/5 = 0. So only A sacrifices: 1:0.' };
export function fixtureAttempt() {
  const feed = fixtureFeed('accountancy');
  const asSnapshot = (q, i) => ({ id: `fixture-q${i + 1}`, chapter: q.chapter, difficulty: ['easy', 'medium', 'hard'][i % 3], question: q.body ?? q.question, explanation: q.explanation, options: q.options.map(o => (typeof o === 'string' ? o : o.text)), correctIndex: 'ABCD'.indexOf(q.correct_answer ?? q.answer) });
  const pool = [feed[0], ADMISSION, feed[1], ADMISSION, feed[0], ADMISSION, feed[1], feed[0], ADMISSION, feed[1]];
  const questions = pool.map(asSnapshot);
  const wrongOf = (q) => (q.correctIndex + 1) % q.options.length;
  // Per question: final answer kind, seconds spent, and an optional first pick that was changed.
  const plan = [['right', 48], ['wrong', 12], ['wrong', 15, 'right'], ['wrong', 70], ['right', 35], ['wrong', 9], ['right', 52, 'wrong'], ['wrong', 14], ['blank', 30], ['wrong', 18]];
  const answers = {}; const events = []; let at = 0; let seq = 1;
  plan.forEach(([kind, seconds, first], i) => {
    const q = questions[i];
    events.push({ seq: seq++, qid: q.id, at, type: 'visit' });
    const pick = (k) => (k === 'right' ? q.correctIndex : wrongOf(q));
    if (first) { events.push({ seq: seq++, qid: q.id, at: at + seconds * 400, type: 'answer', answer: pick(first) }); }
    if (kind !== 'blank') { answers[q.id] = pick(kind); events.push({ seq: seq++, qid: q.id, at: at + seconds * 900, type: 'answer', answer: answers[q.id] }); }
    at += seconds * 1000;
  });
  events.push({ seq: seq++, qid: questions.at(-1).id, at, type: 'visit' });
  const scored = scoreSession(questions, answers, events);
  return { id: 'fixture-attempt', subject: 'accountancy', score: scored.score, correct: scored.correct, wrong: scored.wrong, unattempted: scored.unattempted, total: scored.total,
    completedAt: '2026-10-04T18:00:00.000Z', questionsSnapshot: questions, details: scored.details,
    selectionMeta: { scoringVersion: 'server_practice_v1', recovery: scored.recovery } };
}
