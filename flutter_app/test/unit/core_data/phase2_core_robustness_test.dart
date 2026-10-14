// Regression tests for the phase 2 robustness list (docs/brain/ui-phase2/ROBUSTNESS.json), the
// items that live in lib/core: offline-01, offline-02, offline-04, offline-05, practice-02,
// practice-04, practice-05, practice-06, review-03, today-05, onboarding-02, onboarding-05,
// you-04, result-05.
import 'dart:async';

import 'package:drift/drift.dart' show Value;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/consent.dart';
import 'package:mockmob/core/models/notification_prefs.dart';
import 'package:mockmob/core/models/session.dart';
import 'package:mockmob/core/notifications/notification_channels.dart';
import 'package:mockmob/core/notifications/notification_gateway.dart';
import 'package:mockmob/core/notifications/notification_planner.dart';
import 'package:mockmob/core/notifications/notification_service.dart';
import 'package:mockmob/core/repositories/consent_repository.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/pending_result_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/router/router_redirect.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/core/sync/session/session_clock.dart';
import 'package:mockmob/core/sync/session/session_engine.dart';
import 'package:mockmob/core/sync/session/session_journal.dart';
import 'package:mockmob/core/sync/session/session_submitter.dart';
import 'package:mockmob/core/sync/session/session_syncer.dart';
import 'package:mockmob/core/sync/session/session_work_scheduler.dart';
import 'package:timezone/timezone.dart' as tz;

import 'support/fakes.dart';
import 'support/fixtures.dart';
import 'support/test_db.dart';

class _Scheduler implements SessionWorkScheduler {
  final List<String> keys = [];

  @override
  Future<void> scheduleSubmit({required String userId, required String sessionId, required String draftKey, required DateTime runAt}) async => keys.add(draftKey);

  @override
  Future<void> cancelSubmit(String sessionId) async {}
}

/// A session API that can hold a PUT open or send back a reply that is not a number.
class _Api extends FakeSessionApi {
  Completer<void>? putHold;

  @override
  Future<int> putEvents({required String sessionId, required List<SessionEvent> events}) async {
    final hold = putHold;
    if (hold != null) await hold.future;
    return super.putEvents(sessionId: sessionId, events: events);
  }
}

class _User extends Notifier<String?> {
  @override
  String? build() => 'u1';
}

final _userProvider = NotifierProvider<_User, String?>(_User.new);

class _Counting extends RemoteNotifier<int> {
  static final List<Completer<int>> fetches = [];

  @override
  Future<CachedValue<int>?> readCache(String userId) async => null;

  @override
  Future<Fetched<int>> fetchRemote() async {
    final c = Completer<int>();
    fetches.add(c);
    return Fetched(await c.future, null);
  }

  @override
  Future<void> writeCache(String userId, Fetched<int> fetched, DateTime at) async {}
}

final _countingProvider = NotifierProvider<_Counting, RemoteState<int>>(_Counting.new);

class _FakeAuth extends AuthController {
  @override
  AuthSnapshot build() => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'a');
}

class _Gateway implements LocalNotificationsGateway {
  Completer<void>? showHold;
  int shown = 0;

  @override
  Future<void> initialize({void Function(NotificationTap tap)? onTap}) async {}

  @override
  Future<void> createChannel(NotificationChannelSpec spec) async {}

  @override
  Future<void> schedule({
    required int id,
    required NotificationChannelSpec channel,
    required tz.TZDateTime at,
    required String title,
    required String body,
    String? payload,
    bool silent = false,
    List<NotificationActionSpec> actions = const [],
  }) async {}

  @override
  Future<void> show({
    required int id,
    required NotificationChannelSpec channel,
    required String title,
    required String body,
    String? payload,
    bool silent = false,
    bool ongoing = false,
    List<NotificationActionSpec> actions = const [],
  }) async {
    shown++;
    final hold = showHold;
    if (hold != null) await hold.future;
  }

  @override
  Future<void> cancel(int id) async {}

  @override
  Future<void> cancelAll() async {}

  @override
  Future<bool> areNotificationsEnabled() async => true;
}

void main() {
  group('offline-01 and offline-02: a paper the server can still accept survives sign-out and an account switch', () {
    late AppDatabase db;
    late LocalScope scope;
    late int wall;

    setUp(() {
      db = newTestDb();
      wall = DateTime.now().millisecondsSinceEpoch;
      scope = LocalScope(db, () => 'u1', () => DateTime.fromMillisecondsSinceEpoch(wall));
    });

    tearDown(() => db.close());

    Future<void> answerOn(String sessionId) async {
      await db.into(db.answerJournal).insert(
            AnswerJournalCompanion.insert(userId: 'u1', sessionId: sessionId, seq: 1, qid: 'q1', type: 'answer', atMs: 1, answer: const Value(1), createdAtMs: 1),
          );
    }

    test('an open paper keeps its draft and its answers; a closed one goes', () async {
      final drafts = SessionDraftRepository(scope);
      // Open: the deadline is still ahead.
      await drafts.save(draftOf(sessionId: 'open', endsAtWallMs: wall + 600000, generationKey: 'g-open'));
      await answerOn('open');
      // Just past the deadline but inside the 120 s grace: still owed.
      await drafts.save(draftOf(sessionId: 'grace', endsAtWallMs: wall - 60000, count: 4, generationKey: 'g-grace', pending: true));
      await answerOn('grace');
      // Closed: past deadline plus grace.
      await drafts.save(draftOf(sessionId: 'closed', endsAtWallMs: wall - 600000, count: 5, generationKey: 'g-closed'));
      await answerOn('closed');

      await db.clearUserData('u1', keepOutbox: true);

      final kept = (await db.select(db.sessionDrafts).get()).map((r) => r.sessionId).toSet();
      expect(kept, {'open', 'grace'}, reason: 'the sign-out warning counted those answers; they are not thrown away');
      final journals = (await db.select(db.answerJournal).get()).map((r) => r.sessionId).toSet();
      expect(journals, {'open', 'grace'});
    });

    test('another account never sees the kept paper', () async {
      final drafts = SessionDraftRepository(scope);
      await drafts.save(draftOf(sessionId: 'open', endsAtWallMs: wall + 600000));
      await db.clearUserData('u1');
      final other = SessionDraftRepository(LocalScope(db, () => 'u2', () => DateTime.fromMillisecondsSinceEpoch(wall)));
      expect(await other.latest(), isNull);
      expect(await drafts.latest(), isNotNull, reason: 'u1 finds the paper again when she signs back in');
    });

    test('deleting the account purges every paper', () async {
      final drafts = SessionDraftRepository(scope);
      await drafts.save(draftOf(sessionId: 'open', endsAtWallMs: wall + 600000));
      await answerOn('open');
      await db.clearUserData('u1');
      await db.purgeUserPapers('u1');
      expect(await db.select(db.sessionDrafts).get(), isEmpty);
      expect(await db.select(db.answerJournal).get(), isEmpty);
    });
  });

  group('today-05: a forced refresh never joins a read that started before the change', () {
    test('waits for the running read, then reads again and returns the newer data', () async {
      _Counting.fetches.clear();
      final container = ProviderContainer(overrides: [
        authSnapshotProvider.overrideWith(_FakeAuth.new),
        nowProvider.overrideWithValue(() => DateTime.utc(2026, 10, 14, 10)),
      ]);
      addTearDown(container.dispose);
      container.listen(_countingProvider, (_, _) {});
      await pumpEventQueue();
      expect(_Counting.fetches.length, 1, reason: 'the open-time read is in flight');

      final forced = container.read(_countingProvider.notifier).refresh(force: true);
      var done = false;
      unawaited(forced.then((_) => done = true));
      await pumpEventQueue();
      expect(done, isFalse, reason: 'it must not resolve with the pre-change read');

      _Counting.fetches[0].complete(1); // the stale read lands
      await pumpEventQueue();
      expect(_Counting.fetches.length, 2, reason: 'a fresh read starts after the stale one');
      expect(done, isFalse);

      _Counting.fetches[1].complete(2);
      await forced;
      expect(container.read(_countingProvider).value, 2);
    });

    test('forced calls that arrive while the second read waits share it', () async {
      _Counting.fetches.clear();
      final container = ProviderContainer(overrides: [
        authSnapshotProvider.overrideWith(_FakeAuth.new),
        nowProvider.overrideWithValue(() => DateTime.utc(2026, 10, 14, 10)),
      ]);
      addTearDown(container.dispose);
      container.listen(_countingProvider, (_, _) {});
      await pumpEventQueue();
      final a = container.read(_countingProvider.notifier).refresh(force: true);
      final b = container.read(_countingProvider.notifier).refresh(force: true);
      _Counting.fetches[0].complete(1);
      await pumpEventQueue();
      expect(_Counting.fetches.length, 2, reason: 'one fresh read for both');
      _Counting.fetches[1].complete(2);
      await Future.wait([a, b]);
    });
  });

  group('onboarding-02: the age answer never switches usage data off', () {
    late FakeHttpAdapter http;
    late ProviderContainer container;

    setUp(() {
      http = FakeHttpAdapter();
      container = ProviderContainer(overrides: [
        userIdProvider.overrideWith((ref) => ref.watch(_userProvider)),
        appPrefsProvider.overrideWithValue(AppPrefs(MemoryPrefsStore())),
        apiClientProvider.overrideWithValue(newApiClient(http)),
      ]);
      addTearDown(container.dispose);
    });

    Map<String, dynamic> consentJson({bool allowed = true}) => {
          'ageBand': 'adult',
          'analyticsAllowed': allowed,
          'policyVersion': '2026-10-12',
          'decidedAt': '2026-10-12T10:00:00.000Z',
        };

    test('before the consent read lands, the write waits for it and keeps the opt-in', () async {
      // The consent read is slow; the age write is requested while it is still out.
      final gate = Completer<void>();
      http.hold = gate;
      http.handler = (options) => options.method == 'GET' ? FakeReply(200, consentJson()) : FakeReply(200, consentJson());
      final repo = container.read(consentRepositoryProvider.notifier);
      container.read(consentRepositoryProvider);
      final write = repo.setAgeBand(AgeBand.adult);
      await pumpEventQueue();
      expect(http.requests.where((r) => r.method == 'PUT'), isEmpty, reason: 'nothing is sent before the opt-in is known');
      gate.complete();
      await write;
      final put = http.requests.firstWhere((r) => r.method == 'PUT');
      expect((put.body as Map)['analyticsAllowed'], isTrue, reason: 'the existing usage-data choice is kept');
    });

    test('when the consent cannot be read, nothing is written and the caller is told', () async {
      http.handler = (options) => const FakeReply(503, {'error': 'unavailable'});
      final repo = container.read(consentRepositoryProvider.notifier);
      container.read(consentRepositoryProvider);
      await expectLater(repo.setAgeBand(AgeBand.adult), throwsA(isA<ApiError>()));
      expect(http.requests.where((r) => r.method == 'PUT'), isEmpty);
    });
  });

  group('onboarding-05: the remembered target survives the process dying during sign-in', () {
    test('a location kept on the phone comes back, with its owner', () async {
      final store = MemoryPrefsStore();
      final first = IntendedRoute(store: store)..remember('/run/s1', userId: 'u1');
      await pumpEventQueue();
      expect(first.location, '/run/s1');

      final second = await IntendedRoute.restored(store);
      expect(second.location, '/run/s1');
      expect(second.locationFor('u1'), '/run/s1');
      expect(second.locationFor('u2'), isNull, reason: 'another account never continues there');
    });

    test('a stale one is dropped', () async {
      final store = MemoryPrefsStore();
      var now = DateTime(2026, 10, 14, 10);
      IntendedRoute(clock: () => now, store: store).remember('/review');
      await pumpEventQueue();

      now = now.add(IntendedRoute.defaultMaxAge + const Duration(seconds: 1));
      expect((await IntendedRoute.restored(store, clock: () => now)).location, isNull);
    });

    test('taking it forgets it on the phone too', () async {
      final store = MemoryPrefsStore();
      final now = DateTime(2026, 10, 14, 10);
      IntendedRoute(clock: () => now, store: store).remember('/review');
      await pumpEventQueue();

      final fresh = await IntendedRoute.restored(store, clock: () => now);
      expect(fresh.take(), '/review');
      await pumpEventQueue();
      expect((await IntendedRoute.restored(store, clock: () => now)).location, isNull);
    });

    test('unreadable storage starts empty', () async {
      final store = MemoryPrefsStore()..values[IntendedRoute.storeKey] = '[1, 2]';
      expect((await IntendedRoute.restored(store)).location, isNull);
    });
  });

  group('you-04: the reminder ledger is never a lost update', () {
    test('a result post that loaded the ledger early does not erase the reminder added meanwhile', () async {
      final gateway = _Gateway();
      final ledger = MemoryNotificationLedgerStore();
      final now = DateTime.utc(2026, 10, 12, 14, 30); // 8:00 PM IST
      final service = NotificationService(
        gateway: gateway,
        ledger: ledger,
        prefs: () => _studyOn,
        weeklyCap: () async => 3,
        createdChannels: () async => {},
        saveCreatedChannels: (_) async {},
        now: () => now,
      );
      // The post (respondsToStudentAction) loads the ledger, then waits inside the plugin.
      final hold = Completer<void>();
      gateway.showHold = hold;
      final post = service.schedule(NotificationRequest(
        taskId: 'result:1',
        channel: NotificationChannels.studyReminders,
        title: 'Result',
        body: 'Ready',
        respondsToStudentAction: true,
      ));
      await pumpEventQueue();
      expect(gateway.shown, 1);

      // Meanwhile a reminder is scheduled and recorded.
      gateway.showHold = null;
      await service.schedule(NotificationRequest(
        taskId: 'reminder:1',
        channel: NotificationChannels.studyReminders,
        title: 'Study',
        body: 'Tonight',
        at: now.add(const Duration(hours: 1)),
      ));
      expect([for (final e in ledger.entries) e.taskId], ['reminder:1']);

      // The post finishes. It used to save its old snapshot and erase the reminder.
      hold.complete();
      await post;
      expect([for (final e in ledger.entries) e.taskId], ['reminder:1'], reason: 'the reminder still counts toward the daily cap');
    });
  });

  group('result-05: the reminder spacing belongs to the account', () {
    test('a second account is not held back by the first one\'s last ask', () async {
      final prefs = AppPrefs(MemoryPrefsStore());
      final at = DateTime(2026, 10, 14, 9);
      await prefs.setLastPrePromptAt(at, userId: 'a');
      expect(await prefs.lastPrePromptAt(userId: 'a'), at);
      expect(await prefs.lastPrePromptAt(userId: 'b'), isNull);
      // The old per-phone value still works for callers that have not moved.
      await prefs.setLastPrePromptAt(at);
      expect(await prefs.lastPrePromptAt(), at);
    });
  });

  group('offline-05: a clock set back while the app was closed gives no time back', () {
    test('restore never reads the wall clock earlier than the last save', () {
      var mono = 0;
      var wall = 10000000; // the phone's clock was set back to here
      final clock = SessionClock(monotonicMs: () => mono, wallMs: () => wall);
      // The draft was last saved at wall 12_000_000 with the deadline at 12_600_000: 10 minutes.
      clock.restore(startedRefWallMs: 12000000 - 1200000, endsAtWallMs: 12600000, notBeforeWallMs: 12000000);
      expect(clock.remainingMs, 600000, reason: 'ten minutes at the last save, not the 43 minutes the set-back clock says');
      mono += 1000;
      expect(clock.remainingMs, 599000);
    });

    test('without a save time it behaves as before', () {
      final clock = SessionClock(monotonicMs: () => 0, wallMs: () => 10000000);
      clock.restore(startedRefWallMs: 9000000, endsAtWallMs: 10600000);
      expect(clock.remainingMs, 600000);
    });
  });

  group('the session engine', () {
    late AppDatabase db;
    late _Api api;
    late ManualTimers timers;
    late _Scheduler scheduler;
    late SessionDraftRepository drafts;
    late int mono;
    late int wall;
    late SessionEngineServices services;
    final engines = <SessionEngine>[];

    setUp(() {
      db = newTestDb();
      api = _Api();
      timers = ManualTimers();
      scheduler = _Scheduler();
      mono = 0;
      wall = 2000000;
      final scope = LocalScope(db, () => 'u1', () => DateTime.fromMillisecondsSinceEpoch(wall));
      drafts = SessionDraftRepository(scope);
      services = SessionEngineServices(
        db: db,
        userId: 'u1',
        api: api,
        drafts: drafts,
        submitter: SessionSubmitter(
          api: api,
          drafts: drafts,
          pendingResults: PendingResultRepository(scope),
          cacheAttempt: (_) async {},
          now: () => DateTime.fromMillisecondsSinceEpoch(wall),
        ),
        scheduler: scheduler,
        clockFactory: () => SessionClock(monotonicMs: () => mono, wallMs: () => wall),
        timerFactory: timers.create,
        earlierDraftWait: const Duration(milliseconds: 50),
        now: () => DateTime.fromMillisecondsSinceEpoch(wall),
      );
    });

    tearDown(() async {
      for (final e in engines) {
        e.dispose();
      }
      engines.clear();
      await db.close();
    });

    Future<SessionEngine> start({String id = 'sess-1', String generationKey = 'gen-1', int expiresAt = 1600000, int serverNow = 1000000}) async {
      final view = sessionViewOf(id: id, count: 3, startedAt: 1000000, expiresAt: expiresAt, serverNow: serverNow);
      final e = await SessionEngine.start(services: services, view: view, subject: 'accountancy', mode: 'full', count: 3, generationKey: generationKey);
      engines.add(e);
      return e;
    }

    Future<void> settle([int rounds = 20]) async {
      for (var i = 0; i < rounds; i++) {
        await Future<void>.delayed(Duration.zero);
      }
    }

    test('practice-04: a start with no usable deadline is refused before anything is saved or sent', () async {
      // expiresAt at the epoch is what a missing field parses to.
      await expectLater(start(expiresAt: 0), throwsA(isA<ApiError>()));
      expect(await db.select(db.sessionDrafts).get(), isEmpty);
      expect(api.submits, isEmpty);
      // At the server's own clock: no time left either.
      await expectLater(start(expiresAt: 1000000), throwsA(isA<ApiError>()));
      expect(await db.select(db.sessionDrafts).get(), isEmpty);
    });

    test('review-03: a reply that is not a number never skips the draft and the backup job on pause', () async {
      final engine = await start();
      await engine.selectAnswer('q1', 1);
      api.putFailure = () => StateError('bad reply');
      final scheduledBefore = scheduler.keys.length;
      await engine.onPaused();
      expect(scheduler.keys.length, greaterThan(scheduledBefore), reason: 'the backup job is re-registered');
      final stored = (await drafts.bySessionId('sess-1'))!;
      expect(stored.currentIndex, 0);
    });

    test('review-03: a non-API failure of the PUT backs off and retries instead of sticking on sending', () async {
      final engine = await start();
      api.putFailure = () => StateError('bad reply');
      await engine.selectAnswer('q1', 1);
      timers.fireNext(); // the debounce
      await settle();
      expect(engine.saveState.value.unsyncedAnswers, 1);
      // A retry is scheduled (the back-off), the status is failing, not sending.
      expect(timers.pendingDelays, contains(const Duration(seconds: 1)));
      api.putFailure = null;
      timers.fireAll();
      await settle();
      expect(engine.saveState.value.unsyncedAnswers, 0, reason: 'the retry went through');
    });

    test('practice-02: an engine closing late never writes its draft over a newer session of the same selection', () async {
      final first = await start();
      await first.selectAnswer('q1', 1);
      await first.flushDraft();
      // A new session of the same selection starts and takes the row.
      final second = await start(id: 'sess-2', generationKey: 'gen-2');
      expect((await drafts.byKey(second.draft.draftKey))!.sessionId, 'sess-2');

      await first.selectAnswer('q2', 2);
      await first.flushDraft(); // the late write
      expect((await drafts.byKey(second.draft.draftKey))!.sessionId, 'sess-2', reason: 'the new session still owns the row');
    });

    test('practice-05: an acknowledgement that lands after the engine closed is persisted', () async {
      final engine = await start();
      await engine.selectAnswer('q1', 1);
      await engine.flushDraft();
      // The PUT is still in flight when the student leaves.
      api.putHold = Completer<void>();
      timers.fireNext();
      await settle();
      engine.dispose();
      engines.remove(engine);

      api.putHold!.complete();
      await settle();
      final stored = (await drafts.bySessionId('sess-1'))!;
      expect(stored.acknowledgedSequence, greaterThan(0), reason: 'reopening does not show held answers as unsent');
    });

    test('practice-06: a resume that returns after the student left sends nothing', () async {
      final engine = await start();
      await engine.selectAnswer('q1', 1);
      api.putFailure = () => const ApiError(kind: ApiErrorKind.conflict, code: ApiCodes.eventConflict, status: 409);
      timers.fireNext();
      await settle();
      expect(api.resumeCalls, 1, reason: 'recovery started');

      engine.dispose();
      engines.remove(engine);
      api.putFailure = null;
      api.resumeView = sessionViewOf(id: 'sess-1', count: 3, startedAt: 1000000, expiresAt: 1600000, serverNow: 1000000);
      final putsBefore = api.puts.length;
      timers.fireAll();
      await settle();
      expect(api.puts.length, putsBefore, reason: 'nothing is sent for a session the student has left');
    });

    test('offline-04: a failed resume after a conflict is retried with back-off until it works', () async {
      final engine = await start();
      await engine.selectAnswer('q1', 1);
      var conflict = true;
      api.putFailure = () => conflict ? const ApiError(kind: ApiErrorKind.conflict, code: ApiCodes.eventConflict, status: 409) : null;
      timers.fireNext();
      await settle();
      expect(api.resumeCalls, 1);
      expect(timers.pendingDelays, contains(const Duration(seconds: 1)), reason: 'the retry is scheduled');

      // The server comes back with its own log.
      conflict = false;
      api.resumeFailure = null;
      api.resumeView = sessionViewOf(id: 'sess-1', count: 3, startedAt: 1000000, expiresAt: 1600000, serverNow: 1000000);
      timers.fireNext();
      await settle();
      expect(api.resumeCalls, 2);
      await settle();
      // The local answer is back on the server's log and goes out again.
      expect(engine.answerFor('q1'), 1);
    });
  });

  group('review-03: the events PUT with a reply that is not a number', () {
    test('the syncer treats a non-API error as a transient failure', () async {
      final db = newTestDb();
      addTearDown(db.close);
      final api = FakeSessionApi()..putFailure = () => StateError('bad ack');
      final timers = ManualTimers();
      final clock = SessionClock(monotonicMs: () => 0, wallMs: () => 0)..anchor(serverNowMs: 0, startedAtMs: 0, expiresAtMs: 600000);
      final journal = await SessionJournal.open(db, userId: 'u1', sessionId: 's1');
      final syncer = SessionSyncer(api: api, journal: journal, sessionId: 's1', timerFactory: timers.create);
      await journal.recordAnswer('q1', 1, clock);
      await syncer.flushNow();
      expect(syncer.status.value, SyncStatus.failing);
      expect(timers.pendingCount, 1, reason: 'a retry is scheduled');
    });
  });
}

final NotificationPrefs _studyOn = NotificationPrefs(
  timezone: NotificationPrefs.defaults.timezone,
  quietStart: NotificationPrefs.defaults.quietStart,
  quietEnd: NotificationPrefs.defaults.quietEnd,
  channels: {...NotificationPrefs.defaults.channels, 'study_window': true},
  studyWindow: NotificationPrefs.defaults.studyWindow,
  weeklyCap: NotificationPrefs.defaults.weeklyCap,
);
