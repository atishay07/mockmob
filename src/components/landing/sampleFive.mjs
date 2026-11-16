// The home page's own five sample questions: the five every signed-out visitor plays first on the desk's card (DemoDrill
// DRILL, "Try 5 questions first"), with no network and no account. Original CUET-pattern questions, not authenticated
// PYQs. They live here, in a plain module, so the page can read them on the server as well (16 Nov 2026, the tour's Mob
// screen opens one of them for "Fix it together": publicSample below). DemoDrill.jsx imports DRILL from here and plays it
// exactly as before. src/lib/server/sampleImport.js mirrors their subjects and keys (sample_import.test.mjs holds that).
export const DRILL = [
  {
    subject: 'English',
    q: 'Choose the option nearest in meaning to CANDID:',
    options: ['Hidden', 'Frank', 'Careful', 'Sweet'],
    correct: 1,
    why: 'Candid means frank or honest. Frank is the closest synonym among these options.',
    chapter: 'Vocabulary: synonyms',
  },
  {
    subject: 'Accountancy',
    q: 'Assets are ₹80,000 and liabilities are ₹30,000. What is the owner’s equity?',
    options: ['₹30,000', '₹50,000', '₹80,000', '₹1,10,000'],
    correct: 1,
    // No-break spaces round the operators (R8 HERO-15): the worked sum never parts at a line end.
    why: 'Equity = assets − liabilities = ₹80,000 − ₹30,000 = ₹50,000.',
    chapter: 'Accounting equation',
  },
  {
    subject: 'Economics',
    q: 'Which of these is NOT a function of the Reserve Bank of India?',
    options: [
      'Banker to the government',
      'Issuing currency',
      'Accepting public deposits',
      'Controlling credit',
    ],
    correct: 2,
    why: 'Commercial banks accept public deposits. The RBI does not.',
    chapter: 'Money and banking',
  },
  {
    subject: 'Accountancy',
    q: 'Goodwill brought in by an incoming partner is shared by old partners in:',
    options: ['New ratio', 'Old ratio', 'Sacrificing ratio', 'Equal ratio'],
    correct: 2,
    why: 'Old partners are compensated for their sacrifice, so it is split in the sacrificing ratio.',
    chapter: 'Partnership: admission of a partner',
  },
  {
    subject: 'Business Studies',
    q: 'Comparing actual performance with a planned standard is part of which management function?',
    options: ['Staffing', 'Controlling', 'Organising', 'Directing'],
    correct: 1,
    why: 'Controlling compares actual performance with standards so deviations can be identified and corrected.',
    chapter: 'Controlling',
  },
];

/**
 * The first of the public five in `subject`, as a frozen copy (the stem, the four options, the right option's place, the
 * reason and the chapter), or null when the five hold none. Read on the server (page.js) and handed down as a prop, so a
 * screen that shows a "real question" can only ever show one a signed-out visitor already sees on this page.
 */
export function publicSample(subject, drill = DRILL) {
  const item = drill.find((entry) => entry.subject === subject);
  if (!item) return null;
  return Object.freeze({ ...item, options: Object.freeze([...item.options]) });
}
