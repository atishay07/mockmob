import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/learning_plan.dart';
import 'package:mockmob/core/repositories/dismissal_repository.dart';
import 'package:mockmob/features/today/data/today_profile.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';

/// A verdict for one question of a fixture paper.
enum V { right, wrong, blank }

/// Tuesday 13 October 2026, 8:40 PM in Kolkata.
final DateTime tuesdayEvening = DateTime.utc(2026, 10, 13, 15, 10);

/// The same Tuesday at 11:40 PM in Kolkata.
final DateTime tuesdayLate = DateTime.utc(2026, 10, 13, 18, 10);

DateTime daysBefore(DateTime now, int days, {int hour = 15}) =>
    DateTime.utc(now.year, now.month, now.day - days, hour, 40);

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
      snapshot.add({'id': qid, 'chapter': chapter, 'question': 'Question $n', 'correctIndex': 0, 'options': [{'key': 'A', 'text': 'A'}]});
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

LearningPlan readyPlan({int minutes = 10}) =>
    LearningPlan.fromJson({'primary': {'kind': 'ordinary_practice', 'title': 'Practise'}, 'minutes': minutes, 'recordState': 'ready'});

TodayInputs ashaInputs({
  DateTime? now,
  List<Attempt>? attempts,
  bool returning = false,
  TodayDraft? draft,
  List<({String attemptId, DateTime receivedAt})> unopened = const [],
  bool offline = false,
  int? selectedMinutes,
  TodayProfile? profile = ashaProfile,
  Map<String, Set<String>> repaired = const {},
  Set<DismissalKey> dismissed = const {},
}) {
  final at = now ?? tuesdayEvening;
  return TodayInputs(
    now: at,
    firstName: 'Asha',
    subjects: const ['accountancy', 'business_studies', 'economics', 'english'],
    attempts: attempts ?? ashaRecord(at),
    attemptsFetchedAt: at.subtract(const Duration(minutes: 70)),
    attemptsStale: offline,
    plan: readyPlan(),
    planFetchedAt: at.subtract(const Duration(minutes: 70)),
    planStale: offline,
    week: tuesdayWeek,
    returning: returning,
    draft: draft,
    unopened: unopened,
    repaired: repaired,
    dismissed: dismissed,
    profile: profile,
    offline: offline,
    selectedMinutes: selectedMinutes,
  );
}
