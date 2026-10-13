import 'subjects.dart';

/// One original practice question for the onboarding's single real question (brief section 11,
/// step 7). Written for this pool, CUET-style, with one unambiguous answer and the ten-second
/// fix a student needs when they fall for the trap.
class WarmupQuestion {
  const WarmupQuestion({
    required this.id,
    required this.subject,
    required this.chapter,
    required this.stem,
    required this.options,
    required this.answer,
    required this.fix,
  });

  /// Stable id, versioned with the pool ("acc-1").
  final String id;
  final SheetSubject subject;
  final String chapter;
  final String stem;

  /// Four options, shown as A to D.
  final List<String> options;

  /// Index of the right option.
  final int answer;

  /// The ten-second fix, shown after a wrong answer.
  final String fix;

  /// The order the options are shown in: `order[i]` is the index in [options] shown at
  /// position i (A, B, C, D). A stable shuffle seeded by [id], so the right answer is not
  /// always where the author wrote it, and a question looks the same on every return.
  /// [answer] and a stored choice stay indexes into [options].
  List<int> get order => stableOrder(options.length, stableSeed(id));
}

/// A 31-bit FNV-1a hash of [text]: the same on every phone and every run (String.hashCode is not
/// promised to be).
int stableSeed(String text) {
  var h = 0x811c9dc5;
  for (final unit in text.codeUnits) {
    h = ((h ^ unit) * 0x01000193) & 0xffffffff;
  }
  return h & 0x7fffffff;
}

/// 0 to n - 1, shuffled by a small fixed generator seeded with [seed] (Fisher-Yates).
List<int> stableOrder(int n, int seed) {
  final out = [for (var i = 0; i < n; i++) i];
  var x = seed == 0 ? 0x2545f491 : seed;
  for (var i = n - 1; i > 0; i--) {
    // xorshift32
    x ^= (x << 13) & 0xffffffff;
    x ^= x >> 17;
    x ^= (x << 5) & 0xffffffff;
    x &= 0xffffffff;
    final j = x % (i + 1);
    final t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

/// Bump when a question changes, so a stored answer is not shown against a different question.
const int kWarmupPoolVersion = 2;

/// Two to three questions per subject. The onboarding picks one by the student's seed (see [warmupFor]).
const List<WarmupQuestion> kWarmupPool = [
  WarmupQuestion(
    id: 'acc-1',
    subject: SheetSubject.accountancy,
    chapter: 'Partnership',
    stem: 'A and B share profits 3:2. C joins for a 1/5 share, which he takes equally from A and B. '
        'What is the new profit-sharing ratio of A, B and C?',
    options: ['5:3:2', '12:8:5', '3:2:1', '2:2:1'],
    answer: 0,
    fix: 'Equally means each gives up 1/10. A: 6/10 minus 1/10 is 5/10. B: 4/10 minus 1/10 is 3/10. '
        'C gets 2/10. 12:8:5 is what you get if C takes his share in the old ratio.',
  ),
  WarmupQuestion(
    id: 'acc-2',
    subject: SheetSubject.accountancy,
    chapter: 'Partnership',
    stem: 'There is no partnership deed. A partner has lent the firm money over and above his capital. '
        'What interest does he get on that loan?',
    options: ['6% a year', '12% a year', 'Nothing, unless all partners agree', 'The bank rate'],
    answer: 0,
    fix: 'Without a deed: no interest on capital and no salary, but a partner\'s loan earns 6% a year '
        'under the Partnership Act.',
  ),
  WarmupQuestion(
    id: 'bst-1',
    subject: SheetSubject.businessStudies,
    chapter: 'Principles of Management',
    stem: 'Which of these is not one of Henri Fayol\'s principles of management?',
    options: ['Unity of command', 'Scalar chain', 'Science, not rule of thumb', 'Esprit de corps'],
    answer: 2,
    fix: '"Science, not rule of thumb" is Taylor\'s, from scientific management. Fayol gave fourteen '
        'principles, and unity of command, scalar chain and esprit de corps are three of them.',
  ),
  WarmupQuestion(
    id: 'bst-2',
    subject: SheetSubject.businessStudies,
    chapter: 'Marketing',
    stem: 'A company gives its product a name, sign or symbol so buyers can tell it apart from '
        'rival products. Which marketing function is this?',
    options: ['Labelling', 'Branding', 'Packaging', 'Grading'],
    answer: 1,
    fix: 'Telling one maker\'s product from another\'s is branding. Labelling gives information about '
        'the product; packaging protects and holds it.',
  ),
  WarmupQuestion(
    id: 'eco-1',
    subject: SheetSubject.economics,
    chapter: 'Money and Banking',
    stem: 'The legal reserve ratio is 20%. What is the money multiplier?',
    options: ['0.2', '2', '5', '20'],
    answer: 2,
    fix: 'The money multiplier is 1 divided by the reserve ratio: 1 / 0.2 = 5. Picking 0.2 or 20 means '
        'the ratio was read but not inverted.',
  ),
  WarmupQuestion(
    id: 'eco-2',
    subject: SheetSubject.economics,
    chapter: 'Government Budget',
    stem: 'Which of these is a revenue receipt of the government?',
    options: ['Borrowing from the RBI', 'Recovery of loans', 'Dividends from public sector companies', 'Disinvestment'],
    answer: 2,
    fix: 'A revenue receipt neither creates a liability nor reduces an asset. Borrowing creates a liability; '
        'loan recovery and disinvestment reduce assets. Dividends do neither.',
  ),
  WarmupQuestion(
    id: 'eng-1',
    subject: SheetSubject.english,
    chapter: 'Vocabulary',
    stem: 'Choose the word closest in meaning to "candid".',
    options: ['Careful', 'Frank', 'Cunning', 'Polite'],
    answer: 1,
    fix: 'Candid means honest and direct, so frank. "Cunning" is the trap: it sounds similar and means '
        'nearly the opposite.',
  ),
  WarmupQuestion(
    id: 'eng-2',
    subject: SheetSubject.english,
    chapter: 'Error Detection',
    stem: 'Which part of this sentence has an error? "Neither the teacher nor the students was ready '
        'for the surprise test."',
    options: ['Neither the teacher', 'nor the students', 'was ready', 'for the surprise test'],
    answer: 2,
    fix: 'With neither and nor, the verb agrees with the nearer subject. "Students" is plural, so it '
        'should be "were ready".',
  ),
  WarmupQuestion(
    id: 'gt-1',
    subject: SheetSubject.generalTest,
    chapter: 'Quantitative Aptitude',
    stem: 'An item is marked at Rs 500 and sold at a 10% discount. The seller still makes a 12.5% '
        'profit. What did the item cost the seller?',
    options: ['Rs 400', 'Rs 393.75', 'Rs 420', 'Rs 450'],
    answer: 0,
    fix: 'Selling price is 450. Profit is a percentage of cost, so cost x 1.125 = 450 and cost = 400. '
        'Taking 12.5% off 450 gives 393.75, which is the trap.',
  ),
  WarmupQuestion(
    id: 'gt-2',
    subject: SheetSubject.generalTest,
    chapter: 'Logical Reasoning',
    stem: 'In a code, TEACH is written as UFBDI. How is CLASS written in that code?',
    options: ['DMBTT', 'DLBTT', 'BKZRR', 'DMBUU'],
    answer: 0,
    fix: 'Each letter moves one step forward: T to U, E to F. So C to D, L to M, A to B, S to T.',
  ),
  WarmupQuestion(
    id: 'phy-nta1',
    subject: SheetSubject.physics,
    chapter: 'Electromagnetic Induction',
    stem: 'A north pole of a bar magnet is moved towards a stationary conducting ring. The induced current in the ring will be such that it:',
    options: ['repels the approaching magnet', 'attracts the approaching magnet', 'produces no magnetic interaction', 'reverses the pole of the bar magnet'],
    answer: 0,
    fix: 'Lenz\'s law: the induced current opposes the change that causes it. The approaching pole is opposed, so the ring repels it. Attraction would speed the magnet up and create energy from nothing.',
  ),
  WarmupQuestion(
    id: 'phy-nta5',
    subject: SheetSubject.physics,
    chapter: 'Nuclei',
    stem: 'A radioactive sample has a half-life of 10 days. What fraction of the original nuclei remains after 30 days?',
    options: ['1/8', '1/4', '1/16', '3/8'],
    answer: 0,
    fix: '30 days is 3 half-lives, so the fraction is (1/2) x (1/2) x (1/2) = 1/8. Picking 1/4 means counting 2 half-lives.',
  ),
  WarmupQuestion(
    id: 'phy-nta6',
    subject: SheetSubject.physics,
    chapter: 'Ray Optics and Optical Instruments',
    stem: 'Two thin lenses of powers +4 D and +2 D are placed in contact. The power of the combination is:',
    options: ['+2 D', '+6 D', '-2 D', '+8 D'],
    answer: 1,
    fix: 'Powers of lenses in contact add: +4 D + 2 D = +6 D. Focal lengths do not add, which is why 8 D (the product) is wrong.',
  ),
  WarmupQuestion(
    id: 'chem-nta1',
    subject: SheetSubject.chemistry,
    chapter: 'Biomolecules',
    stem: 'Which amino acid has a thioether group (a sulphur atom between two carbons) in its side chain?',
    options: ['Cysteine', 'Methionine', 'Serine', 'Tyrosine'],
    answer: 1,
    fix: 'Methionine\'s side chain is -CH2-CH2-S-CH3, a thioether. Cysteine is the trap: its sulphur is a thiol (-SH) with a hydrogen on it.',
  ),
  WarmupQuestion(
    id: 'chem-nta2',
    subject: SheetSubject.chemistry,
    chapter: 'Chemical Kinetics',
    stem: 'A first-order oxidation of benzaldehyde has a half-life of 30 min. How long will it take for the concentration to fall to 25% of its initial value?',
    options: ['15 min', '30 min', '60 min', '90 min'],
    answer: 2,
    fix: '100% to 50% is one half-life, 50% to 25% is a second one. Two half-lives of 30 min is 60 min.',
  ),
  WarmupQuestion(
    id: 'chem-nta4',
    subject: SheetSubject.chemistry,
    chapter: 'General Principles and Processes of Isolation of Elements',
    stem: 'Powdering the ore before reduction in extraction processes primarily helps because it increases the',
    options: ['number of exposed surfaces for reaction', 'average particle temperature', 'melting point of ore', 'density of ore'],
    answer: 0,
    fix: 'Smaller grains expose more surface, so the reducing agent reaches more of the ore and the reaction goes faster. Powdering changes surface area, not temperature, melting point or density.',
  ),
  WarmupQuestion(
    id: 'math-nta1',
    subject: SheetSubject.mathematics,
    chapter: 'Determinants',
    stem: 'If A is a square matrix of order 3 such that |A| = 5, then the value of |adj(A)| is:',
    options: ['25', '125', '5', '1'],
    answer: 0,
    fix: '|adj A| = |A|^(n-1). With n = 3 that is 5^2 = 25. 125 comes from using the power n instead of n - 1.',
  ),
  WarmupQuestion(
    id: 'math-nta3',
    subject: SheetSubject.mathematics,
    chapter: 'Continuity and Differentiability',
    stem: 'Find f\'(1) for f(x) = 3x^3 - 2x + 1.',
    options: ['7', '5', '9', '3'],
    answer: 0,
    fix: 'f\'(x) = 9x^2 - 2, so f\'(1) = 9 - 2 = 7. Choosing 9 means the -2 was dropped.',
  ),
  WarmupQuestion(
    id: 'math-nta5',
    subject: SheetSubject.mathematics,
    chapter: 'Three Dimensional Geometry',
    stem: 'Find the perpendicular distance from point P(1, 2, -1) to the plane 2x - y + 2z - 3 = 0.',
    options: ['5/3', '3/5', '1', '5'],
    answer: 0,
    fix: 'Distance = |2(1) - 2 + 2(-1) - 3| / sqrt(4 + 1 + 4) = |-5| / 3 = 5/3. Keep the root of the coefficients in the denominator, not the numerator.',
  ),
  WarmupQuestion(
    id: 'bio-nta1',
    subject: SheetSubject.biology,
    chapter: 'Human Reproduction',
    stem: 'From 5 primary spermatocytes undergoing meiosis, how many mature spermatozoa are produced in total?',
    options: ['20', '10', '40', '5'],
    answer: 0,
    fix: 'One primary spermatocyte gives 4 spermatozoa, so 5 give 20. In females the same division gives only 1 ovum.',
  ),
  WarmupQuestion(
    id: 'bio-nta3',
    subject: SheetSubject.biology,
    chapter: 'Biotechnology: Principles and Processes',
    stem: 'Sanger (dideoxy) DNA sequencing is based on chain termination. Which molecule causes termination of DNA strand elongation?',
    options: ['2\',3\'-dideoxynucleotide triphosphate (ddNTP) lacking a 3\'-OH', 'Ribonucleotide triphosphates (rNTPs) with 2\'-OH groups', 'DNA ligase joining adjacent nucleotides', 'Deoxynucleotide triphosphates (dNTPs) with intact 3\'-OH'],
    answer: 0,
    fix: 'The next nucleotide attaches to a 3\'-OH. A ddNTP has none, so once it is added the strand cannot grow. Ordinary dNTPs keep the 3\'-OH and let the chain continue.',
  ),
  WarmupQuestion(
    id: 'bio-nta4',
    subject: SheetSubject.biology,
    chapter: 'Human Health and Disease',
    stem: 'A disease that can be naturally transmitted between animals and humans is called:',
    options: ['Zoonosis', 'Nosocomial infection', 'Congenital disease', 'Idiopathic disorder'],
    answer: 0,
    fix: 'Zoonosis is animal-to-human spread, such as rabies. Nosocomial means picked up in a hospital, and congenital means present from birth.',
  ),
  WarmupQuestion(
    id: 'cs-nta1',
    subject: SheetSubject.computerScience,
    chapter: 'Boolean Algebra',
    stem: 'Which expression is equivalent to NOT (A OR B) by De Morgan\'s law?',
    options: ['(NOT A) OR (NOT B)', '(NOT A) AND (NOT B)', '(NOT A) XOR (NOT B)', 'A AND B'],
    answer: 1,
    fix: 'De Morgan: negating an OR flips it to an AND and negates each term. NOT (A OR B) = (NOT A) AND (NOT B).',
  ),
  WarmupQuestion(
    id: 'cs-nta2',
    subject: SheetSubject.computerScience,
    chapter: 'Queue',
    stem: 'Start with an empty queue. Perform: enqueue(1), enqueue(2), enqueue(3), dequeue(), enqueue(4), enqueue(5), dequeue(). What is the queue content from front to rear?',
    options: ['3, 4, 5', '1, 2, 3, 4, 5', '2, 3, 4', '4, 5, 3'],
    answer: 0,
    fix: 'A queue removes from the front, first in first out. The two dequeues remove 1 and then 2, leaving 3, 4, 5.',
  ),
  WarmupQuestion(
    id: 'cs-nta3',
    subject: SheetSubject.computerScience,
    chapter: 'Stack',
    stem: 'Start with an empty stack. Perform operations: push(5), push(3), push(8), pop(), push(2), pop(). What is the top element now?',
    options: ['5', '3', '2', '8'],
    answer: 1,
    fix: 'A stack removes the last item added. The pops remove 8 and then 2, leaving 5 and 3, with 3 on top.',
  ),
  WarmupQuestion(
    id: 'geo-nta1',
    subject: SheetSubject.geography,
    chapter: 'Population: Distribution, Density and Growth',
    stem: 'A country has 30,000,000 people and 150,000 sq km of arable land. What is its physiological density (people per sq km of arable land)?',
    options: ['50', '100', '150', '200'],
    answer: 3,
    fix: 'Physiological density divides people by arable land only: 30,000,000 / 150,000 = 200. Dividing by total area would give arithmetic density.',
  ),
  WarmupQuestion(
    id: 'geo-nta2',
    subject: SheetSubject.geography,
    chapter: 'Population: Distribution, Density and Growth',
    stem: 'If a country has a crude birth rate of 28 per 1,000 and a crude death rate of 12 per 1,000, its natural increase (per 1,000) is:',
    options: ['12 per 1,000', '16 per 1,000', '40 per 1,000', '-16 per 1,000'],
    answer: 1,
    fix: 'Natural increase is births minus deaths: 28 - 12 = 16 per 1,000. Adding them gives 40, which is not a rate of growth.',
  ),
  WarmupQuestion(
    id: 'geo-nta3',
    subject: SheetSubject.geography,
    chapter: 'Population: Distribution, Density and Growth',
    stem: 'A region\'s population grew from 5.0 million in 2001 to 5.75 million in 2011. What is the decadal growth rate (to the nearest percent)?',
    options: ['15%', '12%', '10%', '7%'],
    answer: 0,
    fix: 'Growth rate is the change over the starting figure: 0.75 / 5.0 = 15%. Dividing by the 2011 figure gives about 13%.',
  ),
  WarmupQuestion(
    id: 'hist-nta1',
    subject: SheetSubject.history,
    chapter: 'Peasants, Zamindars and the State',
    stem: 'Who was the headman of the village panchayat in the Mughal period, often responsible for mediating disputes?',
    options: ['Patwari', 'Qanungo', 'Muqaddam', 'Amin'],
    answer: 2,
    fix: 'The headman was the muqaddam, also called mandal. The patwari kept the village accounts and the qanungo was a pargana-level record keeper.',
  ),
  WarmupQuestion(
    id: 'hist-nta2',
    subject: SheetSubject.history,
    chapter: 'Peasants, Zamindars and the State',
    stem: 'The cultivation of which crop, introduced from the New World, became significant in some parts of the Mughal Empire for its commercial value?',
    options: ['Tea', 'Coffee', 'Tobacco', 'Opium'],
    answer: 2,
    fix: 'Tobacco came from the Americas and spread in the 17th century. Tea and coffee were not Mughal cash crops, and opium was not a New World introduction.',
  ),
  WarmupQuestion(
    id: 'hist-nta3',
    subject: SheetSubject.history,
    chapter: 'Kings, Farmers and Towns',
    stem: 'A traveling merchant arrives at a prosperous medieval town and seeks a local institution to resolve a trade dispute with an out-of-town partner. Which institution, as described in the chapter, would most likely handle this?',
    options: ['Shreni or merchant guild', 'Village panchayat', 'Royal land revenue office', 'Temple priestly committee'],
    answer: 0,
    fix: 'Merchants and craftspeople organised into guilds called shrenis, which set trade rules and settled disputes among members. A panchayat or revenue office served other purposes.',
  ),
  WarmupQuestion(
    id: 'pol-nta1',
    subject: SheetSubject.politicalScience,
    chapter: 'Challenges to and Restoration of the Congress System',
    stem: 'Which of the following landmark Supreme Court judgments in 1967 established that the Parliament cannot abridge Fundamental Rights?',
    options: ['Kesavananda Bharati case', 'Golaknath case', 'Minerva Mills case', 'K. Gopalan case'],
    answer: 1,
    fix: 'Golaknath (1967) held that Parliament cannot take away Fundamental Rights. Kesavananda Bharati came later, in 1973, and set the basic structure doctrine.',
  ),
  WarmupQuestion(
    id: 'pol-nta2',
    subject: SheetSubject.politicalScience,
    chapter: 'Crisis of the Democratic Order',
    stem: 'Which constitutional provision empowered the central government to proclaim an Internal Emergency in India in 1975?',
    options: ['Article 352 (proclamation of emergency on grounds of internal disturbance)', 'Article 356 (failure of constitutional machinery in a state)', 'Article 370 (special status of Jammu and Kashmir)', 'Article 368 (power of Parliament to amend the Constitution)'],
    answer: 0,
    fix: 'Article 352 covers a national emergency. Article 356 is President\'s Rule in a single state, which is the usual mix-up.',
  ),
  WarmupQuestion(
    id: 'pol-nta5',
    subject: SheetSubject.politicalScience,
    chapter: 'US Hegemony in World Politics',
    stem: 'During the Cold War, how did the US policy of \'containment\' differ from \'rollback\' in practice?',
    options: ['Containment sought to prevent expansion of influence, while rollback aimed to reduce or eliminate existing influence', 'Containment aimed at immediate regime change, while rollback favored long-term coexistence', 'Containment relied on formal colonial control, while rollback relied on trade incentives', 'Containment required UN approval, whereas rollback did not'],
    answer: 0,
    fix: 'Containment meant holding the line so communism did not spread further. Rollback meant pushing it back where it already existed.',
  ),
  WarmupQuestion(
    id: 'psy-nta1',
    subject: SheetSubject.psychology,
    chapter: 'Meeting Life Challenges',
    stem: 'When facing an upcoming difficult presentation at work, Rohit dedicates extra time to thoroughly research his topic, meticulously prepares visual aids, and practices his delivery multiple times to anticipate potential questions. Which coping strategy is Rohit primarily employing?',
    options: ['Emotion-focused coping', 'Avoidance-oriented coping', 'Problem-focused coping', 'Social support seeking'],
    answer: 2,
    fix: 'He is acting on the problem itself: research, preparation, practice. Emotion-focused coping manages the feelings and leaves the problem as it is.',
  ),
  WarmupQuestion(
    id: 'psy-nta2',
    subject: SheetSubject.psychology,
    chapter: 'Psychological Disorders',
    stem: 'Which of the following perspectives on psychological disorders primarily emphasizes the role of unconscious conflicts and early childhood experiences in their development?',
    options: ['Psychodynamic perspective', 'Humanistic perspective', 'Cognitive perspective', 'Behavioural perspective'],
    answer: 0,
    fix: 'Unconscious conflict and early childhood are Freud\'s ground, the psychodynamic view. Cognitive looks at thoughts and behavioural at learned responses.',
  ),
  WarmupQuestion(
    id: 'psy-nta3',
    subject: SheetSubject.psychology,
    chapter: 'Self and Personality',
    stem: 'A manager consistently works long hours, becomes easily irritated by minor delays, and often takes on multiple tasks simultaneously, feeling a constant sense of urgency and competitiveness. Which personality type is this manager most likely exhibiting?',
    options: ['Type A personality', 'Type B personality', 'Introverted personality', 'Conscientious personality'],
    answer: 0,
    fix: 'Urgency, competitiveness and irritation at delays are the Type A pattern. Type B is relaxed and not driven by time pressure.',
  ),
  WarmupQuestion(
    id: 'soc-nta1',
    subject: SheetSubject.sociology,
    chapter: 'Demographic Structure of the Indian Society',
    stem: 'A town with population 200,000 records 3,000 births in one year. What is its crude birth rate (per 1,000 population) for that year?',
    options: ['6.0 per 1,000', '15 per 1,000', '30 per 1,000', '150 per 1,000'],
    answer: 1,
    fix: 'Crude birth rate = births / population x 1,000 = 3,000 / 200,000 x 1,000 = 15. Forgetting the x 1,000 step gives 0.015.',
  ),
  WarmupQuestion(
    id: 'soc-nta2',
    subject: SheetSubject.sociology,
    chapter: 'Demographic Structure of the Indian Society',
    stem: 'A town\'s age distribution is: 0-14 years = 30%, 15-59 years = 60%, 60+ years = 10%. If dependents are defined as those aged 0-14 and 60+, and the working-age population is 15-59, what is the dependency ratio (per 100 working-age persons)?',
    options: ['66.7', '40.0', '50.0', '20.0'],
    answer: 0,
    fix: 'Dependents are 30 + 10 = 40. Divide by the working-age 60 and multiply by 100: 40 / 60 x 100 = 66.7.',
  ),
  WarmupQuestion(
    id: 'soc-nta4',
    subject: SheetSubject.sociology,
    chapter: 'Mass Media and Communications',
    stem: 'Which sociological perspective argues that mass media serves to maintain the \'status quo\' by promoting consumerism and distracting the working class from systemic inequality?',
    options: ['Functionalist Perspective', 'Conflict Perspective', 'Symbolic Interactionist Perspective', 'Post-Modernist Perspective'],
    answer: 1,
    fix: 'Conflict theory reads media as a tool of dominant groups that keeps unequal power in place. Functionalism sees media as helping society run smoothly.',
  ),
];

/// A question for [subject] whose id is not in [seen] (all of them once every one was seen),
/// picked by [seed]: the student's own seed gives every student the same question on every
/// return, while different students see different ones.
WarmupQuestion? warmupFor(SheetSubject subject, {Set<String> seen = const {}, int seed = 0}) {
  final pool = [for (final q in kWarmupPool) if (q.subject == subject) q];
  if (pool.isEmpty) return null;
  final fresh = [for (final q in pool) if (!seen.contains(q.id)) q];
  final from = fresh.isEmpty ? pool : fresh;
  return from[seed.abs() % from.length];
}

/// Subjects with at least one warm-up question.
Set<SheetSubject> get warmupSubjects => {for (final q in kWarmupPool) q.subject};
