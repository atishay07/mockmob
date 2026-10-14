import 'dart:async';

import 'package:drift/drift.dart' hide isNotNull, isNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/pending_result_repository.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/session/save_state.dart';
import 'package:mockmob/core/sync/session/session_clock.dart';
import 'package:mockmob/core/sync/session/session_engine.dart';
import 'package:mockmob/core/sync/session/session_journal.dart';
import 'package:mockmob/core/sync/session/session_submitter.dart';

import '../core_data/support/fakes.dart';
import '../core_data/support/fixtures.dart';

/// Holds or fails the journal's inserts, standing in for a slow or broken disk.
class _SlowDisk extends QueryInterceptor {
  Completer<void>? gate;
  Object? failWith;
  int held = 0;

  @override
  Future<int> runInsert(QueryExecutor executor, String statement, List<Object?> args) async {
    if (statement.contains('answer_journal')) {
      if (gate != null) {
        held++;
        await gate!.future;
      }
      if (failWith != null) throw failWith!;
    }
    return super.runInsert(executor, statement, args);
  }
}

/// A submitter whose own code throws, past every ApiError the real one maps.
class _BrokenSubmitter extends SessionSubmitter {
  _BrokenSubmitter(SessionSubmitter real, SessionDraftRepository drafts, PendingResultRepository pending)
    : super(api: real.api, drafts: drafts, pendingResults: pending, cacheAttempt: (_) async {});

  @override
  Future<SubmitOutcome> submit({required draft, required SessionJournal journal, required int durationMs}) async =>
      throw StateError('disk full');
}

void main() {
  late _SlowDisk disk;
  late AppDatabase db;
  late FakeSessionApi api;
  late ManualTimers timers;
  late SessionDraftRepository drafts;
  late PendingResultRepository pending;
  late SessionEngineServices services;
  late int mono;
  late int wall;
  final engines = <SessionEngine>[];

  SessionClock newClock() => SessionClock(monotonicMs: () => mono, wallMs: () => wall);
  DateTime now() => DateTime.fromMillisecondsSinceEpoch(wall);

  SessionEngineServices servicesWith(SessionSubmitter submitter) => SessionEngineServices(
    db: db,
    userId: 'u1',
    api: api,
    drafts: drafts,
    submitter: submitter,
    clockFactory: newClock,
    timerFactory: timers.create,
    now: now,
  );

  setUp(() {
    disk = _SlowDisk();
    db = AppDatabase(NativeDatabase.memory().interceptWith(disk));
    api = FakeSessionApi();
    timers = ManualTimers();
    mono = 0;
    wall = 2000000;
    final scope = LocalScope(db, () => 'u1', now);
    drafts = SessionDraftRepository(scope);
    pending = PendingResultRepository(scope);
    services = servicesWith(SessionSubmitter(api: api, drafts: drafts, pendingResults: pending, cacheAttempt: (_) async {}, now: now));
  });

  tearDown(() async {
    for (final e in engines) {
      e.dispose();
    }
    engines.clear();
    await db.close();
  });

  Future<SessionEngine> start({SessionEngineServices? using, String id = 'sess-1', String gen = 'gen-1', int? mockNumber = 7}) async {
    final e = await SessionEngine.start(
      services: using ?? services,
      view: sessionViewOf(id: id, startedAt: 1000000, expiresAt: 1600000, serverNow: 1000000),
      subject: 'accountancy',
      mode: 'full',
      count: 3,
      generationKey: gen,
      mockNumber: mockNumber,
    );
    engines.add(e);
    return e;
  }

  Future<void> settle() => Future<void>.delayed(Duration.zero);

  group('selecting an answer is instant', () {
    test('the screen is told in the same frame, before the journal write finishes', () async {
      final e = await start();
      var told = 0;
      e.addListener(() => told++);
      disk.gate = Completer<void>();

      final write = e.selectAnswer('q1', 2);
      // Nothing awaited yet, the disk is held: the answer is already on screen.
      expect(told, 1);
      expect(e.answerFor('q1'), 2);
      expect(e.answeredCount, 1);
      expect(e.answers, {'q1': 2});
      expect(e.unsyncedQuestionIds, contains('q1'));
      expect(await db.select(db.answerJournal).get().then((r) => r.where((x) => x.type == 'answer')), isEmpty);

      disk.gate!.complete();
      expect(await write, isTrue);
      expect(e.answerFor('q1'), 2);
      final stored = await db.select(db.answerJournal).get();
      expect(stored.where((r) => r.type == 'answer' && r.answer == 2), hasLength(1));
      expect(e.saveState.value.state, SaveState.saving);
    });

    test('moving between questions does not wait for the disk either', () async {
      final e = await start();
      var told = 0;
      e.addListener(() => told++);
      disk.gate = Completer<void>();

      final move = e.goTo(2);
      expect(e.currentIndex, 2);
      expect(told, 1);
      expect(e.visited, contains('q3'));

      disk.gate!.complete();
      await move;
      final visits = (await db.select(db.answerJournal).get()).where((r) => r.type == 'visit').map((r) => r.qid);
      expect(visits, containsAllInOrder(['q1', 'q3']));
    });

    test('a failed write rolls the answer back and the pill says On this phone', () async {
      final e = await start();
      disk.failWith = StateError('disk full');
      expect(await e.selectAnswer('q1', 1), isFalse);
      expect(e.answerFor('q1'), isNull);
      expect(e.answeredCount, 0);
      expect(e.unsyncedQuestionIds, isEmpty);
      expect(e.saveState.value.state, SaveState.onThisPhone);

      disk.failWith = null;
      expect(await e.selectAnswer('q1', 1), isTrue);
      expect(e.answerFor('q1'), 1);
      expect(e.saveState.value.state, SaveState.saving);
    });

    test('a failed clear keeps the earlier saved answer on screen', () async {
      final e = await start();
      expect(await e.selectAnswer('q1', 3), isTrue);
      disk.failWith = StateError('disk full');
      expect(await e.selectAnswer('q1', null), isFalse);
      expect(e.answerFor('q1'), 3);
    });

    test('rapid taps on one question: the newest wins while the older write is still going', () async {
      final e = await start();
      disk.gate = Completer<void>();
      final first = e.selectAnswer('q1', 1);
      final second = e.selectAnswer('q1', 2);
      expect(e.answerFor('q1'), 2);
      disk.gate!.complete();
      expect(await first, isTrue);
      expect(await second, isTrue);
      expect(e.answerFor('q1'), 2);
      expect(e.answers, {'q1': 2});
    });

    test('submit waits for a tap still being written, so it is on the paper', () async {
      final e = await start();
      disk.gate = Completer<void>();
      unawaited(e.selectAnswer('q2', 0));
      final submitting = e.submit();
      await settle();
      expect(api.submits, isEmpty, reason: 'the paper is not sent while a tap is still being written');
      disk.gate!.complete();
      final outcome = await submitting;
      expect(outcome, isA<SubmitReceived>());
      expect(api.submits.single['answers'], {'q2': 0});
    });
  });

  group('a submit never leaves the draft stuck', () {
    test('a local cache failure after the server accepted still ends received', () async {
      final local = SessionSubmitter(
        api: api,
        drafts: drafts,
        pendingResults: pending,
        cacheAttempt: (_) async => throw StateError('cache locked'),
        now: now,
      );
      final e = await start(using: servicesWith(local));
      await e.selectAnswer('q1', 1);
      final outcome = await e.submit();
      expect(outcome, isA<SubmitReceived>());
      expect(e.submitState.value.stage, SubmitStage.received);
      expect(await drafts.bySessionId('sess-1'), isNull, reason: 'the attempt exists; the draft is cleared');
    });

    test('a failure that is not an ApiError is a pending submit, with the draft kept owed', () async {
      final e = await start();
      await e.selectAnswer('q1', 1);
      api.submitFailure = TypeError();
      final outcome = await e.submit();
      expect(outcome, isA<SubmitPending>());
      expect((outcome as SubmitPending).error.kind, ApiErrorKind.unknown);
      expect(e.submitState.value.stage, SubmitStage.pending);
      expect((await drafts.bySessionId('sess-1'))!.pendingSubmission, isTrue);

      // It can be tried again and then goes through.
      api.submitFailure = null;
      expect(await e.submit(), isA<SubmitReceived>());
    });

    test('even if the submitter itself throws, the stage leaves sending', () async {
      final broken = _BrokenSubmitter(services.submitter, drafts, pending);
      final e = await start(using: servicesWith(broken));
      final outcome = await e.submit();
      expect(outcome, isA<SubmitPending>());
      expect(e.submitState.value.stage, SubmitStage.pending);
      expect(e.draft.pendingSubmission, isTrue);
    });

    test('settling an earlier draft that blows up does not block the next start, and keeps it', () async {
      final first = await start();
      await first.selectAnswer('q1', 1);
      api.submitFailure = const ApiError(kind: ApiErrorKind.network, code: 'network');
      await first.submit();
      first.dispose();
      engines.clear();
      api.submitFailure = null;

      final broken = _BrokenSubmitter(services.submitter, drafts, pending);
      final second = await start(using: servicesWith(broken), id: 'sess-2', gen: 'gen-2', mockNumber: 8);
      expect(second.draft.sessionId, 'sess-2');
      final kept = await drafts.bySessionId('sess-1');
      expect(kept, isNotNull, reason: 'the owed draft is archived, not overwritten');
      expect(kept!.pendingSubmission, isTrue);
      expect(kept.draftKey, SessionDraftRepository.archiveKeyOf('sess-1'));
      final rows = await db.select(db.answerJournal).get();
      expect(rows.where((r) => r.sessionId == 'sess-1' && r.type == 'answer'), hasLength(1));
    });
  });

  group('a rejected draft is never silently overwritten', () {
    test('starting the same selection again archives it with its answers', () async {
      final first = await start();
      await first.selectAnswer('q1', 2);
      api.submitFailure = const ApiError(status: 422, kind: ApiErrorKind.validation, code: 'invalid_answer');
      expect(await first.submit(), isA<SubmitRejected>());
      first.dispose();
      engines.clear();
      api.submitFailure = null;

      final second = await start(id: 'sess-2', gen: 'gen-2', mockNumber: 8);
      expect(second.draft.sessionId, 'sess-2');
      expect((await drafts.bySessionId('sess-2')), isNotNull);
      final old = (await drafts.bySessionId('sess-1'))!;
      expect(old.rejected, isTrue);
      expect(old.draftKey, SessionDraftRepository.archiveKeyOf('sess-1'));
      expect(old.pendingSubmission, isFalse);
      // The answers it held are still there to count and to review.
      final journal = await SessionJournal.open(db, userId: 'u1', sessionId: 'sess-1');
      expect(journal.answers, {'q1': 2});
    });

    test('an archived draft does not come back under the selection key', () async {
      final first = await start();
      api.submitFailure = const ApiError(status: 422, kind: ApiErrorKind.validation, code: 'invalid_answer');
      await first.submit();
      first.dispose();
      engines.clear();
      await start(id: 'sess-2', gen: 'gen-2', mockNumber: 8);
      final key = (await drafts.bySessionId('sess-2'))!.draftKey;
      expect((await drafts.byKey(key))!.sessionId, 'sess-2');
    });
  });
}
