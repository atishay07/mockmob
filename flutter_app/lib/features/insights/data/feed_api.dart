import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/models/json_helpers.dart';
import 'practice_question.dart';

/// One page of `GET /api/questions/feed`. Rows held for checks are dropped on the server
/// after paging, so a page can be short or empty while [hasMore] is still true.
class FeedPage {
  const FeedPage({required this.questions, required this.nextOffset, required this.hasMore});

  final List<PracticeQuestion> questions;
  final int nextOffset;
  final bool hasMore;
}

/// The question stream's server calls: the feed, the vote and the interaction log.
class FeedApi {
  const FeedApi(this._api);

  final ApiClient _api;

  static const pageSize = 12;

  Future<FeedPage> page({required String subject, String? chapter, String? difficulty, required int offset}) async {
    final res = await _api.get('/api/questions/feed', query: {
      'subject': subject,
      'chapter': ?chapter,
      'difficulty': ?difficulty,
      'limit': pageSize,
      'offset': offset,
    });
    final body = res.map;
    final questions = [for (final q in asJsonList(body['questions'])) PracticeQuestion.fromJson(q)];
    return FeedPage(
      questions: questions,
      nextOffset: asInt(body['nextOffset']) ?? offset + questions.length,
      hasMore: asBool(body['hasMore']) ?? false,
    );
  }

  /// `POST /api/questions/{id}/vote`: the counts and the student's vote as the server stored them.
  Future<({int up, int down, String? vote})> vote(String questionId, String? vote) async {
    final res = await _api.post('/api/questions/${Uri.encodeComponent(questionId)}/vote', body: {'vote_type': vote});
    final b = res.map;
    final stored = asString(b['userVote']);
    return (up: asInt(b['upvotes']) ?? 0, down: asInt(b['downvotes']) ?? 0, vote: stored == 'up' || stored == 'down' ? stored : null);
  }

  /// `POST /api/questions/{id}/interact`. Telemetry: a failure is never shown to the student,
  /// except for a report, which must say it arrived.
  Future<void> interact(
    String questionId,
    String type, {
    required String flow,
    int? dwellMs,
    Map<String, Object?>? metadata,
  }) async {
    await _api.post('/api/questions/${Uri.encodeComponent(questionId)}/interact', body: {
      'interaction_type': type,
      'flow_context': flow,
      'session_id': null,
      'dwell_ms': ?dwellMs,
      'metadata': metadata ?? const <String, Object?>{},
    });
  }

  /// Fire and forget, for seen, attempted and skip.
  void log(String questionId, String type, {required String flow, int? dwellMs, Map<String, Object?>? metadata}) {
    interact(questionId, type, flow: flow, dwellMs: dwellMs, metadata: metadata).catchError((Object _) {
      // Telemetry only. Nothing to tell the student.
    });
  }
}

final feedApiProvider = Provider<FeedApi>((ref) => FeedApi(ref.watch(apiClientProvider)));

/// Whether a report reached the server.
Future<bool> reportQuestion(FeedApi api, String questionId, String reason, {required String flow, Map<String, Object?> extra = const {}}) async {
  try {
    await api.interact(questionId, 'report', flow: flow, metadata: {...extra, 'reason': reason});
    return true;
  } on ApiError {
    return false;
  }
}
