import 'dart:async';

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
import 'package:mockmob/core/repositories/notification_prefs_repository.dart' show studentTimezoneProvider;
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/core/copy/formatters.dart';
import 'package:mockmob/core/repositories/rhythm_repository.dart';
import 'package:mockmob/core/repositories/rhythm_seen_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/features/review/copy.dart';
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

  /// When set, a call is recorded and then waits here (a slow network).
  Completer<void>? gate;

  @override
  Future<RepairResponse> repair({required String attemptId, required String questionId, required String requestId, int? retryPick}) async {
    calls.add((questionId, requestId));
    await gate?.future;
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
        studentTimezoneProvider.overrideWithValue('Asia/Kolkata'),
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
    run().begin(tryFirst: false);
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
    run().begin(tryFirst: false);
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
    run().begin(tryFirst: false);
    await settle();
    expect(api.calls, hasLength(2));
    expect(api.calls[0].$2, isNot(api.calls[1].$2));
    expect(state().current!.outcome, isA<OutcomeExplained>());
  });

  group('failures from the repair route (all sent with charged: 0)', () {
    // What the repair route answers: the code, the status, `charged: 0` and the sentence for the student.
    ApiError failure(int status, ApiErrorKind kind, String code, String message) =>
        ApiError(status: status, kind: kind, code: code, details: {'charged': 0, 'message': message});
    final timeout = failure(504, ApiErrorKind.server, 'provider_timeout', 'This one took too long. You were not charged.');
    final unavailable = failure(
      503,
      ApiErrorKind.unavailable,
      'provider_unavailable',
      'Repairs aren’t available right now. Try again in a little while. You were not charged.',
    );
    final wallet = failure(503, ApiErrorKind.unavailable, 'wallet_unavailable', 'We couldn’t reach your credits. Nothing was charged. Try again.');
    final budget = failure(503, ApiErrorKind.unavailable, 'budget_reached', 'Repairs are paused until 1 November. You were not charged.');

    Future<void> begin() async {
      run().open('m7-q0');
      run().begin(tryFirst: false);
      await settle();
    }

    OutcomeFailed failed() => state().current!.outcome! as OutcomeFailed;

    test('provider_timeout says it took too long and not offline, keeps the run going, and the retry gets a fresh id', () async {
      api.answers.add(timeout);
      await begin();
      expect(failed().failure, RepairFailure.tookTooLong);
      expect(failed().failure.canRetry, isTrue);
      expect(state().keyOnly, isFalse);
      expect(ReviewCopy.tookTooLong, 'This took too long. You were not charged.');
      await run().retry();
      await settle();
      expect(api.calls, hasLength(2));
      expect(api.calls[1].$2, isNot(api.calls[0].$2), reason: 'a charged: 0 failure released the id');
      expect(state().current!.outcome, isA<OutcomeExplained>());
    });

    test('a call the app stopped waiting for is a timeout, not offline, and the retry keeps its id', () async {
      api.answers.add(const ApiError(kind: ApiErrorKind.timeout, code: 'timeout'));
      await begin();
      expect(failed().failure, RepairFailure.tookTooLong);
      expect(state().keyOnly, isFalse);
      await run().retry();
      await settle();
      expect(api.calls[1].$2, api.calls[0].$2, reason: 'no answer arrived, so the server may still hold this id: it charges once per id');
      expect(state().current!.outcome, isA<OutcomeExplained>());
    });

    test('provider_unavailable shows the server message, keeps the run going, and the retry gets a fresh id', () async {
      api.answers.add(unavailable);
      await begin();
      expect(failed().failure, RepairFailure.providerUnavailable);
      expect(failed().message, unavailable.serverMessage);
      expect(failed().failure.canRetry, isTrue);
      expect(state().keyOnly, isFalse);
      await run().retry();
      await settle();
      expect(api.calls[1].$2, isNot(api.calls[0].$2));
      expect(state().current!.outcome, isA<OutcomeExplained>());
    });

    test('wallet_unavailable shows the server message, keeps the run going, and the retry gets a fresh id', () async {
      api.answers.add(wallet);
      await begin();
      expect(failed().failure, RepairFailure.walletUnavailable);
      expect(failed().message, wallet.serverMessage);
      expect(state().keyOnly, isFalse);
      await run().retry();
      await settle();
      expect(api.calls[1].$2, isNot(api.calls[0].$2));
      expect(state().current!.outcome, isA<OutcomeExplained>());
    });

    test('unusable_output shows the server message and the retry gets a fresh id', () async {
      api.answers.add(failure(502, ApiErrorKind.server, 'unusable_output', 'The repair could not be prepared reliably this time. You were not charged.'));
      await begin();
      expect(failed().failure, RepairFailure.unavailable);
      expect(failed().message, 'The repair could not be prepared reliably this time. You were not charged.');
      await run().retry();
      await settle();
      expect(api.calls[1].$2, isNot(api.calls[0].$2));
    });

    test('budget_reached says when repairs are back, offers no retry, and the run keeps going to the next mistake', () async {
      api.answers.add(budget);
      await begin();
      expect(failed().failure, RepairFailure.budgetReached);
      expect(failed().message, 'Repairs are paused until 1 November. You were not charged.');
      expect(failed().failure.canRetry, isFalse);
      expect(state().keyOnly, isFalse, reason: 'only paused turns the run into key reviews');
      run().next();
      await settle();
      expect(api.calls, hasLength(2), reason: 'the next mistake is still asked for');
      expect(state().current!.item.questionId, isNot('m7-q0'));
      expect(state().current!.outcome, isA<OutcomeExplained>());
    });

    test('budget_reached without a sentence still names the date: the first of next month in India', () async {
      api.answers.add(const ApiError(status: 503, kind: ApiErrorKind.unavailable, code: 'budget_reached', details: {'charged': 0}));
      await begin();
      expect(failed().message, 'Repairs are paused until 1 November. You were not charged.');
    });

    test('paused is the one that turns the rest of the run into key reviews, without more calls', () async {
      api.answers.add(const ApiError(status: 503, kind: ApiErrorKind.unavailable, code: 'paused', details: {'charged': 0}));
      await begin();
      expect((state().current!.outcome! as OutcomeKeyReview).reason, KeyReviewReason.paused);
      expect(state().keyOnly, isTrue);
      run().next();
      await settle();
      expect(api.calls, hasLength(1));
      expect(state().current!.outcome, isA<OutcomeKeyReview>());
    });

    test('a failure that did not say charged: 0 keeps the id (in_progress)', () async {
      api.answers.add(const ApiError(status: 409, kind: ApiErrorKind.conflict, code: 'in_progress'));
      await begin();
      expect(failed().failure, RepairFailure.inProgress);
      await run().retry();
      await settle();
      expect(api.calls[1].$2, api.calls[0].$2);
    });

    test('a second failure after the fresh id gets another fresh id, never the released one', () async {
      api.answers
        ..add(unavailable)
        ..add(timeout);
      await begin();
      await run().retry();
      await settle();
      await run().retry();
      await settle();
      expect(api.calls, hasLength(3));
      expect({api.calls[0].$2, api.calls[1].$2, api.calls[2].$2}, hasLength(3));
      expect(state().current!.outcome, isA<OutcomeExplained>());
    });

    test('a reopened repair that fails with charged: 0 leaves its record alone', () async {
      final repo = container.read(repairLocalRepositoryProvider);
      await repo.recordOutcome(attemptId: 'm7', questionId: 'm7-q0', status: RepairLocalStatus.explained, requestId: 'req-original-0000000');
      final before = await local('m7-q0');
      await settle();
      api.answers.add(unavailable);
      await begin();
      expect(failed().failure, RepairFailure.providerUnavailable);
      final after = await local('m7-q0');
      expect(after!.status, RepairLocalStatus.explained);
      expect(after.requestId, before!.requestId);
    });
  });

  test('not_a_mistake removes the step quietly and moves on', () async {
    api.answers.add(const ApiError(kind: ApiErrorKind.validation, code: 'not_a_mistake', status: 422));
    run().open('m7-q0');
    run().begin(tryFirst: false);
    await settle();
    expect(state().steps, hasLength(2));
    expect(state().current!.item.questionId, 'm7-q10');
    expect((await local('m7-q0'))!.status, RepairLocalStatus.notAMistake);
  });

  test('held_for_recheck is set aside and never counts as repaired', () async {
    api.answers.add({'status': 'held_for_recheck', 'charged': 0});
    run().open('m7-q0');
    run().begin(tryFirst: false);
    await settle();
    expect(state().current!.outcome, isA<OutcomeSetAside>());
    expect(state().repairedCount, 0);
    expect((await local('m7-q0'))!.status, RepairLocalStatus.heldForRecheck);
  });

  test('an empty wallet switches the run to key explanations without more calls', () async {
    api.answers.add(const ApiError(kind: ApiErrorKind.paymentRequired, code: 'insufficient_ai_credits', status: 402));
    run().open('m7-q0');
    run().begin(tryFirst: false);
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
    run().begin(tryFirst: false);
    await settle();
    expect((state().current!.outcome! as OutcomeSetAside).heldByServer, isFalse);
  });

  test('finishing ends the run and reports the count', () async {
    run().open('m7-q0');
    run().begin(tryFirst: false, limit: 2);
    await settle();
    run().next();
    await settle();
    run().next();
    expect(state().phase, RepairPhase.ending);
    expect(state().repairedCount, 2);
    expect(analytics.events.last.$1, AnalyticsEvents.repairCompleted);
    expect(analytics.events.last.$2, {'count': 2});
  });

  group('a repair answered after the student left the step', () {
    test('finishing while a call is in flight still counts the acknowledged answer (result-review-03)', () async {
      run().open('m7-q0');
      run().begin(tryFirst: false, limit: 2);
      await settle();
      expect(state().repairedCount, 1);
      final gate = api.gate = Completer<void>();
      run().next();
      await settle();
      expect(state().current!.outcome, isA<OutcomeLoading>());
      run().finish();
      expect(state().phase, RepairPhase.ending);
      expect(state().repairedCount, 1);
      gate.complete();
      await settle();
      // The server charged for it and the record says Repaired: the ending now says so too.
      expect((await local('m7-q10'))!.status, RepairLocalStatus.explained);
      expect(state().repairedCount, 2);
      expect(state().steps[1].outcome, isA<OutcomeExplained>());
      expect(state().lastAckedAt, lateUtc);
    });

    test('an answer that comes back after the run was replaced does not touch the new run', () async {
      final gate = api.gate = Completer<void>();
      run().open('m7-q0');
      run().begin(tryFirst: false);
      await settle();
      expect(state().current!.outcome, isA<OutcomeLoading>());
      run().open('m7-q10');
      expect(state().phase, RepairPhase.entry);
      gate.complete();
      await settle();
      expect(state().phase, RepairPhase.entry);
      expect(state().repairedCount, 0);
      expect((await local('m7-q0'))!.status, RepairLocalStatus.explained);
    });
  });

  group('open (result-review-06)', () {
    test('a run backed out of before any repair is replaced by the tapped mistake and count', () async {
      api.answers.add(const ApiError(kind: ApiErrorKind.network, code: 'network'));
      run().open('m7-q10');
      run().begin(tryFirst: false);
      await settle();
      expect(state().current!.outcome, isA<OutcomeFailed>());
      expect(run().open('m7-q10', count: 1), isTrue);
      expect(state().phase, RepairPhase.entry);
      expect(state().index, 0);
      expect(state().steps, hasLength(1));
      expect(state().current!.outcome, isNull);
      expect(run().open('m7-q0'), isTrue);
      expect(state().steps.first.item.questionId, 'm7-q0');
    });

    test('a run left at its entry does not hold on to an old count', () async {
      run().open('m7-q10', count: 1);
      expect(state().steps, hasLength(1));
      run().open('m7-q10');
      expect(state().steps, hasLength(3));
    });

    test('a run whose call is still in flight is kept for the same question', () async {
      api.gate = Completer<void>();
      run().open('m7-q0');
      run().begin(tryFirst: false);
      await settle();
      expect(run().open('m7-q0'), isTrue);
      expect(state().phase, RepairPhase.working);
      expect(state().current!.outcome, isA<OutcomeLoading>());
      api.gate!.complete();
      await settle();
    });

    test('a run that has repaired something is kept for the same question', () async {
      run().open('m7-q0');
      run().begin(tryFirst: false);
      await settle();
      expect(state().repairedCount, 1);
      expect(run().open('m7-q0'), isTrue);
      expect(state().phase, RepairPhase.working);
      expect(state().repairedCount, 1);
    });
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
    Future<Set<String>> spent() async => (await container.read(rhythmSeenRepositoryProvider).read()).celebratedIds;

    test('finishing alone fires nothing: no slot is on screen yet, so no id is spent', () async {
      run().open('m7-q0');
      run().begin(tryFirst: false, limit: 2);
      await settle();
      run().next();
      await settle();
      run().next();
      await settle();
      expect(state().phase, RepairPhase.ending);
      expect(container.read(celebrationControllerProvider).byScope, isEmpty);
      expect(await spent(), isEmpty);
    });

    test('the ending consumes the moment with the acknowledged time, once, in the run scope', () async {
      run().open('m7-q0');
      run().begin(tryFirst: false, limit: 2);
      await settle();
      run().next();
      await settle();
      run().next();
      await settle();
      final shown = await run().celebrateEnding();
      final c = container.read(celebrationControllerProvider).byScope[CelebrationScope.repair('m7')];
      expect(c, isNotNull);
      expect(shown?.id, c!.id);
      expect(c.id, startsWith('repair:m7:'));
      // The student's clock (Asia/Kolkata), as the ending screen shows it, not UTC.
      expect(c.receipt, 'Repair finished. Recorded at ${formatTime12(container.read(reviewClockProvider).local(state().lastAckedAt!))}.');
      expect(await spent(), contains(c.id));
      // The same ending drawn again keeps the moment showing.
      expect((await run().celebrateEnding())?.id, c.id);
    });

    test('a run with nothing repaired fires nothing', () async {
      api.answers.add(explainedJson(status: 'not_explained'));
      run().open('m7-q0');
      run().begin(tryFirst: false, limit: 1);
      await settle();
      run().finish();
      await settle();
      expect(await run().celebrateEnding(), isNull);
      expect(container.read(celebrationControllerProvider).byScope, isEmpty);
    });

    test('with the weekly rhythm turned off the moment is not spent unseen', () async {
      rhythmStore.values['rhythm_hidden_u1'] = true;
      run().open('m7-q0');
      run().begin(tryFirst: false, limit: 1);
      await settle();
      run().finish();
      await settle();
      expect(await run().celebrateEnding(), isNull);
      expect(container.read(celebrationControllerProvider).byScope, isEmpty);
      expect(await spent(), isEmpty);
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
    run().begin(tryFirst: false);
    await settle();
    final o = state().current!.outcome! as OutcomeExplained;
    expect(o.reopened, isTrue);
    expect(state().repairedCount, 0);
    final after = await local('m7-q0');
    expect(after!.requestId, before!.requestId);
    expect(after.ackedAt, before.ackedAt);
  });
}
