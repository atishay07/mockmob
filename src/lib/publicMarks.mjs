// The pen and the highlighter on the public pages beyond the home page (18 Nov 2026, lane marks; owner LK308: "circling the
// text in a fancy way, maybe drawing the line under it ... that kind of a doodle vibe ... while keeping it professional").
// The marks themselves are the home page's (src/components/doodle/Doodle.jsx); this file only says, page by page, which
// words carry one and which mark it is, so the whole site reads as one hand and data/tests/public_marks_1118.test.mjs can
// hold the rules:
//   - at most one mark in a page's top screen (its h1 or the line under it), at most one per later section heading;
//   - one phrase of one to three words, at most 20 characters, never a whole sentence;
//   - highlight (volt): what the student gets that others do not give, at most one per page; circle: a number, a date or a
//     time; underline or double (ink): what the sentence is about; squiggle (brand): a question's last words or a closing
//     line's gentle emphasis; the red pen only for words about a mistake (none here);
//   - never a legal or price condition, a disclaimer, a button, a link, navigation, a form, or a page of plain facts.
// Each entry is [phrase, Doodle props], the shape <Marked marks={[...]}> takes. A phrase is found in its sentence as the
// page draws it, so a phrase that is not there is simply left unmarked (the words win over the marks).

const highlight = Object.freeze({ mark: 'highlight', tone: 'volt' });
const underline = Object.freeze({ mark: 'underline', tone: 'ink' });
const circle = Object.freeze({ mark: 'circle', tone: 'brand' });
const squiggle = Object.freeze({ mark: 'squiggle', tone: 'brand' });

const m = (phrase, props) => Object.freeze([phrase, props]);

/** The guides' shared close, "Reading about it is not practice." (SeoContentPage, and a subject page while its first mock is not free). */
export const GUIDE_CLOSE_MARK = m('not practice.', squiggle);

export const PUBLIC_MARKS = Object.freeze({
  // /pricing h1 "Practise without limits": what Pro gives that a capped plan does not.
  pricing: { head: m('without limits', highlight) },
  // /features: the h1 "What MockMob does" names the page; its line carries the promise, the free DU tools.
  features: { head: m('free tools', highlight) },
  // /about h1 "Built for one exam: CUET."
  about: { head: m('one exam', underline) },
  // /daily, its head only (never the game): the h1 "Daily Five", the number of the day's questions, at the heading's end.
  daily: { head: m('Five', circle) },
  // /sunday-mock: no marks. Its h1 "The Sunday Mock." is the product's name, its only date ("every Sunday") sits mid-line in
  // the body text, where a circle crosses the words on both sides, and "How a Sunday goes." carries no promise.
  // /key-cards: the intro's "free to read", and the close "Keep the cards you read."
  keyCards: { head: m('free to read', highlight), close: m('you read.', squiggle) },
  // /key-cards/<subject>/<chapter>: the intro's "... are free to read, with no account."
  keyCardsChapter: { head: m('free to read', highlight) },
  // /cuet-2027 h1 "CUET 2027: pattern, expected dates and a plan that works".
  cuet2027: { head: m('plan that works', underline), close: GUIDE_CLOSE_MARK },
  // /cuet-mock-test-free h1 "CUET mock test free online".
  freeMockTest: { head: m('free', highlight), close: GUIDE_CLOSE_MARK },
  // /cuet-practice-tests-online h1 "CUET practice tests online".
  practiceTests: { head: m('practice tests', underline), close: GUIDE_CLOSE_MARK },
  // /cuet-previous-year-questions: no head mark (its subject, "previous year questions", is longer than 20 characters and
  // its intro is a disclaimer); the shared close only.
  previousYearQuestions: { close: GUIDE_CLOSE_MARK },
  // /cuet/<subject> h1 "CUET <Subject> mock tests and practice", and the h2 "<Subject> Key cards, free to read". The close
  // "Your first <Subject> mock is free." is a price condition and stays unmarked; its other wording takes the guides' close.
  subject: { head: m('mock tests', underline), keyCards: m('free to read', highlight), close: GUIDE_CLOSE_MARK },
  // /cuet-subject-combination: no marks. Its promise, "the most DU doors", sits mid-heading in a 1.04 leading, so at 360 and
  // 390 its underline lands on the capitals of the line below; its one other heading is "Questions students ask".
  // /cuet-cutoff-calculator: its h1's question runs straight on into a second sentence on the same line, so a squiggle under
  // "can you get?" lies on the next line's words; the sources heading "Built from DU's own documents" carries the mark.
  calculator: { sources: m('own documents', underline) },
  // /du-cutoffs/<course> h1 "DU <Course> cutoffs 2026" and /du-cutoffs/colleges/<college> h1 "<College> cutoffs 2026": the
  // year of the lists, the heading's last word. The index's h1 ("DU cutoffs 2026 for every course and college") has its year
  // mid-line, where a circle crosses the words on both sides: the index stays unmarked.
  duCourse: { head: m('2026', circle) },
  duCollege: { head: m('2026', circle) },
  // /login h1 "Your next chapter is waiting." and /signup h1 "Start your CUET 2027 practice." (only these wordings; an
  // invite's or a carried heading stays unmarked).
  login: { head: m('next chapter', underline) },
  signup: { head: m('CUET 2027', circle) },
  // The public 404, h1 "That page is not here.". It is drawn in the arena shell, where --ink is the near-black in Night too,
  // so the ink tone would vanish there: the pen takes the words' own colour (tone "current", as the home's sample tick does).
  notFound: { head: m('not here.', { mark: 'underline', tone: 'current' }) },
});

/** The guides drawn by SeoContentPage, by their slug. */
export const GUIDE_MARKS = Object.freeze({
  'cuet-2027': PUBLIC_MARKS.cuet2027,
  'cuet-mock-test-free': PUBLIC_MARKS.freeMockTest,
  'cuet-practice-tests-online': PUBLIC_MARKS.practiceTests,
  'cuet-previous-year-questions': PUBLIC_MARKS.previousYearQuestions,
});

/** The pages of plain facts: no marks at all. */
export const PLAIN_FACT_PAGES = Object.freeze(['privacy', 'terms', 'refunds', 'contact', 'account-deletion', 'corrections']);

/** Pages whose words are about a mistake or a wrong answer, the only ones the red pen may mark (none on these pages). */
export const MISTAKE_PAGES = Object.freeze([]);
