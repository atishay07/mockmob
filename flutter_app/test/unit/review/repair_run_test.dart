import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/analytics/analytics.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/models/repair.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/core/repositories/rhythm_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/features/review/data/repair_api.dart';
import 'package:mockmob/features/review/data/repair_run.dart';
import 'package:mockmob/features/review/data/repair_state.dart';
import 'package:mockmob/features/review/data/review_providers.dart';
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationScope, celebrationControllerProvider;
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart' show rhythmPrefsStoreProvider;

import 'support/review_fixtures.dart';

/// Answers each call from a queue: a response map or an [ApiError].
class FakeRepairApi implements RepairApi {
  final List<Object> answers = [];
  final List<(String, String)> calls = [];

  @override
  Future<RepairResponse> repair({required String attemptId, required String questionId, required String requestId}) async {
    calls.add((questionId, requestId));
    final next = answers.isEmpty ? explainedJson() : answers.removeAt(0);
    if (next is ApiError) throw next;
    return RepairResponse.fromJson(next as Map<String, dynamic>);
  }
}

class FakeAnalytics implements AnalyticsClient {
  final List<(String, Map<String, Object?>?)> events = [];

  @override
  Future<bool> track(String name, {Map<String, Object?>? props}) async {
    events.add((name, props));
    return true;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  late FakeRepairApi api;
  late FakeAnalytics analytics;
  late ProviderContainer container;
  late AppDatabase db;
  late MemoryPrefsStore rhythmStore;

  setUp(() {
    api = FakeRepairApi();
    analytics = FakeAnalytics();
    db = AppDatabase(NativeDatabase.memory());
    rhythmStore = MemoryPrefsStore();
    container = ProviderContainer(
      overrides: [
        authSnapshotProvider.overrideWithBuild((ref, n) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1')),
        appDatabaseProvider.overrideWithValue(db),
        nowProvider.overrideWithValue(() => lateUtc),
        reviewInputsProvider.overrideWith(
          (ref) => ReviewInputs(
            attempts: RemoteState(value: allAttempts, fetchedAt: eveningUtc),
            records: ref.watch(repairLocalRecordsProvider).value ?? const [],
          ),
        ),
        repairApiProvider.overrideWithValue(api),
        analyticsClientProvider.overrideWithValue(analytics),
        hapticsProvider.overrideWithValue(const Haptics(enabled: false)),
        creditsRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState<AiCredits>()),
        rhythmRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState<Rhythm>()),
        rhythmPrefsStoreProvider.overrideWithValue(rhythmStore),
      ],
    );
    // Keep the live record stream subscribed, as the screens do.
    container.listen(repairLocalRecordsProvider, (_, _) {});
  });

  tearDown(() async {
    container.dispose();
    await db.close();
  });

  RepairRun run() => container.read(repairRunProvider('m7').notifier);
  RepairRunState state() => container.read(repairRunProvider('m7'))!;
  Future<void> settle() => Future<void>.delayed(const Duration(milliseconds: 20));
  Future<RepairLocalRecord?> local(String qid) async {
    final all = await container.read(repairLocalRepositoryProvider).forAttempt('m7');
    for (final r in all) {
      if (r.questionId == qid) return r;
    }
    return null;
  }

  test("open starts at the tapped mistake, then the chapter's other open mistakes", () async {
    expect(run().open('m7-q10'), isTrue);
    expect(state().steps.map((s) => s.item.number), [11, 1, 31]);
    expect(state().phase, RepairPhase.entry);
    expect(run().open('missing'), isFalse);
  });

  test('explained is recorded with its acknowledgement and counted', () async {
    run().open('m7-q0');
    run().begin();
    await settle();
    expect(state().current!.outcome, isA<OutcomeExplained>());
    final r = await local('m7-q0');
    expect(r!.status, RepairLocalStatus.explained);
    expect(r.ackedAt, isNotNull);
    expect(state().repairedCount, 1);
    expect(state().lastAckedAt, lateUtc);
    expect(analytics.events.first.$1, AnalyticsEvents.repairStarted);
  });

  test('a failed call keeps the requestId for the retry', () async {
    api.answers.add(const ApiError(kind: ApiErrorKind.network, code: 'network'));
    run().open('m7-q0');
    run().begin();
    await settle();
    expect((state().current!.outcome! as OutcomeFailed).failure, RepairFailure.offline);
    await run().retry();
    await settle();
    expect(api.calls, hasLength(2));
    expect(api.calls[0].$2, api.calls[1].$2);
    expect(state().current!.outcome, isA<OutcomeExplained>());
  });

  test('operation_released mints a new id and calls again once', () async {
    api.answers.add(const ApiError(kind: ApiErrorKind.conflict, code: 'operation_released', status: 409));
    run().open('m7-q0');
    run().begin();
    await settle();
    expect(api.calls, hasLength(2));
    expect(api.calls[0].$2, isNot(api.calls[1].$2));
    expect(state().current!.outcome, isA<OutcomeExplained>());
  });

  test('not_a_mistake removes the step quietly and moves on', () async {
    api.answers.add(const ApiError(kind: ApiErrorKind.validation, code: 'not_a_mistake', status: 422));
    run().open('m7-q0');
    run().begin();
    await settle();
    expect(state().steps, hasLength(2));
    expect(state().current!.item.questionId, 'm7-q10');
    expect((await local('m7-q0'))!.status, RepairLocalStatus.notAMistake);
  });

  test('held_for_recheck is set aside and never counts as repaired', () async {
    api.answers.add({'status': 'held_for_recheck', 'charged': 0});
    run().open('m7-q0');
    run().begin();
    await settle();
    expect(state().current!.outcome, isA<OutcomeSetAside>());
    expect(state().repairedCount, 0);
    expect((await local('m7-q0'))!.status, RepairLocalStatus.heldForRecheck);
  });

  test('an empty wallet switches the run to key explanations without more calls', () async {
    api.answers.add(const ApiError(kind: ApiErrorKind.paymentRequired, code: 'insufficient_ai_credits', status: 402));
    run().open('m7-q0');
    run().begin();
    await settle();
    final outcome = state().current!.outcome! as OutcomeKeyReview;
    expect(outcome.reason, KeyReviewReason.outOfCredits);
    expect(state().keyOnly, isTrue);
    final reviewed = await local('m7-q0');
    expect(reviewed!.status, RepairLocalStatus.reviewed);
    expect(reviewed.ackedAt, isNull, reason: 'a key review is on this phone only');
    run().next();
    await settle();
    expect(api.calls, hasLength(1));
    expect(state().current!.outcome, isA<OutcomeKeyReview>());
  });

  test('a review state on an eligibility error sets the question aside', () async {
    api.answers.add(
      const ApiError(
        kind: ApiErrorKind.conflict,
        code: 'under_review',
        status: 409,
        details: {
          'review': {'state': 'under_review'},
        },
      ),
    );
    run().open('m7-q0');
    run().begin();
    await settle();
    expect((state().current!.outcome! as OutcomeSetAside).heldByServer, isFalse);
  });

  test('finishing ends the run and reports the count', () async {
    run().open('m7-q0');
    run().begin(limit: 2);
    await settle();
    run().next();
    await settle();
    run().next();
    expect(state().phase, RepairPhase.ending);
    expect(state().repairedCount, 2);
    expect(analytics.events.last.$1, AnalyticsEvents.repairCompleted);
    expect(analytics.events.last.$2, {'count': 2});
  });

  test('a group key counts the steps its run holds, paper by paper', () async {
    final index = container.read(reviewIndexProvider)!;
    final group = index.openGroups.firstWhere((g) => g.chapter == 'Partnership: admission of a partner');
    expect(group.openByPaper.map((p) => p.items.length), [3, 2]);
    for (final paper in group.openByPaper) {
      expect(container.read(repairRunProvider(paper.attemptId).notifier).open(paper.items.first.questionId), isTrue);
      expect(container.read(repairRunProvider(paper.attemptId))!.steps, hasLength(paper.items.length));
    }
  });

  group('the repair ending fires the one repairFinished moment (rhythm-01)', () {
    test('it consumes the moment with the acknowledged time, once, in the run scope', () async {
      run().open('m7-q0');
      run().begin(limit: 2);
      await settle();
      run().next();
      await settle();
      run().next();
      await settle();
      final c = container.read(celebrationControllerProvider).byScope[CelebrationScope.repair('m7')];
      expect(c, isNotNull);
      expect(c!.id, startsWith('repair:m7:'));
      expect(c.receipt, startsWith('Repair finished.'));
    });

    test('a run with nothing repaired fires nothing', () async {
      api.answers.add(explainedJson(status: 'not_explained'));
      run().open('m7-q0');
      run().begin(limit: 1);
      await settle();
      run().finish();
      await settle();
      expect(container.read(celebrationControllerProvider).byScope, isEmpty);
    });

    test('with the weekly rhythm turned off the moment is not spent unseen', () async {
      rhythmStore.values['rhythm_hidden_u1'] = true;
      run().open('m7-q0');
      run().begin(limit: 1);
      await settle();
      run().finish();
      await settle();
      expect(container.read(celebrationControllerProvider).byScope, isEmpty);
    });
  });

  test('reopening a repaired mistake is free and leaves the record alone', () async {
    final repo = container.read(repairLocalRepositoryProvider);
    await repo.recordOutcome(attemptId: 'm7', questionId: 'm7-q0', status: RepairLocalStatus.explained, requestId: 'req-original-0000000');
    final before = await local('m7-q0');
    await settle();
    expect(run().open('m7-q0'), isTrue);
    expect(state().steps, hasLength(1));
    api.answers.add(explainedJson(status: 'stored'));
    run().begin();
    await settle();
    final o = state().current!.outcome! as OutcomeExplained;
    expect(o.reopened, isTrue);
    expect(state().repairedCount, 0);
    final after = await local('m7-q0');
    expect(after!.requestId, before!.requestId);
    expect(after.ackedAt, before.ackedAt);
  });
}
