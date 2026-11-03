// LK50 (3 Nov 2026): on the owner's main account every screen said "Sending your answers · Computer
// Science mock" for good. A local draft kept `pendingSubmission` after its window had passed (the app was
// closed when it ended, or the backup job gave up when the background token refresher lost the session),
// and the strip showed whenever that flag was set. These tests reproduce his state and the settle paths.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/app_overrides.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/api_providers.dart' show nowProvider;
import 'package:mockmob/core/connectivity/connectivity_monitor.dart' show NetworkStatus;
import 'package:mockmob/core/connectivity/connectivity_providers.dart' show networkStatusProvider, NetworkStatusNotifier;
import 'package:mockmob/core/domain/session_rules.dart';
import 'package:mockmob/core/models/session_draft.dart';
import 'package:mockmob/core/notifications/notification_channels.dart';
import 'package:mockmob/core/notifications/notification_gateway.dart';
import 'package:mockmob/core/notifications/notification_ids.dart';
import 'package:mockmob/core/notifications/notification_planner.dart' show NotificationActionSpec;
import 'package:mockmob/core/notifications/notification_service.dart';
import 'package:timezone/timezone.dart' as tz;
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/pending_result_repository.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/pending_work.dart';
import 'package:mockmob/core/sync/session/session_heartbeat.dart';
import 'package:mockmob/core/sync/session/session_journal.dart';
import 'package:mockmob/core/sync/session/session_notifications.dart';
import 'package:mockmob/core/sync/session/session_clock.dart';
import 'package:mockmob/core/sync/session/session_submitter.dart';
import 'package:mockmob/core/sync/session/session_work_scheduler.dart';
import 'package:mockmob/core/sync/session/stale_submit_settler.dart';
import 'package:mockmob/core/widgets/bar/bar_live.dart';

import '../notifications/support.dart' show prefsWith;
import 'support/fakes.dart';
import 'support/fixtures.dart';
import 'support/test_db.dart';

class _Scheduler implements SessionWorkScheduler {
  final scheduled = <String>[];
  final cancelled = <String>[];
  bool fail = false;

  @override
  Future<void> scheduleSubmit({required String userId, required String sessionId, required String draftKey, required DateTime runAt}) async {
    if (fail) throw StateError('WorkManager not ready');
    scheduled.add(sessionId);
  }

  @override
  Future<void> cancelSubmit(String sessionId) async => cancelled.add(sessionId);
}

/// [FakeSessionApi] whose attempt read can fail like a phone with no network.
class _Api extends FakeSessionApi {
  Object? fetchFailure;

  @override
  Future<Map<String, dynamic>?> fetchAttempt(String attemptId, {String? forUserId}) async {
    if (fetchFailure != null) {
      fetchCalls++;
      throw fetchFailure!;
    }
    return super.fetchAttempt(attemptId, forUserId: forUserId);
  }
}

/// A gateway that keeps the shade in order: what was shown (and whether it was pinned) and cancelled.
class _Gateway implements LocalNotificationsGateway {
  final events = <({String op, int id, String? title, bool ongoing})>[];

  /// What the shade holds under [id] now: the last show that no cancel followed, else null.
  ({String title, bool ongoing})? shade(int id) {
    ({String title, bool ongoing})? out;
    for (final e in events) {
      if (e.id != id) continue;
      out = e.op == 'show' ? (title: e.title!, ongoing: e.ongoing) : null;
    }
    return out;
  }

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
  }) async => events.add((op: 'show', id: id, title: title, ongoing: ongoing));

  @override
  Future<void> cancel(int id) async => events.add((op: 'cancel', id: id, title: null, ongoing: false));

  @override
  Future<void> cancelAll() async {}

  @override
  Future<bool> areNotificationsEnabled() async => true;
}

/// A shade that fails on every call, like a plugin that is not ready.
class _ThrowingGateway extends _Gateway {
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
  }) async => throw StateError('plugin');

  @override
  Future<void> cancel(int id) async => throw StateError('plugin');
}

class _Network extends NetworkStatusNotifier {
  _Network(this.value);
  final NetworkStatus value;
  @override
  NetworkStatus build() => value;
}

void main() {
  // The owner's evening: the paper ended an hour before he opened the app again.
  final now = DateTime.utc(2026, 11, 3, 8, 0);
  final nowMs = now.millisecondsSinceEpoch;
  final hourAgo = nowMs - const Duration(hours: 1).inMilliseconds;

  late AppDatabase db;
  late _Api api;
  late SessionDraftRepository drafts;
  late PendingResultRepository pending;
  late _Scheduler scheduler;
  late _Gateway gateway;
  late NotificationService notifications;
  late Map<String, bool> live;
  var online = true;

  StaleSubmitSettler settler() => StaleSubmitSettler(
        db: db,
        userId: 'u1',
        drafts: drafts,
        submitter: SessionSubmitter(api: api, drafts: drafts, pendingResults: pending, cacheAttempt: (_) async {}, now: () => now),
        scheduler: scheduler,
        isOnline: () => online,
        onRetryLive: (id, l) => live[id] = l,
        notifications: notifications,
        now: () => now,
      );

  final statusId = notificationIdFor(mockInProgressTaskId);

  NotificationService serviceOn(LocalNotificationsGateway g) => NotificationService(
        gateway: g,
        ledger: MemoryNotificationLedgerStore(),
        prefs: () => prefsWith(),
        weeklyCap: () async => 3,
        createdChannels: () async => {},
        saveCreatedChannels: (_) async {},
        now: () => now,
      );

  /// His draft: a Computer Science mock, answers on the phone, `pendingSubmission` still set.
  Future<SessionDraft> hisDraft({required int endsAtWallMs}) async {
    final draft = draftOf(endsAtWallMs: endsAtWallMs, pending: true, subject: 'computer_science');
    await drafts.save(draft);
    final clock = SessionClock(monotonicMs: () => 0, wallMs: () => 0)..anchor(serverNowMs: 0, startedAtMs: 0, expiresAtMs: 600000);
    final journal = await SessionJournal.open(db, userId: 'u1', sessionId: draft.sessionId);
    await journal.recordVisit('q1', clock);
    await journal.recordAnswer('q1', 2, clock);
    return draft;
  }

  setUp(() {
    db = newTestDb();
    api = _Api();
    final scope = LocalScope(db, () => 'u1', () => now);
    drafts = SessionDraftRepository(scope);
    pending = PendingResultRepository(scope);
    scheduler = _Scheduler();
    gateway = _Gateway();
    notifications = serviceOn(gateway);
    live = {};
    online = true;
  });

  tearDown(() => db.close());

  group('the strip shows only a submit that can still happen', () {
    test('his state on a cold start: pending, endsAt an hour ago, nothing running: no "Sending"', () async {
      final draft = await hisDraft(endsAtWallMs: hourAgo);
      expect(submitCanStillHappen(draft, nowMs: nowMs, retryLive: false), isFalse);
      // Even a retry someone believes is queued cannot send it: the server's window is closed.
      expect(submitCanStillHappen(draft, nowMs: nowMs, retryLive: true), isFalse);
      // And it is not network work either, so the connectivity pings stop.
      expect(submitStillOwed(draft, nowMs: nowMs), isFalse);
    });

    test('the backup job gave up (refresher lost the session) inside the window: no retry, no "Sending"', () async {
      final draft = await hisDraft(endsAtWallMs: nowMs - 30000);
      expect(submitStillOwed(draft, nowMs: nowMs), isTrue);
      expect(submitCanStillHappen(draft, nowMs: nowMs, retryLive: false), isFalse);
      expect(submitCanStillHappen(draft, nowMs: nowMs, retryLive: true), isTrue);
    });

    test('settled drafts never say "Sending"', () {
      final base = draftOf(endsAtWallMs: nowMs + 60000, pending: true);
      expect(submitCanStillHappen(base, nowMs: nowMs, retryLive: true), isTrue);
      expect(submitCanStillHappen(base.copyWith(windowClosed: true), nowMs: nowMs, retryLive: true), isFalse);
      expect(submitCanStillHappen(base.copyWith(rejected: true), nowMs: nowMs, retryLive: true), isFalse);
      expect(submitCanStillHappen(base.copyWith(pendingSubmission: false), nowMs: nowMs, retryLive: true), isFalse);
      // The last moment the server takes it, and the first it does not.
      final edge = draftOf(endsAtWallMs: nowMs - submissionGraceMs + 1, pending: true);
      expect(submitCanStillHappen(edge, nowMs: nowMs, retryLive: true), isTrue);
      final past = draftOf(endsAtWallMs: nowMs - submissionGraceMs, pending: true);
      expect(submitCanStillHappen(past, nowMs: nowMs, retryLive: true), isFalse);
    });

    group('the bar provider as the app wires it', () {
      ProviderContainer container(SessionDraft? draft, {Set<String> retries = const {}, Set<String> engines = const {}}) {
        final c = ProviderContainer(overrides: [
          ...liveAppOverrides(),
          latestSessionDraftProvider.overrideWith((ref) => Stream.value(draft)),
          networkStatusProvider.overrideWith(() => _Network(NetworkStatus.online)),
          nowProvider.overrideWithValue(() => now),
        ]);
        for (final id in retries) {
          c.read(submitRetryRegistryProvider.notifier).set(id, live: true);
        }
        for (final key in engines) {
          c.read(pendingWorkRegistryProvider.notifier).set(key, pending: true);
        }
        addTearDown(c.dispose);
        return c;
      }

      Future<String?> sending(ProviderContainer c) async {
        // Listened to, as the bar listens: an unlistened provider is paused.
        final sub = c.listen(barSendingInputProvider, (_, _) {});
        addTearDown(sub.close);
        await c.read(latestSessionDraftProvider.future);
        return c.read(barSendingInputProvider);
      }

      test('his stale draft: no strip on any screen', () async {
        final draft = draftOf(endsAtWallMs: hourAgo, pending: true, subject: 'computer_science');
        expect(await sending(container(draft, retries: {'sess-1'}, engines: {'session:sess-1'})), isNull);
      });

      test('inside the window with nothing retrying: no strip', () async {
        final draft = draftOf(endsAtWallMs: nowMs - 30000, pending: true);
        expect(await sending(container(draft)), isNull);
      });

      test('inside the window with the job queued or the engine sending: the strip shows', () async {
        final draft = draftOf(endsAtWallMs: nowMs - 30000, pending: true);
        expect(await sending(container(draft, retries: {'sess-1'})), isNotNull);
        expect(await sending(container(draft, engines: {'session:sess-1'})), isNotNull);
      });
    });
  });

  group('the start/resume settler', () {
    test('his state, received by the server: the draft clears and the result path takes over', () async {
      await hisDraft(endsAtWallMs: hourAgo);
      api.submitFailure = const ApiError(kind: ApiErrorKind.conflict, code: 'SESSION_EXPIRED');
      api.attemptOnFetch = {'id': 'sess-1', 'subject': 'computer_science', 'correct': 1, 'total': 3};
      final settled = await settler().settle();
      expect(settled.single.outcome, isA<SubmitReceived>());
      // The server judges the window: the POST goes first, its SESSION_EXPIRED leads to the read.
      expect(api.submits, hasLength(1));
      expect(api.fetchCalls, 1);
      expect(await drafts.bySessionId('sess-1'), isNull);
      expect((await pending.unopened()).single.attemptId, 'sess-1');
      expect(scheduler.cancelled, ['sess-1']);
    });

    test('his state, not received and the window closed: marked window-closed, never "Sending"', () async {
      await hisDraft(endsAtWallMs: hourAgo);
      api.submitFailure = const ApiError(kind: ApiErrorKind.conflict, code: 'SESSION_EXPIRED');
      api.attemptOnFetch = null;
      final settled = await settler().settle();
      expect(settled.single.outcome, isA<SubmitWindowClosed>());
      final saved = (await drafts.bySessionId('sess-1'))!;
      expect(saved.windowClosed, isTrue);
      expect(saved.pendingSubmission, isFalse);
      // The answers stay on the phone; Today's missed-submit copy reads them.
      expect(await db.select(db.answerJournal).get(), isNotEmpty);
      expect(await pending.unopened(), isEmpty);
      expect(submitCanStillHappen(saved, nowMs: nowMs, retryLive: true), isFalse);
      expect(endedMockOutcome(attemptExistsOnServer: false, endsAtMs: saved.endsAtWallMs, nowMs: nowMs), EndedMockOutcome.windowClosed);
    });

    test('offline: nothing is asked and nothing changes until online', () async {
      await hisDraft(endsAtWallMs: hourAgo);
      online = false;
      expect(await settler().settle(), isEmpty);
      expect(api.fetchCalls, 0);
      expect(api.submits, isEmpty);
      expect((await drafts.bySessionId('sess-1'))!.pendingSubmission, isTrue);
      online = true;
      api.submitFailure = const ApiError(kind: ApiErrorKind.conflict, code: 'SESSION_EXPIRED');
      api.attemptOnFetch = null;
      await settler().settle();
      expect((await drafts.bySessionId('sess-1'))!.windowClosed, isTrue);
    });

    test('the server could not be asked: the draft is kept as it was', () async {
      await hisDraft(endsAtWallMs: hourAgo);
      api.submitFailure = const ApiError(kind: ApiErrorKind.network, code: 'network');
      final settled = await settler().settle();
      expect(settled.single.outcome, isA<SubmitPending>());
      final saved = (await drafts.bySessionId('sess-1'))!;
      expect(saved.pendingSubmission, isTrue);
      expect(saved.windowClosed, isFalse);
      expect(scheduler.cancelled, isEmpty);
    });

    test('refresher gave up inside the window: the foreground sends it now and it is received', () async {
      await hisDraft(endsAtWallMs: nowMs - 30000);
      final settled = await settler().settle();
      expect(settled.single.outcome, isA<SubmitReceived>());
      expect(api.submits.single['answers'], {'q1': 2});
      expect(await drafts.bySessionId('sess-1'), isNull);
      expect(live['sess-1'], isFalse);
    });

    test('inside the window and the send fails: the job is queued again and the retry counts as live', () async {
      await hisDraft(endsAtWallMs: nowMs - 30000);
      api.submitFailure = const ApiError(kind: ApiErrorKind.timeout, code: 'timeout');
      final settled = await settler().settle();
      expect(settled.single.outcome, isA<SubmitPending>());
      expect(scheduler.scheduled, ['sess-1']);
      expect(live['sess-1'], isTrue);
      expect((await drafts.bySessionId('sess-1'))!.pendingSubmission, isTrue);
    });

    test('inside the window, the send fails and no job can be queued: no live retry, so no "Sending"', () async {
      await hisDraft(endsAtWallMs: nowMs - 30000);
      api.submitFailure = const ApiError(kind: ApiErrorKind.timeout, code: 'timeout');
      scheduler.fail = true;
      await settler().settle();
      expect(live['sess-1'], isFalse);
    });

    test('a paper its engine has open on screen is left to the engine', () async {
      await hisDraft(endsAtWallMs: hourAgo);
      await SessionHeartbeat(db, userId: 'u1', now: () => now).beat('sess-1');
      expect(await settler().settle(), isEmpty);
      expect(api.fetchCalls, 0);
    });

    test('an archived owed paper is settled too, and settled drafts are not asked about again', () async {
      final draft = await hisDraft(endsAtWallMs: hourAgo);
      await drafts.archive(draft);
      await drafts.save(draftOf(endsAtWallMs: hourAgo, sessionId: 'sess-2', windowClosed: true, generationKey: 'g2'));
      api.submitFailure = const ApiError(kind: ApiErrorKind.conflict, code: 'SESSION_EXPIRED');
      api.attemptOnFetch = null;
      final settled = await settler().settle();
      expect([for (final s in settled) s.sessionId], ['sess-1']);
      expect(await drafts.owedSubmits(), isEmpty);
    });
  });

  group('settling the paper also settles the pinned "Sending" status and keeps the draft order', () {
    /// The shade as an engine left it when the app went to the background mid-send.
    Future<SessionDraft> pinnedSending({required int endsAtWallMs}) async {
      final draft = await hisDraft(endsAtWallMs: endsAtWallMs);
      await NotificationSessionStatusNotifier(notifications).showSending(draft);
      expect(gateway.shade(statusId)!.ongoing, isTrue);
      return draft;
    }

    const expired = ApiError(kind: ApiErrorKind.conflict, code: 'SESSION_EXPIRED');

    test('received: the pinned "Sending" is cancelled (sending-strip-1)', () async {
      await pinnedSending(endsAtWallMs: hourAgo);
      api.submitFailure = expired;
      api.attemptOnFetch = {'id': 'sess-1', 'subject': 'computer_science', 'correct': 1, 'total': 3};
      expect((await settler().settle()).single.outcome, isA<SubmitReceived>());
      expect(gateway.shade(statusId), isNull);
      expect(scheduler.cancelled, ['sess-1']);
    });

    test('received inside the window: the pinned "Sending" is cancelled too', () async {
      await pinnedSending(endsAtWallMs: nowMs - 30000);
      expect((await settler().settle()).single.outcome, isA<SubmitReceived>());
      expect(gateway.shade(statusId), isNull);
    });

    test('window closed: "Sending" is replaced by the not-recorded post, which can be swiped away', () async {
      await pinnedSending(endsAtWallMs: hourAgo);
      api.submitFailure = expired;
      api.attemptOnFetch = null;
      expect((await settler().settle()).single.outcome, isA<SubmitWindowClosed>());
      final shade = gateway.shade(statusId)!;
      expect(shade.title, 'Mock 7 not recorded');
      expect(shade.ongoing, isFalse);
    });

    test('rejected: replaced by the could-not-accept post', () async {
      await pinnedSending(endsAtWallMs: nowMs - 30000);
      api.submitFailure = const ApiError(kind: ApiErrorKind.validation, code: 'validation', status: 400);
      expect((await settler().settle()).single.outcome, isA<SubmitRejected>());
      final shade = gateway.shade(statusId)!;
      expect(shade.title, 'Mock 7 not recorded');
      expect(shade.ongoing, isFalse);
    });

    test('another paper is open on screen: its status is left alone', () async {
      await pinnedSending(endsAtWallMs: hourAgo);
      await SessionHeartbeat(db, userId: 'u1', now: () => now).beat('sess-other');
      api.submitFailure = expired;
      api.attemptOnFetch = null;
      expect((await settler().settle()).single.outcome, isA<SubmitWindowClosed>());
      final shade = gateway.shade(statusId)!;
      expect(shade.title, 'Sending Mock 7');
      expect(shade.ongoing, isTrue);
    });

    test('still pending with the job queued: the "Sending" stays, a retry is running', () async {
      await pinnedSending(endsAtWallMs: nowMs - 30000);
      api.submitFailure = const ApiError(kind: ApiErrorKind.timeout, code: 'timeout');
      await settler().settle();
      expect(scheduler.scheduled, ['sess-1']);
      expect(gateway.shade(statusId)!.ongoing, isTrue);
    });

    test('still pending and no job could be queued: nothing is being sent, so "Sending" is taken down', () async {
      await pinnedSending(endsAtWallMs: nowMs - 30000);
      api.submitFailure = const ApiError(kind: ApiErrorKind.timeout, code: 'timeout');
      scheduler.fail = true;
      await settler().settle();
      expect(gateway.shade(statusId), isNull);
    });

    test('a notification failure never blocks settling', () async {
      await hisDraft(endsAtWallMs: hourAgo);
      api.submitFailure = expired;
      api.attemptOnFetch = null;
      final broken = StaleSubmitSettler(
        db: db,
        userId: 'u1',
        drafts: drafts,
        submitter: SessionSubmitter(api: api, drafts: drafts, pendingResults: pending, cacheAttempt: (_) async {}, now: () => now),
        scheduler: scheduler,
        isOnline: () => true,
        notifications: serviceOn(_ThrowingGateway()),
        now: () => now,
      );
      expect((await broken.settle()).single.outcome, isA<SubmitWindowClosed>());
      expect((await drafts.bySessionId('sess-1'))!.windowClosed, isTrue);
      expect(scheduler.cancelled, ['sess-1']);
    });

    test('past the local window the phone does not decide: the server still takes the POST (sending-strip-2)', () async {
      // The phone's clock ran slow when the paper started and was corrected since: locally the window
      // is long gone, the server's is not.
      await hisDraft(endsAtWallMs: hourAgo);
      final settled = await settler().settle();
      expect(settled.single.outcome, isA<SubmitReceived>());
      expect(api.submits, hasLength(1));
      expect(api.submits.single['answers'], {'q1': 2});
      expect(await drafts.bySessionId('sess-1'), isNull);
      expect(await drafts.owedSubmits(), isEmpty);
    });

    test('an old owed paper settled as window-closed does not displace a newer running paper (sending-strip-3)', () async {
      final older = SessionDraftRepository(LocalScope(db, () => 'u1', () => now.subtract(const Duration(days: 2))));
      final newer = SessionDraftRepository(LocalScope(db, () => 'u1', () => now.subtract(const Duration(minutes: 10))));
      // M: an Accountancy mock owed since two days ago, in its own selection row.
      await older.save(draftOf(endsAtWallMs: nowMs - const Duration(days: 2).inMilliseconds, pending: true));
      // P: an Economics practice the student is halfway through, started later.
      await newer.save(draftOf(endsAtWallMs: nowMs + 900000, sessionId: 'sess-2', subject: 'economics', mode: 'practice', mockNumber: null, generationKey: 'g2'));
      expect((await drafts.latest())!.sessionId, 'sess-2');

      api.submitFailure = expired;
      api.attemptOnFetch = null;
      final settled = await settler().settle();
      expect([for (final s in settled) s.sessionId], ['sess-1']);
      expect(settled.single.outcome, isA<SubmitWindowClosed>());
      final m = (await drafts.bySessionId('sess-1'))!;
      expect(m.windowClosed, isTrue);
      // M keeps the time it was last worked on, so P's Resume is still the latest.
      expect(m.updatedAtMs, now.subtract(const Duration(days: 2)).millisecondsSinceEpoch);
      expect((await drafts.latest())!.sessionId, 'sess-2');
    });
  });
}
