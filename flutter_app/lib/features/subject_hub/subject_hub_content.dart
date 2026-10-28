// Generated from the website's own data, never written by hand: `src/lib/subjectHubs.js` (the
// six subject hubs at /cuet/<subject>) and `src/lib/seoPages.js` (the previous-year questions
// guide at /cuet-previous-year-questions), in wt-batch2 at 4db57fc5. The chapter lists are the
// website's `data/subjects.js` (canonical syllabus) as the hubs print them. The words are the
// website's words; nothing here is new copy. The website reads these from static modules, there is
// no API behind them, so the app bundles them. Chapters the live subject list returns win over the
// bundled ones (see subject_hub_data.dart); this list is the offline fallback.

class HubSection {
  const HubSection(this.heading, this.paragraphs);

  final String heading;
  final List<String> paragraphs;
}

class HubFaq {
  const HubFaq(this.question, this.answer);

  final String question;
  final String answer;
}

/// One subject hub of the website.
class SubjectHubContent {
  const SubjectHubContent({
    required this.slug,
    required this.subjectId,
    required this.name,
    required this.intro,
    required this.approach,
    required this.chapters,
    required this.faqs,
  });

  /// The website path segment (`business-studies`).
  final String slug;

  /// The public subject id the API takes (`business_studies`).
  final String subjectId;
  final String name;
  final String intro;

  /// The one strategy section the hub prints before the chapter list.
  final HubSection approach;

  /// The syllabus chapters, in the website's order.
  final List<String> chapters;
  final List<HubFaq> faqs;
}

/// The website's previous-year questions guide. It is a method guide: the website says in its own
/// first paragraph that MockMob does not hold a verified past-paper set, and so does this screen.
class PyqGuideContent {
  const PyqGuideContent({required this.intro, required this.sections, required this.faqs});

  final String intro;
  final List<HubSection> sections;
  final List<HubFaq> faqs;
}

const List<SubjectHubContent> subjectHubs = [
  SubjectHubContent(
    slug: 'english',
    subjectId: 'english',
    name: 'English',
    intro: 'CUET English rewards pace above everything: long reading comprehension sets, vocabulary calls you either know in two seconds or lose a minute to, and grammar traps built for second-guessing. Practising it untimed hides exactly the weakness the exam exposes.',
    approach: HubSection('How to structure CUET English practice', [
      'Reading comprehension carries the heaviest weight, so anchor every practice block around at least one full RC passage under time. Track seconds per question, not just accuracy: most English scores leak on pace, not knowledge.',
      'Vocabulary and grammar respond to short daily drills far better than weekend marathons. Ten questions a day across synonyms, antonyms, idioms, and error-spotting compounds into exam-grade recall within weeks.',
    ]),
    chapters: [
      'Factual Passage',
      'Narrative Passage',
      'Literary Passage',
      'Para Jumbles',
      'Match the Following',
      'Vocabulary',
      'Correct Word Usage',
    ],
    faqs: [
      HubFaq('How many questions does CUET English have?', 'In CUET UG 2026 each subject paper had 50 questions in 60 minutes, all compulsory. MockMob’s full mocks use the same format.'),
      HubFaq('Is reading comprehension the most important CUET English topic?', 'It is usually the biggest time sink. Practise full passages under the clock and track seconds per question, because that is where most English marks leak.'),
    ],
  ),
  SubjectHubContent(
    slug: 'accountancy',
    subjectId: 'accountancy',
    name: 'Accountancy',
    intro: 'CUET Accountancy is a paper of procedures: goodwill, revaluation, capital adjustments, ratios and cash flow. Know each treatment cold and most questions become quick arithmetic. Hesitate, and the clock takes the marks.',
    approach: HubSection('Where Accountancy scores are won', [
      'Partnership fundamentals, admission and retirement, and company accounts form the core of the paper. These chapters are procedural: once the treatment of goodwill, revaluation, and capital adjustment is automatic, questions become arithmetic.',
      'Ratio analysis and cash flow statements are the classic differentiators. They punish students who memorised formulas without practising classification, and reward anyone who has solved fifty timed variants.',
    ]),
    chapters: [
      'Partnership Fundamentals',
      'Profit & Loss Appropriation Account',
      'Change in Profit Sharing Ratio',
      'Goodwill Valuation',
      'Admission of Partner',
      'Retirement & Death of Partner',
      'Dissolution of Partnership',
      'Dissolution of Partnership Firm',
      'Share Capital',
      'Debentures',
      'Financial Statements of Company',
      'Analysis of Financial Statements',
      'Comparative & Common Size Statements',
      'Accounting Ratios',
      'Cash Flow Statement',
      'Computerized Accounting System',
    ],
    faqs: [
      HubFaq('Is CUET Accountancy tougher than boards?', 'It is different rather than tougher. Every question is objective, so there are no marks for working and a slow method costs you time. Practise the calculations under a timer.'),
      HubFaq('Which Accountancy chapters should I prioritise?', 'Partnership (fundamentals, admission, retirement) plus company accounts historically carry the most weight, with ratios and cash flow as the top differentiators.'),
      HubFaq('Does MockMob show chapter-wise Accountancy analysis?', 'Yes. The weak-chapters view traces every miss to its chapter, so after a mock you can see whether partnership, company accounts or ratios cost you the most.'),
    ],
  ),
  SubjectHubContent(
    slug: 'economics',
    subjectId: 'economics',
    name: 'Economics',
    intro: 'CUET Economics splits students into two camps: those who treat macro numericals (national income, multipliers, banking ratios) as pattern drills, and those who re-derive everything in the exam hall. The first camp finishes with minutes to spare.',
    approach: HubSection('The two halves of the Economics paper', [
      'Introductory macroeconomics supplies the numericals: national income aggregates, the investment multiplier, money creation, and government budget arithmetic. These follow tight formats where timed repetition converts directly into marks.',
      'Indian economic development is factual and NCERT-line specific: five-year plans, reforms since 1991, poverty measures, and employment definitions. Statement-based MCQs here reward line-level NCERT recall, so revision must be text-anchored, not summary-anchored.',
    ]),
    chapters: [
      'Introduction & Theory of Consumer Behaviour',
      'Production & Costs',
      'Theory of Firms under Perfect Competition',
      'Market Equilibrium & Simple Applications',
      'National Income & Related Aggregates',
      'Money & Banking',
      'Income Determination',
      'Government Budget & the Economy',
      'Balance of Payments',
      'Indian Economy on the Eve of Independence',
      'Indian Economic Development 1950–1990',
      'Economic Reforms Since 1991',
      'Human Capital Formation',
      'Rural Development',
      'Employment',
      'Infrastructure',
      'Environment & Sustainable Development',
      'Development Experiences of India',
    ],
    faqs: [
      HubFaq('Does CUET Economics include numericals?', 'Yes. National income, multiplier, banking, and budget numericals appear regularly. They follow repeatable formats that timed practice makes routine.'),
      HubFaq('Is NCERT enough for CUET Economics?', 'NCERT is the source of truth for the factual half of the paper. Pair line-level NCERT revision with timed MCQ practice for the numerical half.'),
      HubFaq('How do I fix a weak Economics chapter fast?', 'Take a short timed set on that chapter, read why each miss was wrong, then come back a few days later with fresh questions. The weak-chapters view shows whether the chapter moved.'),
    ],
  ),
  SubjectHubContent(
    slug: 'business-studies',
    subjectId: 'business_studies',
    name: 'Business Studies',
    intro: 'Business Studies looks like the easiest commerce subject until the paper arrives: case-based MCQs where every option quotes the textbook and only one matches the scenario. Reading precision, not memory, is what the exam actually tests.',
    approach: HubSection('Beating the case-based format', [
      'Most Business Studies questions wrap a concept in a two-line scenario: identify the principle of management, the function, or the marketing element in play. Practising these under time teaches the keyword-spotting that separates near-identical options.',
      'Chapters on business finance and marketing carry disproportionate weight and blend into Economics-style reasoning. Treat them as priority lanes rather than end-of-syllabus afterthoughts.',
    ]),
    chapters: [
      'Nature & Significance of Management',
      'Principles of Management',
      'Business Environment',
      'Planning',
      'Organising',
      'Staffing',
      'Directing',
      'Controlling',
      'Financial Management',
      'Financial Markets',
      'Marketing Management',
      'Consumer Protection',
      'Entrepreneurship Development',
    ],
    faqs: [
      HubFaq('Are CUET Business Studies questions case-based?', 'A large share are short scenario MCQs that test application of principles, functions, and marketing concepts rather than direct definitions.'),
      HubFaq('Which Business Studies chapters matter most for CUET?', 'Principles and functions of management, business finance, and marketing consistently anchor the paper across years.'),
      HubFaq('Can I combine Business Studies with Accountancy practice on MockMob?', 'Yes. Practise each subject on its own, and the weak-chapters view tracks every subject and chapter separately.'),
    ],
  ),
  SubjectHubContent(
    slug: 'history',
    subjectId: 'history',
    name: 'History',
    intro: 'CUET History is built almost entirely on NCERT Themes in Indian History, and it loves the details students skim: source excerpts, travellers, inscriptions, and match-the-column sets. It punishes broad-strokes revision and rewards students who practised the exam format itself.',
    approach: HubSection('How to revise History for MCQs, not essays', [
      'Board-style History revision optimises for long answers; CUET wants precise recall of names, dates, sources, and pairings. Convert every Themes chapter into MCQ practice early, because recognising a fact in options is a different skill from writing about it.',
      'Match-the-column and chronology questions are where loose revision shows. Timed drills on traveller accounts, Bhakti-Sufi figures and movement chronology close that gap.',
    ]),
    chapters: [
      'Bricks, Beads & Bones',
      'Kings, Farmers & Towns',
      'Kinship, Caste & Class',
      'Thinkers, Beliefs & Buildings',
      'Through the Eyes of Travellers',
      'Bhakti-Sufi Traditions',
      'An Imperial Capital — Vijayanagara',
      'Peasants, Zamindars & the State',
      'Kings & Chronicles',
      'Colonialism & the Countryside',
      'Rebels & the Raj',
      'Mahatma Gandhi & the Nationalist Movement',
      'Partition',
      'Framing the Constitution',
    ],
    faqs: [
      HubFaq('Is NCERT enough for CUET History?', 'Themes in Indian History (Parts I to III) is the core source. The gap is format: practise MCQs, sources, and match-the-column sets under time.'),
      HubFaq('Does CUET History ask source-based questions?', 'Yes, excerpts and source identification appear regularly, which is why the NCERT source boxes are worth studying, not skipping.'),
      HubFaq('How does MockMob help with History chronology?', 'Practise chronology-heavy chapters as short timed sets. Review then lists every sequence you got wrong, so you know exactly what to go back to.'),
    ],
  ),
  SubjectHubContent(
    slug: 'political-science',
    subjectId: 'political_science',
    name: 'Political Science',
    intro: 'Political Science is one of the highest-scoring CUET subjects for prepared students because the syllabus is compact: two NCERTs, heavy on events, organisations, and leaders. The risk is complacency: statement-combination questions turn "easy" facts into coin flips for anyone who revised loosely.',
    approach: HubSection('The two-book game plan', [
      'Contemporary World Politics supplies questions on the Cold War, international organisations, and globalisation: precise names, years, and treaty facts. Politics in India Since Independence covers parties, movements, and eras where sequence questions dominate.',
      'Statement-based MCQs ("which of the following are correct") are the signature trap. The counter is practising eliminating options under time, which is exactly what short chapter drills train.',
    ]),
    chapters: [
      'Challenges of Nation Building',
      'Era of One-Party Dominance',
      'Politics of Planned Development',
      'India\'s External Relations',
      'Challenges to & Restoration of the Congress System',
      'Crisis of the Democratic Order',
      'Rise of Popular Movements',
      'Regional Aspirations',
      'Democratic Upsurge and Coalition Politics',
      'Recent Issues and Challenges',
      'Cold War Era',
      'End of Bipolarity',
      'US Hegemony in World Politics',
      'Alternative Centres of Power',
      'Contemporary South Asia',
      'International Organisations',
      'Security in the Contemporary World',
      'Environment & Natural Resources',
      'Globalisation',
    ],
    faqs: [
      HubFaq('Is CUET Political Science scoring?', 'Yes, for students who revise precisely. The syllabus is compact, but statement-combination and chronology questions punish loose revision.'),
      HubFaq('Which book matters more for CUET Political Science?', 'Both NCERTs carry weight. Contemporary World Politics tends to be more fact-dense, while Politics in India Since Independence drives sequence and era questions.'),
      HubFaq('Can I take Political Science chapter drills free?', 'Free accounts practise on credits. Open Practice to see the Political Science sets ready today.'),
    ],
  ),
];

const PyqGuideContent pyqGuide = PyqGuideContent(
  intro: 'Learn how to use CUET previous year questions to study exam patterns and review your preparation. MockMob does not currently claim a verified historical question inventory; its ordinary practice content is not presented as official past-paper material.',
  sections: [
    HubSection('Why CUET previous year questions are important', [
      'Previous year questions show the difference between knowing a chapter and answering an exam question under pressure. They reveal the language of the paper, the depth of concepts usually tested, and the kind of distractors that make a familiar topic feel tricky. For CUET aspirants, PYQs also help separate high-yield areas from topics that may need lighter revision.',
      'Many students use CUET previous year questions only as a checklist. A better method is to treat them as pattern data. Notice which chapters repeat, which question styles consume time, and which subjects reward direct recall versus application. When you combine PYQs with mock tests, you get both pattern familiarity and exam stamina.',
    ]),
    HubSection('How to practise CUET PYQs correctly', [
      'Start by solving a set without looking at explanations. Use a timer, even for short sets, because CUET preparation must include speed. After solving, mark each question as correct, incorrect, guessed, or skipped. This small classification gives you more useful data than a raw score. Guessed-correct questions still need review because they can become future mistakes.',
      'The review should be chapter-specific. If several questions from a subject go wrong, ask whether they belong to the same chapter, formula family, or reading pattern. Then practise a small drill before returning to another PYQ set. This turns a past-paper session into specific review actions.',
      'Avoid solving PYQs in a hurry only to mark them complete. The real value appears when you compare your reasoning with the answer. If you chose a wrong option, identify whether the issue was concept confusion, careless reading, lack of elimination, or time pressure. Each mistake type needs a different fix, and that distinction is what makes previous year question practice powerful.',
    ]),
    HubSection('Using MockMob with previous year questions', [
      'MockMob helps organize practice around available questions, saved items, and attempt history. Its ordinary library contains CUET-style practice and is not represented as verified historical exam material. When your own PYQ review exposes a weak area, use available practice to revisit that topic.',
      'A smart weekly routine could include one previous year question session, two subject-wise practice tests, one mixed mock, and one revision block for saved questions. This gives you pattern recognition, topic coverage, time management, and mistake correction in the same week. It is simple, repeatable, and easier to sustain than random study marathons.',
      'When a PYQ feels difficult, save it and revisit it after a few days. If you can solve it later without remembering the answer, the concept has started to settle. If you still struggle, it belongs in your priority list. This spaced return is especially useful for CUET subjects where similar ideas appear in different wording across practice sets.',
    ]),
    HubSection('PYQ strategy for higher CUET scores', [
      'Do not memorise answers blindly. CUET questions can change wording, order, and framing, so the real advantage is understanding the pattern behind the answer. For each PYQ, write down the concept tested, the trap in the options, and the fastest route to the correct choice. Over time, this builds an exam instinct that simple note revision cannot provide.',
      'Use PYQs closer to the exam as calibration. If your mock scores are improving but PYQ accuracy is unstable, your preparation may be drifting away from the exam style. If PYQs feel comfortable but mocks are slow, the issue may be stamina or time allocation. Both signals matter, and the best CUET preparation plan uses them together.',
      'PYQs are also useful for confidence because they replace vague fear with concrete patterns. Instead of wondering what CUET might ask, you see the actual level and framing from past papers. That clarity makes revision calmer and helps you spend less time on low-value material that looks impressive in notes but rarely affects exam performance.',
    ]),
  ],
  faqs: [
    HubFaq('Are CUET previous year questions enough for CUET preparation?', 'CUET PYQs can help with exam-pattern familiarity. Combine them with chapter practice, revision, and timed tests, and check that any question described as a past-paper item has a clear source.'),
    HubFaq('How should I analyse CUET previous year questions?', 'Track the chapter, mistake type, time taken, and whether the answer was guessed. This makes PYQ practice diagnostic instead of just repetitive.'),
    HubFaq('When should I start solving CUET PYQs?', 'Start once you know the basics of a subject. Early PYQ exposure helps you understand question style, while later PYQ rounds help with exam calibration.'),
    HubFaq('Can MockMob help with CUET PYQ-style practice?', 'Yes. MockMob supports CUET-style question practice, saved questions, timed mocks, and analytics that help you act on the weak areas PYQs reveal.'),
  ],
);
