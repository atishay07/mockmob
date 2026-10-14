import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/connectivity/connectivity_providers.dart';
import 'package:mockmob/core/models/json_helpers.dart';
import 'package:mockmob/core/models/study.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/features/learn/data/learn_log.dart';
import 'package:mockmob/features/learn/data/learn_store.dart';
import 'package:mockmob/features/learn/data/pending_event.dart';
import 'package:mockmob/features/learn/data/run_controller.dart';
import 'package:mockmob/features/learn/data/study_api.dart';

import '../core_data/support/fakes.dart';
import '../core_data/support/test_db.dart';
import 'support/learn_fixtures.dart';

/// Regression tests for ROBUSTNESS.json review-02: `_send` only caught `ApiError`, so any other
/// failure (an unreadable reply, a write to the phone's own store) left `sending` true with the
/// event pending, the retry timer never started and the step showed a spinner until a restart.

class _FakeAuth extends AuthController {
  @override
  AuthSnapshot build() => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'a@b.co');
}

class _FakeNetwork extends NetworkStatusNotifier {
  @override
  NetworkStatus build() => NetworkStatus.online;
}

/// A study API whose event endpoint fails with something that is not an `ApiError`.
class _BrokenEventsApi extends StudyApi {
  _BrokenEventsApi(super.client, this.failure);

  final Object Function() failure;
  int calls = 0;
  bool broken = true;

  @override
  Future<StudyRun> sendEvent(String runId, PendingEvent event) {
    calls++;
    if (broken) throw failure();
    return super.sendEvent(runId, event);
  }
}

/// A store whose writes can be made to fail, like a full disk or a locked database.
class _FlakyStore extends LearnStore {
  _FlakyStore(super.scope);

  bool failPutPending = false;
  bool failClearPending = false;
  bool failPutRun = false;

  @override
  Future<void> putPending(String runId, PendingEvent event) =>
      failPutPending ? Future.error(StateError('disk full')) : super.putPending(runId, event);

  @override
  Future<void> clearPending(String runId) =>
      failClearPending ? Future.error(StateError('disk full')) : super.clearPending(runId);

  @override
  Future<void> putRun(String runId, Json json) =>
      failPutRun ? Future.error(StateError('disk full')) : super.putRun(runId, json);
}

void main() {
  late AppDatabase db;
  late DateTime now;
  late FakeHttpAdapter http;
  final provider = runControllerProvider('run-1');

  setUp(() {
    db = newTestDb();
    now = DateTime.utc(2026, 10, 14, 12);
    LearnLog.clear();
    RunController.retryBackoff = const [Duration(milliseconds: 20)];
    http = FakeHttpAdapter()
      ..handler = (o) => o.method == 'GET'
          ? FakeReply(200, runJson(revision: 1, revealed: true, item: revealCard(revealed: true)))
          : FakeReply(200, runJson(cursor: 1, revision: 2, item: revealCard(id: 'card-2')));
  });

  tearDown(() async {
    RunController.retryBackoff = [
      const Duration(seconds: 4),
      const Duration(seconds: 10),
      const Duration(seconds: 30),
      const Duration(seconds: 60),
    ];
    await db.close();
  });

  ProviderContainer container(List<Override> extra) {
    final c = ProviderContainer(
      overrides: [
        authSnapshotProvider.overrideWith(_FakeAuth.new),
        appDatabaseProvider.overrideWithValue(db),
        apiClientProvider.overrideWithValue(newApiClient(http, now: () => now)),
        nowProvider.overrideWithValue(() => now),
        networkStatusProvider.overrideWith(_FakeNetwork.new),
        networkRestoredProvider.overrideWith((ref) => const Stream<void>.empty()),
        ...extra,
      ],
    );
    addTearDown(c.dispose);
    return c;
  }

  Future<void> until(bool Function() done) async {
    for (var i = 0; i < 800 && !done(); i++) {
      await Future<void>.delayed(const Duration(milliseconds: 1));
    }
    expect(done(), isTrue, reason: 'state never settled');
  }

  Future<ProviderContainer> ready(List<Override> extra) async {
    final c = container(extra);
    c.listen(provider, (_, _) {});
    await until(() => c.read(provider).load == RunLoad.ready);
    return c;
  }

  test('an unreadable reply ends the spinner, keeps the rating and sends it again by itself', () async {
    final api = _BrokenEventsApi(newApiClient(http, now: () => now), () => StateError('unexpected payload'));
    final c = await ready([studyApiProvider.overrideWithValue(api)]);

    // Nothing escapes the call.
    await c.read(provider.notifier).rate(3);

    final stuck = c.read(provider);
    expect(stuck.sending, isFalse, reason: 'the spinner must end');
    expect(stuck.notice, RunNotice.sendFailed);
    expect(stuck.pending, isNotNull, reason: 'a rating is kept on the phone');
    expect(LearnLog.lines.last, contains('failed unexpectedly (StateError)'));

    // The retry timer was started (it was not before the fix): once the server reads again the
    // same event goes through without a restart.
    api.broken = false;
    await until(() => c.read(provider).run?.cursor == 1);
    expect(c.read(provider).pending, isNull);
    expect(c.read(provider).sending, isFalse);
  });

  test('an unreadable reply to a continue keeps it on the phone', () async {
    final api = _BrokenEventsApi(newApiClient(http, now: () => now), () => const FormatException('bad json'));
    final c = await ready([studyApiProvider.overrideWithValue(api)]);

    await c.read(provider.notifier).advance();

    final ui = c.read(provider);
    expect(ui.sending, isFalse);
    expect(ui.notice, RunNotice.sendFailed);
    // A continue can wait offline, so it stays for the retry; a reveal or answer is cleared.
    expect(await LearnStore(scopeFor(db)).pending('run-1'), isNotNull);
  });

  test('an unreadable reply to a reveal lets the student tap again', () async {
    http.handler = (o) => FakeReply(200, runJson(revision: 1, item: revealCard()));
    final api = _BrokenEventsApi(newApiClient(http, now: () => now), () => const FormatException('bad json'));
    final c = await ready([studyApiProvider.overrideWithValue(api)]);

    await c.read(provider.notifier).reveal();

    final ui = c.read(provider);
    expect(ui.sending, isFalse);
    expect(ui.pending, isNull, reason: 'a reveal needs the server and is not kept');
    expect(ui.notice, RunNotice.sendFailed);
    expect(await LearnStore(scopeFor(db)).pending('run-1'), isNull);

    api.broken = false;
    http.handler = (o) => o.method == 'GET'
        ? FakeReply(200, runJson(revision: 1, item: revealCard()))
        : FakeReply(200, runJson(revision: 2, revealed: true, item: revealCard(revealed: true)));
    await c.read(provider.notifier).reveal();
    expect(c.read(provider).run!.revealed, isTrue);
  });

  test('a failed write to the phone after the server acknowledged does not hide the acknowledgement', () async {
    final store = _FlakyStore(scopeFor(db));
    final c = await ready([learnStoreProvider.overrideWithValue(store)]);

    store
      ..failClearPending = true
      ..failPutRun = true;
    await c.read(provider.notifier).rate(3);

    final ui = c.read(provider);
    expect(ui.sending, isFalse);
    expect(ui.run!.cursor, 1, reason: 'the server moved on, so the screen does too');
    expect(ui.pending, isNull);
    expect(LearnLog.lines.join('\n'), contains('could not clearPending on this phone (StateError)'));
  });

  test('a failed write of the pending step sends nothing and frees the key', () async {
    final store = _FlakyStore(scopeFor(db));
    final c = await ready([learnStoreProvider.overrideWithValue(store)]);

    store.failPutPending = true;
    await c.read(provider.notifier).rate(2);

    final ui = c.read(provider);
    expect(ui.sending, isFalse);
    expect(ui.pending, isNull);
    expect(ui.notice, RunNotice.sendFailed);
    expect([for (final r in http.requests) if (r.method == 'POST') r], isEmpty);

    // The next tap works.
    store.failPutPending = false;
    await c.read(provider.notifier).rate(2);
    expect(c.read(provider).run!.cursor, 1);
  });

  test('two taps in the same frame send one event', () async {
    final gate = Completer<void>();
    final c = await ready(const []);
    http.hold = gate;
    final ctl = c.read(provider.notifier);
    unawaited(ctl.rate(3));
    // The second tap lands before the first has reached the network: refused, not queued.
    unawaited(ctl.rate(1));
    expect(c.read(provider).sending, isTrue, reason: 'the key shows its spinner on the next frame');
    gate.complete();
    await until(() => c.read(provider).run?.cursor == 1);
    final posts = [for (final r in http.requests) if (r.method == 'POST') r];
    expect(posts, hasLength(1));
    expect((posts.single.body! as Map)['rating'], 3);
  });

  test('a run reply the app cannot read does not leave the skeleton standing', () async {
    final failing = _BrokenRunApi(newApiClient(http, now: () => now));
    final c = container([studyApiProvider.overrideWithValue(failing)]);
    c.listen(provider, (_, _) {});
    await until(() => c.read(provider).load != RunLoad.loading);
    expect(c.read(provider).load, RunLoad.unavailable);
  });
}

class _BrokenRunApi extends StudyApi {
  _BrokenRunApi(super.client);

  @override
  Future<StudyRun> run(String runId) => Future.error(StateError('unexpected payload'));
}

LocalScope scopeFor(AppDatabase db) => LocalScope(db, () => 'u1', () => DateTime.utc(2026, 10, 14));
