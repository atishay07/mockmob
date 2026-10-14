// Regression tests for the second sync bug hunt (14 Oct 2026): sync-session-r2-01, 02, 04, 05,
// 06 and 07.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/connectivity/connectivity_monitor.dart';
import 'package:mockmob/core/connectivity/connectivity_providers.dart';
import 'package:mockmob/core/models/notification_prefs.dart';
import 'package:mockmob/core/models/session.dart';
import 'package:mockmob/core/models/session_draft.dart';
import 'package:mockmob/core/notifications/notification_channels.dart';
import 'package:mockmob/core/notifications/notification_gateway.dart';
import 'package:mockmob/core/notifications/notification_planner.dart';
import 'package:mockmob/core/notifications/notification_service.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/pending_result_repository.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/background_tasks.dart';
import 'package:mockmob/core/sync/session/session_api.dart';
import 'package:mockmob/core/sync/session/session_clock.dart';
import 'package:mockmob/core/sync/session/session_engine.dart';
import 'package:mockmob/core/sync/session/session_heartbeat.dart';
import 'package:mockmob/core/sync/session/session_journal.dart';
import 'package:mockmob/core/sync/session/session_submitter.dart';
import 'package:mockmob/core/sync/session/session_work_scheduler.dart';
import 'package:timezone/timezone.dart' as tz;

import 'support/fakes.dart';
import 'support/fixtures.dart';
import 'support/test_db.dart';

class _Shown {
  _Shown(this.title, this.body, {required this.ongoing});

  final String title;
  final String body;
  final bool ongoing;
}

class _Gateway implements LocalNotificationsGateway {
  final shown = <_Shown>[];
  final cancelled = <int>[];

  @override
  Future<void> initialize({void Function(NotificationTap tap)? onTap}) async {}

  @override
  Future<void> createChannel(NotificationChannelSpec spec) async {}

  @override
  Future<void> schedule({required int id, required NotificationChannelSpec channel, required tz.TZDateTime at, required String title, required String body, String? payload, bool silent = false, List<NotificationActionSpec> actions = const []}) async {}

  @override
  Future<void> show({required int id, required NotificationChannelSpec channel, required String title, required String body, String? payload, bool silent = false, bool ongoing = false, List<NotificationActionSpec> actions = const []}) async =>
      shown.add(_Shown(title, body, ongoing: ongoing));

  @override
  Future<void> cancel(int id) async => cancelled.add(id);

  @override
  Future<void> cancelAll() async {}

  @override
  Future<bool> areNotificationsEnabled() async => true;
}

class _Scheduler implements SessionWorkScheduler {
  final List<(String, DateTime)> jobs = [];

  @override
  Future<void> scheduleSubmit({required String userId, required String sessionId, required String draftKey, required DateTime runAt}) async => jobs.add((draftKey, runAt));

  @override
  Future<void> cancelSubmit(String sessionId) async {}
}

Future<void> _settle([int rounds = 20]) async {
  for (var i = 0; i < rounds; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  group('sync-session-r2-01: every reconnect reaches the listeners', () {
    test('a second and a third reconnect notify, not only the first', () async {
      final radio = StreamController<bool>();
      final monitor = ConnectivityMonitor(radioPresent: radio.stream, ping: () async => true, hasPendingWork: () => false);
      final container = ProviderContainer(overrides: [connectivityMonitorProvider.overrideWithValue(monitor)]);
      addTearDown(() async {
        container.dispose();
        await monitor.dispose();
        await radio.close();
      });
      var notified = 0;
      container.listen(networkRestoredProvider, (_, next) {
        if (next.hasValue) notified++;
      });
      for (var i = 0; i < 3; i++) {
        radio.add(false);
        await _settle();
        radio.add(true);
        await _settle();
      }
      expect(notified, 3);
    });
  });

  // R1 of the 14 Oct audit: every session call names the paper's owner. Sent with another
  // account's token, the server would refuse the paper (or say it has no such attempt), and that
  // answer would end the first student's unsent paper. The guard refuses instead, and a refusal
  // of the guard keeps the submit owed.
  group("a paper goes out only with its owner's token", () {
    late AppDatabase db;
    late FakeHttpAdapter http;
    late FakeTokens tokens;
    late SessionDraftRepository drafts;
    late PendingResultRepository pending;
    late SessionJournal journal;
    final now = DateTime.utc(2026, 10, 12, 17, 12);

    setUp(() async {
      db = newTestDb();
      http = FakeHttpAdapter();
      tokens = FakeTokens();
      final scope = LocalScope(db, () => 'u1', () => now);
      drafts = SessionDraftRepository(scope);
      pending = PendingResultRepository(scope);
      final clock = SessionClock(monotonicMs: () => 0, wallMs: () => 0)..anchor(serverNowMs: 0, startedAtMs: 0, expiresAtMs: 600000);
      journal = await SessionJournal.open(db, userId: 'u1', sessionId: 'sess-1');
      await journal.recordVisit('q1', clock);
      await journal.recordAnswer('q1', 2, clock);
    });

    tearDown(() => db.close());

    SessionSubmitter submitter() => SessionSubmitter(
          api: ApiSessionApi(newApiClient(http, tokens: tokens)),
          drafts: drafts,
          pendingResults: pending,
          cacheAttempt: (_) async {},
          now: () => now,
        );

    test('with another account signed in, the submit is not sent and stays owed', () async {
      tokens
        ..token = 'tok-b'
        ..userId = 'u2';
      // What the server would say to B about A's paper: without the guard this rejects it.
      http.replies.add(const FakeReply(404, {'error': 'not_found'}));
      final draft = draftOf(endsAtWallMs: 600000);
      await drafts.save(draft);
      final outcome = await submitter().submit(draft: draft, journal: journal, durationMs: 600000);
      expect(http.requests, isEmpty, reason: "nothing of A's paper goes out with B's token");
      expect(outcome, isA<SubmitPending>());
      expect((outcome as SubmitPending).error.isAccountChanged, isTrue);
      final kept = (await drafts.bySessionId('sess-1'))!;
      expect(kept.pendingSubmission, isTrue, reason: 'still owed');
      expect(kept.rejected, isFalse);
      expect(kept.windowClosed, isFalse);
      expect(await db.select(db.answerJournal).get(), isNotEmpty);
    });

    test('a switch after SESSION_EXPIRED never lets the other account close the paper', () async {
      final draft = draftOf(endsAtWallMs: 600000);
      await drafts.save(draft);
      http.handler = (options) {
        // B signs in while the first answer is on its way back.
        tokens
          ..token = 'tok-b'
          ..userId = 'u2';
        return const FakeReply(422, {'error': 'SESSION_EXPIRED'});
      };
      final outcome = await submitter().submit(draft: draft, journal: journal, durationMs: 600000);
      expect(http.requests.map((r) => '${r.method} ${r.path}'), ['POST /api/attempts'], reason: "the attempt read is not asked with B's token");
      expect(outcome, isA<SubmitPending>());
      final kept = (await drafts.bySessionId('sess-1'))!;
      expect(kept.windowClosed, isFalse, reason: "B's 404 would have closed A's paper");
      expect(await db.select(db.answerJournal).get(), isNotEmpty);
    });

    test("the submit and the attempt read name the paper's owner", () async {
      final api = FakeSessionApi()..submitFailure = const ApiError(status: 422, kind: ApiErrorKind.validation, code: 'SESSION_EXPIRED');
      final draft = draftOf(endsAtWallMs: 600000);
      await drafts.save(draft);
      await SessionSubmitter(api: api, drafts: drafts, pendingResults: pending, cacheAttempt: (_) async {}, now: () => now)
          .submit(draft: draft, journal: journal, durationMs: 600000);
      expect(api.submits.single['forUserId'], 'u1');
      expect(api.fetchedFor, ['u1']);
    });

    test('the events PUT and the resume are refused the same way', () async {
      tokens
        ..token = 'tok-b'
        ..userId = 'u2';
      final api = ApiSessionApi(newApiClient(http, tokens: tokens), userId: 'u1');
      final put = await api.putEvents(sessionId: 'sess-1', events: journal.events).then<Object?>((_) => null, onError: (Object e) => e);
      final resume = await api.resume('sess-1').then<Object?>((_) => null, onError: (Object e) => e);
      expect((put! as ApiError).isAccountChanged, isTrue);
      expect((resume! as ApiError).isAccountChanged, isTrue);
      expect(http.requests, isEmpty);
    });

    test('with its owner signed in, the paper goes out as before', () async {
      http.replies.add(const FakeReply(200, {'id': 'att-1', 'subject': 'accountancy', 'correct': 1, 'wrong': 0, 'unattempted': 0, 'total': 1}));
      final draft = draftOf(endsAtWallMs: 600000);
      await drafts.save(draft);
      final outcome = await submitter().submit(draft: draft, journal: journal, durationMs: 600000);
      expect(outcome, isA<SubmitReceived>());
      expect(http.requests.single.headers['Authorization'], 'Bearer tok-1');
    });
  });

  group('sync-session-r2-02: a 2xx without an attempt keeps the answers', () {
    late AppDatabase db;
    late FakeHttpAdapter http;
    late SessionDraftRepository drafts;
    late PendingResultRepository pending;
    late SessionJournal journal;
    final now = DateTime.utc(2026, 10, 12, 17, 12);

    setUp(() async {
      db = newTestDb();
      http = FakeHttpAdapter();
      final scope = LocalScope(db, () => 'u1', () => now);
      drafts = SessionDraftRepository(scope);
      pending = PendingResultRepository(scope);
      final clock = SessionClock(monotonicMs: () => 0, wallMs: () => 0)..anchor(serverNowMs: 0, startedAtMs: 0, expiresAtMs: 600000);
      journal = await SessionJournal.open(db, userId: 'u1', sessionId: 'sess-1');
      await journal.recordVisit('q1', clock);
      await journal.recordAnswer('q1', 2, clock);
    });

    tearDown(() => db.close());

    SessionSubmitter submitterWith(SessionApi api) =>
        SessionSubmitter(api: api, drafts: drafts, pendingResults: pending, cacheAttempt: (_) async {}, now: () => now);

    for (final (name, reply) in [
      ('an HTML page served with 200', const FakeReply(200, '<html>Sign in to the Wi-Fi</html>')),
      ('an empty 204', const FakeReply(204, '')),
      ('a JSON object with no id', const FakeReply(200, {'ok': true})),
    ]) {
      test('$name is pending, and the draft and journal stay', () async {
        http.replies.add(reply);
        final draft = draftOf(endsAtWallMs: 600000);
        await drafts.save(draft);
        final outcome = await submitterWith(ApiSessionApi(newApiClient(http))).submit(draft: draft, journal: journal, durationMs: 600000);
        expect(outcome, isA<SubmitPending>());
        expect((outcome as SubmitPending).error.isDefinitiveRefusal, isFalse);
        final kept = (await drafts.bySessionId('sess-1'))!;
        expect(kept.pendingSubmission, isTrue);
        expect(await db.select(db.answerJournal).get(), isNotEmpty);
        expect(await pending.unopened(), isEmpty);
      });
    }

    test('after SESSION_EXPIRED, a 200 page on the attempt read is not a finalised result', () async {
      http.replies
        ..add(const FakeReply(422, {'error': 'SESSION_EXPIRED'}))
        ..add(const FakeReply(200, '<html>Maintenance</html>'));
      final draft = draftOf(endsAtWallMs: 600000);
      await drafts.save(draft);
      final outcome = await submitterWith(ApiSessionApi(newApiClient(http))).submit(draft: draft, journal: journal, durationMs: 600000);
      expect(outcome, isA<SubmitPending>());
      expect(await drafts.bySessionId('sess-1'), isNotNull);
      expect(await db.select(db.answerJournal).get(), isNotEmpty);
    });

    test('the submitter itself refuses an attempt without an id', () async {
      final api = FakeSessionApi()..submitResult = {};
      final draft = draftOf(endsAtWallMs: 600000);
      await drafts.save(draft);
      final outcome = await submitterWith(api).submit(draft: draft, journal: journal, durationMs: 600000);
      expect(outcome, isA<SubmitPending>());
      expect(await drafts.bySessionId('sess-1'), isNotNull);
      expect(await db.select(db.answerJournal).get(), isNotEmpty);
    });
  });

  group('sync-session-r2-04: an archived draft never becomes the latest', () {
    test('re-saving an archived draft keeps the live paper as the latest', () async {
      final db = newTestDb();
      addTearDown(db.close);
      var nowMs = 1000000;
      final drafts = SessionDraftRepository(LocalScope(db, () => 'u1', () => DateTime.fromMillisecondsSinceEpoch(nowMs)));

      await drafts.save(draftOf(sessionId: 'sess-1', endsAtWallMs: 600000, pending: true));
      nowMs += 60000;
      // The new paper with the same selection: the earlier one moves to its archive row first.
      await drafts.archive((await drafts.bySessionId('sess-1'))!);
      await drafts.save(draftOf(sessionId: 'sess-2', generationKey: 'gen-2', endsAtWallMs: 2000000));
      final live = drafts.watchLatest();

      // Later, the submit of the earlier paper (or its backup job) writes the archive row again.
      nowMs += 60000;
      final archived = (await drafts.bySessionId('sess-1'))!;
      expect(archived.draftKey, SessionDraftRepository.archiveKeyOf('sess-1'));
      await drafts.save(archived.copyWith(pendingSubmission: false, rejected: true));

      expect((await drafts.latest())!.sessionId, 'sess-2');
      expect((await live.first)!.sessionId, 'sess-2');
      // The archive row was still written.
      expect((await drafts.bySessionId('sess-1'))!.rejected, isTrue);
    });
  });

  group('sync-session-r2-05: a submit that lands after an account switch', () {
    test('stays out of the next student\'s cache and results, and still clears its own draft', () async {
      final db = newTestDb();
      addTearDown(db.close);
      final now = DateTime.utc(2026, 10, 12, 17, 12);
      var signedIn = 'u1';
      final scope = LocalScope(db, () => signedIn, () => now);
      final drafts = SessionDraftRepository(scope);
      final pending = PendingResultRepository(scope);
      final cached = <Map<String, dynamic>>[];
      final api = _HeldApi();
      final submitter = SessionSubmitter(
        api: api,
        drafts: drafts,
        pendingResults: pending,
        cacheAttempt: (a) async => cached.add(a),
        signedInUserId: () => scope.userIdOrNull,
        now: () => now,
      );
      final clock = SessionClock(monotonicMs: () => 0, wallMs: () => 0)..anchor(serverNowMs: 0, startedAtMs: 0, expiresAtMs: 600000);
      final journal = await SessionJournal.open(db, userId: 'u1', sessionId: 'sess-1');
      await journal.recordAnswer('q1', 2, clock);
      final draft = draftOf(endsAtWallMs: 600000);
      await drafts.save(draft);

      final sending = submitter.submit(draft: draft, journal: journal, durationMs: 600000);
      await _settle();
      // Student A signs out and B signs in while the reply is still on its way.
      signedIn = 'u2';
      api.hold.complete();
      final outcome = await sending;

      expect(outcome, isA<SubmitReceived>());
      expect(cached, isEmpty);
      expect(await db.select(db.pendingResults).get(), isEmpty);
      expect(await db.select(db.sessionDrafts).get(), isEmpty);
      expect(await db.select(db.answerJournal).get(), isEmpty);
    });

    test('the same student still gets the cache and the result note', () async {
      final db = newTestDb();
      addTearDown(db.close);
      final now = DateTime.utc(2026, 10, 12, 17, 12);
      final scope = LocalScope(db, () => 'u1', () => now);
      final cached = <Map<String, dynamic>>[];
      final submitter = SessionSubmitter(
        api: FakeSessionApi(),
        drafts: SessionDraftRepository(scope),
        pendingResults: PendingResultRepository(scope),
        cacheAttempt: (a) async => cached.add(a),
        signedInUserId: () => scope.userIdOrNull,
        now: () => now,
      );
      final journal = await SessionJournal.open(db, userId: 'u1', sessionId: 'sess-1');
      final outcome = await submitter.submit(draft: draftOf(endsAtWallMs: 600000), journal: journal, durationMs: 600000);
      expect(outcome, isA<SubmitReceived>());
      expect(cached.single['id'], 'sess-1');
      expect((await db.select(db.pendingResults).get()).single.userId, 'u1');
    });
  });

  group('sync-session-r2-06: the backup job never leaves "Sending" pinned', () {
    late AppDatabase db;
    late FakeHttpAdapter http;
    late _Gateway gateway;
    late DateTime now;
    late BackgroundEnvironment env;
    final endsAt = DateTime.utc(2026, 10, 12, 17, 42);

    setUp(() async {
      db = newTestDb();
      http = FakeHttpAdapter();
      gateway = _Gateway();
      now = endsAt.add(const Duration(seconds: 30));
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
      await SessionDraftRepository(LocalScope(db, () => 'u1', () => now)).save(draftOf(endsAtWallMs: endsAt.millisecondsSinceEpoch, mockNumber: 7));
      final clock = SessionClock(monotonicMs: () => 0, wallMs: () => 0)..anchor(serverNowMs: 0, startedAtMs: 0, expiresAtMs: 600000);
      final journal = await SessionJournal.open(db, userId: 'u1', sessionId: 'sess-1');
      await journal.recordAnswer('q1', 1, clock);
    });

    tearDown(() => db.close());

    Map<String, dynamic> input() => {'userId': 'u1', 'sessionId': 'sess-1', 'draftKey': 'k'};

    test('a closed window replaces it with a status that can be swiped away', () async {
      http.replies
        ..add(const FakeReply(422, {'error': 'SESSION_EXPIRED'}))
        ..add(const FakeReply(404, {'error': 'Attempt not found'}));
      expect(await runSubmitSessionTask(env, input()), isTrue);
      final last = gateway.shown.single;
      expect(last.title, 'Mock 7 not recorded');
      expect(last.body, 'The time to send it ended before it reached MockMob.');
      expect(last.ongoing, isFalse);
    });

    test('a refusal says it was not recorded', () async {
      http.replies.add(const FakeReply(422, {'error': 'invalid_answer'}));
      expect(await runSubmitSessionTask(env, input()), isTrue);
      expect(gateway.shown.single.title, 'Mock 7 not recorded');
      expect(gateway.shown.single.body, 'MockMob could not accept these answers.');
      expect(gateway.shown.single.ongoing, isFalse);
    });

    test('the last retry after the window says the answers were not sent', () async {
      now = endsAt.add(const Duration(minutes: 5));
      http.replies.add(const FakeReply.network());
      expect(await runSubmitSessionTask(env, input()), isTrue);
      expect(gateway.shown.single.title, 'Mock 7 not sent');
      expect(gateway.shown.single.body, 'Your answers are still on this phone. The time to send them has ended.');
      expect(gateway.shown.single.ongoing, isFalse);
    });

    test('a retry inside the window leaves "Sending" as it is', () async {
      http.replies.add(const FakeReply.network());
      expect(await runSubmitSessionTask(env, input()), isFalse);
      expect(gateway.shown, isEmpty);
      expect(gateway.cancelled, isEmpty);
    });

    test('a draft settled earlier clears the status', () async {
      await SessionDraftRepository(LocalScope(db, () => 'u1', () => now)).save(draftOf(endsAtWallMs: endsAt.millisecondsSinceEpoch, windowClosed: true));
      expect(await runSubmitSessionTask(env, input()), isTrue);
      expect(gateway.cancelled, hasLength(1));
    });

    test('the status of another paper open on screen is left alone', () async {
      await SessionHeartbeat(db, userId: 'u1', now: () => now).beat('sess-2');
      http.replies.add(const FakeReply(422, {'error': 'invalid_answer'}));
      expect(await runSubmitSessionTask(env, input()), isTrue);
      expect(gateway.shown, isEmpty);
      expect(gateway.cancelled, isEmpty);
    });
  });

  group('sync-session-r2-07: a new paper never overwrites unsent answers', () {
    late AppDatabase db;
    late FakeSessionApi api;
    late _Scheduler scheduler;
    late SessionDraftRepository drafts;
    late int wall;
    late SessionEngineServices services;
    final engines = <SessionEngine>[];

    setUp(() {
      db = newTestDb();
      api = FakeSessionApi();
      scheduler = _Scheduler();
      wall = 2000000;
      final scope = LocalScope(db, () => 'u1', () => DateTime.fromMillisecondsSinceEpoch(wall));
      drafts = SessionDraftRepository(scope);
      final timers = ManualTimers();
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
        clockFactory: () => SessionClock(monotonicMs: () => wall - 2000000, wallMs: () => wall),
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

    Future<SessionEngine> start(String id, {String? ticket}) async {
      final view = sessionViewOf(id: id, count: 3, startedAt: 1000000, expiresAt: 1600000, serverNow: 1000000, ticket: ticket);
      final e = await SessionEngine.start(services: services, view: view, subject: 'accountancy', mode: 'full', count: 3, generationKey: 'gen-$id');
      engines.add(e);
      return e;
    }

    Future<SessionDraft> leaveUnsubmitted(SessionEngine e) async {
      await e.selectAnswer('q1', 1);
      await e.flushDraft();
      e.dispose();
      final saved = (await drafts.bySessionId(e.draft.sessionId))!;
      expect(saved.pendingSubmission, isFalse);
      return saved;
    }

    test('ticket mode: an expired paper that was never submitted is sent before the new one starts', () async {
      final first = await leaveUnsubmitted(await start('sess-1', ticket: 'p2.a.b.c'));
      wall = first.endsAtWallMs + 30000; // deadline passed, the backup job has not run

      await start('sess-2', ticket: 'p2.d.e.f');
      await _settle();

      expect(api.submits.first['sessionId'], 'sess-1');
      expect(api.submits.first['answers'], {'q1': 1});
      expect(await drafts.bySessionId('sess-2'), isNotNull);
    });

    test('durable mode: unacknowledged answers of an expired paper are sent', () async {
      api.putFailure = () => const ApiError(kind: ApiErrorKind.network, code: 'network');
      final first = await leaveUnsubmitted(await start('sess-1'));
      wall = first.endsAtWallMs + 30000;
      api.putFailure = null;

      await start('sess-2');
      await _settle();

      expect(api.submits.first['sessionId'], 'sess-1');
      expect(api.submits.first['answers'], {'q1': 1});
    });

    test('an unsent paper still running is archived for the backup job, not sent early', () async {
      final first = await leaveUnsubmitted(await start('sess-1', ticket: 'p2.a.b.c'));

      await start('sess-2', ticket: 'p2.d.e.f');
      await _settle();

      expect(api.submits, isEmpty);
      final kept = (await drafts.bySessionId('sess-1'))!;
      expect(kept.draftKey, SessionDraftRepository.archiveKeyOf('sess-1'));
      final job = scheduler.jobs.singleWhere((j) => j.$1 == SessionDraftRepository.archiveKeyOf('sess-1'));
      expect(job.$2.millisecondsSinceEpoch, first.endsAtWallMs - 90000);
      final journal = await SessionJournal.open(db, userId: 'u1', sessionId: 'sess-1');
      expect(journal.answers, {'q1': 1});
    });

    test('a paper with nothing unsent is replaced as before', () async {
      final e = await start('sess-1', ticket: 'p2.a.b.c');
      await e.flushDraft();
      e.dispose();
      wall += 700000;

      await start('sess-2', ticket: 'p2.d.e.f');
      await _settle();

      expect(api.submits, isEmpty);
      expect(await drafts.bySessionId('sess-1'), isNull);
    });
  });
}

/// A session API whose submit reply waits until [hold] completes.
class _HeldApi extends FakeSessionApi {
  final hold = Completer<void>();

  @override
  Future<Map<String, dynamic>> submit({
    required String sessionId,
    String? sessionTicket,
    required Map<String, int> answers,
    required List<SessionEvent> events,
    String? forUserId,
  }) async {
    await hold.future;
    return super.submit(sessionId: sessionId, sessionTicket: sessionTicket, answers: answers, events: events, forUserId: forUserId);
  }
}
