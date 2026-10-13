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
}

/// Bump when a question changes, so a stored answer is not shown against a different question.
const int kWarmupPoolVersion = 1;

/// Two questions per subject. The onboarding picks the first one the student has not seen.
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
];

/// The first question for [subject] whose id is not in [seen], or the first one again.
WarmupQuestion? warmupFor(SheetSubject subject, {Set<String> seen = const {}}) {
  final pool = [for (final q in kWarmupPool) if (q.subject == subject) q];
  if (pool.isEmpty) return null;
  return pool.firstWhere((q) => !seen.contains(q.id), orElse: () => pool.first);
}

/// Subjects with at least one warm-up question.
Set<SheetSubject> get warmupSubjects => {for (final q in kWarmupPool) q.subject};
