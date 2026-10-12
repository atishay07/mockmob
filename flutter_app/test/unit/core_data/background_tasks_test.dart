import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/notification_prefs.dart';
import 'package:mockmob/core/notifications/notification_channels.dart';
import 'package:mockmob/core/notifications/notification_gateway.dart';
import 'package:mockmob/core/notifications/notification_planner.dart';
import 'package:mockmob/core/notifications/notification_service.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/background_tasks.dart';
import 'package:mockmob/core/sync/outbox_repository.dart';
import 'package:mockmob/core/sync/session/session_clock.dart';
import 'package:mockmob/core/sync/session/session_heartbeat.dart';
import 'package:mockmob/core/sync/session/session_journal.dart';
import 'package:timezone/timezone.dart' as tz;

import 'support/fakes.dart';
import 'support/fixtures.dart';
import 'support/test_db.dart';

class _Gateway implements LocalNotificationsGateway {
  final shown = <String>[];
  final scheduledTitles = <String>[];
  final cancelled = <int>[];

  @override
  Future<void> initialize({void Function(NotificationTap tap)? onTap}) async {}

  @override
  Future<void> createChannel(NotificationChannelSpec spec) async {}

  @override
  Future<void> schedule({required int id, required NotificationChannelSpec channel, required tz.TZDateTime at, required String title, required String body, String? payload, bool silent = false, List<NotificationActionSpec> actions = const []}) async =>
      scheduledTitles.add(body);

  @override
  Future<void> show({required int id, required NotificationChannelSpec channel, required String title, required String body, String? payload, bool silent = false, bool ongoing = false, List<NotificationActionSpec> actions = const []}) async =>
      shown.add('$body|silent=$silent|payload=$payload');

  @override
  Future<void> cancel(int id) async => cancelled.add(id);

  @override
  Future<void> cancelAll() async {}

  @override
  Future<bool> areNotificationsEnabled() async => true;
}

void main() {
  late AppDatabase db;
  late FakeHttpAdapter http;
  late _Gateway gateway;
  late DateTime now;
  late BackgroundEnvironment env;
  late SessionDraftRepository drafts;

  // Session ran 10 minutes ending at this wall-clock time.
  final endsAt = DateTime.utc(2026, 10, 12, 17, 42);

  setUp(() async {
    db = newTestDb();
    http = FakeHttpAdapter();
    gateway = _Gateway();
    now = endsAt.add(const Duration(seconds: 30)); // the job runs shortly after the end
    final service = NotificationService(
      gateway: gateway,
      ledger: MemoryNotificationLedgerStore(),
      prefs: () => NotificationPrefs.defaults,
      weeklyCap: () async => 3,
      createdChannels: () async => {},
      saveCreatedChannels: (_) async {},
      now: () => now,
    );
    env = BackgroundEnvironment(db: db, api: newApiClient(http), notifications: service, now: () => now, closeDatabase: false);
    drafts = SessionDraftRepository(LocalScope(db, () => 'u1', () => now));

    final draft = draftOf(endsAtWallMs: endsAt.millisecondsSinceEpoch, mockNumber: 7);
    await drafts.save(draft);
    final clock = SessionClock(monotonicMs: () => 0, wallMs: () => 0)..anchor(serverNowMs: 0, startedAtMs: 0, expiresAtMs: 600000);
    final journal = await SessionJournal.open(db, userId: 'u1', sessionId: 'sess-1');
    await journal.recordVisit('q1', clock);
    await journal.recordAnswer('q1', 1, clock);
  });

  tearDown(() => db.close());

  Map<String, dynamic> input() => {'userId': 'u1', 'sessionId': 'sess-1', 'draftKey': 'k'};

  Map<String, dynamic> attemptBody() => attemptJson(id: 'sess-1', questions: chapterOf('Goodwill', right: 1));

  test('submits, caches the attempt, records the pending result and posts the result-ready notification', () async {
    http.replies.add(FakeReply(200, attemptBody()));
    final done = await runBackgroundTask(BackgroundTaskNames.submitSession, input(), env);
    expect(done, isTrue);

    final sent = http.requests.single;
    expect(sent.path, '/api/attempts');
    expect(sent.method, 'POST');
    expect((sent.body as Map)['sessionId'], 'sess-1');
    expect((sent.body as Map)['answers'], {'q1': 1});

    expect((await db.select(db.cachedAttempts).get()).single.attemptId, 'sess-1');
    expect((await db.select(db.pendingResults).get()).single.openedAtMs, isNull);
    expect(await drafts.latest(), isNull);
    expect(gateway.shown.single, startsWith('Mock 7 was received. Your result is ready.'));
    expect(gateway.shown.single, contains('payload=/result/sess-1/sealed'));
  });

  test('the result-ready notification arrives silently inside quiet hours', () async {
    now = DateTime.utc(2026, 10, 12, 18, 30); // midnight IST
    http.replies.add(FakeReply(200, attemptBody()));
    await runBackgroundTask(BackgroundTaskNames.submitSession, input(), env);
    expect(gateway.shown.single, contains('silent=true'));
  });

  test('uses the stored session ticket in ticket mode', () async {
    await drafts.save(draftOf(endsAtWallMs: endsAt.millisecondsSinceEpoch, ticket: 'p2.a.b.c'));
    http.replies.add(FakeReply(200, attemptBody()));
    await runBackgroundTask(BackgroundTaskNames.submitSession, input(), env);
    expect((http.requests.single.body as Map)['sessionTicket'], 'p2.a.b.c');
  });

  test('an offline job inside the window asks WorkManager to retry', () async {
    http.replies.add(const FakeReply.network());
    final done = await runBackgroundTask(BackgroundTaskNames.submitSession, input(), env);
    expect(done, isFalse);
    expect((await drafts.latest())!.pendingSubmission, isTrue);
    expect(gateway.shown, isEmpty);
  });

  test('a 401 keeps the draft and retries later', () async {
    http.handler = (_) => const FakeReply(401, {'error': 'Unauthorized'});
    final done = await runBackgroundTask(BackgroundTaskNames.submitSession, input(), env);
    expect(done, isFalse);
    expect(await drafts.latest(), isNotNull);
  });

  test('a network failure after the window closed ends the job', () async {
    now = endsAt.add(const Duration(minutes: 5));
    http.replies.add(const FakeReply.network());
    expect(await runBackgroundTask(BackgroundTaskNames.submitSession, input(), env), isTrue);
  });

  test('SESSION_EXPIRED then a 404 read marks the window closed and ends the job', () async {
    http.replies
      ..add(const FakeReply(422, {'error': 'SESSION_EXPIRED'}))
      ..add(const FakeReply(404, {'error': 'Attempt not found'}));
    expect(await runBackgroundTask(BackgroundTaskNames.submitSession, input(), env), isTrue);
    final draft = (await drafts.latest())!;
    expect(draft.windowClosed, isTrue);
    expect(gateway.shown, isEmpty);
  });

  test('SESSION_EXPIRED then a 200 read means the server finalised it', () async {
    http.replies
      ..add(const FakeReply(422, {'error': 'SESSION_EXPIRED'}))
      ..add(FakeReply(200, attemptBody()));
    expect(await runBackgroundTask(BackgroundTaskNames.submitSession, input(), env), isTrue);
    expect((await db.select(db.pendingResults).get()).length, 1);
    expect(gateway.shown.length, 1);
  });

  test('a rejection ends the job without a retry', () async {
    http.replies.add(const FakeReply(422, {'error': 'invalid_answer'}));
    expect(await runBackgroundTask(BackgroundTaskNames.submitSession, input(), env), isTrue);
  });

  group('foreground heartbeat', () {
    test('defers while a live engine still owns a session that has not ended', () async {
      now = endsAt.subtract(const Duration(seconds: 90));
      await SessionHeartbeat(db, userId: 'u1', now: () => now).beat('sess-1');
      now = now.add(const Duration(seconds: 5));
      expect(await runBackgroundTask(BackgroundTaskNames.submitSession, input(), env), isFalse);
      expect(http.requests, isEmpty);
      expect(await drafts.latest(), isNotNull);
    });

    test('a stale heartbeat does not block the submit', () async {
      now = endsAt.subtract(const Duration(seconds: 90));
      await SessionHeartbeat(db, userId: 'u1', now: () => now).beat('sess-1');
      now = now.add(const Duration(seconds: 40));
      http.replies.add(FakeReply(200, attemptBody()));
      expect(await runBackgroundTask(BackgroundTaskNames.submitSession, input(), env), isTrue);
      expect(http.requests.single.path, '/api/attempts');
    });

    test('after the deadline the job submits even with a fresh heartbeat', () async {
      await SessionHeartbeat(db, userId: 'u1', now: () => now).beat('sess-1');
      http.replies.add(FakeReply(200, attemptBody()));
      expect(await runBackgroundTask(BackgroundTaskNames.submitSession, input(), env), isTrue);
    });
  });

  test('no draft means nothing to do and no network call', () async {
    await drafts.deleteSession('sess-1');
    expect(await runBackgroundTask(BackgroundTaskNames.submitSession, input(), env), isTrue);
    expect(http.requests, isEmpty);
  });

  test('a draft whose window already closed is left alone', () async {
    await drafts.save(draftOf(endsAtWallMs: endsAt.millisecondsSinceEpoch, windowClosed: true));
    expect(await runBackgroundTask(BackgroundTaskNames.submitSession, input(), env), isTrue);
    expect(http.requests, isEmpty);
  });

  test('missing input is ignored', () async {
    expect(await runBackgroundTask(BackgroundTaskNames.submitSession, {'userId': 'u1'}, env), isTrue);
  });

  group('outbox task', () {
    test('sends the due writes with their idempotency keys', () async {
      final scope = LocalScope(db, () => 'u1', () => now);
      await OutboxRepository(scope).enqueue(
        kind: 'study_event',
        method: 'POST',
        path: '/api/study/runs/r1/events',
        body: {'requestKey': 'rk-000000000001'},
        idempotencyKey: 'idem-key-000001',
      );
      http.replies.add(const FakeReply(200, {}));
      expect(await runBackgroundTask(BackgroundTaskNames.flushOutbox, {'userId': 'u1'}, env), isTrue);
      expect(http.requests.single.headers['Idempotency-Key'], 'idem-key-000001');
      expect(await OutboxRepository(scope).pending(), isEmpty);
    });

    test('asks for a retry while something must wait', () async {
      final scope = LocalScope(db, () => 'u1', () => now);
      await OutboxRepository(scope).enqueue(kind: 'k', method: 'POST', path: '/api/x', body: {});
      http.replies.add(const FakeReply(503, {}));
      expect(await runBackgroundTask(BackgroundTaskNames.flushOutbox, {'userId': 'u1'}, env), isFalse);
    });
  });

  test('an unknown task finishes quietly', () async {
    expect(await runBackgroundTask('mm.unknown', null, env), isTrue);
  });
}
