import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/connectivity/connectivity_providers.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/features/learn/data/learn_store.dart';
import 'package:mockmob/features/learn/data/lesson_loader.dart';
import 'package:mockmob/features/learn/data/pending_event.dart';
import 'package:mockmob/features/learn/data/run_starter.dart';
import 'package:mockmob/features/learn/data/study_api.dart';

import '../core_data/support/fakes.dart';
import '../core_data/support/test_db.dart';

class _MemoryPrefs implements PrefsStore {
  final Map<String, Object> values = {};

  @override
  Future<bool?> getBool(String key) async => values[key] as bool?;
  @override
  Future<int?> getInt(String key) async => values[key] as int?;
  @override
  Future<String?> getString(String key) async => values[key] as String?;
  @override
  Future<List<String>?> getStringList(String key) async => (values[key] as List<String>?);
  @override
  Future<void> setBool(String key, bool value) async => values[key] = value;
  @override
  Future<void> setInt(String key, int value) async => values[key] = value;
  @override
  Future<void> setString(String key, String value) async => values[key] = value;
  @override
  Future<void> setStringList(String key, List<String> value) async => values[key] = value;
  @override
  Future<void> remove(String key) async => values.remove(key);
}

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

Map<String, dynamic> lesson(String id, {String subject = 'accountancy', String version = '2', String hash = 'h1'}) => {
      'id': id,
      'subject': subject,
      'version': version,
      'contentHash': hash,
      'title': 'Lesson $id',
      'blocks': [
        {'id': 'b1', 'type': 'reading', 'body': 'x' * 2000},
      ],
    };

void main() {
  late AppDatabase db;
  late LearnStore store;

  setUp(() {
    db = newTestDb();
    store = LearnStore(LocalScope(db, () => 'u1', () => DateTime.utc(2026, 10, 12)));
  });

  tearDown(() => db.close());

  test('a lesson is kept by id, version and content hash, with its size', () async {
    await store.putLesson(lesson('a'));
    final kept = (await store.lesson('a'))!;
    expect(kept.version, '2');
    expect(kept.contentHash, 'h1');
    expect(kept.subject, 'accountancy');
    expect(kept.sizeBytes, greaterThan(2000));
    expect(await store.lesson('missing'), isNull);
  });

  test('size is summed per subject and a subject can be dropped', () async {
    await store.putLesson(lesson('a'));
    await store.putLesson(lesson('b'));
    await store.putLesson(lesson('c', subject: 'english'));
    final sizes = await store.sizeBySubject();
    expect(sizes.keys, unorderedEquals(['accountancy', 'english']));
    expect(sizes['accountancy']!, greaterThan(sizes['english']!));
    await store.dropSubject('accountancy');
    expect(await store.lesson('a'), isNull);
    expect(await store.lesson('c'), isNotNull);
  });

  test('a lesson whose version changed on the server is dropped, the rest stay', () async {
    await store.putLesson(lesson('a', version: '2'));
    await store.putLesson(lesson('b', version: '2'));
    await store.dropChanged({'a': '3', 'b': '2'});
    expect(await store.lesson('a'), isNull);
    expect(await store.lesson('b'), isNotNull);
  });

  test('one pending event per run survives a restart and is cleared on demand', () async {
    final event = PendingEvent.create(expectedRevision: 4, itemId: 'card-1', type: 'rate', rating: 3);
    await store.putPending('run-1', event);
    final reloaded = (await store.pending('run-1'))!;
    expect(reloaded.requestKey, event.requestKey);
    expect(reloaded.expectedRevision, 4);
    expect(reloaded.rating, 3);
    expect(await store.pendingRunIds(), ['run-1']);
    await store.clearPending('run-1');
    expect(await store.pending('run-1'), isNull);
    expect(await store.pendingRunIds(), isEmpty);
  });

  test('request keys fit the server pattern', () {
    final pattern = RegExp(r'^[a-zA-Z0-9_-]{12,100}$');
    for (var i = 0; i < 20; i++) {
      expect(PendingEvent.newRequestKey(), matches(pattern));
    }
  });

  test('only a rating or a continue can wait on the phone', () {
    PendingEvent of(String type) => PendingEvent.create(expectedRevision: 0, itemId: 'i', type: type);
    expect(of('rate').canWaitOffline, isTrue);
    expect(of('continue').canWaitOffline, isTrue);
    expect(of('reveal').canWaitOffline, isFalse);
    expect(of('answer').canWaitOffline, isFalse);
  });

  group('starting a run', () {
    Future<(RunStarter, FakeHttpAdapter)> starter(FakeReply Function(Object? body) reply) async {
      final http = FakeHttpAdapter()..handler = (o) => reply(o.data);
      final api = StudyApi(newApiClient(http));
      return (RunStarter(api, store), http);
    }

    Future<StartOutcome> outcome(FakeReply reply) async {
      final (s, _) = await starter((_) => reply);
      return (await s.start(mode: 'recall')).outcome;
    }

    test('the server answers map to the spec states', () async {
      expect(await outcome(const FakeReply(422, {'error': 'DAILY_NEW_LIMIT_REACHED'})), StartOutcome.dailyLimit);
      expect(await outcome(const FakeReply(422, {'error': 'NOTHING_DUE'})), StartOutcome.nothingDue);
      expect(await outcome(const FakeReply(422, {'error': 'LESSON_NOT_READ'})), StartOutcome.lessonNotRead);
      expect(await outcome(const FakeReply(503, {'error': 'STUDY_CONTENT_CHANGED'})), StartOutcome.contentChanged);
      expect(await outcome(const FakeReply(503, {'error': 'STUDY_RECALL_UNAVAILABLE'})), StartOutcome.unavailable);
      expect(await outcome(const FakeReply(500, {})), StartOutcome.failed);
      expect(await outcome(const FakeReply.network()), StartOutcome.offline);
    });

    test('a started run is kept on the phone so it can be reopened', () async {
      final (s, http) = await starter((_) => const FakeReply(200, {'id': 'run-1', 'state': 'active', 'revision': 0, 'cursor': 0, 'total': 8}));
      final result = await s.start(mode: 'recall');
      expect(result.started, isTrue);
      expect(await store.run('run-1'), isNotNull);
      expect(http.requests.single.path, '/api/study/runs');
    });

    test('a retry after a dropped connection reuses the same request key', () async {
      var offline = true;
      final (s, http) = await starter((_) => offline ? const FakeReply.network() : const FakeReply(200, {'id': 'run-1', 'state': 'active'}));
      expect((await s.start(mode: 'recall')).outcome, StartOutcome.offline);
      offline = false;
      await s.start(mode: 'recall');
      final keys = [for (final r in http.requests) (r.body! as Map)['requestKey']];
      expect(keys.toSet(), hasLength(1));
    });

    test('the plain messages are the spec lines', () async {
      final (s, _) = await starter((_) => const FakeReply(422, {'error': 'DAILY_NEW_LIMIT_REACHED'}));
      expect((await s.start(mode: 'recall')).message, "You have done today's new cards. Review is still open.");
    });
  });

  group('opening a lesson', () {
    ProviderContainer container(FakeHttpAdapter http, _MemoryPrefs prefs, {NetworkStatus network = NetworkStatus.online}) {
      final c = ProviderContainer(overrides: [
        authSnapshotProvider.overrideWith(_FakeAuth.new),
        appDatabaseProvider.overrideWithValue(db),
        appPrefsProvider.overrideWithValue(AppPrefs(prefs)),
        apiClientProvider.overrideWithValue(newApiClient(http)),
        networkStatusProvider.overrideWith(() => _FakeNetwork(network)),
      ]);
      addTearDown(c.dispose);
      return c;
    }

    Future<LessonLoad> open(ProviderContainer c, String id) {
      c.listen(lessonProvider(id), (_, _) {});
      return c.read(lessonProvider(id).future);
    }

    test('a lesson of a kept subject stays on the phone and opens offline later', () async {
      final prefs = _MemoryPrefs();
      await AppPrefs(prefs).setOfflineLearnSubjects({'accountancy'});
      final http = FakeHttpAdapter()..handler = (_) => FakeReply(200, lesson('a'));
      final online = container(http, prefs);
      final first = await open(online, 'a');
      expect(first.fromPhone, isFalse);
      expect(await store.lesson('a'), isNotNull);

      final offlineHttp = FakeHttpAdapter()..handler = (_) => const FakeReply.network();
      final airplane = container(offlineHttp, prefs, network: NetworkStatus.offline);
      final second = await open(airplane, 'a');
      expect(second.fromPhone, isTrue);
      expect(second.json['title'], 'Lesson a');
      expect(offlineHttp.requests, isEmpty);
    });

    test('a lesson of a subject that is not kept leaves no copy', () async {
      final http = FakeHttpAdapter()..handler = (_) => FakeReply(200, lesson('a'));
      await container(http, _MemoryPrefs()).read(lessonProvider('a').future);
      expect(await store.lesson('a'), isNull);
    });

    test('the network failing while online falls back to the kept copy', () async {
      await store.putLesson(lesson('a'));
      final http = FakeHttpAdapter()..handler = (_) => const FakeReply.network();
      final load = await container(http, _MemoryPrefs()).read(lessonProvider('a').future);
      expect(load.fromPhone, isTrue);
    });

    test('a lesson the server no longer has is removed from the phone', () async {
      await store.putLesson(lesson('a'));
      final http = FakeHttpAdapter()..handler = (_) => const FakeReply(404, {'error': 'UNIT_NOT_FOUND'});
      final c = container(http, _MemoryPrefs());
      await expectLater(open(c, 'a'), throwsA(anything));
      expect(await store.lesson('a'), isNull);
    });

    test('turning a subject off drops what was kept', () async {
      final prefs = _MemoryPrefs();
      await AppPrefs(prefs).setOfflineLearnSubjects({'accountancy'});
      await store.putLesson(lesson('a'));
      final c = container(FakeHttpAdapter(), prefs);
      await c.read(offlineLearnProvider.future);
      expect(c.read(offlineLearnProvider).value!.sizeOf('accountancy'), greaterThan(0));
      await c.read(offlineLearnProvider.notifier).setKept('accountancy', keep: false);
      expect(c.read(offlineLearnProvider).value!.kept, isEmpty);
      expect(await store.lesson('a'), isNull);
    });
  });
}
