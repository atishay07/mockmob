import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/auth/auth_me_loader.dart';

import 'support/fakes.dart';

void main() {
  late FakeHttpAdapter http;
  final waits = <Duration>[];

  setUp(() {
    http = FakeHttpAdapter();
    waits.clear();
  });

  Future<void> sleep(Duration d) async => waits.add(d);

  const me = {
    'user': {'id': 'usr_1', 'email': 'asha@example.com', 'name': 'Asha', 'subjects': ['accountancy'], 'isPremium': true, 'premiumUntil': '2027-07-31T00:00:00.000Z'},
    'needsOnboarding': false,
  };

  test('returns the profile on the first try without waiting', () async {
    http.replies.add(const FakeReply(200, me));
    final result = await loadAuthMe(newApiClient(http), sleep: sleep);
    expect(result.user!.id, 'usr_1');
    expect(result.user!.isPremium, isTrue);
    expect(result.user!.premiumUntil?.year, 2027);
    expect(waits, isEmpty);
  });

  test('retries 429 and 5xx on the documented schedule', () async {
    http.replies
      ..add(const FakeReply(429, {'error': 'Too many requests'}))
      ..add(const FakeReply(500, {'error': 'Failed to resolve auth session'}))
      ..add(const FakeReply(503, {}))
      ..add(const FakeReply(200, me));
    final result = await loadAuthMe(newApiClient(http), sleep: sleep);
    expect(result.user!.email, 'asha@example.com');
    expect(waits, [
      const Duration(milliseconds: 250),
      const Duration(milliseconds: 600),
      const Duration(milliseconds: 1000),
    ]);
  });

  test('the schedule is 0, 250, 600, 1000, 1600, 2400, 3200 ms', () {
    expect(authMeBackoff.map((d) => d.inMilliseconds), [0, 250, 600, 1000, 1600, 2400, 3200]);
  });

  test('gives up after the last wait with the last error', () async {
    http.handler = (_) => const FakeReply(502, {});
    expect(
      () => loadAuthMe(newApiClient(http), sleep: sleep),
      throwsA(isA<ApiError>().having((e) => e.status, 'status', 502)),
    );
  });

  test('an offline error is thrown at once for the cached profile fallback', () async {
    http.replies.add(const FakeReply.network());
    await expectLater(
      loadAuthMe(newApiClient(http), sleep: sleep),
      throwsA(isA<ApiError>().having((e) => e.isOffline, 'offline', isTrue)),
    );
    expect(waits, isEmpty);
    expect(http.requests.length, 1);
  });

  test('a body with no user is retried like a 404', () async {
    http.replies
      ..add(const FakeReply(200, {'user': null, 'needsOnboarding': false}))
      ..add(const FakeReply(200, me));
    final result = await loadAuthMe(newApiClient(http), sleep: sleep);
    expect(result.user!.id, 'usr_1');
  });
}
