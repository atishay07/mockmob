import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/models/json_helpers.dart';

/// One chapter `GET /api/recovery/replay` can or cannot make five fresh questions for.
class ReplayChapter {
  const ReplayChapter({required this.chapter, required this.available});

  factory ReplayChapter.fromJson(Json j) =>
      ReplayChapter(chapter: asStringOr(j['chapter'], ''), available: asString(j['state']) == 'available');

  final String chapter;
  final bool available;
}

/// What the server can prove for one result: fresh question families per missed chapter, only
/// for the four launch subjects (`state: unsupported` elsewhere).
class ReplayInventory {
  const ReplayInventory({required this.supported, this.chapters = const []});

  factory ReplayInventory.fromJson(Json j) => ReplayInventory(
    supported: asString(j['state']) == 'ready',
    chapters: [
      for (final c in asJsonList(j['chapters']))
        if (asStringOr(c['chapter'], '').isNotEmpty) ReplayChapter.fromJson(c),
    ],
  );

  final bool supported;
  final List<ReplayChapter> chapters;

  /// The first chapter with five fresh questions ready, in the server's order (most missed).
  String? get firstAvailable => chapters.where((c) => c.available).map((c) => c.chapter).firstOrNull;
}

/// `GET /api/recovery/replay?attemptId=` (30 a minute): read once per result view. A failure is
/// silent: the Prove step simply does not appear, the result is unaffected.
final replayInventoryProvider = FutureProvider.autoDispose.family<ReplayInventory?, String>((ref, attemptId) async {
  try {
    final res = await ref.watch(apiClientProvider).get('/api/recovery/replay', query: {'attemptId': attemptId});
    return ReplayInventory.fromJson(res.map);
  } on ApiError {
    return null;
  }
});

/// What a report says about the question, as the website's result analysis sends it.
class ResultReport {
  const ResultReport({
    required this.questionId,
    required this.attemptId,
    required this.subject,
    required this.verdict,
    required this.note,
    this.sessionId,
    this.givenIndex,
    this.correctIndex,
  });

  final String questionId;
  final String attemptId;
  final String? sessionId;
  final String subject;

  /// `correct`, `wrong` or `skipped`, as the website names them.
  final String verdict;
  final String note;
  final int? givenIndex;
  final int? correctIndex;

  Json get body => {
    'interaction_type': 'report',
    'flow_context': 'review',
    'session_id': sessionId,
    'metadata': {
      'source': 'result_analysis',
      'attempt_id': attemptId,
      'subject': subject,
      'verdict': verdict,
      'note': note,
      'given_index': givenIndex,
      'correct_index': correctIndex,
    },
  };
}

/// The questions reported from a result in this run of the app, so a row says "Reported" after
/// the server took it and the student cannot send the same report twice.
class ReportedQuestions extends Notifier<Set<String>> {
  @override
  Set<String> build() => const {};

  /// Sends the report; true only after the server answered 2xx.
  Future<bool> send(ResultReport report) async {
    try {
      await ref.read(apiClientProvider).post('/api/questions/${Uri.encodeComponent(report.questionId)}/interact', body: report.body);
    } on ApiError {
      return false;
    }
    state = {...state, report.questionId};
    return true;
  }
}

final reportedQuestionsProvider = NotifierProvider<ReportedQuestions, Set<String>>(ReportedQuestions.new);
