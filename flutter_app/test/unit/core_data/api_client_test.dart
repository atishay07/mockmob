import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/api/api_error.dart';

import 'support/fakes.dart';

class _Observer implements ApiNetworkObserver {
  int errors = 0;
  int reached = 0;

  @override
  void onNetworkError() => errors++;

  @override
  void onReachedServer() => reached++;
}

void main() {
  late FakeHttpAdapter http;
  late FakeTokens tokens;
  late ApiClient api;

  setUp(() {
    http = FakeHttpAdapter();
    tokens = FakeTokens();
    api = newApiClient(http, tokens: tokens);
  });

  Future<ApiError> errorOf(Future<Object?> call) async {
    try {
      await call;
    } on ApiError catch (e) {
      return e;
    }
    fail('expected an ApiError');
  }

  group('bearer and refresh', () {
    test('sends the access token as a bearer header', () async {
      http.replies.add(const FakeReply(200, {'ok': true}));
      final r = await api.get('/api/auth/me');
      expect(r.map['ok'], isTrue);
      expect(http.requests.single.headers['Authorization'], 'Bearer tok-1');
    });

    test('401 refreshes once and retries with the new token', () async {
      http.replies
        ..add(const FakeReply(401, {'error': 'Unauthorized'}))
        ..add(const FakeReply(200, {'user': {'id': 'u'}}));
      final r = await api.get('/api/auth/me');
      expect(r.status, 200);
      expect(tokens.refreshCalls, 1);
      expect(tokens.lostCalls, 0);
      expect(http.requests.length, 2);
      expect(http.requests.last.headers['Authorization'], 'Bearer tok-2');
    });

    test('401 with a failed refresh signs out once and surfaces unauthorized', () async {
      tokens.refreshResult = false;
      http.replies.add(const FakeReply(401, {'error': 'Unauthorized'}));
      final e = await errorOf(api.get('/api/me/goal'));
      expect(e.isUnauthorized, isTrue);
      expect(tokens.refreshCalls, 1);
      expect(tokens.lostCalls, 1);
      expect(http.requests.length, 1);
    });

    test('401 while the refresh cannot run is offline, not a lost session', () async {
      tokens.refreshUnavailable = true;
      http.replies.add(const FakeReply(401, {'error': 'Unauthorized'}));
      // A POST is not retried, so the offline error surfaces directly.
      final e = await errorOf(api.post('/api/me/goal', body: {'x': 1}));
      expect(e.isOffline, isTrue);
      expect(tokens.refreshCalls, 1);
      expect(tokens.lostCalls, 0);
    });

    test('a second 401 after refreshing signs out and does not refresh again', () async {
      http.replies
        ..add(const FakeReply(401))
        ..add(const FakeReply(401));
      final e = await errorOf(api.get('/api/me/goal'));
      expect(e.isUnauthorized, isTrue);
      expect(tokens.refreshCalls, 1);
      expect(tokens.lostCalls, 1);
      expect(http.requests.length, 2);
    });

    test('concurrent 401s share one refresh', () async {
      http.handler = (options) {
        final token = options.headers['Authorization'];
        return token == 'Bearer tok-1' ? const FakeReply(401) : const FakeReply(200, {'ok': true});
      };
      final results = await Future.wait([api.get('/api/a'), api.get('/api/b'), api.get('/api/c')]);
      expect(results.every((r) => r.status == 200), isTrue);
      expect(tokens.refreshCalls, 1);
    });

    test('a public call sends no token and never refreshes', () async {
      http.replies.add(const FakeReply(401, {'ok': false}));
      final e = await errorOf(api.post('/api/auth/email-login', body: {'email': 'a@b.co'}, options: const ApiOptions(authenticated: false)));
      expect(e.isUnauthorized, isTrue);
      expect(http.requests.single.headers.containsKey('Authorization'), isFalse);
      expect(tokens.refreshCalls, 0);
      expect(tokens.lostCalls, 0);
    });

    test('with no token the call fails as unauthorized without touching the network', () async {
      tokens.token = null;
      final e = await errorOf(api.get('/api/auth/me'));
      expect(e.isUnauthorized, isTrue);
      expect(http.requests, isEmpty);
    });
  });

  group('error parsing by family', () {
    test('machine code family', () async {
      http.replies.add(const FakeReply(422, {'error': 'SESSION_EXPIRED'}));
      final e = await errorOf(api.post('/api/attempts', body: {}));
      expect(e.status, 422);
      expect(e.hasCode(ApiCodes.sessionExpired), isTrue);
      expect(e.kind, ApiErrorKind.validation);
    });

    test('learning family with a message the UI must not see', () async {
      http.replies.add(const FakeReply(503, {'error': 'STUDY_CONTENT_CHANGED', 'message': 'internal detail about hashes'}));
      final e = await errorOf(api.get('/api/study/catalog', query: {'subject': 'x'}, options: const ApiOptions(retries: 0)));
      expect(e.hasCode(ApiCodes.studyContentChanged), isTrue);
      expect(e.kind, ApiErrorKind.unavailable);
      expect(e.message.contains('hashes'), isFalse);
      expect(e.toString().contains('hashes'), isFalse);
    });

    test('repair family reads the error code', () async {
      http.replies.add(const FakeReply(402, {'ok': false, 'error': 'insufficient_ai_credits', 'message': 'no', 'balance': 2}));
      final e = await errorOf(api.post('/api/recovery/repair', body: {}));
      expect(e.hasCode(ApiCodes.insufficientAiCredits), isTrue);
      expect(e.kind, ApiErrorKind.paymentRequired);
      expect(e.details['balance'], 2);
    });

    test('repair eligibility review state takes priority over the error code', () async {
      http.replies.add(const FakeReply(409, {'ok': false, 'error': 'question_unavailable', 'review': {'state': 'under_review', 'secret': 'x'}}));
      final e = await errorOf(api.post('/api/recovery/repair', body: {}));
      expect(e.code, 'under_review');
      expect(e.details['review'], {'state': 'under_review'});
    });

    test('quote family reads reasonCode', () async {
      http.replies.add(const FakeReply(429, {'state': 'unavailable', 'reasonCode': 'rate_limited', 'reason': 'Slow down.'}));
      final e = await errorOf(api.get('/api/practice/quote'));
      expect(e.isRateLimited, isTrue);
      expect(e.code, 'rate_limited');
    });

    test('a human string error becomes a status-derived code and is never surfaced', () async {
      http.replies.add(const FakeReply(404, {'error': 'Attempt not found'}));
      final e = await errorOf(api.get('/api/attempts/x'));
      expect(e.code, 'not_found');
      expect(e.kind, ApiErrorKind.notFound);
      expect(e.message.contains('Attempt'), isFalse);
    });

    test('a raw parser message on a 422 never reaches the UI', () async {
      http.replies.add(const FakeReply(422, {'error': 'Unexpected token } in JSON at position 41'}));
      final e = await errorOf(api.post('/api/sessions', body: {}));
      expect(e.code, 'invalid_request');
      expect('${e.message} ${e.toString()}'.contains('token'), isFalse);
    });

    test('login family without a code falls back to the status', () async {
      http.replies.add(const FakeReply(429, {'ok': false, 'message': 'Please wait before requesting another login code.'}));
      final e = await errorOf(api.post('/api/auth/email-login', body: {}, options: const ApiOptions(authenticated: false)));
      expect(e.isRateLimited, isTrue);
      expect(e.message.contains('login code'), isFalse);
    });

    test('a non json error body is handled', () async {
      http.replies.add(const FakeReply(502, '<html>Bad gateway</html>'));
      final e = await errorOf(api.post('/api/anything', body: {}));
      expect(e.status, 502);
      expect(e.kind, ApiErrorKind.server);
    });

    test('no response is a network error, a timeout is a timeout', () async {
      http.replies.add(const FakeReply.network());
      final e = await errorOf(api.post('/api/x', body: {}));
      expect(e.kind, ApiErrorKind.network);
      expect(e.isOffline, isTrue);
    });
  });

  group('429 back-off', () {
    test('holds later requests of the same route family for 60 seconds without calling out', () async {
      var now = DateTime.utc(2026, 10, 12, 12);
      api = newApiClient(http, tokens: tokens, now: () => now);
      http.replies.add(const FakeReply(429, {'error': 'Too many requests'}));
      final first = await errorOf(api.get('/api/learning/plan'));
      expect(first.retryAfter, const Duration(seconds: 60));
      expect(http.requests.length, 1);

      // Another learning route shares the bucket and is held with no network call.
      final held = await errorOf(api.get('/api/study/catalog'));
      expect(held.isRateLimited, isTrue);
      expect(http.requests.length, 1);
      expect(api.heldFor('/api/study/catalog'), isNotNull);

      // A different family is not held.
      http.replies.add(const FakeReply(200, {}));
      await api.get('/api/me/goal');
      expect(http.requests.length, 2);

      now = now.add(const Duration(seconds: 61));
      http.replies.add(const FakeReply(200, {}));
      await api.get('/api/learning/plan');
      expect(http.requests.length, 3);
    });

    test('honours a Retry-After header', () async {
      http.replies.add(const FakeReply(429, {}, {'retry-after': '120'}));
      final e = await errorOf(api.get('/api/auth/me'));
      expect(e.retryAfter, const Duration(seconds: 120));
    });

    test('a loop with its own back-off can bypass the hold', () async {
      http.replies
        ..add(const FakeReply(429, {}))
        ..add(const FakeReply(200, {'user': {}}));
      await errorOf(api.get('/api/auth/me', options: const ApiOptions(retries: 0, bypassRateGate: true)));
      final r = await api.get('/api/auth/me', options: const ApiOptions(retries: 0, bypassRateGate: true));
      expect(r.status, 200);
    });
  });

  group('retries and idempotency', () {
    test('a GET retries a network error and a 503 up to twice', () async {
      http.replies
        ..add(const FakeReply.network())
        ..add(const FakeReply(503, {'error': 'unavailable'}))
        ..add(const FakeReply(200, {'ok': 1}));
      final r = await api.get('/api/me/rhythm');
      expect(r.map['ok'], 1);
      expect(http.requests.length, 3);
    });

    test('a GET gives up after the retries', () async {
      http.replies
        ..add(const FakeReply.network())
        ..add(const FakeReply.network())
        ..add(const FakeReply.network());
      final e = await errorOf(api.get('/api/me/rhythm'));
      expect(e.isOffline, isTrue);
      expect(http.requests.length, 3);
    });

    test('a write is never repeated automatically', () async {
      http.replies
        ..add(const FakeReply.network())
        ..add(const FakeReply(200, {}));
      await errorOf(api.post('/api/attempts', body: {}));
      expect(http.requests.length, 1);
    });

    test('a 4xx is not retried', () async {
      http.replies.add(const FakeReply(422, {'error': 'invalid_request'}));
      await errorOf(api.get('/api/me/goal'));
      expect(http.requests.length, 1);
    });

    test('passes an idempotency key through as a header', () async {
      await api.post('/api/study/runs/r1/events', body: {'requestKey': 'k'}, options: const ApiOptions(idempotencyKey: 'key-123456789012'));
      expect(http.requests.single.headers['Idempotency-Key'], 'key-123456789012');
    });
  });

  group('connectivity observer', () {
    test('sees network errors and answered requests', () async {
      final observer = _Observer();
      api = newApiClient(http, tokens: tokens, observer: observer);
      http.replies
        ..add(const FakeReply.network())
        ..add(const FakeReply(404, {}))
        ..add(const FakeReply(200, {}));
      await errorOf(api.post('/api/a', body: {}));
      expect(observer.errors, 1);
      await errorOf(api.post('/api/b', body: {}));
      await api.post('/api/c', body: {});
      expect(observer.reached, 2);
    });
  });
}
