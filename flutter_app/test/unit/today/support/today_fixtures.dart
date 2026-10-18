import 'package:mockmob/features/review/model/review_chapters.dart' show ChapterRow;
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/learning_plan.dart';
import 'package:mockmob/core/repositories/dismissal_repository.dart';
import 'package:mockmob/features/today/data/today_profile.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/practice/model/open_paper.dart' show OpenPaper;

/// A verdict for one question of a fixture paper.
enum V { right, wrong, blank }

/// Tuesday 13 October 2026, 8:40 PM in Kolkata.
final DateTime tuesdayEvening = DateTime.utc(2026, 10, 13, 15, 10);

/// The same Tuesday at 11:40 PM in Kolkata.
final DateTime tuesdayLate = DateTime.utc(2026, 10, 13, 18, 10);

DateTime daysBefore(DateTime now, int days, {int hour = 15}) =>
    DateTime.utc(now.year, now.month, now.day - days, hour, 40);

/// CUET-style stems by chapter, so screens that show a question in full read like the real thing.
const Map<String, List<String>> _stems = {
  'Partnership fundamentals': [
    'A and B share profits 3:2. C joins for a fifth share, taken equally from A and B. What is the new profit-sharing ratio?',
    'In the absence of a partnership deed, at what rate is interest allowed on a loan a partner gives the firm?',
    "When capitals are fixed, which of these is credited to the partner's current account?",
  ],
  'Company accounts': [
    'Shares of 10 each are issued at a premium of 2. Where does the premium appear in the balance sheet?',
    'A company forfeits 100 shares on which 6 was called and 4 paid per share. How much is credited to share forfeiture?',
    'Under the Companies Act, 2013, the securities premium cannot be used to do which of these?',
  ],
  'Ratio analysis': [
    "A firm's current ratio is 2.5 and its working capital is 60,000. What are its current liabilities?",
    'Which ratio shows how many times inventory is sold and replaced in a year?',
    'The quick ratio is 1.2 and current liabilities are 50,000. What are the quick assets?',
  ],
  'Cash flow statement': [
    'Under the indirect method, how is an increase in trade receivables treated?',
    'For a company that is not a finance company, interest paid is which kind of activity?',
    'Machinery bought for 2,00,000 appears under which activity?',
  ],
  'Dissolution of a firm': [
    'On dissolution, an unrecorded asset taken over by a partner is credited to which account?',
    'Realisation expenses the firm pays on behalf of a partner are debited to which account?',
    'When a firm is dissolved, which liability is paid first?',
  ],
  'Not-for-profit organisations': [
    'How are life membership fees received by a club treated?',
    'Subscriptions received in advance for next year appear in the balance sheet as what?',
    'On which side of the balance sheet are specific donations shown?',
  ],
};

/// The stem of question [n] in [chapter]: a real-looking question, or "Question n" elsewhere.
String stemFor(String chapter, int n) {
  final list = _stems[chapter];
  return list == null ? 'Question $n' : list[n % list.length];
}

/// Builds a paper in the server's JSON shape from (chapter, verdict) runs.
Attempt paper({
  required String id,
  required DateTime completedAt,
  String subject = 'accountancy',
  String mode = 'full',
  required List<(String, V, int)> runs,
}) {
  final snapshot = <Map<String, dynamic>>[];
  final details = <Map<String, dynamic>>[];
  var correct = 0, wrong = 0, blank = 0, n = 0;
  for (final (chapter, verdict, count) in runs) {
    for (var k = 0; k < count; k++) {
      n++;
      final qid = '$id-q$n';
      snapshot.add({'id': qid, 'chapter': chapter, 'question': stemFor(chapter, n), 'correctIndex': 0, 'options': [{'key': 'A', 'text': 'A'}]});
      switch (verdict) {
        case V.right:
          correct++;
          details.add({'qid': qid, 'givenIndex': 0, 'isCorrect': true});
        case V.wrong:
          wrong++;
          details.add({'qid': qid, 'givenIndex': 1, 'isCorrect': false});
        case V.blank:
          blank++;
          details.add({'qid': qid, 'givenIndex': null, 'isCorrect': null});
      }
    }
  }
  return Attempt.fromJson({
    'id': id,
    'subject': subject,
    'score': 0,
    'correct': correct,
    'wrong': wrong,
    'unattempted': blank,
    'total': n,
    'details': details,
    'questionsSnapshot': snapshot,
    'selectionMeta': {'mode': mode, 'scoringVersion': 'server_snapshot_v1'},
    'completedAt': completedAt.millisecondsSinceEpoch,
  });
}

/// A 50-question Accountancy mock whose verdicts interleave like a real sheet: [wrongAt] and
/// [blankAt] are 1-based question numbers; chapters run in blocks of eight or so.
Attempt accountancyMock(String id, DateTime at, {Set<int> wrongAt = const {}, Set<int> blankAt = const {}}) {
  const chapters = [
    'Partnership fundamentals',
    'Company accounts',
    'Ratio analysis',
    'Cash flow statement',
    'Dissolution of a firm',
    'Not-for-profit organisations',
  ];
  final runs = <(String, V, int)>[];
  for (var q = 1; q <= 50; q++) {
    final chapter = chapters[((q - 1) ~/ 9).clamp(0, chapters.length - 1)];
    final v = wrongAt.contains(q) ? V.wrong : (blankAt.contains(q) ? V.blank : V.right);
    runs.add((chapter, v, 1));
  }
  return paper(id: id, completedAt: at, runs: runs);
}

/// Asha's record: seven Accountancy mocks and a Business Studies Quick 10. The newest, Mock 7
/// two days ago, left six mistakes, four of them in Partnership.
List<Attempt> ashaRecord(DateTime now) => [
      accountancyMock('m7', daysBefore(now, 2), wrongAt: {3, 5, 7, 8, 22, 31}, blankAt: {40, 47}),
      paper(
        id: 'q1',
        completedAt: daysBefore(now, 4),
        subject: 'business_studies',
        mode: 'quick',
        runs: const [('Principles of management', V.right, 3), ('Principles of management', V.wrong, 1), ('Staffing', V.right, 4), ('Staffing', V.wrong, 1), ('Staffing', V.blank, 1)],
      ),
      accountancyMock('m6', daysBefore(now, 6), wrongAt: {2, 9, 14, 19, 26, 33, 41, 44, 49}, blankAt: {12, 36, 37, 48, 50}),
      accountancyMock('m5', daysBefore(now, 9), wrongAt: {4, 11, 15, 23, 28, 30, 39, 42}, blankAt: {45, 46, 47, 48}),
      accountancyMock('m4', daysBefore(now, 11), wrongAt: {1, 6, 18, 25, 34, 43}, blankAt: {49, 50}),
      accountancyMock('m3', daysBefore(now, 13), wrongAt: {2, 3, 10, 20, 27, 35, 38}),
      accountancyMock('m2', daysBefore(now, 15), wrongAt: {5, 9, 16, 24}),
      accountancyMock('m1', daysBefore(now, 18), wrongAt: {7, 8, 13, 21, 29, 32, 40, 41, 44, 47}),
    ];

/// Every wrong answer of every paper in [attempts] marked repaired on this phone, by paper id.
Map<String, Set<String>> repairedAll(List<Attempt> attempts) => {
      for (final a in attempts) a.id: {for (final q in a.questions) if (a.detailFor(q.id)?.isCorrect == false) q.id},
    };

const TodayProfile ashaProfile = TodayProfile(
  ladder: [
    LadderPick(college: 'Shri Ram College of Commerce', course: 'B.Com (Hons)', closingScore: 924.3, outOf: 1000),
    LadderPick(college: 'Hindu College', course: 'B.Com (Hons)', closingScore: 919.9, outOf: 1000),
    LadderPick(college: 'Deshbandhu College', course: 'B.Com (Hons)', closingScore: 763.0, outOf: 1000),
  ],
  weakestSubject: 'accountancy',
  restWeekdays: {7},
);

TodayProfile ashaProfileWith({DateTime? firstMoveAt}) => TodayProfile(
      ladder: ashaProfile.ladder,
      weakestSubject: ashaProfile.weakestSubject,
      restWeekdays: ashaProfile.restWeekdays,
      firstMoveAt: firstMoveAt,
    );

/// Monday counted, Tuesday is today; Asha plans Monday, Tuesday, Thursday and Saturday.
const TodayWeek tuesdayWeek = TodayWeek(
  studied: [true, false, false, false, false, false, false],
  todayIndex: 1,
  label: '1 of 4 study days',
  goal: 4,
  planned: {0, 1, 3, 5},
  dates: [12, 13, 14, 15, 16, 17, 18],
);

/// Monday and Tuesday counted, Saturday 17 October is today (the dates are the stale Tuesday
/// week's own, so Today has to place the marker from its own clock).
const TodayWeek saturdayWeek = TodayWeek(
  studied: [true, true, false, false, false, false, false],
  todayIndex: 5,
  label: '2 of 4 study days',
  goal: 4,
  planned: {0, 1, 3, 5},
  dates: [12, 13, 14, 15, 16, 17, 18],
);

/// A plan read that came back saying the record could not be read (L01, S6).
LearningPlan unavailablePlan() =>
    LearningPlan.fromJson({'primary': {'kind': 'ordinary_practice', 'title': 'Practise'}, 'minutes': 10, 'recordState': 'unavailable'});

/// Rhythm read with no weekly goal set yet.
const TodayWeek noGoalWeek = TodayWeek(
  studied: [true, false, false, false, false, false, false],
  todayIndex: 1,
  label: '1 study day',
  dates: [12, 13, 14, 15, 16, 17, 18],
);

LearningPlan readyPlan({int minutes = 10}) =>
    LearningPlan.fromJson({'primary': {'kind': 'ordinary_practice', 'title': 'Practise'}, 'minutes': minutes, 'recordState': 'ready'});

TodayInputs ashaInputs({
  DateTime? now,
  List<Attempt>? attempts,
  bool returning = false,
  TodayDraft? draft,
  List<({String attemptId, DateTime receivedAt})> unopened = const [],
  List<({String attemptId, DateTime receivedAt})>? reelPending,
  bool offline = false,
  int? selectedMinutes,
  TodayProfile? profile = ashaProfile,
  Map<String, Set<String>> repaired = const {},
  Set<DismissalKey> dismissed = const {},
  Duration attemptsAge = const Duration(minutes: 70),
  Duration planAge = const Duration(minutes: 70),
  TodayWeek week = tuesdayWeek,
  bool weekFailed = false,
  bool? attemptsStale,
  DateTime? lastTriedAt,
  LearningPlan? plan,
  int repairedToday = 0,
  int? reviseDue,
  int? reviseShown,
  int reviseCap = 10,
  int? openRepairs,
  List<ChapterRow>? reviewChapters,
  bool isPro = false,
  String? firstName = 'Asha',
  String? email,
  OpenPaper? openPaper,
}) {
  final at = now ?? tuesdayEvening;
  return TodayInputs(
    now: at,
    firstName: firstName,
    email: email,
    repairedToday: repairedToday,
    reviseDue: reviseDue,
    reviseShown: reviseShown,
    reviseCap: reviseCap,
    openRepairs: openRepairs,
    reviewChapters: reviewChapters,
    isPro: isPro,
    subjects: const ['accountancy', 'business_studies', 'economics', 'english'],
    attempts: attempts ?? ashaRecord(at),
    attemptsFetchedAt: at.subtract(attemptsAge),
    attemptsStale: attemptsStale ?? offline,
    plan: plan ?? readyPlan(),
    planFetchedAt: at.subtract(planAge),
    planStale: offline,
    week: weekFailed ? null : week,
    weekFailed: weekFailed,
    returning: returning,
    draft: draft,
    unopened: unopened,
    reelPending: reelPending,
    repaired: repaired,
    dismissed: dismissed,
    profile: profile,
    offline: offline,
    selectedMinutes: selectedMinutes,
    lastTriedAt: lastTriedAt,
    openPaper: openPaper,
  );
}
