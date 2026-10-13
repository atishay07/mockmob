// Question pools for the device demo, so a practice started in any subject shows real CUET-style
// questions, real options and a real explanation on its result (device finding 4). Demo only:
// none of this ships.
import 'package:mockmob/core/models/models.dart';

class DemoQuestion {
  const DemoQuestion(this.chapter, this.question, this.options, this.key, this.explanation);

  final String chapter;
  final String question;
  final List<String> options;

  /// Index of the right option.
  final int key;
  final String explanation;
}

const Map<String, List<DemoQuestion>> _pools = {
  // Two questions a chapter, in chapter pairs: a 50-question paper cycles them, so every chapter
  // holds ten questions and each question's text belongs to its own chapter.
  'accountancy': [
    DemoQuestion('Admission of a partner', 'A and B share profits 3:2. C joins for a 1/5 share, taken equally from A and B. What is the new ratio?',
        ['5:3:2', '3:2:1', '11:5:4', '2:2:1'], 0, 'A gives 1/10 and B gives 1/10: A 3/5 - 1/10 = 5/10, B 2/5 - 1/10 = 3/10, C 2/10. So 5:3:2.'),
    DemoQuestion('Admission of a partner', 'The premium for goodwill the new partner brings in cash is shared by the old partners in their',
        ['Old ratio', 'Sacrificing ratio', 'New ratio', 'Capital ratio'], 1, 'Only the partners who give up a share are compensated, so the premium follows the sacrificing ratio.'),
    DemoQuestion('Goodwill', 'Average profit is Rs 30,000 and normal profit Rs 15,000. Goodwill at 3 years’ purchase of super profit is',
        ['Rs 90,000', 'Rs 30,000', 'Rs 45,000', 'Rs 15,000'], 2, 'Super profit = 30,000 - 15,000 = 15,000. Three years’ purchase: 15,000 x 3 = Rs 45,000.'),
    DemoQuestion('Goodwill', 'Under the capitalisation of super profit method, goodwill is super profit multiplied by',
        ['The years’ purchase', 'The normal rate of return', 'Average profit', '100 divided by the normal rate of return'], 3,
        'Capitalising super profit at the normal rate: super profit x 100 / normal rate of return.'),
    DemoQuestion('Retirement of a partner', 'The gaining ratio is the',
        ['Old ratio minus new ratio', 'New ratio minus old ratio', 'Ratio of capitals', 'Sacrificing ratio'], 1, 'Continuing partners gain: their new share minus their old share.'),
    DemoQuestion('Retirement of a partner', 'On retirement, the retiring partner’s share of goodwill is debited to the',
        ['Gaining partners’ capital accounts', 'Retiring partner’s capital account', 'Revaluation account', 'Realisation account'], 0,
        'The partners who gain the retiring partner’s share pay for it, in their gaining ratio.'),
    DemoQuestion('Issue of shares', 'Shares issued at a premium: the premium is credited to',
        ['Share capital', 'General reserve', 'Securities premium', 'Profit and loss'], 2, 'Section 52 of the Companies Act keeps the premium in a separate Securities Premium account.'),
    DemoQuestion('Issue of shares', 'When forfeited shares are reissued at a discount, the discount cannot exceed',
        ['The face value', 'The amount forfeited on those shares', 'The premium received', 'The called-up amount'], 1,
        'The discount on reissue is met from the forfeited amount, so it can never be more than that amount.'),
    DemoQuestion('Partnership fundamentals', 'If the partnership deed is silent, interest on partners’ capital is',
        ['6% a year', '12% a year', 'At the bank rate', 'Not allowed'], 3, 'Without a clause in the deed, the Partnership Act allows no interest on capital.'),
    DemoQuestion('Partnership fundamentals', 'If the deed is silent, a partner’s loan to the firm earns interest at',
        ['6% a year', '12% a year', 'Nothing', 'The bank rate'], 0, 'The Partnership Act sets 6% a year on a partner’s loan when the deed says nothing.'),
  ],
  'business_studies': [
    DemoQuestion('Principles of management', 'Which principle of Fayol says each employee should receive orders from one superior only?',
        ['Unity of direction', 'Unity of command', 'Scalar chain', 'Centralisation'], 1, 'Unity of command: one boss per employee. Unity of direction is one plan for one group of activities.'),
    DemoQuestion('Principles of management', 'Which technique of Taylor separates planning from doing?',
        ['Differential piece wage', 'Time study', 'Functional foremanship', 'Method study'], 2,
        'Functional foremanship puts planning in-charges and production in-charges over the worker.'),
    DemoQuestion('Nature and significance of management', 'Management is multidimensional because it manages',
        ['Only people', 'Work, people and operations', 'Only money', 'Only machines'], 1, 'It covers the work to be done, the people who do it and the operations that turn inputs into outputs.'),
    DemoQuestion('Business environment', 'Demonetisation in November 2016 is an example of a change in the',
        ['Economic environment', 'Social environment', 'Technological environment', 'Political environment'], 0,
        'It changed the money in circulation and the way business was paid: an economic change.'),
    DemoQuestion('Business environment', 'Liberalisation in 1991 mainly meant',
        ['More government ownership', 'Higher import duties', 'Fewer licences and controls on business', 'Selling only public companies'], 2,
        'Liberalisation removed most industrial licensing and eased controls on business.'),
    DemoQuestion('Planning', 'Which is the first step of the planning process?',
        ['Developing premises', 'Setting objectives', 'Implementing the plan', 'Follow-up action'], 1, 'Every later step needs to know what the plan is for, so objectives come first.'),
    DemoQuestion('Planning', 'A plan that states exactly what must or must not be done, leaving no discretion, is a',
        ['Policy', 'Programme', 'Rule', 'Budget'], 2, 'A rule is specific and rigid; a policy is a general guide that allows judgement.'),
    DemoQuestion('Organising', 'Activities grouped by product, each with its own manager, form a',
        ['Functional structure', 'Divisional structure', 'Informal organisation', 'Matrix of committees'], 1,
        'A divisional structure groups work by product, each division run like a unit of its own.'),
    DemoQuestion('Organising', 'In delegation, which cannot be passed down?',
        ['Authority', 'Responsibility for the task', 'Accountability', 'Work'], 2, 'Authority is delegated; the superior stays accountable for what the subordinate does.'),
    DemoQuestion('Staffing', 'Which is the first step of the staffing process?',
        ['Recruitment', 'Selection', 'Estimating manpower requirements', 'Training'], 2, 'You cannot recruit before you know how many people, with what skills, the work needs.'),
    DemoQuestion('Staffing', 'Which is an internal source of recruitment?',
        ['Campus recruitment', 'Promotion', 'Advertisement', 'Employment exchange'], 1, 'Promotion and transfer fill a post from people already in the organisation.'),
    DemoQuestion('Directing', 'Maslow’s hierarchy of needs begins with',
        ['Safety needs', 'Esteem needs', 'Physiological needs', 'Self-actualisation needs'], 2, 'Food, water and shelter come first; higher needs motivate once these are met.'),
    DemoQuestion('Directing', 'Communication that runs outside the official chain of command is the',
        ['Grapevine', 'Formal channel', 'Upward channel', 'Downward channel'], 0, 'The grapevine is informal communication; it spreads fast and follows no chart.'),
    DemoQuestion('Controlling', 'Comparing actual performance with standards is followed by',
        ['Setting standards', 'Analysing deviations', 'Measuring performance', 'Planning'], 1, 'Set standards, measure, compare, then analyse the deviations and take corrective action.'),
    DemoQuestion('Financial management', 'How much of the profit to pay to shareholders is the',
        ['Investment decision', 'Financing decision', 'Dividend decision', 'Working capital decision'], 2, 'The dividend decision splits profit between payout and retained earnings.'),
    DemoQuestion('Financial management', 'Using more debt to raise the return on equity is called',
        ['Trading on equity', 'Capital budgeting', 'Factoring', 'Leasing'], 0, 'When the return on investment is above the cost of debt, debt lifts the earnings per share.'),
    DemoQuestion('Financial markets', 'SEBI got statutory powers in',
        ['1988', '1992', '1956', '2000'], 1, 'SEBI was set up in 1988 and given statutory powers by the SEBI Act, 1992.'),
    DemoQuestion('Financial markets', 'Treasury bills are issued by',
        ['Commercial banks', 'Companies', 'SEBI', 'The RBI for the Government of India'], 3, 'T-bills are short-term government borrowing, issued by the RBI on the government’s behalf.'),
    DemoQuestion('Marketing', 'Which is not one of the 4 Ps of the marketing mix?',
        ['Product', 'Price', 'People', 'Promotion'], 2, 'The four Ps are product, price, place and promotion. People belongs to the extended services mix.'),
    DemoQuestion('Consumer protection', 'Which is a right of the consumer under the Consumer Protection Act?',
        ['Right to a discount', 'Right to be heard', 'Right to free samples', 'Right to strike'], 1,
        'The Act lists the right to be heard among the consumer’s rights, with safety, information, choice, redress and education.'),
  ],
  'economics': [
    DemoQuestion('National income', 'GDP at market price minus depreciation is',
        ['GNP at market price', 'NDP at market price', 'NDP at factor cost', 'NNP at factor cost'], 1, 'Gross minus depreciation gives net; the price basis stays market price.'),
    DemoQuestion('Money and banking', 'If the legal reserve ratio is 20%, the money multiplier is',
        ['2', '4', '5', '20'], 2, 'Money multiplier = 1 / LRR = 1 / 0.2 = 5.'),
    DemoQuestion('Government budget', 'Fiscal deficit minus interest payments is',
        ['Revenue deficit', 'Primary deficit', 'Budget deficit', 'Effective deficit'], 1, 'Primary deficit removes the interest on past borrowing from the fiscal deficit.'),
    DemoQuestion('Balance of payments', 'Which is recorded in the current account?',
        ['Foreign direct investment', 'Export of services', 'External borrowing', 'Change in reserves'], 1, 'Trade in goods and services, income and transfers sit in the current account.'),
  ],
  'english': [
    DemoQuestion('Vocabulary', 'Choose the word closest in meaning to “candid”.',
        ['Secretive', 'Frank', 'Careless', 'Polite'], 1, 'Candid means open and honest: frank.'),
    DemoQuestion('Grammar', 'Choose the correct sentence.',
        ['Neither of the boys have come.', 'Neither of the boys has come.', 'Neither of the boy has come.', 'Neither the boys has come.'], 1,
        '“Neither of” takes a singular verb: has.'),
    DemoQuestion('Vocabulary', 'Choose the antonym of “scarce”.',
        ['Rare', 'Plentiful', 'Limited', 'Costly'], 1, 'Scarce means in short supply; the opposite is plentiful.'),
  ],
  'mathematics': [
    DemoQuestion('Matrices', 'If A is a 3 x 3 matrix with |A| = 4, then |2A| is',
        ['8', '16', '32', '64'], 2, 'For an n x n matrix, |kA| = k^n |A|: 2^3 x 4 = 32.'),
    DemoQuestion('Derivatives', 'The derivative of sin x · cos x is',
        ['cos 2x', 'sin 2x', '-cos 2x', '2 cos x'], 0, 'sin x cos x = (1/2) sin 2x, so the derivative is cos 2x.'),
  ],
  'physics': [
    DemoQuestion('Current electricity', 'Two 6 ohm resistors in parallel give an equivalent resistance of',
        ['12 ohm', '6 ohm', '3 ohm', '1.5 ohm'], 2, 'For two equal resistors in parallel, R/2 = 3 ohm.'),
    DemoQuestion('Ray optics', 'The power of a convex lens of focal length 50 cm is',
        ['+0.5 D', '+2 D', '-2 D', '+5 D'], 1, 'P = 1/f in metres = 1/0.5 = +2 D; convex lenses are positive.'),
  ],
  'chemistry': [
    DemoQuestion('Solutions', 'Which is a colligative property?',
        ['Viscosity', 'Osmotic pressure', 'Surface tension', 'Density'], 1, 'Colligative properties depend on the number of solute particles: osmotic pressure is one.'),
    DemoQuestion('Chemical kinetics', 'The unit of the rate constant of a first-order reaction is',
        ['mol L^-1 s^-1', 's^-1', 'L mol^-1 s^-1', 'mol s^-1'], 1, 'For first order, rate = k[A], so k has the unit s^-1.'),
  ],
  'biology': [
    DemoQuestion('Molecular basis of inheritance', 'In DNA, adenine pairs with',
        ['Guanine', 'Cytosine', 'Thymine', 'Uracil'], 2, 'A pairs with T by two hydrogen bonds; uracil replaces thymine only in RNA.'),
    DemoQuestion('Human reproduction', 'Fertilisation in humans usually takes place in the',
        ['Uterus', 'Ampullary region of the fallopian tube', 'Cervix', 'Ovary'], 1, 'The ovum meets the sperm at the ampullary region of the oviduct.'),
  ],
  'history': [
    DemoQuestion('Bricks, beads and bones', 'The Great Bath was found at',
        ['Harappa', 'Mohenjodaro', 'Lothal', 'Kalibangan'], 1, 'The Great Bath is in the citadel of Mohenjodaro.'),
    DemoQuestion('Framing the Constitution', 'The Constituent Assembly first met in',
        ['August 1947', 'December 1946', 'January 1950', 'November 1949'], 1, 'Its first session was held on 9 December 1946.'),
  ],
  'political_science': [
    DemoQuestion('Planning and development', 'The Planning Commission of India was set up in',
        ['1947', '1950', '1951', '1956'], 1, 'It was set up by a government resolution in March 1950.'),
    DemoQuestion('The end of bipolarity', 'The Soviet Union was dissolved in',
        ['1989', '1990', '1991', '1993'], 2, 'The USSR formally ended in December 1991.'),
  ],
  'geography': [
    DemoQuestion('Human development', 'The Human Development Index is published by the',
        ['World Bank', 'UNDP', 'IMF', 'WTO'], 1, 'The United Nations Development Programme publishes the HDI in its Human Development Report.'),
    DemoQuestion('Population', 'Which state of India has the highest population?',
        ['Maharashtra', 'Bihar', 'Uttar Pradesh', 'West Bengal'], 2, 'Uttar Pradesh has the largest population (Census 2011).'),
  ],
  'psychology': [
    DemoQuestion('Variations in psychological attributes', 'An IQ of 100 means mental age is',
        ['Higher than chronological age', 'Equal to chronological age', 'Lower than chronological age', 'Unrelated to age'], 1,
        'IQ = mental age / chronological age x 100, so 100 means the two are equal.'),
    DemoQuestion('Meeting life challenges', 'The General Adaptation Syndrome was proposed by',
        ['Freud', 'Selye', 'Lazarus', 'Maslow'], 1, 'Hans Selye described alarm, resistance and exhaustion.'),
  ],
  'sociology': [
    DemoQuestion('The demographic structure', 'The theory that population grows faster than food supply is by',
        ['Marx', 'Malthus', 'Durkheim', 'Weber'], 1, 'Thomas Malthus: population grows geometrically, food arithmetically.'),
    DemoQuestion('Social institutions', 'A family where the wife lives with the husband’s family is',
        ['Matrilocal', 'Patrilocal', 'Neolocal', 'Avunculocal'], 1, 'Patrilocal residence: the couple lives with or near the husband’s family.'),
  ],
  'computer_science': [
    DemoQuestion('Python', 'What does len("CUET") return?',
        ['3', '4', '5', 'An error'], 1, 'len counts the characters: C, U, E, T is 4.'),
    DemoQuestion('Database concepts', 'A key that uniquely identifies each row of a table is the',
        ['Foreign key', 'Primary key', 'Alternate key', 'Composite attribute'], 1, 'The primary key is unique and not null for every row.'),
  ],
  'general_test': [
    DemoQuestion('Arithmetic', 'A price rises by 10% and then falls by 10%. The net change is',
        ['No change', '1% fall', '1% rise', '2% fall'], 1, '1.1 x 0.9 = 0.99, so a 1% fall.'),
    DemoQuestion('Reasoning', 'Find the next number: 2, 6, 12, 20, 30, ?',
        ['40', '42', '44', '36'], 1, 'Differences go 4, 6, 8, 10, so the next is 12: 30 + 12 = 42.'),
  ],
};

/// The demo pool for a subject: every practice subject has its own; anything else (a language
/// paper) uses General Test's, never another subject's.
List<DemoQuestion> demoPool(String subject) => _pools[subject] ?? _pools['general_test']!;

/// [count] questions in [subject], cycling the pool, with ids unique to [sessionId].
List<SessionQuestion> demoQuestions(String subject, int count, String sessionId) {
  final pool = demoPool(subject);
  return [
    for (var i = 0; i < count; i++)
      SessionQuestion(
        id: '$sessionId-q${i + 1}',
        subject: subject,
        chapter: pool[i % pool.length].chapter,
        question: pool[i % pool.length].question,
        difficulty: 'medium',
        options: [
          for (var j = 0; j < pool[i % pool.length].options.length; j++)
            QuestionOption(key: String.fromCharCode(65 + j), text: pool[i % pool.length].options[j]),
        ],
      ),
  ];
}

/// The attempt as the server would mark it from [answers] (question id to option), for a
/// practice set or (with [mode] `full` or `nta`) a mock.
AttemptDetail demoPracticeDetail({
  required String id,
  required String subject,
  required List<SessionQuestion> questions,
  required Map<String, int> answers,
  required DateTime completedAt,
  String mode = 'quick',
}) {
  final pool = demoPool(subject);
  var correct = 0, wrong = 0, blank = 0;
  final details = <Map<String, dynamic>>[];
  for (var i = 0; i < questions.length; i++) {
    final given = answers[questions[i].id];
    final key = pool[i % pool.length].key;
    if (given == null) {
      blank++;
    } else if (given == key) {
      correct++;
    } else {
      wrong++;
    }
    details.add({'qid': questions[i].id, 'givenIndex': given, 'isCorrect': given == null ? null : given == key});
  }
  return AttemptDetail.fromJson({
    'id': id,
    'userId': 'u1',
    'subject': subject == 'general_test' ? 'gat' : subject,
    'score': correct * 5 - wrong,
    'correct': correct,
    'wrong': wrong,
    'unattempted': blank,
    'total': questions.length,
    'details': details,
    'questionsSnapshot': [
      for (var i = 0; i < questions.length; i++)
        {
          'id': questions[i].id,
          'subject': subject,
          'chapter': questions[i].chapter,
          'question': questions[i].question,
          'options': [for (final o in questions[i].options) o.text],
          'correctIndex': pool[i % pool.length].key,
          'explanation': pool[i % pool.length].explanation,
        },
    ],
    'selectionMeta': {'mode': mode, 'scoringVersion': 'server_practice_v1', if (mode == 'full' || mode == 'nta') 'durationMinutes': 60},
    'completedAt': completedAt.toUtc().toIso8601String(),
    'answerReviews': <String, dynamic>{},
    'answerReviewState': 'ready',
  });
}
