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
import 'package:mockmob/core/repositories/rhythm_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/features/review/copy.dart';
import 'package:mockmob/features/review/data/repair_api.dart';
import 'package:mockmob/features/review/data/repair_run.dart';
import 'package:mockmob/features/review/data/repair_state.dart';
import 'package:mockmob/features/review/data/review_providers.dart';
import 'package:mockmob/features/review/widgets/retry_first.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart' show rhythmPrefsStoreProvider;

import 'support/review_fixtures.dart';

/// Records every call with the retry pick it carried, and answers from a queue.
class _TryApi implements RepairApi {
  final List<Object> answers = [];
  final List<({String qid, String requestId, int? pick})> calls = [];

  @override
  Future<RepairResponse> repair({required String attemptId, required String questionId, required String requestId, int? retryPick}) async {
    calls.add((qid: questionId, requestId: requestId, pick: retryPick));
    final next = answers.isEmpty ? explainedJson() : answers.removeAt(0);
    if (next is ApiError) throw next;
    return RepairResponse.fromJson(next as Map<String, dynamic>);
  }
}

void main() {
  late _TryApi api;
  late ProviderContainer container;
  late AppDatabase db;

  setUp(() {
    api = _TryApi();
    db = AppDatabase(NativeDatabase.memory());
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
        analyticsClientProvider.overrideWithValue(_NoAnalytics()),
        hapticsProvider.overrideWithValue(const Haptics(enabled: false)),
        creditsRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState<AiCredits>()),
        rhythmRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState<Rhythm>()),
        rhythmPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
      ],
    );
    container.listen(repairLocalRecordsProvider, (_, _) {});
  });

  tearDown(() async {
    container.dispose();
    await db.close();
  });

  RepairRun run() => container.read(repairRunProvider('m7').notifier);
  RepairRunState state() => container.read(repairRunProvider('m7'))!;
  Future<void> settle() => Future<void>.delayed(const Duration(milliseconds: 20));

  group('the try step comes before the paid call', () {
    test('begin offers the try on every open mistake and sends nothing', () async {
      run().open('m7-q10');
      run().begin();
      await settle();
      expect(state().steps.every((s) => s.tryStage == TryStage.open), isTrue);
      expect(state().current!.awaitingTry, isTrue);
      expect(state().current!.outcome, isNull);
      expect(api.calls, isEmpty);
    });

    test('a pick is local, "Check my answer" sends the call with that pick', () async {
      run().open('m7-q10');
      run().begin();
      run().selectTry(2);
      expect(state().current!.retryPick, 2);
      expect(api.calls, isEmpty);
      run().confirmTry();
      await settle();
      expect(api.calls, hasLength(1));
      expect(api.calls.single.pick, 2);
      expect(state().current!.outcome, isA<OutcomeExplained>());
      expect(state().current!.checkedPick, 2);
    });

    test('"Check my answer" does nothing before a pick', () async {
      run().open('m7-q10');
      run().begin();
      run().confirmTry();
      await settle();
      expect(api.calls, isEmpty);
      expect(state().current!.awaitingTry, isTrue);
    });

    test('"Show the reason now" sends the call with no pick and no verdict', () async {
      run().open('m7-q10');
      run().begin();
      run().selectTry(1);
      run().skipTry();
      await settle();
      expect(api.calls.single.pick, isNull);
      expect(state().current!.checkedPick, isNull);
      expect(state().current!.tryStage, TryStage.done);
    });

    test('a failed call keeps the pick and "Try again" resends the same pick with the same request id', () async {
      api.answers.add(const ApiError(kind: ApiErrorKind.network, code: 'network'));
      run().open('m7-q10');
      run().begin();
      run().selectTry(3);
      run().confirmTry();
      await settle();
      expect(state().current!.outcome, isA<OutcomeFailed>());
      expect(state().current!.checkedPick, 3);
      await run().retry();
      await settle();
      expect(api.calls, hasLength(2));
      expect(api.calls[1].pick, 3);
      // A dropped connection never charges twice: the same id goes again.
      expect(api.calls[1].requestId, api.calls[0].requestId);
    });

    test('the next mistake offers its own try and calls nothing until it is checked', () async {
      run().open('m7-q10');
      run().begin();
      run().selectTry(0);
      run().confirmTry();
      await settle();
      run().next();
      await settle();
      expect(state().index, 1);
      expect(state().current!.awaitingTry, isTrue);
      expect(api.calls, hasLength(1));
    });

    test('a repair opened again (already repaired) has no try step', () async {
      run().open('m7-q10');
      run().begin();
      run().selectTry(0);
      run().confirmTry();
      await settle();
      // The mistake is repaired now: opening it again is a free reopen with no try.
      run().finish();
      run().open('m7-q10');
      run().begin();
      await settle();
      expect(state().current!.tryStage, TryStage.none);
      expect(api.calls, hasLength(2));
    });

    test('the older flow (tryFirst false) still calls at once', () async {
      run().open('m7-q10');
      run().begin(tryFirst: false);
      await settle();
      expect(api.calls, hasLength(1));
      expect(api.calls.single.pick, isNull);
    });
  });

  group('the verdict', () {
    test('right when the pick is the key', () {
      expect(retryVerdictOf(pick: 2, key: 2, before: 1), RetryVerdict.right);
    });

    test('still when the same wrong option is picked again', () {
      expect(retryVerdictOf(pick: 1, key: 2, before: 1), RetryVerdict.still);
    });

    test('different when another wrong option is picked', () {
      expect(retryVerdictOf(pick: 3, key: 2, before: 1), RetryVerdict.different);
    });

    test('no verdict before a pick or before the key is known (the reason brings it)', () {
      expect(retryVerdictOf(pick: null, key: 2, before: 1), isNull);
      expect(retryVerdictOf(pick: 2, key: null, before: 1), isNull);
    });

    test('the option words name the key, the pick now and the pick in the paper', () {
      final words = retryOptionWords(pick: 3, key: 2, before: 1, source: 'Mock 2');
      expect(words[2], ReviewCopy.keyWord);
      expect(words[3], ReviewCopy.yourPickNow);
      expect(words[1], 'Your pick in Mock 2');
      expect(retryOptionWords(pick: 2, key: 2, before: 1, source: 'Mock 2')[2], ReviewCopy.yourPickAndKey);
    });
  });
}

class _NoAnalytics implements AnalyticsClient {
  @override
  Future<bool> track(String name, {Map<String, Object?>? props}) async => true;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
