// Ask Mobi's first record ask after a cold start (v15.1 emulator walk, 18 Oct): "Where am I losing
// marks?" was sent to the server because the record had not reached the phone yet; a slow staging
// reply then read "You are offline" with the network up. A fixed record ask now waits for the record
// and is answered on the phone, and no answer while the phone is online says the server was slow.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/connectivity/connectivity_monitor.dart' show NetworkStatus;
import 'package:mockmob/core/connectivity/connectivity_providers.dart' show NetworkStatusNotifier, networkStatusProvider;
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/insights/copy.dart';
import 'package:mockmob/features/insights/data/ask_controller.dart';
import 'package:mockmob/features/insights/data/insights_models.dart';
import 'package:mockmob/features/insights/data/insights_repository.dart';

import '../core_data/support/fakes.dart';
import 'support/insights_fixtures.dart';

class _FakeAuth extends AuthController {
  @override
  AuthSnapshot build() => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1');
}

/// The record on its way: nothing on the phone until [arrive] (or [fail]).
class _LateInsights extends InsightsRepository {
  final Completer<PrepInsights?> _done = Completer();
  int reads = 0;

  void arrive() => _done.complete(rich());
  void fail() => _done.complete(null);

  @override
  RemoteState<PrepInsights> build() => const RemoteState(loading: true);

  @override
  Future<void> refresh({bool force = false}) async {
    reads++;
    final v = await _done.future;
    state = v == null ? const RemoteState(error: ApiError(kind: ApiErrorKind.server, code: 'server_error', status: 500)) : RemoteState(value: v);
  }
}

class _Credits extends CreditsRepository {
  @override
  RemoteState<AiCredits> build() => const RemoteState();

  @override
  Future<void> refresh({bool force = false}) async {}
}

class _Network extends NetworkStatusNotifier {
  _Network(this.status);

  final NetworkStatus status;

  @override
  NetworkStatus build() => status;
}

void main() {
  late FakeHttpAdapter http;
  late ProviderContainer c;
  late _LateInsights insights;
  final now = DateTime.utc(2026, 10, 18, 12);

  ProviderContainer make({NetworkStatus network = NetworkStatus.online}) => ProviderContainer(overrides: [
        authSnapshotProvider.overrideWith(_FakeAuth.new),
        apiClientProvider.overrideWithValue(newApiClient(http, now: () => now)),
        nowProvider.overrideWithValue(() => now),
        insightsRepositoryProvider.overrideWith(() => insights = _LateInsights()),
        creditsRepositoryProvider.overrideWith(_Credits.new),
        networkStatusProvider.overrideWith(() => _Network(network)),
      ]);

  setUp(() => http = FakeHttpAdapter());
  tearDown(() => c.dispose());

  AskController ctl() => c.read(askControllerProvider.notifier);
  List<AskMessage> messages() => c.read(askControllerProvider).messages;
  bool chatSent() => http.requests.any((r) => r.path.contains('/mentor/chat'));

  group('a record ask before the record is on the phone', () {
    test('waits for the record and is answered on the phone: nothing goes to the network', () async {
      c = make();
      c.read(insightsRepositoryProvider);
      final sending = ctl().send(InsightsCopy.promptLosing);
      await Future<void>.delayed(Duration.zero);
      expect(messages().last.sending, isTrue, reason: 'Mobi is thinking while the record arrives');
      insights.arrive();
      expect(await sending, isNull);
      expect(messages().last.origin, AskOrigin.phone);
      expect(messages().last.text, isNotEmpty);
      expect(chatSent(), isFalse, reason: 'a record ask never reaches /api/ai/mentor/chat while the record is on its way');
    });

    test('every fixed record ask is one of them; a written question is not', () {
      for (final t in [InsightsCopy.promptLosing, InsightsCopy.promptChapter, InsightsCopy.promptPace, InsightsCopy.promptWeek, InsightsCopy.promptChanges, InsightsCopy.promptBlank]) {
        expect(AskController.isRecordAsk(t), isTrue, reason: t);
      }
      expect(AskController.isRecordAsk('What is goodwill?'), isFalse);
    });

    test('a record that does not come lets the server answer instead', () async {
      c = make();
      c.read(insightsRepositoryProvider);
      http.handler = (o) => const FakeReply(200, {'ok': true, 'sessionId': 's-1', 'reply': 'From your record.', 'origin': 'record', 'actions': []});
      final sending = ctl().send(InsightsCopy.promptLosing);
      await Future<void>.delayed(Duration.zero);
      insights.fail();
      expect(await sending, isNull);
      expect(chatSent(), isTrue);
      expect(messages().last.origin, AskOrigin.record);
    });

    test('a written question does not wait for the record', () async {
      c = make();
      c.read(insightsRepositoryProvider);
      http.handler = (o) => const FakeReply(200, {'ok': true, 'sessionId': 's-1', 'reply': 'Goodwill is paid for future profits.', 'origin': 'model', 'actions': []});
      expect(await ctl().send('What is goodwill?'), isNull);
      expect(chatSent(), isTrue);
    });
  });

  group('no answer is "offline" only when the phone is offline', () {
    test('the mapping', () {
      const timeout = ApiError(kind: ApiErrorKind.timeout, code: 'timeout');
      const network = ApiError(kind: ApiErrorKind.network, code: 'network');
      expect(askFailureFor(timeout), AskFailure.slow, reason: 'it connected; the server was slow');
      expect(askFailureFor(timeout, network: NetworkStatus.online), AskFailure.slow);
      expect(askFailureFor(timeout, network: NetworkStatus.offline), AskFailure.offline);
      expect(askFailureFor(network), AskFailure.offline);
      expect(askFailureFor(network, network: NetworkStatus.online), AskFailure.slow);
      expect(askFailureFor(network, network: NetworkStatus.offline), AskFailure.offline);
    });

    test('online, a lost reply says it is taking longer and Send again can still answer it', () async {
      c = make();
      // The shell watches the connection monitor; the controller reads it only when it is running.
      c.read(networkStatusProvider);
      http.handler = (o) => const FakeReply.network();
      expect(await ctl().send('What is goodwill?'), AskFailure.slow);
      expect(InsightsCopy.failSlow, 'Taking longer than usual. Send it again in a moment.');
      final first = messages().last.requestId;
      expect(first, isNotNull);
      http.handler = (o) => const FakeReply(200, {'ok': true, 'sessionId': 's-1', 'reply': 'Goodwill is paid for future profits.', 'origin': 'model', 'actions': []});
      await ctl().retry();
      expect(messages().last.failure, isNull);
    });

    test('offline, it still says offline', () async {
      c = make(network: NetworkStatus.offline);
      c.read(networkStatusProvider);
      http.handler = (o) => const FakeReply.network();
      expect(await ctl().send('What is goodwill?'), AskFailure.offline);
    });
  });
}
