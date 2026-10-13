import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';

/// Review fixtures: real-shaped attempts from `GET /api/attempts`. Times are UTC instants;
/// the student's zone is Asia/Kolkata (UTC+5:30).

const _chapters = [
  'Partnership: admission of a partner',
  'Accounting ratios',
  'Cash flow statement',
  'Issue of shares',
  'Dissolution of a partnership firm',
];

/// Question, options (the key is always option B) and the key explanation, per chapter.
const _bank = <String, (String, List<String>, String)>{
  'Partnership: admission of a partner': (
    'A and B share profits 3:2. C is admitted for a 1/5 share, which he takes equally from A and B. What is the new profit-sharing ratio?',
    ['2:1:1', '5:3:2', '3:2:1', '11:7:2'],
    'A gives up 1/10 and B gives up 1/10. A keeps 5/10, B keeps 3/10 and C gets 2/10, so 5:3:2.',
  ),
  'Accounting ratios': (
    'Current ratio is 2.5:1 and working capital is 60,000. What are the current liabilities?',
    ['24,000', '40,000', '60,000', '36,000'],
    'Working capital is 1.5 times current liabilities here, so current liabilities are 60,000 divided by 1.5.',
  ),
  'Cash flow statement': (
    'Interest received by a finance company is shown under which activity?',
    ['Investing activities', 'Operating activities', 'Financing activities', 'None of these'],
    'Lending is the main business of a finance company, so its interest received is operating.',
  ),
  'Issue of shares': (
    'Shares of 10 each are issued at a premium of 2. Where is the premium credited?',
    ['Share capital account', 'Securities premium account', 'Profit and loss account', 'General reserve'],
    'The premium is a capital receipt, so it goes to the securities premium account and not to profit.',
  ),
  'Dissolution of a partnership firm': (
    'Unrecorded assets taken over by a partner on dissolution are credited to which account?',
    ["Partner's capital account", 'Realisation account', 'Cash account', 'Revaluation account'],
    "The partner's capital is debited and the realisation account credited, as for any asset realised.",
  ),
  'Money and banking': (
    'Which of these is not a function of the central bank?',
    ['Banker to the government', 'Accepting deposits from the public', 'Lender of last resort', 'Custodian of foreign exchange'],
    'Accepting deposits from the public is a function of commercial banks.',
  ),
};

Map<String, dynamic> _question(String attempt, int i, {String subject = 'accountancy', String? chapter}) {
  final c = chapter ?? _chapters[i % _chapters.length];
  final (question, options, explanation) = _bank[c]!;
  return {
    'id': '$attempt-q$i',
    'subject': subject,
    'internalSubject': subject,
    'chapter': c,
    'question': question,
    'options': options,
    'correctIndex': 1,
    'explanation': explanation,
  };
}

/// A 50-question Accountancy mock. [wrong] and [blank] are 0-based question indexes.
Map<String, dynamic> mockJson({
  required String id,
  required DateTime completedAt,
  Set<int> wrong = const {},
  Set<int> blank = const {},
  String mode = 'full',
  int count = 50,
  String subject = 'accountancy',
  String? chapter,
}) {
  final questions = [for (var i = 0; i < count; i++) _question(id, i, subject: subject, chapter: chapter)];
  final details = [
    for (var i = 0; i < count; i++)
      {
        'qid': '$id-q$i',
        'givenIndex': blank.contains(i) ? null : (wrong.contains(i) ? 0 : 1),
        'isCorrect': blank.contains(i) ? null : !wrong.contains(i),
      },
  ];
  final correct = count - wrong.length - blank.length;
  return {
    'id': id,
    'userId': 'u1',
    'subject': subject,
    'score': (correct * 100 / count).round(),
    'correct': correct,
    'wrong': wrong.length,
    'unattempted': blank.length,
    'total': count,
    'details': details,
    'questionsSnapshot': questions,
    'selectionMeta': {'mode': mode, 'scoringVersion': 'server_snapshot_v1'},
    'mode': mode,
    'completedAt': completedAt.millisecondsSinceEpoch,
  };
}

/// Mock 7: 12 October, 10:42 PM IST. Partnership is the trap (questions 1, 11 and 31 are
/// wrong; they cycle to chapter 0), plus two in other chapters, and three skipped.
final mock7 = Attempt.fromJson(
  mockJson(id: 'm7', completedAt: DateTime.utc(2026, 10, 12, 17, 12), wrong: {0, 10, 30, 6, 13}, blank: {9, 28, 47}),
);

/// Mock 6: 3 October, 9:15 PM IST, two Partnership mistakes.
final mock6 = Attempt.fromJson(mockJson(id: 'm6', completedAt: DateTime.utc(2026, 10, 3, 15, 45), wrong: {5, 20}));

/// A Quick practice in Economics on 8 October with one mistake.
final quick = Attempt.fromJson(
  mockJson(
    id: 'q1',
    completedAt: DateTime.utc(2026, 10, 8, 14, 30),
    mode: 'quick',
    count: 10,
    subject: 'economics',
    chapter: 'Money and banking',
    wrong: {3},
  ),
);

List<Attempt> get allAttempts => [mock7, quick, mock6];

/// One mistake of Mock 6 repaired on 4 October at 11:08 PM IST.
final repairedRecord = RepairLocalRecord(
  attemptId: 'm6',
  questionId: 'm6-q5',
  requestId: 'req-0000000000000001',
  status: RepairLocalStatus.explained,
  ackedAt: DateTime.utc(2026, 10, 4, 17, 38),
);

/// The clock of the fixtures: 12 October, 10:55 PM IST is UTC 17:25. 9:40 PM is 16:10.
final eveningUtc = DateTime.utc(2026, 10, 12, 16, 10);
final lateUtc = DateTime.utc(2026, 10, 12, 17, 55);

/// A repair response body as the server sends it.
Map<String, dynamic> explainedJson({String status = 'explained'}) => {
  'status': status,
  'repair': {
    'why_tempting': 'C takes 1/5 in total, so it is tempting to take 1/5 from each partner.',
    'why_wrong': 'The sacrifice is shared equally: A and B each give up 1/10, not 1/5.',
    'key_idea':
        'Subtract each partner\'s sacrifice from the old share first, then put every share over one denominator: A 6/10 minus 1/10, B 4/10 minus 1/10.',
    'next_step': 'Write the sacrifice of each partner before you write any new ratio.',
    'generatedAt': '2026-10-12T17:30:00Z',
  },
  'charged': 1,
  'wallet': {'state': 'available', 'known': true, 'spendable': 8},
  'chosenIndex': 0,
  'keyIndex': 1,
};
