import { SUBJECTS } from '@/../data/subjects';

// Subject hub pages: /cuet/[slug]. Each hub targets long-tail CUET queries
// ("cuet accountancy mock test", "cuet english syllabus chapters") and links
// back into the practice funnel. Chapters come from the same source of truth
// the app uses (data/subjects.js), so hubs never drift from the product.
function chaptersFor(subjectId) {
  return SUBJECTS.find((subject) => subject.id === subjectId)?.chapters || [];
}

export const SUBJECT_HUBS = [
  {
    slug: 'english',
    subjectId: 'english',
    name: 'English',
    title: 'CUET English Mock Test & Chapter-Wise Practice | MockMob',
    description:
      'Practise CUET English online: reading comprehension, vocabulary, grammar, and literature questions with timed mocks and chapter-level analytics.',
    eyebrow: '// CUET English',
    h1: 'CUET English Mock Tests & Practice',
    intro:
      'CUET English rewards pace above everything: long reading comprehension sets, vocabulary calls you either know in two seconds or lose a minute to, and grammar traps built for second-guessing. Practising it untimed hides exactly the weakness the exam exposes.',
    sections: [
      {
        heading: 'How to structure CUET English practice',
        body: [
          'Reading comprehension carries the heaviest weight, so anchor every practice block around at least one full RC passage under time. Track seconds per question, not just accuracy: most English scores leak on pace, not knowledge.',
          'Vocabulary and grammar respond to short daily drills far better than weekend marathons. Ten questions a day across synonyms, antonyms, idioms, and error-spotting compounds into exam-grade recall within weeks.',
        ],
      },
      {
        heading: 'CUET English syllabus chapters',
        body: ['This list follows the subject syllabus. Available MockMob questions and their practice coverage can vary with current inventory.'],
        chips: chaptersFor('english'),
      },
    ],
    faqs: [
      {
        question: 'How many questions does CUET English have?',
        answer:
          'MockMob NTA Mode currently uses a 50-question, 60-minute practice format with original content. CUET UG 2027 rules remain provisional until NTA publishes its bulletin.',
      },
      {
        question: 'Is reading comprehension the most important CUET English topic?',
        answer:
          'Reading comprehension can take substantial time. Timed passage practice can help you notice where you slow down and what deserves another review.',
      },
      {
        question: 'Can I practise CUET English free on MockMob?',
        answer:
          'Yes. Free accounts get credit-gated Quick Practice and Full Mocks, and the landing page drill needs no signup at all.',
      },
    ],
  },
  {
    slug: 'accountancy',
    subjectId: 'accountancy',
    name: 'Accountancy',
    title: 'CUET Accountancy Mock Test & Chapter Practice | MockMob',
    description:
      'CUET Accountancy practice online: partnership, company accounts, ratios, and cash flow questions with timed mocks and weak-chapter tracking.',
    eyebrow: '// CUET Accountancy',
    h1: 'CUET Accountancy Mock Tests & Practice',
    intro:
      'Accountancy practice often combines concepts, formats, and calculations. Timed examples can help you notice which steps take longer and which procedures need another review.',
    sections: [
      {
        heading: 'Where Accountancy scores are won',
        body: [
          'Partnership fundamentals, admission and retirement, and company accounts form the core of the paper. These chapters are procedural: once the treatment of goodwill, revaluation, and capital adjustment is automatic, questions become arithmetic.',
          'Ratio analysis and cash flow statements are the classic differentiators. They punish students who memorised formulas without practising classification, and reward anyone who has solved fifty timed variants.',
        ],
      },
      {
        heading: 'CUET Accountancy syllabus chapters',
        body: ['This list follows the subject syllabus. Available MockMob questions and their practice coverage can vary with current inventory.'],
        chips: chaptersFor('accountancy'),
      },
    ],
    faqs: [
      {
        question: 'Is CUET Accountancy tougher than boards?',
        answer:
          'CUET Accountancy uses objective questions, but the 2027 paper format has not been confirmed. Check NTA’s bulletin when it is published and practise calculations under a timer.',
      },
      {
        question: 'Which Accountancy chapters should I prioritise?',
        answer:
          'Partnership (fundamentals, admission, retirement) plus company accounts historically carry the most weight, with ratios and cash flow as the top differentiators.',
      },
      {
        question: 'Does MockMob show chapter-wise Accountancy analysis?',
        answer:
          'Radar organizes available attempt history by subject and chapter. The detail it can show depends on the questions in your practice history.',
      },
    ],
  },
  {
    slug: 'economics',
    subjectId: 'economics',
    name: 'Economics',
    title: 'CUET Economics Mock Test & Practice Questions | MockMob',
    description:
      'CUET Economics practice: macro, Indian economic development, national income, and money-banking MCQs with timed mocks and analytics.',
    eyebrow: '// CUET Economics',
    h1: 'CUET Economics Mock Tests & Practice',
    intro:
      'CUET Economics splits students into two camps: those who treat macro numericals (national income, multipliers, banking ratios) as pattern drills, and those who re-derive everything in the exam hall. The first camp finishes with minutes to spare.',
    sections: [
      {
        heading: 'The two halves of the Economics paper',
        body: [
          'Introductory macroeconomics supplies the numericals: national income aggregates, the investment multiplier, money creation, and government budget arithmetic. These follow tight formats where timed repetition converts directly into marks.',
          'Indian economic development is factual and NCERT-line specific: five-year plans, reforms since 1991, poverty measures, and employment definitions. Statement-based MCQs here reward line-level NCERT recall, so revision must be text-anchored, not summary-anchored.',
        ],
      },
      {
        heading: 'CUET Economics syllabus chapters',
        body: ['This list follows the subject syllabus. Available MockMob questions and their practice coverage can vary with current inventory.'],
        chips: chaptersFor('economics'),
      },
    ],
    faqs: [
      {
        question: 'Does CUET Economics include numericals?',
        answer:
          'Yes. National income, multiplier, banking, and budget numericals appear regularly. They follow repeatable formats that timed practice makes routine.',
      },
      {
        question: 'Is NCERT enough for CUET Economics?',
        answer:
          'NCERT is the source of truth for the factual half of the paper. Pair line-level NCERT revision with timed MCQ practice for the numerical half.',
      },
      {
        question: 'How do I fix a weak Economics chapter fast?',
        answer:
          'When practice is available, try a short chapter set, review the result, then return to the topic later with fresh questions. Use your attempt history to check what changed.',
      },
    ],
  },
  {
    slug: 'business-studies',
    subjectId: 'business_studies',
    name: 'Business Studies',
    title: 'CUET Business Studies Mock Test & Practice | MockMob',
    description:
      'CUET Business Studies practice: management principles, marketing, finance, and case-based MCQs with timed mocks and chapter analytics.',
    eyebrow: '// CUET Business Studies',
    h1: 'CUET Business Studies Mock Tests & Practice',
    intro:
      'Business Studies looks like the easiest commerce subject until the paper arrives: case-based MCQs where every option quotes the textbook and only one matches the scenario. Reading precision, not memory, is what the exam actually tests.',
    sections: [
      {
        heading: 'Beating the case-based format',
        body: [
          'Most Business Studies questions wrap a concept in a two-line scenario: identify the principle of management, the function, or the marketing element in play. Practising these under time teaches the keyword-spotting that separates near-identical options.',
          'Chapters on business finance and marketing carry disproportionate weight and blend into Economics-style reasoning. Treat them as priority lanes rather than end-of-syllabus afterthoughts.',
        ],
      },
      {
        heading: 'CUET Business Studies syllabus chapters',
        body: ['This list follows the subject syllabus. Available MockMob questions and their practice coverage can vary with current inventory.'],
        chips: chaptersFor('business_studies'),
      },
    ],
    faqs: [
      {
        question: 'Are CUET Business Studies questions case-based?',
        answer:
          'A large share are short scenario MCQs that test application of principles, functions, and marketing concepts rather than direct definitions.',
      },
      {
        question: 'Which Business Studies chapters matter most for CUET?',
        answer:
          'Principles and functions of management, business finance, and marketing consistently anchor the paper across years.',
      },
      {
        question: 'Can I combine Business Studies with Accountancy practice on MockMob?',
        answer:
          'Yes. Mocks can mix your selected subjects, and the dashboard tracks each subject and chapter separately.',
      },
    ],
  },
  {
    slug: 'history',
    subjectId: 'history',
    name: 'History',
    title: 'CUET History Mock Test & Chapter-Wise PYQ Practice | MockMob',
    description:
      'CUET History practice from Harappa to the Constitution: NCERT Themes-based MCQs, source questions, timed mocks, and weak-chapter analytics.',
    eyebrow: '// CUET History',
    h1: 'CUET History Mock Tests & Practice',
    intro:
      'CUET History is built almost entirely on NCERT Themes in Indian History, and it loves the details students skim: source excerpts, travellers, inscriptions, and match-the-column sets. It punishes broad-strokes revision and rewards students who practised the exam format itself.',
    sections: [
      {
        heading: 'How to revise History for MCQs, not essays',
        body: [
          'Board-style History revision optimises for long answers; CUET wants precise recall of names, dates, sources, and pairings. Convert every Themes chapter into MCQ practice early, because recognising a fact in options is a different skill from writing about it.',
          'Match-the-column and chronology questions can be challenging. Timed drills on traveller accounts, Bhakti-Sufi figures, and movement chronology can make your review more focused.',
        ],
      },
      {
        heading: 'CUET History syllabus chapters',
        body: ['This list follows the subject syllabus. Available MockMob questions and their practice coverage can vary with current inventory.'],
        chips: chaptersFor('history'),
      },
    ],
    faqs: [
      {
        question: 'Is NCERT enough for CUET History?',
        answer:
          'Themes in Indian History (Parts I to III) is the core source. The gap is format: practise MCQs, sources, and match-the-column sets under time.',
      },
      {
        question: 'Does CUET History ask source-based questions?',
        answer:
          'Yes, excerpts and source identification appear regularly, which is why the NCERT source boxes are worth studying, not skipping.',
      },
      {
        question: 'How does MockMob help with History chronology?',
        answer:
          'Chronology-heavy chapters get dedicated drills, and Mistake Replay resurfaces the exact sequences you got wrong until they stick.',
      },
    ],
  },
  {
    slug: 'political-science',
    subjectId: 'political_science',
    name: 'Political Science',
    title: 'CUET Political Science Mock Test & Practice | MockMob',
    description:
      'CUET Political Science practice: contemporary world politics and Indian politics since independence, with timed MCQ mocks and analytics.',
    eyebrow: '// CUET Political Science',
    h1: 'CUET Political Science Mock Tests & Practice',
    intro:
      'Political Science is one of the highest-scoring CUET subjects for prepared students because the syllabus is compact: two NCERTs, heavy on events, organisations, and leaders. The risk is complacency, statement-combination questions turn "easy" facts into coin flips for anyone who revised loosely.',
    sections: [
      {
        heading: 'The two-book game plan',
        body: [
          'Contemporary World Politics supplies questions on the Cold War, international organisations, and globalisation: precise names, years, and treaty facts. Politics in India Since Independence covers parties, movements, and eras where sequence questions dominate.',
          'Statement-based MCQs ("which of the following are correct") are the signature trap. The counter is practising eliminating options under time, which is exactly what short chapter drills train.',
        ],
      },
      {
        heading: 'CUET Political Science syllabus chapters',
        body: ['This list follows the subject syllabus. Available MockMob questions and their practice coverage can vary with current inventory.'],
        chips: chaptersFor('political_science'),
      },
    ],
    faqs: [
      {
        question: 'Is CUET Political Science scoring?',
        answer:
          'A compact syllabus still calls for careful revision. Statement-combination and chronology questions reward close reading of each option.',
      },
      {
        question: 'Which book matters more for CUET Political Science?',
        answer:
          'Both NCERTs carry weight. Contemporary World Politics tends to be more fact-dense, while Politics in India Since Independence drives sequence and era questions.',
      },
      {
        question: 'Can I take Political Science chapter drills free?',
        answer:
          'Practice access depends on available questions and the current plan. Check the practice flow for what is available in your subject today.',
      },
    ],
  },
];

export function getSubjectHub(slug) {
  return SUBJECT_HUBS.find((hub) => hub.slug === slug) || null;
}
