// Regression tests for the core sync bug hunt (14 Oct 2026): sync-storage-api-02, 03, 08, 09.
import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/connectivity/connectivity_monitor.dart';
import 'package:mockmob/core/connectivity/connectivity_providers.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/background_tasks.dart';
import 'package:mockmob/core/sync/outbox_repository.dart';
import 'package:mockmob/core/sync/sync_providers.dart';

import 'support/fakes.dart';
import 'support/test_db.dart';

/// Fails every request the way a given network would.
class _FailingAdapter implements HttpClientAdapter {
  _FailingAdapter(this.type);

  final DioExceptionType type;

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async =>
      throw DioException(requestOptions: options, type: type);

  @override
  void close({bool force = false}) {}
}

class _ManualTimer implements Timer {
  _ManualTimer(this.delay, this.cb);

  final Duration delay;
  final void Function() cb;
  bool active = true;

  @override
  void cancel() => active = false;

  @override
  bool get isActive => active;

  @override
  int get tick => 0;
}

Future<void> _settle([int rounds = 20]) async {
  for (var i = 0; i < rounds; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  group('sync-storage-api-02: a slow network is not called offline', () {
    test('a slow reply still proves the network; only failing to connect is offline', () async {
      expect(await pingForTest('https://ping.test', adapter: _FailingAdapter(DioExceptionType.receiveTimeout)), isTrue);
      expect(await pingForTest('https://ping.test', adapter: _FailingAdapter(DioExceptionType.connectionTimeout)), isFalse);
      expect(await pingForTest('https://ping.test', adapter: _FailingAdapter(DioExceptionType.connectionError)), isFalse);
      expect(pingTimeout, greaterThanOrEqualTo(const Duration(seconds: 10)));
    });

    test('after the work clears, a slow recovery ping still lifts a wrong offline verdict', () async {
      final radio = StreamController<bool>();
      final timers = <_ManualTimer>[];
      var pending = true;
      final results = [false, true];
      var restored = 0;
      final monitor = ConnectivityMonitor(
        radioPresent: radio.stream,
        ping: () async {
          final ok = results.removeAt(0);
          // The session closed while the ping was out: nothing is waiting when it fails.
          if (!ok) pending = false;
          return ok;
        },
        hasPendingWork: () => pending,
        timerFactory: (d, cb) {
          final t = _ManualTimer(d, cb);
          timers.add(t);
          return t;
        },
      );
      addTearDown(() async {
        await monitor.dispose();
        await radio.close();
      });
      monitor.restored.listen((_) => restored++);
      radio.add(true);
      await _settle();
      monitor.onNetworkError();
      await _settle();
      expect(monitor.status.value, NetworkStatus.offline);
      expect(pending, isFalse);

      // Nothing is waiting any more, but the radio is still there: a recovery ping follows.
      final next = timers.lastWhere((t) => t.active);
      expect(next.delay, const Duration(seconds: 60));
      next.active = false;
      next.cb();
      await _settle();
      expect(monitor.status.value, NetworkStatus.online);
      expect(restored, 1);
    });

    test('a recovery ping is the slow one, and new work speeds it up', () async {
      final radio = StreamController<bool>();
      final timers = <_ManualTimer>[];
      var pending = true;
      final monitor = ConnectivityMonitor(
        radioPresent: radio.stream,
        ping: () async => false,
        hasPendingWork: () => pending,
        timerFactory: (d, cb) {
          final t = _ManualTimer(d, cb);
          timers.add(t);
          return t;
        },
      );
      addTearDown(() async {
        await monitor.dispose();
        await radio.close();
      });
      radio.add(true);
      await _settle();
      monitor.onNetworkError();
      await _settle();
      pending = false;
      final first = timers.lastWhere((t) => t.active)..active = false;
      first.cb();
      await _settle();
      final recovery = timers.lastWhere((t) => t.active);
      expect(recovery.delay, const Duration(seconds: 60));

      pending = true;
      monitor.pendingWorkChanged();
      expect(recovery.active, isFalse);
      expect(timers.lastWhere((t) => t.active).delay, const Duration(seconds: 5));
    });
  });

  group('sync-storage-api-03: an unknown failure never discards queued work', () {
    test('408 and 425 are worth another try; unknown failures are not refusals', () {
      expect(ApiError.fromResponse(408, const {}).isRetryable, isTrue);
      expect(ApiError.fromResponse(425, const {}).isRetryable, isTrue);
      expect(ApiError.fromResponse(418, const {}).isDefinitiveRefusal, isFalse);
      expect(ApiError.fromDio(DioException(requestOptions: RequestOptions(path: '/x'), error: StateError('keystore'))).isDefinitiveRefusal, isFalse);
      expect(ApiError.fromResponse(422, const {}).isDefinitiveRefusal, isTrue);
      expect(ApiError.fromResponse(400, const {}).isDefinitiveRefusal, isTrue);
    });

    late AppDatabase db;
    late OutboxRepository repo;
    late FakeHttpAdapter http;
    late OutboxFlusher flusher;
    final now = DateTime.utc(2026, 10, 12, 12);

    setUp(() {
      db = newTestDb();
      repo = OutboxRepository(LocalScope(db, () => 'u1', () => now));
      http = FakeHttpAdapter();
      flusher = OutboxFlusher(repository: repo, api: newApiClient(http, now: () => now), now: () => now);
    });

    tearDown(() => db.close());

    for (final status in [408, 410, 418, 425]) {
      test('a $status keeps the write for later', () async {
        await repo.enqueue(kind: 'study_event', method: 'POST', path: '/api/study/runs/r1/events', body: {'n': 1});
        http.replies.add(FakeReply(status, const {}));
        final results = await flusher.flush();
        expect(results.single.kind, OutboxResultKind.retryLater);
        expect((await repo.pending()).length, 1);
      });
    }
  });

  group('sync-storage-api-08: a 429 on a write does not hold reads', () {
    test('the result opens while the events PUT is held', () async {
      final http = FakeHttpAdapter();
      final api = newApiClient(http, now: () => DateTime.utc(2026, 10, 12, 12));
      http.replies.add(const FakeReply(429, {}, {'retry-after': '120'}));
      await expectLater(api.put('/api/sessions', body: const {}), throwsA(isA<ApiError>()));
      expect(http.requests.length, 1);

      // Reading the attempt is not held.
      http.replies.add(const FakeReply(200, {'id': 'a1'}));
      final r = await api.get('/api/attempts/a1', options: const ApiOptions(retries: 0));
      expect(r.status, 200);
      expect(http.requests.length, 2);

      // Another write of the family still waits, with no network call.
      await expectLater(api.post('/api/attempts', body: const {}), throwsA(isA<ApiError>().having((e) => e.isRateLimited, 'rate limited', isTrue)));
      expect(http.requests.length, 2);
      expect(api.heldFor('/api/sessions', method: 'PUT'), isNotNull);
      expect(api.heldFor('/api/attempts/a1'), isNull);
    });
  });

  group('sync-storage-api-09: one outbox flush at a time', () {
    test('overlapping flushes send each item once', () async {
      final db = newTestDb();
      addTearDown(db.close);
      final now = DateTime.utc(2026, 10, 12, 12);
      final repo = OutboxRepository(LocalScope(db, () => 'u1', () => now));
      final http = FakeHttpAdapter();
      final coordinator = SyncCoordinator(
        repository: repo,
        flusher: OutboxFlusher(repository: repo, api: newApiClient(http, now: () => now), now: () => now),
        scheduler: WorkmanagerScheduler(now: () => now),
        userId: () => 'u1',
        isOnline: () => true,
      );

      final hold = Completer<void>();
      http.hold = hold;
      await coordinator.enqueue(kind: 'k', method: 'POST', path: '/api/study/runs/r1/events', body: {'n': 1}, idempotencyKey: 'first-key-000001');
      for (var i = 0; i < 200 && http.requests.isEmpty; i++) {
        await Future<void>.delayed(Duration.zero);
      }
      expect(http.requests.length, 1);
      await coordinator.enqueue(kind: 'k', method: 'POST', path: '/api/study/runs/r1/events', body: {'n': 2}, idempotencyKey: 'second-key-00002');
      await _settle();
      http.hold = null;
      hold.complete();
      await coordinator.flushNow();
      await _settle();

      final keys = [for (final r in http.requests) r.headers['Idempotency-Key']];
      expect(keys, ['first-key-000001', 'second-key-00002']);
      expect(await repo.pending(), isEmpty);
    });

    test('a failing flush started by an enqueue is not an unhandled error', () async {
      final db = newTestDb();
      addTearDown(db.close);
      final now = DateTime.utc(2026, 10, 12, 12);
      final repo = OutboxRepository(LocalScope(db, () => 'u1', () => now));
      final coordinator = SyncCoordinator(
        repository: repo,
        flusher: _ThrowingFlusher(repo),
        scheduler: WorkmanagerScheduler(now: () => now),
        userId: () => 'u1',
        isOnline: () => true,
      );
      await coordinator.enqueue(kind: 'k', method: 'POST', path: '/x', idempotencyKey: 'third-key-000003');
      await _settle();
      expect((await repo.pending()).length, 1);
    });
  });
}

class _ThrowingFlusher extends OutboxFlusher {
  _ThrowingFlusher(OutboxRepository repo) : super(repository: repo, api: newApiClient(FakeHttpAdapter()));

  @override
  Future<List<OutboxResult>> flush() async => throw StateError('signed out mid-flush');
}
