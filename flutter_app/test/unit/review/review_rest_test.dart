import 'dart:async';

import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/analytics/analytics.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/models/attempt.dart';
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
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/features/review/data/repair_api.dart';
import 'package:mockmob/features/review/data/repair_run.dart';
import 'package:mockmob/features/review/data/repair_state.dart';
import 'package:mockmob/features/review/data/review_providers.dart';
import 'package:mockmob/features/review/data/review_seen.dart';
import 'package:mockmob/features/review/screens/repair_ending_screen.dart' show retryQuestionIds;
import 'package:mockmob/features/review/screens/repair_screen.dart';
import 'package:mockmob/features/review/widgets/mistake_view.dart';
import 'package:mockmob/features/review/widgets/question_panel.dart';
import 'package:mockmob/features/review/widgets/run_track.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart' show rhythmPrefsStoreProvider;
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode;

import '../../golden/review/review_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/review_fixtures.dart';

/// Answers each call from a queue; with a [gate] the call waits (a slow network).
class _Api implements RepairApi {
  final List<Object> answers = [];
  final List<String> calls = [];
  Completer<void>? gate;

  @override
  Future<RepairResponse> repair({required String attemptId, required String questionId, required String requestId}) async {
    calls.add(questionId);
    await gate?.future;
    final next = answers.isEmpty ? explainedJson() : answers.removeAt(0);
    if (next is ApiError) throw next;
    return RepairResponse.fromJson(next as Map<String, dynamic>);
  }
}

class _Analytics implements AnalyticsClient {
  @override
  Future<bool> track(String name, {Map<String, Object?>? props}) async => true;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

/// [json] with every question id of the paper renamed onto [asPaper]'s ids, so the same questions
/// appear in two attempts (the bank serves a question again).
Map<String, dynamic> _sameQuestionsAs(Map<String, dynamic> json, String asPaper) {
  final id = json['id'] as String;
  String rename(String q) => q.replaceFirst('$id-q', '$asPaper-q');
  return {
    ...json,
    'questionsSnapshot': [
      for (final q in json['questionsSnapshot'] as List) {...(q as Map<String, dynamic>), 'id': rename(q['id'] as String)},
    ],
    'details': [
      for (final d in json['details'] as List) {...(d as Map<String, dynamic>), 'qid': rename(d['qid'] as String)},
    ],
  };
}

void main() {
  group('the run track (item 6)', () {
    RepairRunState state({int index = 0, int? furthest, List<MistakeOutcome?> outcomes = const []}) {
      final run = runOf(outcomes: outcomes, index: index);
      return run.copyWith(furthest: furthest);
    }

    test('only a step already reached can be shown, never the one on screen or one ahead', () {
      final s = state(index: 1, furthest: 1);
      expect(s.canGoTo(0), isTrue);
      expect(s.canGoTo(1), isFalse, reason: 'already on screen');
      expect(s.canGoTo(2), isFalse, reason: 'not reached: it would need a new repair call');
      expect(s.canGoTo(-1), isFalse);
      final back = s.copyWith(index: 0);
      expect(back.furthest, 1, reason: 'going back keeps the furthest step reached');
      expect(back.canGoTo(1), isTrue);
      expect(runOf(phase: RepairPhase.entry).canGoTo(0), isFalse, reason: 'only while working');
    });

    test('removing a step shifts the place and the furthest step with it', () {
      final s = state(index: 2, furthest: 2);
      final cut = s.without(0);
      expect(cut.steps, hasLength(2));
      expect(cut.index, 1);
      expect(cut.furthest, 1);
      final last = state(index: 2, furthest: 2).without(2);
      expect(last.index, 1);
      expect(last.furthest, 1);
    });

    test('the misses are reached steps that failed or could not be explained', () {
      final s = state(
        index: 2,
        furthest: 2,
        outcomes: [explained, const OutcomeFailed(RepairFailure.offline), const OutcomeNotExplained()],
      );
      expect(s.missed.map((m) => m.item.number), [11, 31]);
      final notReached = state(outcomes: [const OutcomeFailed(RepairFailure.offline)]);
      expect(notReached.missed.map((m) => m.item.number), [1]);
    });
  });

  group('the run goes back without a new call (item 6)', () {
    late _Api api;
    late ProviderContainer container;
    late AppDatabase db;

    setUp(() {
      api = _Api();
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
          analyticsClientProvider.overrideWithValue(_Analytics()),
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
    RepairRunState s() => container.read(repairRunProvider('m7'))!;
    Future<void> settle() => Future<void>.delayed(const Duration(milliseconds: 20));

    test('back and forward along reached steps shows what they had and calls nothing', () async {
      run().open('m7-q0');
      run().begin();
      await settle();
      run().next();
      await settle();
      expect(api.calls, hasLength(2));
      expect(run().goTo(0), isTrue);
      expect(s().index, 0);
      expect(s().current!.outcome, isA<OutcomeExplained>());
      expect(run().goTo(2), isFalse, reason: 'the third mistake was never reached');
      run().next();
      await settle();
      expect(s().index, 1);
      expect(api.calls, hasLength(2), reason: 'a reached step is never called again');
      expect(s().repairedCount, 2);
      run().next();
      await settle();
      expect(api.calls, hasLength(3), reason: 'only a step never opened calls the repair');
    });

    test('an answer that lands while the student looks back is kept on its own step', () async {
      run().open('m7-q0');
      run().begin();
      await settle();
      api.gate = Completer<void>();
      run().next();
      await settle();
      expect(s().current!.outcome, isA<OutcomeLoading>());
      expect(run().goTo(0), isTrue);
      api.gate!.complete();
      await settle();
      expect(s().index, 0, reason: 'the student stays where they went');
      expect(s().steps[1].outcome, isA<OutcomeExplained>());
      run().next();
      await settle();
      expect(api.calls, hasLength(2));
      expect(s().repairedCount, 2);
    });

    test('try the same mistakes again prepares exactly those steps at the entry', () async {
      run().open('m7-q0');
      final first = run().prepareRetry(['m7-q30', 'm7-q10']);
      expect(first, 'm7-q30');
      expect(s().phase, RepairPhase.entry);
      expect(s().steps.map((x) => x.item.questionId), ['m7-q30', 'm7-q10']);
      expect(run().open('m7-q30'), isTrue);
      expect(s().steps.map((x) => x.item.questionId), ['m7-q30', 'm7-q10'], reason: 'the screen keeps the prepared run');
    });
  });

  group('the ending offers the same mistakes again (item 8)', () {
    final index = buildReviewIndex(allAttempts, const []);

    test('nothing repaired: every mistake of the run that is still open', () {
      final run = runOf(phase: RepairPhase.ending, outcomes: [const OutcomeFailed(RepairFailure.offline)]);
      expect(retryQuestionIds(run, index), ['m7-q0', 'm7-q10', 'm7-q30']);
    });

    test('some repaired: only the misses, never the repaired ones', () {
      final run = runOf(
        phase: RepairPhase.ending,
        index: 2,
        outcomes: [explained, const OutcomeFailed(RepairFailure.tookTooLong), explained2],
      ).copyWith(furthest: 2);
      expect(retryQuestionIds(run, index), ['m7-q10']);
    });

    test('all repaired, or nothing known: no key', () {
      final run = runOf(phase: RepairPhase.ending, index: 2, outcomes: [explained, explained, explained2]).copyWith(furthest: 2);
      expect(retryQuestionIds(run, index), isEmpty);
      expect(retryQuestionIds(null, index), isEmpty);
      expect(retryQuestionIds(run, null), isEmpty);
    });
  });

  group('what changed since the last look (item 7)', () {
    test('the first look is the baseline and marks nothing', () {
      expect(compareReviewSeen(null, {'a|x': 3}), isEmpty);
    });

    test('nothing changed, nothing marked', () {
      expect(compareReviewSeen({'a|x': 3, 'a|y': 0}, {'a|x': 3, 'a|y': 0}), isEmpty);
    });

    test('a count that moved is marked from the old count; a new chapter only when it has something open', () {
      final c = compareReviewSeen({'a|x': 3, 'a|y': 2}, {'a|x': 1, 'a|y': 2, 'a|z': 4, 'a|w': 0});
      expect(c, {'a|x': const ChapterChange(from: 3, to: 1), 'a|z': const ChapterChange(from: null, to: 4)});
      expect(c['a|x']!.delta, -2);
      expect(c['a|z']!.isNew, isTrue);
    });

    test('the stored form reads back, and a broken one reads as no last look', () {
      expect(decodeReviewSeen(encodeReviewSeen({'a|x': 3})), {'a|x': 3});
      expect(decodeReviewSeen('not json'), isNull);
      expect(decodeReviewSeen(null), isNull);
    });

    test('a look records itself, so the same change is marked once', () async {
      final store = MemoryPrefsStore();
      final container = ProviderContainer(overrides: [reviewSeenStoreProvider.overrideWithValue(store)]);
      addTearDown(container.dispose);
      container.listen(reviewSeenProvider, (_, _) {});
      final seen = container.read(reviewSeenProvider.notifier);
      expect(seen.look({'a|x': 3}), isEmpty, reason: 'not loaded yet: nothing is marked on a guess');
      await Future<void>.delayed(Duration.zero);
      expect(container.read(reviewSeenProvider), isTrue);
      expect(seen.look({'a|x': 3}), isEmpty, reason: 'first look ever');
      expect(seen.look({'a|x': 1}), {'a|x': const ChapterChange(from: 3, to: 1)});
      expect(seen.look({'a|x': 1}), isEmpty);
      await Future<void>.delayed(Duration.zero);
      expect(decodeReviewSeen(await store.getString(ReviewSeen.storageKey)), {'a|x': 1});
    });
  });

  group('you missed this before (item 9)', () {
    final a1 = mockJson(id: 'a1', completedAt: DateTime.utc(2026, 10, 3, 15, 45), wrong: {0, 5});
    final a2 = _sameQuestionsAs(mockJson(id: 'a2', completedAt: DateTime.utc(2026, 10, 12, 17, 12), wrong: {0, 10, 20}), 'a1');
    final index = buildReviewIndex([Attempt.fromJson(a1), Attempt.fromJson(a2)], const []);

    test('the same question wrong in two attempts is found, newest other paper first', () {
      final now = index.item('a2', 'a1-q0')!;
      final earlier = index.missedElsewhere(now);
      expect(earlier.map((i) => i.attemptId), ['a1']);
      expect(index.missedElsewhere(index.item('a1', 'a1-q0')!).map((i) => i.attemptId), ['a2']);
    });

    test('a question missed once has nothing to say', () {
      expect(index.missedElsewhere(index.item('a2', 'a1-q10')!), isEmpty);
      expect(buildReviewIndex(allAttempts, const []).missedElsewhere(mock7Item()), isEmpty);
    });

    test('a run puts repeat misses first, each part in its own order', () {
      final items = [index.item('a2', 'a1-q10')!, index.item('a2', 'a1-q20')!, index.item('a2', 'a1-q0')!];
      expect(orderRepeatsFirst(index, items).map((i) => i.questionId), ['a1-q0', 'a1-q10', 'a1-q20']);
    });
  });

  group('the screens', () {
    setUpAll(loadAppFonts);

    double shownOpacity(WidgetTester tester) {
      var sum = 0.0;
      for (final view in find.byType(MistakeView).evaluate()) {
        final opacity = find.ancestor(of: find.byWidget(view.widget), matching: find.byType(Opacity)).evaluate();
        sum += opacity.isEmpty ? 1 : (opacity.first.widget as Opacity).opacity;
      }
      return sum;
    }

    Future<void> pumpRun(WidgetTester tester, RepairRunState run) => pumpMockmob(
      tester,
      // The screen keeps a run under way on the mistake it was opened at.
      RepairScreen(attemptId: 'm7', questionId: run.current!.item.questionId),
      size: const Size(384, 853),
      wrapInScaffold: false,
      overrides: [
        ...reviewOverrides(run: run, celebration: CelebrationMode.off),
        hapticsProvider.overrideWithValue(const Haptics(enabled: false)),
      ],
    );

    // The key stays on screen from one mistake to the next, so its tap lock holds: two taps inside
    // it are one commit (a double tap never skips a mistake unread), two taps after it are two.
    for (final gap in const [Duration(milliseconds: 350), Duration(milliseconds: 60)]) {
      final moves = gap >= KeyButton.defaultTapLock ? 2 : 1;
      testWidgets('two Next taps ${gap.inMilliseconds} ms apart move exactly $moves, with no blank frame', (tester) async {
        await pumpRun(tester, runOf(outcomes: [explained, explained, explained2]));
        expect(find.text('1 of 3 mistakes'), findsOneWidget);

        Future<void> watch(Duration span) async {
          for (var t = Duration.zero; t < span; t += const Duration(milliseconds: 16)) {
            await tester.pump(const Duration(milliseconds: 16));
            expect(find.byType(MistakeView), findsWidgets, reason: 'a mistake is always on screen');
            expect(shownOpacity(tester), greaterThanOrEqualTo(0.69), reason: 'the two layers never fade under the floor');
          }
        }

        await tester.tap(find.widgetWithText(KeyButton, 'Next mistake').last);
        await watch(gap);
        await tester.tap(find.widgetWithText(KeyButton, 'Next mistake').hitTestable().last, warnIfMissed: false);
        await watch(const Duration(milliseconds: 400));
        await tester.pump(const Duration(seconds: 2));
        expect(find.text('${1 + moves} of 3 mistakes'), findsOneWidget, reason: 'no mistake skipped unread');
      });
    }

    testWidgets('the track and the key stay put while the mistake moves on', (tester) async {
      await pumpRun(tester, runOf(outcomes: [explained, explained, explained2]));
      final track = tester.element(find.byType(RunTrack));
      final key = tester.element(find.widgetWithText(KeyButton, 'Next mistake'));
      await tester.tap(find.widgetWithText(KeyButton, 'Next mistake'));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byType(RunTrack), findsOneWidget, reason: 'one track whose lift travels, not two crossfading');
      expect(tester.element(find.byType(RunTrack)), same(track));
      expect(find.byType(MistakeView), findsOneWidget, reason: 'only the mistake inside the page moves');
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('2 of 3 mistakes'), findsOneWidget);
      expect(tester.element(find.widgetWithText(KeyButton, 'Next mistake')), same(key));
    });

    testWidgets('a reached segment of the track is a 48 dp key that goes back', (tester) async {
      await pumpRun(tester, runOf(outcomes: [explained, explained], index: 1));
      await tester.pump(const Duration(seconds: 2));
      final first = find.bySemanticsLabel('Mistake 1 of 3, repaired');
      expect(first, findsOneWidget);
      expect(tester.getSize(first).height, greaterThanOrEqualTo(48));
      await tester.tap(first);
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('1 of 3 mistakes'), findsOneWidget);
      // The segment ahead was reached (index 1) and can be shown again; the last one was not.
      await tester.tap(find.bySemanticsLabel('Mistake 3 of 3, not reached yet'), warnIfMissed: false);
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('1 of 3 mistakes'), findsOneWidget, reason: 'a step never reached is not a key');
    });

    testWidgets('a swipe goes back to the mistake before', (tester) async {
      await pumpRun(tester, runOf(outcomes: [explained, explained], index: 1));
      await tester.pump(const Duration(seconds: 2));
      expect(find.text('2 of 3 mistakes'), findsOneWidget);
      await tester.fling(find.byType(ListView).first, const Offset(300, 0), 1200);
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('1 of 3 mistakes'), findsOneWidget);
    });

    testWidgets('the key reveal plays on a key review, and paints final under reduced motion', (tester) async {
      await pumpMockmob(
        tester,
        const RepairScreen(attemptId: 'm7', questionId: 'm7-q10'),
        size: const Size(384, 853),
        disableAnimations: true,
        wrapInScaffold: false,
        overrides: reviewOverrides(
          run: runOf(outcomes: [explained, const OutcomeKeyReview(KeyReviewReason.chosen)], index: 1),
          celebration: CelebrationMode.off,
        ),
      );
      expect(find.text('Correct answer'), findsOneWidget);
      final options = tester.widgetList<MarkedOption>(find.byType(MarkedOption)).toList();
      final key = options.firstWhere((o) => o.mark == OptionMark.correct);
      expect(key.reveal?.value ?? 1, 1, reason: 'reduced motion shows the final state at once');
    });
  });
}

MistakeItem mock7Item() => buildReviewIndex(allAttempts, const []).item('m7', 'm7-q0')!;
