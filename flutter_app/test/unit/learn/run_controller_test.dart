import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/connectivity/connectivity_providers.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/features/learn/data/learn_log.dart';
import 'package:mockmob/features/learn/data/learn_store.dart';
import 'package:mockmob/features/learn/data/run_controller.dart';
import 'package:mockmob/features/learn/models/run_item.dart';

import '../core_data/support/fakes.dart';
import '../core_data/support/test_db.dart';
import 'support/learn_fixtures.dart';

class _FakeAuth extends AuthController {
  @override
  AuthSnapshot build() => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'a@b.co');
}

class _FakeNetwork extends NetworkStatusNotifier {
  _FakeNetwork(this.status);

  final NetworkStatus status;

  @override
  NetworkStatus build() => status;
}


void main() {
  late AppDatabase db;
  late DateTime now;
  late StreamController<void> restored;

  setUp(() {
    db = newTestDb();
    now = DateTime.utc(2026, 10, 12, 12, 42);
    restored = StreamController<void>.broadcast();
  });

  tearDown(() async {
    await restored.close();
    await db.close();
  });

  ProviderContainer containerFor(FakeHttpAdapter http, {NetworkStatus network = NetworkStatus.online}) {
    final container = ProviderContainer(overrides: [
      authSnapshotProvider.overrideWith(_FakeAuth.new),
      appDatabaseProvider.overrideWithValue(db),
      apiClientProvider.overrideWithValue(newApiClient(http, now: () => now)),
      nowProvider.overrideWithValue(() => now),
      networkStatusProvider.overrideWith(() => _FakeNetwork(network)),
      networkRestoredProvider.overrideWith((ref) => restored.stream),
    ]);
    addTearDown(container.dispose);
    return container;
  }

  Future<void> until(bool Function() done) async {
    for (var i = 0; i < 600 && !done(); i++) {
      await Future<void>.delayed(Duration.zero);
    }
    expect(done(), isTrue, reason: 'state never settled');
  }

  final provider = runControllerProvider('run-1');

  /// GET run answers [get]; POST events answer [post] (a reply or a function of the body).
  FakeHttpAdapter serverWith({required J get, FakeReply Function(Object? body)? post}) {
    final http = FakeHttpAdapter();
    http.handler = (o) {
      if (o.method == 'GET') return FakeReply(200, get);
      return post == null ? const FakeReply(200, {}) : post(o.data);
    };
    return http;
  }

  List<RecordedRequest> posts(FakeHttpAdapter http) => [for (final r in http.requests) if (r.method == 'POST') r];

  J revealed({int revision = 1}) =>
      runJson(revision: revision, revealed: true, item: revealCard(revealed: true), feedback: {'answer': 'Old share − New share'});

  test('a rating goes to the phone before it is sent and is cleared once the server acknowledges it', () async {
    final http = serverWith(get: revealed());
    final container = containerFor(http);
    container.listen(provider, (_, _) {});
    await until(() => container.read(provider).load == RunLoad.ready);

    final gate = Completer<void>();
    http.hold = gate;
    unawaited(container.read(provider.notifier).rate(3));
    await until(() => posts(http).isNotEmpty);

    final stored = await LearnStore(scopeFor(db)).pending('run-1');
    expect(stored, isNotNull);
    expect(stored!.type, 'rate');
    expect(stored.rating, 3);
    expect(stored.expectedRevision, 1);
    final body = posts(http).single.body! as Map;
    expect(body['requestKey'], stored.requestKey);
    expect(body['expectedRevision'], 1);

    http.handler = (o) => FakeReply(200, runJson(cursor: 1, revision: 2, item: revealCard(id: 'card-2')));
    gate.complete();
    await until(() => container.read(provider).pending == null && !container.read(provider).sending);
    expect(container.read(provider).run!.cursor, 1);
    expect(container.read(provider).ackedAt, now);
    expect(await LearnStore(scopeFor(db)).pending('run-1'), isNull);
  });

  test('killing the app mid-step and reopening sends the same key again, once', () async {
    // First launch: the send fails because the phone is offline, so the rating stays on the phone.
    final http1 = FakeHttpAdapter()
      ..handler = (o) => o.method == 'GET' ? FakeReply(200, revealed()) : const FakeReply.network();
    final first = containerFor(http1, network: NetworkStatus.offline);
    first.listen(provider, (_, _) {});
    await until(() => first.read(provider).load == RunLoad.ready);
    await first.read(provider.notifier).rate(4);
    final waiting = first.read(provider);
    expect(waiting.pending, isNotNull);
    expect(waiting.notice, RunNotice.queuedOffline);
    final key = waiting.pending!.requestKey;
    first.dispose();

    // Second launch (the app was killed): same key, same revision, sent exactly once.
    final http2 = serverWith(get: revealed(), post: (_) => FakeReply(200, runJson(cursor: 1, revision: 2, item: revealCard(id: 'card-2'))));
    final second = containerFor(http2);
    second.listen(provider, (_, _) {});
    await until(() => second.read(provider).run?.cursor == 1);
    final sent = posts(http2);
    expect(sent, hasLength(1));
    expect((sent.single.body! as Map)['requestKey'], key);
    expect((sent.single.body! as Map)['expectedRevision'], 1);
    expect(second.read(provider).pending, isNull);
  });

  test('a stored event the server already applied is dropped, never sent twice', () async {
    final store = LearnStore(scopeFor(db));
    final http1 = FakeHttpAdapter()
      ..handler = (o) => o.method == 'GET' ? FakeReply(200, revealed()) : const FakeReply.network();
    final first = containerFor(http1, network: NetworkStatus.offline);
    first.listen(provider, (_, _) {});
    await until(() => first.read(provider).load == RunLoad.ready);
    await first.read(provider.notifier).rate(2);
    expect(await store.pending('run-1'), isNotNull);
    first.dispose();

    // The earlier request did reach the server: the run is already at revision 2.
    final http2 = serverWith(get: runJson(cursor: 1, revision: 2, item: revealCard(id: 'card-2')));
    final second = containerFor(http2);
    second.listen(provider, (_, _) {});
    await until(() => second.read(provider).load == RunLoad.ready && second.read(provider).run!.revision == 2);
    await Future<void>.delayed(Duration.zero);
    expect(posts(http2), isEmpty);
    expect(await store.pending('run-1'), isNull);
  });

  test('offline, a rating waits on the phone but an answer that needs the server is not queued', () async {
    final http = FakeHttpAdapter()..handler = (o) => o.method == 'GET' ? FakeReply(200, runJson()) : const FakeReply.network();
    final container = containerFor(http, network: NetworkStatus.offline);
    container.listen(provider, (_, _) {});
    await until(() => container.read(provider).load == RunLoad.ready);
    await container.read(provider.notifier).reveal();
    expect(container.read(provider).notice, RunNotice.connectToReveal);
    expect(container.read(provider).pending, isNull);
    expect(posts(http), isEmpty);
  });

  test('a second step cannot be queued while one is waiting', () async {
    final http = FakeHttpAdapter()..handler = (o) => o.method == 'GET' ? FakeReply(200, revealed()) : const FakeReply.network();
    final container = containerFor(http, network: NetworkStatus.offline);
    container.listen(provider, (_, _) {});
    await until(() => container.read(provider).load == RunLoad.ready);
    final ctl = container.read(provider.notifier);
    await ctl.rate(3);
    final key = container.read(provider).pending!.requestKey;
    await ctl.rate(1);
    await ctl.advance();
    expect(container.read(provider).pending!.requestKey, key);
    expect(container.read(provider).pending!.rating, 3);
  });

  test('a conflict is retried silently once at the current revision', () async {
    var postCount = 0;
    final http = FakeHttpAdapter()
      ..handler = (o) {
        if (o.method == 'GET') {
          // After the conflict the server shows the same card at revision 1, still hidden.
          return FakeReply(200, postCount == 0 ? runJson() : runJson(revision: 1));
        }
        postCount++;
        if (postCount == 1) return const FakeReply(409, {'error': 'REVISION_CONFLICT'});
        return FakeReply(200, revealed(revision: 2));
      };
    final container = containerFor(http);
    container.listen(provider, (_, _) {});
    await until(() => container.read(provider).load == RunLoad.ready);
    await container.read(provider.notifier).reveal();
    await until(() => container.read(provider).run?.revealed == true);
    final sent = posts(http).map((r) => r.body! as Map).toList();
    expect(sent, hasLength(2));
    expect(sent[0]['requestKey'], isNot(sent[1]['requestKey']));
    expect(sent[1]['expectedRevision'], 1);
    expect(container.read(provider).pending, isNull);
    expect(container.read(provider).notice, RunNotice.none);
  });

  test('a second conflict is not retried again and shows the current state', () async {
    final http = FakeHttpAdapter()
      ..handler = (o) => o.method == 'GET' ? FakeReply(200, runJson(revision: 1)) : const FakeReply(409, {'error': 'REVISION_CONFLICT'});
    final container = containerFor(http);
    container.listen(provider, (_, _) {});
    await until(() => container.read(provider).load == RunLoad.ready);
    await container.read(provider.notifier).reveal();
    await until(() => !container.read(provider).sending && container.read(provider).pending == null);
    expect(posts(http), hasLength(2));
    expect(container.read(provider).run!.revision, 1);
    expect(await LearnStore(scopeFor(db)).pending('run-1'), isNull);
  });

  test('a step answered on another device is dropped with a notice and logged without the answer', () async {
    LearnLog.clear();
    var posted = false;
    final http = FakeHttpAdapter()
      ..handler = (o) {
        if (o.method == 'GET') {
          // After the conflict the server has moved on to the next card.
          return FakeReply(200, posted ? runJson(revision: 3, cursor: 1, item: revealCard(id: 'card-9')) : runJson());
        }
        posted = true;
        return const FakeReply(409, {'error': 'REVISION_CONFLICT'});
      };
    final container = containerFor(http);
    container.listen(provider, (_, _) {});
    await until(() => container.read(provider).load == RunLoad.ready);
    await container.read(provider.notifier).reveal();
    await until(() => container.read(provider).notice == RunNotice.supersededElsewhere);
    final ui = container.read(provider);
    expect(posts(http), hasLength(1));
    expect(ui.run!.currentItem!.id, 'card-9');
    expect(ui.pending, isNull);
    final sentKey = (posts(http).single.body! as Map)['requestKey'] as String;
    expect(LearnLog.lines.single, contains('reveal'));
    expect(LearnLog.lines.single, contains(sentKey));
  });

  test('a step type this build does not know can be skipped with continue', () async {
    final http = serverWith(
      get: runJson(item: {'id': 'card-x', 'type': 'drag_match', 'prompt': 'Match the pairs'}),
      post: (_) => FakeReply(200, runJson(revision: 1, cursor: 1, item: revealCard(id: 'card-2'))),
    );
    final container = containerFor(http);
    container.listen(provider, (_, _) {});
    await until(() => container.read(provider).load == RunLoad.ready);
    await container.read(provider.notifier).advance();
    await until(() => container.read(provider).run?.currentItem?.id == 'card-2');
    expect((posts(http).single.body! as Map)['type'], 'continue');
  });

  test('STUDY_CONTENT_CHANGED on an event replaces the run and clears what was waiting', () async {
    final http = serverWith(get: runJson(), post: (_) => const FakeReply(503, {'error': 'STUDY_CONTENT_CHANGED'}));
    final container = containerFor(http);
    container.listen(provider, (_, _) {});
    await until(() => container.read(provider).load == RunLoad.ready);
    await container.read(provider.notifier).reveal();
    await until(() => container.read(provider).load == RunLoad.changed);
    expect(await LearnStore(scopeFor(db)).pending('run-1'), isNull);
    expect(await LearnStore(scopeFor(db)).run('run-1'), isNull);
  });

  test('an invalidated run points at the replacement lesson', () async {
    final http = serverWith(get: {
      'id': 'run-1',
      'mode': 'learn',
      'state': 'invalidated',
      'title': 'Sacrificing and gaining ratios',
      'units': [
        {'id': 'acc-sacrifice', 'title': 'Sacrificing and gaining ratios'}
      ],
    });
    final container = containerFor(http);
    container.listen(provider, (_, _) {});
    await until(() => container.read(provider).load == RunLoad.changed);
    expect(container.read(provider).replacements.single.id, 'acc-sacrifice');
  });

  test('the last acknowledged event ends the run and the kept copy is dropped', () async {
    final http = serverWith(
      get: runJson(cursor: 7, revision: 15, revealed: true, item: revealCard(id: 'card-8', revealed: true)),
      post: (_) => FakeReply(200, runJson(state: 'complete', cursor: 8, revision: 16, item: null, updatedAt: '2026-10-12T12:42:00.000Z')),
    );
    final container = containerFor(http);
    container.listen(provider, (_, _) {});
    await until(() => container.read(provider).load == RunLoad.ready);
    await container.read(provider.notifier).rate(3);
    await until(() => container.read(provider).run?.isComplete == true);
    expect(container.read(provider).ackedAt, now);
    expect(await LearnStore(scopeFor(db)).run('run-1'), isNull);
  });

  test('a cached run opens offline and shows the step that was on the phone', () async {
    await LearnStore(scopeFor(db)).putRun('run-1', runJson(cursor: 2, revision: 4));
    final http = FakeHttpAdapter()..handler = (_) => const FakeReply.network();
    final container = containerFor(http, network: NetworkStatus.offline);
    container.listen(provider, (_, _) {});
    await until(() => container.read(provider).run != null);
    await Future<void>.delayed(const Duration(milliseconds: 20));
    expect(container.read(provider).load, RunLoad.ready);
    expect(container.read(provider).run!.cursor, 2);
  });

  test('with no copy and no network the run is reported as not on this phone', () async {
    final http = FakeHttpAdapter()..handler = (_) => const FakeReply.network();
    final container = containerFor(http, network: NetworkStatus.offline);
    container.listen(provider, (_, _) {});
    await until(() => container.read(provider).load == RunLoad.offlineMissing);
  });

  test('coming back online sends the waiting rating', () async {
    var online = false;
    final http = FakeHttpAdapter()
      ..handler = (o) {
        if (o.method == 'GET') return FakeReply(200, revealed());
        return online ? FakeReply(200, runJson(cursor: 1, revision: 2, item: revealCard(id: 'card-2'))) : const FakeReply.network();
      };
    final container = containerFor(http, network: NetworkStatus.offline);
    container.listen(provider, (_, _) {});
    await until(() => container.read(provider).load == RunLoad.ready);
    await container.read(provider.notifier).rate(3);
    expect(container.read(provider).pending, isNotNull);
    online = true;
    restored.add(null);
    await until(() => container.read(provider).run?.cursor == 1);
    expect(container.read(provider).pending, isNull);
    // The failed attempts and the one that got through all carried the same key.
    expect({for (final r in posts(http)) (r.body! as Map)['requestKey']}, hasLength(1));
  });
}

/// A scope for reading what the controller wrote, outside Riverpod.
LocalScope scopeFor(AppDatabase db) => LocalScope(db, () => 'u1', () => DateTime.utc(2026, 10, 12));
