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
  /// for an existing attempt returns the saved attempt.
  Future<Map<String, dynamic>> submit({
    required String sessionId,
    String? sessionTicket,
    required Map<String, int> answers,
    required List<SessionEvent> events,
  });

  /// `GET /api/attempts/{id}`. Null on 404 (no such attempt for this account).
  Future<Map<String, dynamic>?> fetchAttempt(String attemptId);
}

class ApiSessionApi implements SessionApi {
  ApiSessionApi(this._api);

  final ApiClient _api;

  @override
  Future<int> putEvents({required String sessionId, required List<SessionEvent> events}) async {
    final response = await _api.put(
      '/api/sessions',
      body: {'sessionId': sessionId, 'events': [for (final e in events) e.toJson()]},
      options: const ApiOptions(retries: 0),
    );
    return (response.map['acknowledgedSequence'] as num?)?.toInt() ?? 0;
  }

  @override
  Future<SessionView> resume(String sessionId) async {
    final response = await _api.post('/api/sessions', body: {'sessionId': sessionId}, options: const ApiOptions(retries: 0));
    return SessionView.fromJson(response.map);
  }

  @override
  Future<Map<String, dynamic>> submit({
    required String sessionId,
    String? sessionTicket,
    required Map<String, int> answers,
    required List<SessionEvent> events,
  }) async {
    final response = await _api.post(
      '/api/attempts',
      body: {
        'sessionId': sessionId,
        'sessionTicket': ?sessionTicket,
        'answers': answers,
        'events': [for (final e in events) e.toJson()],
      },
      // The final submit never waits behind a 429 hold from the events PUT: the grace window is
      // only 120 s and the syncer already runs its own back-off.
      options: const ApiOptions(retries: 0, bypassRateGate: true, receiveTimeout: Duration(seconds: 45)),
    );
    return scoredAttempt(response);
  }

  @override
  Future<Map<String, dynamic>?> fetchAttempt(String attemptId) async {
    try {
      final response = await _api.get('/api/attempts/$attemptId', options: const ApiOptions(retries: 1, bypassRateGate: true));
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
