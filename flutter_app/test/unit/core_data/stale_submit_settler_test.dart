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
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/pending_result_repository.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/pending_work.dart';
import 'package:mockmob/core/sync/session/session_heartbeat.dart';
import 'package:mockmob/core/sync/session/session_journal.dart';
import 'package:mockmob/core/sync/session/session_clock.dart';
import 'package:mockmob/core/sync/session/session_submitter.dart';
import 'package:mockmob/core/sync/session/session_work_scheduler.dart';
import 'package:mockmob/core/sync/session/stale_submit_settler.dart';
import 'package:mockmob/core/widgets/bar/bar_live.dart';

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
      api.attemptOnFetch = {'id': 'sess-1', 'subject': 'computer_science', 'correct': 1, 'total': 3};
      final settled = await settler().settle();
      expect(settled.single.outcome, isA<SubmitReceived>());
      expect(api.fetchCalls, 1);
      // Past the window nothing is posted again: the server is only asked.
      expect(api.submits, isEmpty);
      expect(await drafts.bySessionId('sess-1'), isNull);
      expect((await pending.unopened()).single.attemptId, 'sess-1');
      expect(scheduler.cancelled, ['sess-1']);
    });

    test('his state, not received and the window closed: marked window-closed, never "Sending"', () async {
      await hisDraft(endsAtWallMs: hourAgo);
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
      expect((await drafts.bySessionId('sess-1'))!.pendingSubmission, isTrue);
      online = true;
      api.attemptOnFetch = null;
      await settler().settle();
      expect((await drafts.bySessionId('sess-1'))!.windowClosed, isTrue);
    });

    test('the server could not be asked: the draft is kept as it was', () async {
      await hisDraft(endsAtWallMs: hourAgo);
      api.fetchFailure = const ApiError(kind: ApiErrorKind.network, code: 'network');
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
      api.attemptOnFetch = null;
      final settled = await settler().settle();
      expect([for (final s in settled) s.sessionId], ['sess-1']);
      expect(await drafts.owedSubmits(), isEmpty);
    });
  });
}
