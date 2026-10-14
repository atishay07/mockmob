// Regression tests for the core sync bug hunt (14 Oct 2026): sync-storage-api-01, 03, 04, 05, 10.
import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/session.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/pending_result_repository.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/session/session_clock.dart';
import 'package:mockmob/core/sync/session/session_engine.dart';
import 'package:mockmob/core/sync/session/session_journal.dart';
import 'package:mockmob/core/sync/session/session_submitter.dart';
import 'package:mockmob/core/sync/session/session_syncer.dart';
import 'package:mockmob/core/sync/session/session_work_scheduler.dart';

import 'support/fakes.dart';
import 'support/fixtures.dart';
import 'support/test_db.dart';

/// A session API whose next submit or PUT can be held open, like a slow 3G link.
class _SlowApi extends FakeSessionApi {
  Completer<void>? submitHold;
  Completer<void>? putHold;

  @override
  Future<Map<String, dynamic>> submit({
    required String sessionId,
    String? sessionTicket,
    required Map<String, int> answers,
    required List<SessionEvent> events,
    String? forUserId,
  }) async {
    final hold = submitHold;
    if (hold != null) await hold.future;
    return super.submit(sessionId: sessionId, sessionTicket: sessionTicket, answers: answers, events: events, forUserId: forUserId);
  }

  @override
  Future<int> putEvents({required String sessionId, required List<SessionEvent> events}) async {
    final hold = putHold;
    putHold = null;
    if (hold != null) await hold.future;
    return super.putEvents(sessionId: sessionId, events: events);
  }
}

class _Scheduler implements SessionWorkScheduler {
  final List<String> keys = [];

  @override
  Future<void> scheduleSubmit({required String userId, required String sessionId, required String draftKey, required DateTime runAt}) async => keys.add(draftKey);

  @override
  Future<void> cancelSubmit(String sessionId) async {}
}

void main() {
  late AppDatabase db;
  late _SlowApi api;
  late ManualTimers timers;
  late _Scheduler scheduler;
  late SessionDraftRepository drafts;
  late int mono;
  late int wall;
  late SessionEngineServices services;
  final engines = <SessionEngine>[];

  setUp(() {
    db = newTestDb();
    api = _SlowApi();
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

  Future<SessionEngine> start({String id = 'sess-1', String generationKey = 'gen-1'}) async {
    final view = sessionViewOf(id: id, count: 3, startedAt: 1000000, expiresAt: 1600000, serverNow: 1000000);
    final e = await SessionEngine.start(services: services, view: view, subject: 'accountancy', mode: 'full', count: 3, generationKey: generationKey);
    engines.add(e);
    return e;
  }

  Future<void> settle([int rounds = 20]) async {
    for (var i = 0; i < rounds; i++) {
      await Future<void>.delayed(Duration.zero);
    }
  }

  group('sync-storage-api-01: a slow earlier submit never holds the new start', () {
    test('the new paper opens after the short wait, and the late submit cannot touch it', () async {
      final first = await start();
      await first.selectAnswer('q1', 1);
      api.submitFailure = const ApiError(kind: ApiErrorKind.network, code: 'network');
      await first.submit();
      first.dispose();
      engines.remove(first);
      api.submitFailure = null;
      scheduler.keys.clear();

      // The earlier submit hangs on a slow link.
      api.submitHold = Completer<void>();
      final second = await start(id: 'sess-2', generationKey: 'gen-2').timeout(const Duration(seconds: 2));
      expect(second.draft.sessionId, 'sess-2');
      expect(api.submits.single['sessionId'], 'sess-1');
      // The earlier answers are archived and the backup job is queued for them.
      final kept = (await drafts.bySessionId('sess-1'))!;
      expect(kept.draftKey, SessionDraftRepository.archiveKeyOf('sess-1'));
      expect(kept.pendingSubmission, isTrue);
      expect(scheduler.keys, contains(SessionDraftRepository.archiveKeyOf('sess-1')));

      // The slow submit lands later: the earlier draft is cleared, the new one is untouched.
      api.submitHold!.complete();
      await settle();
      expect(await drafts.bySessionId('sess-1'), isNull);
      final now = (await drafts.byKey(second.draft.draftKey))!;
      expect(now.sessionId, 'sess-2');
    });

    test('a late refusal is written to the archive row, not the new paper', () async {
      final first = await start();
      api.submitFailure = const ApiError(kind: ApiErrorKind.network, code: 'network');
      await first.submit();
      first.dispose();
      engines.remove(first);

      api.submitHold = Completer<void>();
      api.submitFailure = const ApiError(status: 422, kind: ApiErrorKind.validation, code: 'invalid_answer');
      final second = await start(id: 'sess-2', generationKey: 'gen-2').timeout(const Duration(seconds: 2));
      api.submitHold!.complete();
      await settle();

      final old = (await drafts.bySessionId('sess-1'))!;
      expect(old.rejected, isTrue);
      expect(old.draftKey, SessionDraftRepository.archiveKeyOf('sess-1'));
      final current = (await drafts.byKey(second.draft.draftKey))!;
      expect(current.sessionId, 'sess-2');
      expect(current.rejected, isFalse);
    });
  });

  group('sync-storage-api-03: only a clear refusal ends a submit', () {
    for (final failure in [
      ApiError.fromResponse(408, const {}),
      ApiError.fromResponse(425, const {}),
      ApiError.fromResponse(410, const {}),
      const ApiError(kind: ApiErrorKind.unknown, code: 'unknown'),
      const ApiError(kind: ApiErrorKind.cancelled, code: 'cancelled'),
    ]) {
      test('$failure keeps the paper owed, never "not recorded"', () async {
        final e = await start();
        await e.selectAnswer('q1', 1);
        api.submitFailure = failure;
        final outcome = await e.submit();
        expect(outcome, isA<SubmitPending>());
        final saved = (await drafts.bySessionId('sess-1'))!;
        expect(saved.pendingSubmission, isTrue);
        expect(saved.rejected, isFalse);
      });
    }

    test('a 422 is still a refusal', () async {
      final e = await start();
      api.submitFailure = ApiError.fromResponse(422, const {'error': 'invalid_answer'});
      expect(await e.submit(), isA<SubmitRejected>());
    });
  });

  group('sync-storage-api-04: a wall-clock step does not move the timer', () {
    test('a forward step while answering is ignored on resume', () async {
      final e = await start();
      mono += 60000;
      wall += 60000;
      // The phone corrects its clock by five minutes while the mock is open.
      wall += 5 * 60 * 1000;
      await e.onPaused();
      mono += 10000;
      wall += 10000;
      await e.onResumed();
      expect(e.remaining.value, const Duration(minutes: 8, seconds: 50));
    });

    test('time asleep while paused is still taken off', () async {
      final e = await start();
      await e.onPaused();
      wall += 120000; // Deep sleep: the monotonic clock stood still.
      await e.onResumed();
      expect(e.remaining.value, const Duration(minutes: 8));
    });
  });

  group('sync-storage-api-05: restore sends answers that were never acknowledged', () {
    test('a fresh open queues a PUT at once', () async {
      final e = await start();
      api.putFailure = () => const ApiError(kind: ApiErrorKind.network, code: 'network');
      await e.selectAnswer('q1', 1);
      await e.selectAnswer('q2', 0);
      await e.flushDraft();
      e.dispose();
      engines.clear();
      api.putFailure = null;
      final putsBefore = api.puts.length;

      final saved = (await drafts.bySessionId('sess-1'))!;
      final restored = (await SessionEngine.restore(services: services, draft: saved))!;
      engines.add(restored);
      expect(timers.pendingDelays, contains(Duration.zero));
      timers.fireAll();
      await settle();
      expect(api.puts.length, greaterThan(putsBefore));
      expect(restored.unsyncedQuestionIds, isEmpty);
    });
  });

  group('sync-storage-api-10: flushNow sends the newest events too', () {
    test('an answer tapped while a PUT is in flight is sent before flushNow returns', () async {
      final journal = await SessionJournal.open(db, userId: 'u1', sessionId: 's1');
      final clock = SessionClock(monotonicMs: () => 0, wallMs: () => 0)..anchor(serverNowMs: 0, startedAtMs: 0, expiresAtMs: 600000);
      final syncer = SessionSyncer(api: api, journal: journal, sessionId: 's1', timerFactory: timers.create);
      addTearDown(syncer.dispose);

      await journal.recordAnswer('q1', 1, clock);
      syncer.notifyChanged();
      final hold = Completer<void>();
      api.putHold = hold;
      timers.fireNext(); // The first PUT goes out and hangs.
      await settle(2);
      await journal.recordAnswer('q2', 0, clock);
      syncer.notifyChanged();

      final flushing = syncer.flushNow();
      hold.complete();
      await flushing;
      expect(api.puts.length, 2);
      expect(api.puts.last.last.seq, journal.lastSeq);
      expect(syncer.hasUnacknowledged, isFalse);
    });
  });
}
