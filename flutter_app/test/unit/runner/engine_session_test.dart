import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/pending_result_repository.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/session/session_clock.dart';
import 'package:mockmob/core/sync/session/session_engine.dart';
import 'package:mockmob/core/sync/session/session_submitter.dart';
import 'package:mockmob/core/sync/sync_providers.dart';
import 'package:mockmob/features/runner/data/runner_loader.dart';
import 'package:mockmob/features/runner/data/runner_session.dart';

import '../core_data/support/fakes.dart';
import '../core_data/support/fixtures.dart';
import '../core_data/support/test_db.dart';

/// The runner on the real core engine: the opener restores from the draft and journal on this
/// phone, and closing never discards, so a killed process comes back to the same place.
void main() {
  late AppDatabase db;
  late FakeSessionApi api;
  late SessionDraftRepository drafts;
  late SessionEngineServices services;
  late int mono;
  late int wall;

  setUp(() {
    db = newTestDb();
    api = FakeSessionApi();
    mono = 0;
    wall = 1000000;
    DateTime now() => DateTime.fromMillisecondsSinceEpoch(wall);
    final scope = LocalScope(db, () => 'u1', now);
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
        now: now,
      ),
      clockFactory: () => SessionClock(monotonicMs: () => mono, wallMs: () => wall),
      timerFactory: ManualTimers().create,
      now: now,
    );
  });

  tearDown(() => db.close());

  ProviderContainer container() {
    final c = ProviderContainer(
      overrides: [
        sessionDraftRepositoryProvider.overrideWithValue(drafts),
        sessionEngineRestorerProvider.overrideWithValue((draft) => SessionEngine.restore(services: services, draft: draft)),
      ],
    );
    addTearDown(c.dispose);
    return c;
  }

  /// What practice setup does: start, let the engine write the draft and journal, dispose.
  Future<void> startLikePractice({String mode = 'full'}) async {
    final engine = await SessionEngine.start(
      services: services,
      view: sessionViewOf(count: 3, startedAt: 1000000, expiresAt: 1600000, serverNow: 1000000),
      subject: 'accountancy',
      mode: mode,
      count: 3,
      generationKey: 'gen-1',
      mockNumber: 7,
    );
    engine.dispose();
  }

  test('opens the session from the phone, and after a restart lands on the same question and answers', () async {
    await startLikePractice();
    final load = await container().read(runnerOpenerProvider)('sess-1');
    expect(load, isA<RunnerReady>());
    final session = (load as RunnerReady).session;
    expect(session.isMock, isTrue);
    expect(session.mockNumber, 7);
    expect(session.questions, hasLength(3));

    await session.goTo(1);
    expect(await session.selectAnswer('q2', 1), isTrue);
    session.setMarked('q2', true);
    expect(session.answerFor('q2'), 1);

    // Leaving flushes the answers to the server and writes the draft.
    await session.close();
    expect(api.puts, isNotEmpty);
    expect(api.puts.last.where((e) => e.isAnswer).map((e) => e.qid), contains('q2'));

    // The process dies and the student comes back.
    mono += 30000;
    wall += 30000;
    final again = await container().read(runnerOpenerProvider)('sess-1');
    final restored = (again as RunnerReady).session;
    expect(restored.currentIndex, 1);
    expect(restored.answerFor('q2'), 1);
    expect(restored.marked, contains('q2'));
    expect(restored.submitOwedOnOpen, isFalse);
    await restored.close();
  });

  test('a submit through the runner session reaches the server once and clears the draft', () async {
    await startLikePractice();
    final session = ((await container().read(runnerOpenerProvider)('sess-1')) as RunnerReady).session;
    await session.selectAnswer('q1', 0);
    final outcome = await session.submit();
    expect(outcome, isA<SubmitReceived>());
    expect(session.submitState.value.stage, SubmitStage.received);
    expect(api.submits, hasLength(1));
    expect(await drafts.bySessionId('sess-1'), isNull);
    // Pausing and leaving after the acknowledgement never brings the finished draft back.
    await (session as EngineRunnerSession).engine.onPaused();
    await session.close();
    expect(await drafts.bySessionId('sess-1'), isNull);
  });

  test('an unknown session is missing, and one whose time ran out has ended', () async {
    expect(await container().read(runnerOpenerProvider)('nope'), isA<RunnerMissing>());

    await startLikePractice();
    wall += 700000; // Past the deadline, no submit owed.
    final load = await container().read(runnerOpenerProvider)('sess-1');
    expect(load, isA<RunnerEnded>());
    expect((load as RunnerEnded).isMock, isTrue);
  });

  test('a failure to open is reported, not thrown', () async {
    final c = ProviderContainer(
      overrides: [
        sessionDraftRepositoryProvider.overrideWithValue(drafts),
        sessionEngineRestorerProvider.overrideWithValue((_) => throw StateError('database closed')),
      ],
    );
    addTearDown(c.dispose);
    await startLikePractice();
    expect(await c.read(runnerOpenerProvider)('sess-1'), isA<RunnerFailed>());
  });

  test('the route provider closes the session when nothing watches it', () async {
    await startLikePractice();
    final c = container();
    final sub = c.listen(runnerLoadProvider('sess-1'), (_, _) {});
    final load = await c.read(runnerLoadProvider('sess-1').future);
    final session = (load as RunnerReady).session as EngineRunnerSession;
    await session.selectAnswer('q1', 2);
    sub.close();
    await Future<void>.delayed(const Duration(milliseconds: 50));
    // Closed: the engine stopped taking answers, and the answer was flushed first.
    expect(session.canAnswer, isFalse);
    expect(api.puts.last.where((e) => e.isAnswer).map((e) => e.qid), contains('q1'));
  });
}
