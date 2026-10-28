import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/repositories/attempts_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart';

/// The attempts list the hub reads, in any state, and a retry the test can count.
class FakeHubAttempts extends AttemptsRepository {
  FakeHubAttempts(this.initial);

  final RemoteState<List<Attempt>> initial;
  static int refreshes = 0;

  @override
  RemoteState<List<Attempt>> build() => initial;

  @override
  Future<void> refresh({bool force = false}) async => refreshes++;
}

final DateTime hubNow = DateTime(2026, 10, 15, 14);

/// One attempt in [subject] as `GET /api/attempts` returns it: a question per entry of [rows], each
/// `(chapter, outcome)` with outcome `right`, `wrong` or `blank`.
Attempt hubAttempt(
  String id,
  String subject,
  List<(String, String)> rows, {
  DateTime? at,
  String internalSubject = '',
}) {
  var correct = 0;
  var wrong = 0;
  var blank = 0;
  final questions = <Map<String, Object?>>[];
  final details = <Map<String, Object?>>[];
  for (var i = 0; i < rows.length; i++) {
    final (chapter, outcome) = rows[i];
    questions.add({
      'id': '$id-q$i',
      'subject': subject,
      'internalSubject': internalSubject.isEmpty ? subject : internalSubject,
      'chapter': chapter,
      'question': 'Question $i',
      'options': ['A', 'B', 'C', 'D'],
    });
    switch (outcome) {
      case 'right':
        correct++;
        details.add({'qid': '$id-q$i', 'givenIndex': 0, 'isCorrect': true});
      case 'wrong':
        wrong++;
        details.add({'qid': '$id-q$i', 'givenIndex': 1, 'isCorrect': false});
      default:
        blank++;
        details.add({'qid': '$id-q$i'});
    }
  }
  return Attempt.fromJson({
    'id': id,
    'subject': subject,
    'score': 0,
    'correct': correct,
    'wrong': wrong,
    'unattempted': blank,
    'total': rows.length,
    'mode': 'quick',
    'questionsSnapshot': questions,
    'details': details,
    'completedAt': (at ?? DateTime.utc(2026, 10, 12, 9)).toIso8601String(),
  });
}

List<(String, String)> rowsOf(String chapter, {int right = 0, int wrong = 0, int blank = 0}) => [
  for (var i = 0; i < right; i++) (chapter, 'right'),
  for (var i = 0; i < wrong; i++) (chapter, 'wrong'),
  for (var i = 0; i < blank; i++) (chapter, 'blank'),
];

/// Two Accountancy attempts: Partnership Fundamentals 9 of 12 right, Goodwill Valuation 3 of 8,
/// Accounting Ratios 2 of 3 (too few for a percentage), Cash Flow Statement two questions left
/// blank, every other chapter untouched.
List<Attempt> accountancyAttempts() => [
  hubAttempt(
    'a1',
    'accountancy',
    [
      ...rowsOf('Partnership Fundamentals', right: 5, wrong: 1),
      ...rowsOf('Goodwill Valuation', right: 2, wrong: 3),
      ...rowsOf('Accounting Ratios', right: 2, wrong: 1),
    ],
    at: DateTime.utc(2026, 10, 10, 9),
  ),
  hubAttempt(
    'a2',
    'accountancy',
    [
      ...rowsOf('Partnership Fundamentals', right: 4, wrong: 2),
      ...rowsOf('Goodwill Valuation', right: 1, wrong: 2),
      ...rowsOf('Cash Flow Statement', blank: 2),
    ],
    at: DateTime.utc(2026, 10, 12, 9),
  ),
  // Another subject's attempt must never count here.
  hubAttempt('e1', 'english', rowsOf('Vocabulary', right: 4)),
];

RemoteState<List<Attempt>> loaded(List<Attempt> attempts) => RemoteState(value: attempts, fetchedAt: hubNow);

const ApiError offlineError = ApiError(kind: ApiErrorKind.network, code: 'network');

List<Override> hubOverrides({
  RemoteState<List<Attempt>>? attempts,
  List<Subject>? subjects,
  bool subjectsFail = false,
}) => [
  attemptsRepositoryProvider.overrideWith(() => FakeHubAttempts(attempts ?? loaded(const []))),
  practiceSubjectsProvider.overrideWith(
    (ref) async => subjectsFail ? throw offlineError : (subjects ?? const <Subject>[]),
  ),
];
