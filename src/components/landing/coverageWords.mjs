// The words and the small rules of the home page's CUET 2026 check (owner LK427, 23 Nov 2026): the question-by-question
// explorer in CoverageExplorer.jsx. This file imports no data, so the browser gets the words without the summary; the figures
// are passed in by coverage2026.mjs from data/coverage/cuet2026/public/summary.json. Plain words, sentence case, no em dash,
// no exclamation mark. The check was made after the exam: nothing here says MockMob predicted the paper, and nothing compares
// MockMob with another company (their methods differ, LK368).

export const COVERAGE_PATH = '/cuet-2026-coverage';
export const subjectPath = (id) => `${COVERAGE_PATH}/${id}`;

/** One letter a status in a subject's strip (data/coverage/cuet2026/home/strips.json): a paper is one short string. */
export const STATUS_CODE = Object.freeze({ same: 's', 'new-values': 'v', concept: 'c', 'not-yet': 'n', skill: 'k', 'off-syllabus': 'o', dropped: 'd' });
export const CODE_STATUS = Object.freeze(Object.fromEntries(Object.entries(STATUS_CODE).map(([status, code]) => [code, status])));

/** Each status in plain words. `group`: in (counted, in MockMob), not (counted, not there yet), out (shown, not counted).
 *  `short` is the legend's name, `line` the one sentence between NTA's question and MockMob's. */
export const STATUS_WORDS = Object.freeze({
  same: Object.freeze({ label: 'Same question', short: 'Same question', group: 'in', line: 'MockMob asks the same thing, with the same answer.' }),
  'new-values': Object.freeze({ label: 'Same question, new numbers', short: 'New numbers', group: 'in', line: 'MockMob has the same type and steps, with different figures.' }),
  concept: Object.freeze({ label: 'Taught as a concept', short: 'Taught', group: 'in', line: 'MockMob teaches what this question tests.' }),
  'not-yet': Object.freeze({ label: 'Not in MockMob yet', short: 'Not yet', group: 'not', line: 'Nothing in MockMob teaches all of this yet.' }),
  skill: Object.freeze({ label: 'Reading skill, not counted', short: 'Not counted', group: 'out', line: 'The answer can be read off a passage printed in the paper.' }),
  'off-syllabus': Object.freeze({ label: 'Off the syllabus, not counted', short: 'Not counted', group: 'out', line: 'It is not in the CUET 2026 syllabus.' }),
  dropped: Object.freeze({ label: 'Dropped by NTA, not counted', short: 'Not counted', group: 'out', line: 'NTA dropped it from the final answer key.' }),
});
export const groupOf = (status) => STATUS_WORDS[status]?.group || 'out';

/** A paper's strip as a view draws it. "now" is the strip itself; "before" draws a question that was not counted then as
 *  "not yet" (marks: one letter a question, 1 = counted then). */
export function viewStrip(strip, marks, view) {
  if (view !== 'before') return String(strip || '');
  return Array.from(String(strip || ''), (code, i) => ('svc'.includes(code) && marks?.[i] !== '1' ? STATUS_CODE['not-yet'] : code)).join('');
}

/** The legend beside a subject's name (owner, 23 Nov 2026 evening: "way too much ... clutter"; his reference draws two states).
 *  The strip draws three things and no more: in MockMob, not yet, and shown but not counted. Which kind of match a question
 *  has (the same question, new numbers, taught) is said once, on the chosen question itself. */
export const LEGEND = Object.freeze([
  Object.freeze({ status: 'concept', label: 'In MockMob', fields: Object.freeze(['same', 'newValues', 'concept']) }),
  Object.freeze({ status: 'not-yet', label: 'Not yet', fields: Object.freeze(['notYet']) }),
  Object.freeze({ status: 'skill', label: 'Not counted', fields: Object.freeze(['skill', 'offSyllabus', 'dropped']) }),
]);

/** The streams as the home page's tabs, in the owner's order (LK427). `pending` are subjects of the stream whose papers are
 *  not checked yet: a name leaves the note by itself once its id is in the summary. */
export const HOME_STREAMS = Object.freeze([
  Object.freeze({ id: 'commerce', name: 'Commerce', pending: Object.freeze([]) }),
  Object.freeze({ id: 'humanities', name: 'Humanities', pending: Object.freeze([]) }),
  Object.freeze({
    id: 'science', name: 'Science',
    pending: Object.freeze([Object.freeze({ id: 'physics', name: 'Physics' }), Object.freeze({ id: 'chemistry', name: 'Chemistry' }), Object.freeze({ id: 'mathematics', name: 'Maths' })]),
  }),
]);

/** The cell a paper opens on: its first "Same question", else the first with new numbers, else the first taught, else Q1.
 *  So the side-by-side shows the strongest match the paper has. Returns a question number (1-based). */
export function firstPick(strip) {
  for (const code of [STATUS_CODE.same, STATUS_CODE['new-values'], STATUS_CODE.concept]) {
    const at = String(strip || '').indexOf(code);
    if (at >= 0) return at + 1;
  }
  return 1;
}

const list = (names) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

export const EXPLORER = Object.freeze({
  h2: 'CUET 2026, checked question by question.',
  mark: 'CUET 2026,',
  total: (covered, of, papers) => `${covered} of ${of} questions from ${papers} CUET 2026 papers are taught in MockMob.`,
  streams: 'Stream',
  subjects: 'Subject',
  pending: (names) => `${list(names)} ${names.length === 1 ? 'is' : 'are'} still being checked.`,
  subjectLine: (covered, of) => `${covered} of ${of} questions taught`,
  strip: (name) => `${name}: every question of the paper`,
  cell: (n, label) => `Question ${n}: ${label}`,
  position: (n, total) => `Question ${n} of ${total}`,
  of: (total) => `of ${total}`,
  prev: 'Previous question',
  next: 'Next question',
  asked: 'CUET 2026 asked',
  ours: 'In MockMob',
  notCounted: 'Why it is not counted',
  ntaKey: 'NTA’s answer',
  ntaKeys: 'NTA accepts either answer',
  ourKey: 'MockMob’s answer',
  card: (chapter) => `Key card${chapter ? `, ${chapter}` : ''}`,
  question: (chapter) => `Practice question${chapter ? `, ${chapter}` : ''}`,
  passage: 'Read the passage',
  showAll: 'Show all',
  showLess: 'Show less',
  loading: 'Loading this paper',
  failed: 'This paper did not load.',
  retry: 'Try again',
  full: (name, total) => `See all ${total} ${name} questions`,
  note: (sitting) => (sitting ? `This paper: ${sitting}.` : ''),
  // The two figures (owner, 23 Nov 2026): each key carries its own number.
  views: 'Which figure',
  view: Object.freeze({ before: 'First check', now: 'Now, for CUET 2027' }),
  viewCount: (covered, of) => `${covered} of ${of} questions`,
});

/** "How we counted": the short sheet behind the figure (owner, 23 Nov 2026: a button like his reference's, "showing their
 *  transparency and assumptions"; then, the same evening: keep it basic). What counts, what was checked, and one plain line
 *  on what the figure is. The numbers are passed in from the model. */
export function howWeCounted({ total }) {
  return {
    button: 'How we counted',
    title: 'How we counted',
    close: 'Close',
    sections: [
      {
        id: 'counts', head: 'What counts as taught', points: [
          'A theory question counts when MockMob states every fact it tests, in a practice question or on a Key card.',
          'A sum counts only when a MockMob question uses the same formula and the same steps. The numbers can differ.',
          'Two separate checks read every question. It counts only when both found it.',
        ],
      },
      {
        id: 'checked', head: 'What we checked', points: [
          `${total.papers} CUET 2026 ${total.papers === 1 ? 'paper' : 'papers'}, one shift of each subject. ${total.of} questions are counted.`,
          'A question you can answer from a passage printed in the paper is shown and not counted.',
        ],
      },
    ],
    note: 'We checked after the exam. Each figure is what MockMob taught when it was counted.',
    link: { href: COVERAGE_PATH, text: `Open all ${total.papers} ${total.papers === 1 ? 'paper' : 'papers'}` },
  };
}
