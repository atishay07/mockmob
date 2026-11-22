// The words of the CUET 2026 coverage pages (owner LK368, 22 Nov 2026; spec tmp/1122-coverage/UI-SPEC.md). Every figure the
// words carry is passed in from data/coverage/cuet2026/public/ (scripts/coverage/build-public.mjs counts them); nothing here
// is a number typed by hand. Plain words, sentence case, no em dash, no exclamation mark. The check was made after the exam,
// on the bank as it stood on the snapshot date: the words never say MockMob predicted the paper.

export const COVERAGE_PATH = '/cuet-2026-coverage';
export const subjectPath = (id) => `${COVERAGE_PATH}/${id}`;

/** The statuses, in the order the bar and the legend draw them. `group`: in (counted, in MockMob), not (counted, not yet),
 *  out (shown, not counted). */
export const STATUS = Object.freeze({
  same: Object.freeze({ label: 'Same question', group: 'in', meaning: 'A MockMob question asks the same thing and has the same answer.' }),
  'new-values': Object.freeze({ label: 'Same question, new numbers', group: 'in', meaning: 'A MockMob question has the same type and steps, with different figures or names.' }),
  concept: Object.freeze({ label: 'Taught in MockMob', group: 'in', meaning: 'A MockMob question or Key card teaches every fact it tests, or the same formula and steps for a sum.' }),
  'not-yet': Object.freeze({ label: 'Not in MockMob yet', group: 'not', meaning: 'Nothing MockMob serves teaches all of it yet.' }),
  skill: Object.freeze({ label: 'Reading skill, not counted', group: 'out', meaning: 'The answer can be read off a passage printed in the paper.' }),
  'off-syllabus': Object.freeze({ label: 'Off the syllabus, not counted', group: 'out', meaning: 'It is not in the CUET 2026 syllabus.' }),
  dropped: Object.freeze({ label: 'Dropped by NTA, not counted', group: 'out', meaning: 'NTA dropped it from the final answer key.' }),
});
export const STATUS_ORDER = Object.freeze(['same', 'new-values', 'concept', 'not-yet', 'skill', 'off-syllabus', 'dropped']);
/** The counted statuses with the count field of `counts` each one reads. */
export const BAR_PARTS = Object.freeze([['same', 'same'], ['new-values', 'newValues'], ['concept', 'concept'], ['not-yet', 'notYet']]);
export const OUT_PARTS = Object.freeze([['skill', 'skill'], ['off-syllabus', 'offSyllabus'], ['dropped', 'dropped']]);

export const STREAMS = Object.freeze([
  Object.freeze({ id: 'commerce', name: 'Commerce' }),
  Object.freeze({ id: 'science', name: 'Science' }),
  Object.freeze({ id: 'humanities', name: 'Humanities' }),
  Object.freeze({ id: 'general', name: 'English and General Test' }),
  Object.freeze({ id: 'other', name: 'Other subjects' }),
]);

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const ofQuestions = (covered, counted) => `${covered} of ${counted} questions`;

/** A date that never parts at a line end ("20 November 2026" stays on one line). */
const day = (d) => (typeof d === 'string' ? d.replace(/ /g, ' ') : d);
/** "20 May 2026, first shift." */
export const sittingLine = (s) => [day(s.examDay), s.shift].filter(Boolean).join(', ');

export const INDEX = Object.freeze({
  title: 'How much of CUET 2026 is already in MockMob? Question by question | MockMob',
  crumb: 'CUET 2026 coverage',
  h1: 'How much of CUET 2026 is already in MockMob?',
  mark: 'already in MockMob?',
  sub: 'We took NTA’s real 2026 papers and checked them question by question. Open a subject to see every question beside the MockMob question or Key card that teaches it.',
  pctLabel: (counted) => `of the ${counted} questions we checked are taught in MockMob`,
  same: (k) => `${k === 1 ? 'question' : 'questions'} asked in CUET 2026 ${k === 1 ? 'is' : 'are'} in our bank as the same question`,
  newValues: (m) => `${m} more with new numbers`,
  chapters: 'chapters CUET 2026 asked from have practice in MockMob',
  subjectsHead: 'Pick a subject',
  methodHead: 'How we checked',
  method: Object.freeze([
    'We took NTA’s master question paper for one shift of each subject, and matched every question to NTA’s final answer key.',
    'For each question we wrote down the facts or steps needed to reach NTA’s answer, then searched what MockMob serves: its practice questions and its Key cards.',
    'Two separate checks did this on their own. A question counts as in MockMob only when both of them found it.',
    'A theory question counts when MockMob states every fact it tests. A sum counts only when a MockMob question uses the same formula and the same steps. A Key card formula alone is not enough.',
  ]),
  notCountHead: 'What does not count',
  notCount: Object.freeze([
    'A question whose answer can be read off a passage printed in the paper tests reading, not what you studied. It is shown and not counted.',
    'A question off the CUET 2026 syllabus, or dropped by NTA, is shown and not counted.',
    'When a check was unsure, the question counts as not in MockMob.',
  ]),
  chapterRule: (min) => `A chapter has practice in MockMob when at least one of its questions is in MockMob, or MockMob serves at least ${min} questions from it.`,
  after: 'This is a check made after the exam. It is not a prediction of the next paper.',
  snapshot: (d) => `MockMob’s questions and Key cards as they were on ${day(d)}.`,
  closeHead: 'Practise the chapters CUET 2026 asked from.',
  close: 'Practise these chapters free',
});

export const SUBJECT = Object.freeze({
  title: (name) => `CUET 2026 ${name} paper, question by question | MockMob`,
  description: (s) => `Every question of the CUET 2026 ${s.name} paper (${sittingLine(s)}) beside the MockMob question or Key card that teaches it. ${s.counts.covered} of ${s.counts.counted} are taught in MockMob.`,
  h1: (name) => `CUET 2026 ${name}, question by question.`,
  mark: 'question by question.',
  line: (s) => `${sittingLine(s)}. ${plural(s.counts.total, 'question')}. Checked against MockMob on ${day(s.snapshotDay)}.`,
  pctLabel: (counted) => `of the ${counted} counted questions are taught in MockMob`,
  outLine: (parts) => `${parts.join(' and ')} ${parts.length === 1 && parts[0].startsWith('1 ') ? 'is' : 'are'} shown below and not counted.`,
  outPart: (n, status) => `${n} ${status === 'skill' ? (n === 1 ? 'reading-skill question' : 'reading-skill questions') : status === 'off-syllabus' ? (n === 1 ? 'question off the syllabus' : 'questions off the syllabus') : (n === 1 ? 'dropped question' : 'dropped questions')}`,
  paletteHead: 'Every question',
  paletteHint: 'Tap a number to jump to that question.',
  filterAll: 'All',
  filterIn: 'In MockMob',
  filterNot: 'Not yet',
  chapterAll: 'Every chapter',
  chapterLabel: 'Chapter',
  showing: (shown, all) => (shown === all ? `Showing all ${all} questions` : `Showing ${shown} of ${all} questions`),
  asked: 'CUET 2026 asked',
  inMockMob: 'In MockMob',
  ntaKey: 'NTA’s answer',
  ntaKeys: 'NTA accepts either answer',
  ourKey: 'MockMob’s answer',
  passage: 'Read the passage',
  explanation: 'Explanation',
  why: 'Why it counts',
  more: (cards, questions) => {
    const parts = [];
    if (cards) parts.push(plural(cards, 'more Key card', 'more Key cards'));
    if (questions) parts.push(plural(questions, 'more question', 'more questions'));
    return parts.length ? `Also taught by ${parts.join(' and ')}.` : null;
  },
  questionFrom: (chapter) => `MockMob question${chapter ? `, ${chapter}` : ''}`,
  cardFrom: (chapter) => `Key card${chapter ? `, ${chapter}` : ''}`,
  notYet: 'Not in MockMob yet',
  chaptersHead: 'Chapter by chapter',
  chapterCols: Object.freeze(['Chapter', 'Asked', 'In MockMob']),
  othersHead: 'Other subjects',
  close: 'Practise these chapters free',
});

/** The palette's and the filter's group for a status: "in", "not" or "out". */
export const groupOf = (status) => STATUS[status]?.group || 'out';
