import '../../api/api_client.dart';
import '../../api/api_error.dart';
import '../../models/session.dart';

/// The session endpoints the engine uses, behind an interface so the engine is tested without a
/// network and the background task can use a different token source.
abstract class SessionApi {
  /// `PUT /api/sessions` with the whole cumulative event log. Returns `acknowledgedSequence`.
  Future<int> putEvents({required String sessionId, required List<SessionEvent> events});

  /// `POST /api/sessions {sessionId}`: resumes a durable session and returns its view
  /// (with the events the server already holds).
  Future<SessionView> resume(String sessionId);

  /// `POST /api/attempts`: submits and returns the scored attempt JSON. Idempotent: a repeat
  /// for an existing attempt returns the saved attempt. [forUserId] is the paper's owner: the
  /// submit is never sent with another account's token (`ApiError.accountChanged`). [meta] adds
  /// the attempt meta fields to the body (`client`, `endedBy`; spec 6, item 6): a description of
  /// the device the server stores and never scores with.
  Future<Map<String, dynamic>> submit({
    required String sessionId,
    String? sessionTicket,
    required Map<String, int> answers,
    required List<SessionEvent> events,
    String? forUserId,
    Map<String, Object?>? meta,
  });

  /// `GET /api/attempts/{id}`. Null on 404 (no such attempt for this account). [forUserId] as
  /// for [submit]: a 404 closes the paper, so only its owner's token may ask.
  Future<Map<String, dynamic>?> fetchAttempt(String attemptId, {String? forUserId});
}

class ApiSessionApi implements SessionApi {
  ApiSessionApi(this._api, {this.userId});

  final ApiClient _api;

  /// The account whose papers these calls are for. When set, no call goes out with another
  /// account's token ([ApiError.accountChanged], which never ends a submit): sent with the
  /// wrong token, the server would refuse the paper or say it has no such attempt, and that
  /// answer would end the student's unsent paper.
  final String? userId;

  @override
  Future<int> putEvents({required String sessionId, required List<SessionEvent> events}) async {
    final response = await _api.put(
      '/api/sessions',
      body: {'sessionId': sessionId, 'events': [for (final e in events) e.toJson()]},
      options: const ApiOptions(retries: 0),
      expectUserId: userId,
    );
    final ack = response.map['acknowledgedSequence'];
    if (ack == null) return 0;
    // A reply that is not a number is no acknowledgement: an ApiError the syncer retries, not a
    // TypeError that skips the rest of a pause (review-03).
    if (ack is! num) throw const ApiError(kind: ApiErrorKind.server, code: unusableAttemptCode);
    return ack.toInt();
  }

  @override
  Future<SessionView> resume(String sessionId) async {
    final response = await _api.post('/api/sessions', body: {'sessionId': sessionId}, options: const ApiOptions(retries: 0), expectUserId: userId);
    return SessionView.fromJson(response.map);
  }

  @override
  Future<Map<String, dynamic>> submit({
    required String sessionId,
    String? sessionTicket,
    required Map<String, int> answers,
    required List<SessionEvent> events,
    String? forUserId,
    Map<String, Object?>? meta,
  }) async {
    final response = await _api.post(
      '/api/attempts',
      body: {
        'sessionId': sessionId,
        'sessionTicket': ?sessionTicket,
        'answers': answers,
        'events': [for (final e in events) e.toJson()],
        ...?meta,
      },
      // The final submit never waits behind a 429 hold from the events PUT: the grace window is
      // only 120 s and the syncer already runs its own back-off.
      options: const ApiOptions(retries: 0, bypassRateGate: true, receiveTimeout: Duration(seconds: 45)),
      expectUserId: forUserId ?? userId,
    );
    return scoredAttempt(response);
  }

  @override
  Future<Map<String, dynamic>?> fetchAttempt(String attemptId, {String? forUserId}) async {
    try {
      // A 404 here closes the paper, so it is asked only with its owner's token.
      final response = await _api.get(
        '/api/attempts/$attemptId',
        options: const ApiOptions(retries: 1, bypassRateGate: true),
        expectUserId: forUserId ?? userId,
      );
      return scoredAttempt(response);
    } on ApiError catch (e) {
      if (e.kind == ApiErrorKind.notFound) return null;
      rethrow;
    }
  }
}

/// The attempt in a 2xx reply, or a non-definitive error when the body is not one.
///
/// A proxy or maintenance page served with 200, a 204 or an empty body is not proof that the
/// server recorded anything. Treating it as an attempt would delete the student's answers, so
/// it counts as an unusable reply and the submit stays pending.
Map<String, dynamic> scoredAttempt(ApiResponse response) {
  final data = response.data;
  if (data is Map) {
    final id = data['id'];
    if (id is String && id.trim().isNotEmpty) return Map<String, dynamic>.from(data);
  }
  throw const ApiError(kind: ApiErrorKind.server, code: unusableAttemptCode);
}

/// The code for a 2xx reply that did not carry an attempt.
const unusableAttemptCode = 'unusable_response';
