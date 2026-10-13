import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/session.dart';
import 'package:mockmob/core/models/session_draft.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/pending_result_repository.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/session/save_state.dart';
import 'package:mockmob/core/sync/session/session_clock.dart';
import 'package:mockmob/core/domain/session_rules.dart';
import 'package:mockmob/core/sync/session/session_engine.dart';
import 'package:mockmob/core/sync/session/session_heartbeat.dart';
import 'package:mockmob/core/sync/session/session_submitter.dart';
import 'package:mockmob/core/sync/session/session_work_scheduler.dart';

import 'support/fakes.dart';
import 'support/fixtures.dart';
import 'support/test_db.dart';

class RecordingScheduler implements SessionWorkScheduler {
  final List<({String sessionId, DateTime runAt})> scheduled = [];
  final List<String> cancelled = [];

  @override
  Future<void> scheduleSubmit({required String userId, required String sessionId, required String draftKey, required DateTime runAt}) async =>
      scheduled.add((sessionId: sessionId, runAt: runAt));

  @override
  Future<void> cancelSubmit(String sessionId) async => cancelled.add(sessionId);
}

class RecordingStatus implements SessionStatusNotifier {
  final List<String> calls = [];

  @override
  Future<void> showInProgress(SessionDraft draft) async => calls.add('inProgress');

  @override
  Future<void> showSending(SessionDraft draft) async => calls.add('sending');

  @override
  Future<void> clear() async => calls.add('clear');
}

void main() {
  late AppDatabase db;
  late FakeSessionApi api;
  late ManualTimers timers;
  late RecordingScheduler scheduler;
  late RecordingStatus status;
  late SessionDraftRepository drafts;
  late int mono;
  late int wall;
  late SessionEngineServices services;
  final engines = <SessionEngine>[];

  SessionClock newClock() => SessionClock(monotonicMs: () => mono, wallMs: () => wall);

  setUp(() {
    db = newTestDb();
    api = FakeSessionApi();
    timers = ManualTimers();
    scheduler = RecordingScheduler();
    status = RecordingStatus();
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
      status: status,
      clockFactory: newClock,
      timerFactory: timers.create,
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

  Future<SessionEngine> start({String? ticket, int count = 3, int serverNow = 1000000, int expiresAt = 1600000}) async {
    final view = sessionViewOf(count: count, startedAt: 1000000, expiresAt: expiresAt, serverNow: serverNow, ticket: ticket);
    final e = await SessionEngine.start(
      services: services,
      view: view,
      subject: 'accountancy',
      mode: 'full',
      count: count,
      generationKey: 'gen-1',
      mockNumber: 7,
    );
    engines.add(e);
    return e;
  }

  void advance(int ms) {
    mono += ms;
    wall += ms;
  }

  Future<void> settle() => Future<void>.delayed(Duration.zero);

  group('start', () {
    test('saves a draft, records a visit on question 1 first and anchors the timer', () async {
      final e = await start();
      expect(e.currentIndex, 0);
      expect(e.remaining.value, const Duration(minutes: 10));
      final saved = await drafts.bySessionId('sess-1');
      expect(saved, isNotNull);
      expect(saved!.mockNumber, 7);
      final rows = await db.select(db.answerJournal).get();
      expect(rows.single.type, 'visit');
      expect(rows.single.qid, 'q1');
      expect(rows.single.seq, 1);
    });

    test('registers the backup job about 90 seconds before the end', () async {
      final e = await start();
      expect(scheduler.scheduled, isNotEmpty);
      expect(scheduler.scheduled.first.runAt.millisecondsSinceEpoch, e.draft.endsAtWallMs - 90000);
    });

    test('elapsed server time is counted: joining 30 seconds in leaves 9:30', () async {
      final e = await start(serverNow: 1030000);
      expect(e.remaining.value, const Duration(minutes: 9, seconds: 30));
    });
  });

  group('answers and the save pill', () {
    test('an answer reaches the database right after the UI is told', () async {
      final e = await start();
      var inDbWhenNotified = false;
      e.addListener(() async {
        final rows = await db.select(db.answerJournal).get();
        inDbWhenNotified = rows.any((r) => r.type == 'answer' && r.answer == 1);
      });
      expect(await e.selectAnswer('q1', 1), isTrue);
      await settle();
      expect(inDbWhenNotified, isTrue);
      expect(e.answerFor('q1'), 1);
    });

    test('durable: saving until the server acknowledges, then saved', () async {
      final e = await start();
      expect(e.saveState.value.state, SaveState.saved);
      await e.selectAnswer('q1', 2);
      expect(e.saveState.value.state, SaveState.saving);
      expect(e.saveState.value.unsyncedAnswers, 1);
      expect(e.unsyncedQuestionIds, {'q1'});
      timers.fireNext(); // the 400 ms debounce
      await settle();
      expect(e.saveState.value.state, SaveState.saved);
      expect(e.unsyncedQuestionIds, isEmpty);
      expect(e.saveState.value.lastAckAt, isNotNull);
      expect((await drafts.bySessionId('sess-1')) == null, isFalse);
    });

    test('offline: answers wait on the phone and the pill says so', () async {
      final e = await start();
      api.putFailure = () => const ApiError(kind: ApiErrorKind.network, code: 'network');
      await e.selectAnswer('q1', 0);
      await e.selectAnswer('q2', 1);
      timers.fireNext();
      await settle();
      expect(e.saveState.value.state, SaveState.waitingForNetwork);
      expect(e.saveState.value.unsyncedAnswers, 2);
      // Answering is never blocked by the network.
      expect(await e.selectAnswer('q3', 2), isTrue);
      expect(e.saveState.value.unsyncedAnswers, 3);
    });

    test('ticket mode: on this phone, no PUT is ever sent', () async {
      final e = await start(ticket: 'p2.a.b.c');
      await e.selectAnswer('q1', 0);
      expect(e.saveState.value.state, SaveState.onThisPhone);
      await e.onPaused();
      expect(api.puts, isEmpty);
      expect(e.saveState.value.state, SaveState.onThisPhone);
    });

    test('clearing an answer removes it and still counts as an unsynced change', () async {
      final e = await start();
      await e.selectAnswer('q1', 0);
      timers.fireNext();
      await settle();
      await e.selectAnswer('q1', null);
      expect(e.answerFor('q1'), isNull);
      expect(e.answeredCount, 0);
      expect(e.unsyncedQuestionIds, {'q1'});
    });

    test('goTo records a visit for the target question only', () async {
      final e = await start();
      await e.goTo(2);
      expect(e.currentIndex, 2);
      final rows = await db.select(db.answerJournal).get();
      expect([for (final r in rows) (r.type, r.qid)], [('visit', 'q1'), ('visit', 'q3')]);
    });

    test('marks are local and counted', () async {
      final e = await start();
      e.setMarked('q2', true);
      e.setMarked('q2', true);
      expect(e.markedCount, 1);
      e.setMarked('q2', false);
      expect(e.markedCount, 0);
    });
  });

  group('clock and deadline', () {
    test('answering stops at zero, the engine flushes and submits once', () async {
      final e = await start(serverNow: 1700000, expiresAt: 1600000); // already past the deadline
      await settle();
      await settle();
      expect(e.canAnswer, isFalse);
      expect(await e.selectAnswer('q1', 1), isFalse);
      expect(api.submits.length, 1);
      expect(e.endedByTimeUp, isTrue);
    });

    test('submit stops answering and ends received on a 200', () async {
      final e = await start();
      await e.selectAnswer('q1', 1);
      final outcome = await e.submit();
      expect(outcome, isA<SubmitReceived>());
      expect(e.submitState.value.stage, SubmitStage.received);
      expect(e.canAnswer, isFalse);
      expect(scheduler.cancelled, contains('sess-1'));
      expect(status.calls, contains('clear'));
    });

    test('a network failure leaves a pending submit that can be retried', () async {
      final e = await start();
      await e.selectAnswer('q1', 1);
      api.submitFailure = const ApiError(kind: ApiErrorKind.network, code: 'network');
      final first = await e.submit();
      expect(first, isA<SubmitPending>());
      expect(e.submitState.value.stage, SubmitStage.pending);
      expect(e.draft.pendingSubmission, isTrue);
      expect(e.canAnswer, isFalse);
      // The backup job is queued to run right away.
      expect(scheduler.scheduled.last.runAt.millisecondsSinceEpoch, wall);

      api.submitFailure = null;
      final second = await e.submit();
      expect(second, isA<SubmitReceived>());
      expect(api.submits.length, 2);
    });

    test('the window closed: the engine ends in windowClosed', () async {
      final e = await start();
      api.submitFailure = const ApiError(status: 422, kind: ApiErrorKind.validation, code: ApiCodes.sessionExpired);
      api.attemptOnFetch = null;
      final outcome = await e.submit();
      expect(outcome, isA<SubmitWindowClosed>());
      expect(e.submitState.value.stage, SubmitStage.windowClosed);
    });
  });

  group('lifecycle', () {
    test('pause flushes answers at once, saves the draft and shows the silent status', () async {
      final e = await start();
      await e.selectAnswer('q1', 1);
      await e.onPaused();
      expect(api.puts.length, 1);
      expect(status.calls, ['inProgress']);
      final saved = await drafts.bySessionId('sess-1');
      expect(saved!.acknowledgedSequence, 2);
    });

    test('resume clears the status and reports how long the student was away', () async {
      final e = await start();
      await e.selectAnswer('q1', 1);
      api.putFailure = () => const ApiError(kind: ApiErrorKind.network, code: 'network');
      await e.onPaused();
      advance(130000);
      await e.onResumed();
      expect(status.calls.last, 'clear');
      final away = e.away.value!;
      expect(away.duration, const Duration(minutes: 2, seconds: 10));
      expect(away.allSaved, isFalse);
      expect(away.unsyncedAnswers, 1);
      e.dismissAway();
      expect(e.away.value, isNull);
    });

    test('a brief pause does not show the away banner', () async {
      final e = await start();
      await e.onPaused();
      advance(2000);
      await e.onResumed();
      expect(e.away.value, isNull);
    });

    test('resume when everything was saved says so', () async {
      final e = await start();
      await e.selectAnswer('q1', 1);
      await e.onPaused();
      advance(60000);
      await e.onResumed();
      expect(e.away.value!.allSaved, isTrue);
    });
  });

  group('process death', () {
    test('restore brings back the same question, selections and marks', () async {
      final e = await start();
      await e.selectAnswer('q1', 2);
      await e.goTo(1);
      await e.selectAnswer('q2', 0);
      await e.goTo(2);
      e.setMarked('q2', true);
      await e.flushDraft();
      e.dispose();
      engines.clear();

      // New process: the monotonic clock restarts, the wall clock kept going.
      mono = 50;
      wall += 20000;
      final saved = (await drafts.latest())!;
      final restored = await SessionEngine.restore(services: services, draft: saved);
      engines.add(restored!);
      expect(restored.currentIndex, 2);
      expect(restored.answers, {'q1': 2, 'q2': 0});
      expect(restored.marked, {'q2'});
      // About 20 seconds were lost while away; the real time left is shown.
      expect(restored.remaining.value, const Duration(minutes: 9, seconds: 40));
    });

    test('restore refuses a draft that can no longer resume', () async {
      final e = await start();
      await e.flushDraft();
      final saved = (await drafts.latest())!;
      e.dispose();
      engines.clear();
      wall = saved.endsAtWallMs + 500000;
      expect(await SessionEngine.restore(services: services, draft: saved), isNull);
    });

    test('a draft with a pending submit still restores inside the 120 second window', () async {
      final e = await start();
      api.submitFailure = const ApiError(kind: ApiErrorKind.network, code: 'network');
      await e.submit();
      final saved = (await drafts.latest())!;
      expect(saved.pendingSubmission, isTrue);
      e.dispose();
      engines.clear();
      wall = saved.endsAtWallMs + 60000;
      final restored = await SessionEngine.restore(services: services, draft: saved);
      expect(restored, isNotNull);
      engines.add(restored!);
    });
  });

  group('pending submit', () {
    test('a reconnect retries a submit that ended pending', () async {
      final e = await start();
      await e.selectAnswer('q1', 1);
      api.submitFailure = const ApiError(kind: ApiErrorKind.network, code: 'network');
      await e.submit();
      expect(e.submitState.value.stage, SubmitStage.pending);

      api.submitFailure = null;
      e.onConnectivityRestored();
      await settle();
      await settle();
      expect(api.submits.length, 2);
      expect(e.submitState.value.stage, SubmitStage.received);
    });

    test('a reconnect after the grace window does not retry', () async {
      final e = await start();
      api.submitFailure = const ApiError(kind: ApiErrorKind.network, code: 'network');
      await e.submit();
      advance(600000 + 121000);
      e.onConnectivityRestored();
      await settle();
      expect(api.submits.length, 1);
    });

    test('a rejected submit leaves nothing pending', () async {
      final e = await start();
      api.submitFailure = const ApiError(status: 422, kind: ApiErrorKind.validation, code: 'invalid_answer');
      final outcome = await e.submit();
      expect(outcome, isA<SubmitRejected>());
      expect(e.draft.pendingSubmission, isFalse);
      final saved = (await drafts.bySessionId('sess-1'))!;
      expect(saved.pendingSubmission, isFalse);
      expect(saved.rejected, isTrue);
      expect(resumableDraft(saved, sessionId: 'sess-1', nowMs: wall), isFalse);
    });

    test('starting the same selection again sends the earlier unsent answers first', () async {
      final first = await start();
      await first.selectAnswer('q1', 1);
      api.submitFailure = const ApiError(kind: ApiErrorKind.network, code: 'network');
      await first.submit();
      api.submitFailure = null;

      final view = sessionViewOf(id: 'sess-2', startedAt: 1000000, serverNow: 1000000);
      final second = await SessionEngine.start(services: services, view: view, subject: 'accountancy', mode: 'full', count: 3, generationKey: 'gen-2', mockNumber: 8);
      engines.add(second);
      expect(api.submits.first['sessionId'], 'sess-1');
      expect(await drafts.bySessionId('sess-1'), isNull);
      expect(await drafts.bySessionId('sess-2'), isNotNull);
    });

    test('starting is refused while the earlier answers still cannot be sent', () async {
      final first = await start();
      api.submitFailure = const ApiError(kind: ApiErrorKind.network, code: 'network');
      await first.submit();

      final view = sessionViewOf(id: 'sess-2', startedAt: 1000000, serverNow: 1000000);
      await expectLater(
        SessionEngine.start(services: services, view: view, subject: 'accountancy', mode: 'full', count: 3, generationKey: 'gen-2'),
        throwsA(isA<PendingSubmitBlocksStart>()),
      );
      final kept = (await drafts.bySessionId('sess-1'))!;
      expect(kept.pendingSubmission, isTrue);
      expect(await drafts.bySessionId('sess-2'), isNull);
    });
  });

  group('backup job and heartbeat', () {
    test('the engine beats while open and stops when it submits', () async {
      final e = await start();
      await settle();
      final beat = SessionHeartbeat(db, userId: 'u1', now: () => DateTime.fromMillisecondsSinceEpoch(wall));
      expect(await beat.isLive('sess-1'), isTrue);
      await e.submit();
      await settle();
      expect(await beat.isLive('sess-1'), isFalse);
    });

    test('resuming after the job already submitted picks up the attempt', () async {
      final e = await start();
      await e.selectAnswer('q1', 1);
      await drafts.deleteSession('sess-1'); // what the background job does after a 200
      await e.onResumed();
      await settle();
      await settle();
      expect(e.submitState.value.stage, SubmitStage.received);
    });
  });

  group('server conflict', () {
    test('a local answer the server does not hold survives the rebuild', () async {
      final e = await start();
      await e.selectAnswer('q1', 1);
      await e.selectAnswer('q2', 2);
      api.resumeView = SessionView.fromJson(sessionViewJson(events: [
        {'seq': 1, 'qid': 'q1', 'type': 'visit', 'at': 5},
        {'seq': 2, 'qid': 'q1', 'type': 'answer', 'at': 9, 'answer': 0},
      ]));
      api.putFailure = () => const ApiError(status: 422, kind: ApiErrorKind.validation, code: ApiCodes.eventConflict);
      timers.fireNext();
      await settle();
      await settle();
      await settle();
      expect(e.answerFor('q1'), 1, reason: 'the typed answer wins over the older server value');
      expect(e.answerFor('q2'), 2);
      expect(e.unsyncedQuestionIds, containsAll(['q1', 'q2']));
    });

    test('EVENT_CONFLICT rebuilds the journal from the server log', () async {
      final e = await start();
      await e.selectAnswer('q1', 1);
      api.resumeView = SessionView.fromJson(sessionViewJson(events: [
        {'seq': 1, 'qid': 'q1', 'type': 'visit', 'at': 5},
        {'seq': 2, 'qid': 'q3', 'type': 'answer', 'at': 9, 'answer': 2},
      ]));
      api.putFailure = () => const ApiError(status: 422, kind: ApiErrorKind.validation, code: ApiCodes.eventConflict);
      timers.fireNext();
      await settle();
      await settle();
      await settle();
      expect(e.answerFor('q3'), 2, reason: 'answers only the server holds come back');
      expect(api.resumeCalls, greaterThan(0));
    });
  });
}
