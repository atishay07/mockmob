import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/session.dart';
import 'package:mockmob/core/models/session_draft.dart';

/// A verdict for one question of a fixture attempt.
enum V { right, wrong, blank }

/// Builds an attempt in the server's JSON shape from (chapter, verdict) pairs.
Map<String, dynamic> attemptJson({
  String id = 'att-1',
  String subject = 'accountancy',
  String? mode = 'full',
  int completedAt = 1000,
  required List<(String, V)> questions,
  Map<String, dynamic>? extraMeta,
}) {
  final snapshot = <Map<String, dynamic>>[];
  final details = <Map<String, dynamic>>[];
  var correct = 0, wrong = 0, blank = 0;
  for (var i = 0; i < questions.length; i++) {
    final (chapter, verdict) = questions[i];
    final qid = '$id-q${i + 1}';
    snapshot.add({
      'id': qid,
      'chapter': chapter,
      'difficulty': 'medium',
      'correctIndex': 0,
      'question': 'Question ${i + 1}',
      'explanation': 'Because $i.',
      'options': [
        {'key': 'A', 'text': 'First'},
        {'key': 'B', 'text': 'Second'},
      ],
    });
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
  return {
    'id': id,
    'userId': 'user-1',
    'subject': subject,
    'score': 50,
    'correct': correct,
    'wrong': wrong,
    'unattempted': blank,
    'total': questions.length,
    'details': details,
    'questionsSnapshot': snapshot,
    'selectionMeta': {'mode': ?mode, 'scoringVersion': 'server_practice_v1', ...?extraMeta},
    'completedAt': completedAt,
  };
}

Attempt attemptOf({
  String id = 'att-1',
  String subject = 'accountancy',
  String? mode = 'full',
  int completedAt = 1000,
  required List<(String, V)> questions,
}) =>
    Attempt.fromJson(attemptJson(id: id, subject: subject, mode: mode, completedAt: completedAt, questions: questions));

Attempt attemptOfJson(Map<String, dynamic> json) => Attempt.fromJson(json);

/// `n` questions in one chapter with the given verdict counts.
List<(String, V)> chapterOf(String chapter, {int right = 0, int wrong = 0, int blank = 0}) => [
      for (var i = 0; i < right; i++) (chapter, V.right),
      for (var i = 0; i < wrong; i++) (chapter, V.wrong),
      for (var i = 0; i < blank; i++) (chapter, V.blank),
    ];

/// A session view JSON with [count] questions q1..qN.
Map<String, dynamic> sessionViewJson({
  String id = 'sess-1',
  int count = 3,
  int startedAt = 1000000,
  int expiresAt = 1000000 + 600000,
  int? serverNow,
  String? ticket,
  List<Map<String, dynamic>>? events,
}) =>
    {
      'id': id,
      'startedAt': DateTime.fromMillisecondsSinceEpoch(startedAt, isUtc: true).toIso8601String(),
      'expiresAt': DateTime.fromMillisecondsSinceEpoch(expiresAt, isUtc: true).toIso8601String(),
      'serverNow': serverNow ?? startedAt,
      'state': ticket == null ? 'active' : null,
      'questions': [
        for (var i = 1; i <= count; i++)
          {
            'id': 'q$i',
            'subject': 'accountancy',
            'chapter': 'Goodwill',
            'question': 'Question $i',
            'options': [
              {'key': 'A', 'text': 'First'},
              {'key': 'B', 'text': 'Second'},
              {'key': 'C', 'text': 'Third'},
            ],
          },
      ],
      'meta': {'sessionId': id, 'mode': 'full', 'requestedCount': count, 'sessionTicket': ?ticket},
      'events': ?events,
    };

SessionView sessionViewOf({String id = 'sess-1', int count = 3, int startedAt = 1000000, int expiresAt = 1600000, int? serverNow, String? ticket}) =>
    SessionView.fromJson(sessionViewJson(id: id, count: count, startedAt: startedAt, expiresAt: expiresAt, serverNow: serverNow, ticket: ticket));

/// A draft with sensible defaults for tests.
SessionDraft draftOf({
  String userId = 'u1',
  String sessionId = 'sess-1',
  String generationKey = 'gen-1',
  int count = 3,
  required int endsAtWallMs,
  int? startedRefWallMs,
  bool pending = false,
  bool windowClosed = false,
  String? ticket,
  String mode = 'full',
  String subject = 'accountancy',
  int? mockNumber = 7,
  int acknowledgedSequence = 0,
}) {
  final view = sessionViewOf(id: sessionId, count: count, ticket: ticket);
  return SessionDraft(
    draftKey: SessionDraft.keyFor(userId: userId, subject: subject, count: count, mode: mode),
    userId: userId,
    view: view,
    generationKey: generationKey,
    subject: subject,
    mode: mode,
    count: count,
    mockNumber: mockNumber,
    startedRefWallMs: startedRefWallMs ?? endsAtWallMs - 600000,
    endsAtWallMs: endsAtWallMs,
    pendingSubmission: pending,
    windowClosed: windowClosed,
    acknowledgedSequence: acknowledgedSequence,
  );
}
