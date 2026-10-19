import { SUBJECT_PAGES } from './subjectPages.mjs';

// The words on each CUET subject page (/cuet/<slug>): the title and description search shows, the opening, one essay on
// where the subject's marks are won and lost, and the questions students ask about that subject. The facts every subject
// shares (the paper, the marking, the syllabus, the bank counts, the free first mock) come from src/lib/subjectPages.mjs,
// so they cannot drift between pages. Owner's voice: plain, confident, grammatical; no exclamation marks, no hype, no
// em dash, no middle dot. Claims stay inside what the syllabus and the product actually do.
const HUB_WORDS = {
  english: {
    title: 'CUET English Mock Test 2027: Syllabus, Free Mock and Practice | MockMob',
    description:
      'CUET English 101: reading comprehension, vocabulary, word usage, para jumbles. Full mocks built fresh from a live bank, marked +5/−1. First mock free.',
    h1: 'CUET English mock tests and practice',
    intro:
      'CUET English rewards pace above everything: long passages, vocabulary calls you either know in two seconds or lose a minute to, and word-usage traps built for second-guessing. Practising it untimed hides exactly the weakness the exam exposes.',
    essay: {
      heading: 'Where English marks are won',
      body: [
        'Reading comprehension carries the heaviest weight, so anchor every practice block around at least one full passage under time. Track seconds per question, not just accuracy: most English scores leak on pace, not knowledge.',
        'Vocabulary, correct word usage and para jumbles respond to short daily drills far better than weekend marathons. Ten questions a day compounds into exam-grade recall within weeks.',
      ],
    },
    faqs: [
      {
        question: 'Is reading comprehension the most important part of CUET English?',
        answer:
          'It is usually the biggest time sink. Practise full passages under the clock and track seconds per question, because that is where most English marks leak.',
      },
      {
        question: 'Can I try a CUET English question without signing up?',
        answer: 'Yes. The question on the MockMob home page needs no account. A free account opens full mocks and the review after each one.',
      },
    ],
  },
  'general-test': {
    title: 'CUET General Test Mock Test 2027: Syllabus, Free Mock and Practice | MockMob',
    description:
      'CUET General Test 501: GK, current affairs, reasoning, numerical ability and quantitative reasoning. Fresh full mocks marked +5/−1. Your first mock is free.',
    h1: 'CUET General Test mock tests and practice',
    intro:
      'The General Test is the widest paper in CUET: general knowledge, current affairs, mental ability, arithmetic and logical reasoning in one sitting. Nothing in it is hard on its own. The marks go to whoever switches between them fastest without slipping.',
    essay: {
      heading: 'Where General Test marks are won',
      body: [
        'Numerical ability and quantitative reasoning use school mathematics: percentages, ratios, averages, simple algebra and data from a table or chart. The skill is speed with no careless step, which only timed sets build.',
        'Reasoning questions (series, coding, directions, arrangements) repeat their shapes. Once you have seen fifty of each under time, most become a fifteen-second read. General knowledge and current affairs reward a little every day, never a cram the week before.',
      ],
    },
    faqs: [
      {
        question: 'Do I need the CUET General Test?',
        answer:
          'Only if a programme you want asks for it. Some do, and many students add it to keep more courses open. The DU cutoff calculator on MockMob shows which programmes your subject choice opens.',
      },
      {
        question: 'What level of maths is in the General Test?',
        answer:
          'School-level arithmetic and basic algebra, geometry and data reading. The difficulty is the clock, not the concepts, so practise in timed sets.',
      },
    ],
  },
  accountancy: {
    title: 'CUET Accountancy Mock Test 2027: Syllabus, Free Mock and Practice | MockMob',
    description:
      'CUET Accountancy 301: partnership, company accounts, ratios, cash flow. Unlimited fresh mocks with Pro, every miss traced to its chapter. First mock free.',
    h1: 'CUET Accountancy mock tests and practice',
    intro:
      'CUET Accountancy is a paper of procedures: goodwill, revaluation, capital adjustments, ratios and cash flow. Know each treatment cold and most questions become quick arithmetic. Hesitate, and the clock takes the marks.',
    essay: {
      heading: 'Where Accountancy marks are won',
      body: [
        'Partnership fundamentals, admission and retirement, and company accounts form the core of the paper. These chapters are procedural: once the treatment of goodwill, revaluation and capital adjustment is automatic, questions become arithmetic.',
        'Ratio analysis and cash flow statements are the classic differentiators. They punish students who memorised formulas without practising classification, and reward anyone who has solved fifty timed variants.',
      ],
    },
    faqs: [
      {
        question: 'Is CUET Accountancy tougher than boards?',
        answer:
          'It is different rather than tougher. Every question is objective, so there are no marks for working and a slow method costs you time. Practise the calculations under a timer.',
      },
      {
        question: 'Which Accountancy chapters should I prioritise?',
        answer:
          'Partnership (fundamentals, admission, retirement) and company accounts carry the most weight, with ratios and cash flow as the top differentiators.',
      },
      {
        question: 'Does MockMob show chapter-wise Accountancy analysis?',
        answer:
          'Yes. Chapter review traces every miss to its chapter, so after a mock you can see whether partnership, company accounts or ratios cost you the most.',
      },
    ],
  },
  'business-studies': {
    title: 'CUET Business Studies Mock Test 2027: Syllabus, Free Mock and Practice | MockMob',
    description:
      'CUET Business Studies 305: principles of management, finance, marketing, case-based MCQs. Fresh full mocks marked +5/−1, every miss explained. First mock free.',
    h1: 'CUET Business Studies mock tests and practice',
    intro:
      'Business Studies looks like the easiest commerce subject until the paper arrives: case-based questions where every option quotes the textbook and only one matches the scenario. Reading precision, not memory, is what the exam tests.',
    essay: {
      heading: 'Beating the case-based format',
      body: [
        'Most Business Studies questions wrap a concept in a two-line scenario: name the principle of management, the function or the marketing element in play. Practising these under time teaches the keyword-spotting that separates near-identical options.',
        'Business finance, financial markets and marketing blend into Economics-style reasoning. Treat them as priority chapters rather than end-of-syllabus afterthoughts.',
      ],
    },
    faqs: [
      {
        question: 'Are CUET Business Studies questions case-based?',
        answer:
          'A large share are short scenario questions that test how a principle, function or marketing concept applies, rather than its definition.',
      },
      {
        question: 'Can I practise Business Studies and Accountancy together on MockMob?',
        answer: 'Yes. Add both to your subjects. Each has its own mocks, and chapter review tracks every subject and chapter separately.',
      },
    ],
  },
  economics: {
    title: 'CUET Economics Mock Test 2027: Syllabus, Free Mock and Practice | MockMob',
    description:
      'CUET Economics 309: micro, macro and Indian economic development. Numericals and NCERT-line questions in fresh full mocks marked +5/−1. First mock free.',
    h1: 'CUET Economics mock tests and practice',
    intro:
      'CUET Economics splits students into two camps: those who treat macro numericals (national income, multipliers, banking ratios) as pattern drills, and those who re-derive everything in the exam hall. The first camp finishes with minutes to spare.',
    essay: {
      heading: 'The two halves of the Economics paper',
      body: [
        'Microeconomics and macroeconomics supply the numericals: national income aggregates, the investment multiplier, money creation, cost curves and budget arithmetic. These follow tight formats where timed repetition converts directly into marks.',
        'Indian economic development is factual and NCERT-line specific: planning, reforms since 1991, human capital, rural development and employment. Statement questions here reward line-level recall, so revise from the text, not from summaries.',
      ],
    },
    faqs: [
      {
        question: 'Does CUET Economics include numericals?',
        answer:
          'Yes. National income, multiplier, banking and budget numericals appear regularly. They follow repeatable formats that timed practice makes routine.',
      },
      {
        question: 'How do I fix a weak Economics chapter fast?',
        answer:
          'Take a short timed set on that chapter, read why each miss was wrong, then come back a few days later to fresh questions. Chapter review shows whether the chapter moved.',
      },
    ],
  },
  mathematics: {
    title: 'CUET Mathematics Mock Test 2027: Syllabus, Free Mock and Practice | MockMob',
    description:
      'CUET Mathematics 319: calculus, matrices, vectors, probability, linear programming and applied maths. Fresh timed mocks marked +5/−1. Your first mock is free.',
    h1: 'CUET Mathematics mock tests and practice',
    intro:
      'CUET Mathematics gives you about seventy seconds a question. That is enough for anyone who knows the shortcut and nowhere near enough for anyone solving it the board-exam way. The paper is a test of method choice as much as mathematics.',
    essay: {
      heading: 'Where Mathematics marks are won',
      body: [
        'Calculus carries the most chapters: continuity, derivatives and their applications, integrals and differential equations. Most questions reward recognising the standard form fast, so drill the forms, not just the theory.',
        'Matrices, determinants, vectors and probability are the reliable marks: short, procedural and quick to check. Use the options too. Substituting a value or testing a choice often beats solving from scratch, and only timed practice teaches you when.',
      ],
    },
    faqs: [
      {
        question: 'Are Mathematics and Applied Mathematics the same CUET paper?',
        answer:
          'They share one paper code, 319. The syllabus MockMob follows lists the core Mathematics units and an Applied Mathematics unit.',
      },
      {
        question: 'How do I get faster at CUET Mathematics?',
        answer:
          'Practise in timed sets and look at the seconds you spent on each miss. Chapter review shows where your time went, so you can see whether a chapter costs you accuracy or pace.',
      },
    ],
  },
  physics: {
    title: 'CUET Physics Mock Test 2027: Syllabus, Free Mock and Practice | MockMob',
    description:
      'CUET Physics 322: electrostatics, current, magnetism, optics, modern physics and semiconductors. Fresh full mocks marked +5/−1, every miss explained. First mock free.',
    h1: 'CUET Physics mock tests and practice',
    intro:
      'CUET Physics follows the Class 12 NCERT book closely, and most questions are one formula and one step. Students lose marks to sign errors, unit slips and second-guessing, far more than to physics they do not know.',
    essay: {
      heading: 'Where Physics marks are won',
      body: [
        'Electrostatics, current electricity and magnetism make up a large part of the syllabus, and their numericals repeat the same few relationships. Solve enough of them under time and the setup becomes automatic.',
        'Optics, dual nature, atoms, nuclei and semiconductors are shorter and more conceptual: direct statements, graphs and quick calculations. They are some of the cheapest marks in the paper if you have read the NCERT text closely.',
      ],
    },
    faqs: [
      {
        question: 'Is NCERT enough for CUET Physics?',
        answer:
          'The syllabus is the Class 12 NCERT syllabus, so the book is the base. The gap is speed and accuracy on objective questions, which timed practice closes.',
      },
      {
        question: 'Which Physics chapters should I start with?',
        answer:
          'Start with electrostatics and current electricity, since they carry the most chapters, then do short timed sets on the modern physics chapters, where marks come quickest.',
      },
    ],
  },
  chemistry: {
    title: 'CUET Chemistry Mock Test 2027: Syllabus, Free Mock and Practice | MockMob',
    description:
      'CUET Chemistry 306: physical, inorganic and organic chemistry from the Class 12 syllabus. Fresh full mocks marked +5/−1, every miss explained. First mock free.',
    h1: 'CUET Chemistry mock tests and practice',
    intro:
      'CUET Chemistry is three papers in one: physical chemistry numericals, inorganic facts and exceptions, and organic reactions with their named conditions. A student strong in one and loose in another loses more marks than they expect.',
    essay: {
      heading: 'Where Chemistry marks are won',
      body: [
        'Solutions, electrochemistry and chemical kinetics are formula-led: colligative properties, cell potentials and rate laws. Their numericals are short, and timed sets turn them into dependable marks.',
        'Organic chemistry, from haloalkanes to amines and biomolecules, rewards knowing each reaction, reagent and product cold. Coordination compounds and the d- and f-block reward exact facts. Both are memory under pressure, which is why short daily sets beat long weekly ones.',
      ],
    },
    faqs: [
      {
        question: 'Is CUET Chemistry mostly organic?',
        answer:
          'Organic chapters are a large share of the syllabus, but physical and inorganic chemistry carry real weight too. Practise all three, and let chapter review show which one costs you most.',
      },
      {
        question: 'How should I revise named reactions for CUET?',
        answer:
          'In short timed sets. Seeing a reaction in four options is a different skill from writing it out, and only objective practice trains that recognition.',
      },
    ],
  },
  biology: {
    title: 'CUET Biology Mock Test 2027: Syllabus, Free Mock and Practice | MockMob',
    description:
      'CUET Biology 304: reproduction, genetics, evolution, biotechnology and ecology. NCERT-line questions in fresh full mocks marked +5/−1. Your first mock is free.',
    h1: 'CUET Biology mock tests and practice',
    intro:
      'CUET Biology is an NCERT-line paper. Questions lift terms, diagrams and examples straight from the Class 12 book, then change one word in an option. Students who read closely score high; students who revised from notes fall for the swapped word.',
    essay: {
      heading: 'Where Biology marks are won',
      body: [
        'Genetics and evolution carry the reasoning questions: crosses, ratios, inheritance patterns and the molecular basis of inheritance. Practise them until the ratios are instant.',
        'Reproduction, human welfare, biotechnology and ecology are recall-heavy. Statement and match-the-column questions test whether you know the exact example, organism or process. Short timed sets show quickly which chapters you only half know.',
      ],
    },
    faqs: [
      {
        question: 'Is NCERT enough for CUET Biology?',
        answer:
          'The paper follows the Class 12 NCERT syllabus closely, so the book is the core. Pair close reading with timed objective practice, because the traps are in the wording.',
      },
      {
        question: 'Which Biology chapters are the most reliable marks?',
        answer:
          'Ecology and biotechnology are compact and quick to revise, and genetics rewards practice. Chapter review after each mock shows where your own marks went.',
      },
    ],
  },
  'computer-science': {
    title: 'CUET Computer Science Mock Test 2027: Syllabus, Free Mock and Practice | MockMob',
    description:
      'CUET Computer Science and Informatics Practices 308: Python, SQL, networks, data structures and Pandas. Fresh full mocks marked +5/−1. First mock free.',
    h1: 'CUET Computer Science mock tests and practice',
    intro:
      'CUET Computer Science asks you to run code in your head. Predict the output of a Python snippet, the result of a SQL query, the state of a stack after five operations. Reading code is a skill of its own, and it only grows with practice.',
    essay: {
      heading: 'Where Computer Science marks are won',
      body: [
        'Databases and networks are the shared part of the syllabus: SQL queries, keys, joins, network types, devices and protocols. These are quick marks for anyone who has written queries rather than only read about them.',
        'Python, file handling, exceptions, stacks, queues, searching and sorting carry the output questions. Trace each snippet line by line, with the loop variables written down, until you can do it under time without slipping.',
      ],
    },
    faqs: [
      {
        question: 'Is Informatics Practices the same CUET paper as Computer Science?',
        answer:
          'They share one paper code, 308. The syllabus has a common part on databases and networks, then a Computer Science part and an Informatics Practices part.',
      },
      {
        question: 'Does CUET Computer Science ask code output questions?',
        answer:
          'Yes. Predicting the output of Python code and the result of SQL queries is a regular question type, so practise tracing code under time.',
      },
    ],
  },
  history: {
    title: 'CUET History Mock Test 2027: Syllabus, Free Mock and Practice | MockMob',
    description:
      'CUET History 314: Themes in Indian History Parts I to III, sources, travellers and the Constitution. Fresh full mocks marked +5/−1. Your first mock is free.',
    h1: 'CUET History mock tests and practice',
    intro:
      'CUET History is built on NCERT Themes in Indian History, and it loves the details students skim: source excerpts, travellers, inscriptions and match-the-column sets. It punishes broad-strokes revision and rewards students who practised the exam format itself.',
    essay: {
      heading: 'How to revise History for objective questions',
      body: [
        'Board-style History revision trains long answers; CUET wants precise recall of names, dates, sources and pairings. Turn every Themes chapter into objective practice early, because recognising a fact among options is a different skill from writing about it.',
        'Match-the-column and chronology questions are where loose revision shows. Timed sets on traveller accounts, Bhakti-Sufi figures and the national movement close that gap.',
      ],
    },
    faqs: [
      {
        question: 'Is NCERT enough for CUET History?',
        answer:
          'Themes in Indian History (Parts I to III) is the core source. The gap is format: practise objective questions, sources and match-the-column sets under time.',
      },
      {
        question: 'Does CUET History ask source-based questions?',
        answer:
          'Yes, excerpts and source identification appear regularly, which is why the NCERT source boxes are worth studying, not skipping.',
      },
    ],
  },
  'political-science': {
    title: 'CUET Political Science Mock Test 2027: Syllabus, Free Mock and Practice | MockMob',
    description:
      'CUET Political Science 323: world politics and politics in India since independence. Statement and chronology questions in fresh full mocks. First mock free.',
    h1: 'CUET Political Science mock tests and practice',
    intro:
      'Political Science is one of the highest-scoring CUET subjects for prepared students, because the syllabus is two compact books heavy on events, organisations and leaders. The risk is complacency: statement questions turn easy facts into coin flips for anyone who revised loosely.',
    essay: {
      heading: 'The two-book game plan',
      body: [
        'Contemporary World Politics brings the Cold War, international organisations and globalisation: precise names, years and treaty facts. Politics in India Since Independence covers parties, movements and eras, where sequence questions dominate.',
        'Statement questions ("which of the following are correct") are the signature trap. The counter is practising elimination under time, which is exactly what short chapter sets train.',
      ],
    },
    faqs: [
      {
        question: 'Is CUET Political Science scoring?',
        answer:
          'Yes, for students who revise precisely. The syllabus is compact, but statement and chronology questions punish loose revision.',
      },
      {
        question: 'Which book matters more for CUET Political Science?',
        answer:
          'Both carry weight. Contemporary World Politics is more fact-dense, while Politics in India Since Independence drives sequence and era questions.',
      },
    ],
  },
  geography: {
    title: 'CUET Geography Mock Test 2027: Syllabus, Free Mock and Practice | MockMob',
    description:
      'CUET Geography 313: human geography, population, activities, transport, settlements and India. Fresh full mocks marked +5/−1, every miss explained. First mock free.',
    h1: 'CUET Geography mock tests and practice',
    intro:
      'CUET Geography is human geography: people, how they earn, move, trade and settle, and how India fits that picture. The questions are rarely deep. They are exact, and an option that is almost right is the one that costs you.',
    essay: {
      heading: 'Where Geography marks are won',
      body: [
        'Population, migration and human development carry definitions and data the paper likes to test word for word: density, growth, sex ratio and the indices behind development. Learn the precise terms, not the gist.',
        'Primary, secondary, tertiary and quaternary activities, transport and trade reward clean classification. Match-the-column and statement questions here are quick marks once each example sits in the right category.',
      ],
    },
    faqs: [
      {
        question: 'Does CUET Geography include map questions?',
        answer:
          'Questions can name places, routes and regions from the NCERT books, so keep the book maps in your revision.',
      },
      {
        question: 'Is NCERT enough for CUET Geography?',
        answer:
          'The Class 12 NCERT books are the syllabus. Read them closely, then practise objective questions under time to catch the near-miss options.',
      },
    ],
  },
  psychology: {
    title: 'CUET Psychology Mock Test 2027: Syllabus, Free Mock and Practice | MockMob',
    description:
      'CUET Psychology 324: intelligence, personality, disorders, therapies, attitudes and social influence. Fresh full mocks marked +5/−1. Your first mock is free.',
    h1: 'CUET Psychology mock tests and practice',
    intro:
      'CUET Psychology is a paper of precise terms. Two options can both sound right, and only one uses the textbook’s exact definition of the concept. Students who learn the vocabulary of each chapter find the paper short.',
    essay: {
      heading: 'Where Psychology marks are won',
      body: [
        'Intelligence, self and personality, and psychological disorders are full of named theories, tests and categories. Keep a list of each name with its one-line idea and test yourself against it in timed sets.',
        'Therapeutic approaches, attitudes, social cognition and group processes lean on application: which concept does this situation show? Practise scenario questions until the match is immediate.',
      ],
    },
    faqs: [
      {
        question: 'Is CUET Psychology scoring?',
        answer:
          'For students who learn the exact terms, yes. The syllabus is seven compact units, and most questions turn on one definition.',
      },
      {
        question: 'Which Psychology units should I start with?',
        answer:
          'Start with intelligence, personality and disorders, which carry the most named theories, then the social units. Chapter review after each mock shows which units cost you marks.',
      },
    ],
  },
  sociology: {
    title: 'CUET Sociology Mock Test 2027: Syllabus, Free Mock and Practice | MockMob',
    description:
      'CUET Sociology 326: Indian society, social institutions, inequality, change and development. Fresh full mocks marked +5/−1, every miss explained. First mock free.',
    h1: 'CUET Sociology mock tests and practice',
    intro:
      'CUET Sociology asks you to recognise ideas in their own words: caste, family, market, community and the thinkers behind each view. It reads easily and marks strictly, because the options are paraphrases of the NCERT text.',
    essay: {
      heading: 'Where Sociology marks are won',
      body: [
        'Indian Society covers demography, institutions, inequality and diversity. Its questions test terms and the examples the book uses, so read the text itself, including the boxes.',
        'Social Change and Development in India covers structural and cultural change, democracy, rural and industrial society, globalisation, media and movements. Statement questions here reward knowing exactly what the book says, which timed sets reveal fast.',
      ],
    },
    faqs: [
      {
        question: 'Is NCERT enough for CUET Sociology?',
        answer:
          'The two Class 12 NCERT books are the syllabus. Read them closely, including the boxed examples, and practise objective questions under time.',
      },
      {
        question: 'Which Sociology chapters should I revise first?',
        answer:
          'Start with the Indian Society chapters, which are compact, then the change and development chapters. Chapter review after each mock shows which ones cost you marks.',
      },
    ],
  },
};

export const SUBJECT_HUBS = SUBJECT_PAGES.map((page) => Object.freeze({ ...page, subjectId: page.id, ...HUB_WORDS[page.slug] }));

export function getSubjectHub(slug) {
  return SUBJECT_HUBS.find((hub) => hub.slug === slug) || null;
}
