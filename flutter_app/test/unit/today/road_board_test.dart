// The road board (owner test 15 Oct): the student's own exam date and mock target, kept on this
// phone, the tiles' arithmetic, the sheets that change them, and the "more below" cue.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/domain/cuet_dates.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart' show rhythmPrefsStoreProvider;
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/data/road_plan.dart';
import 'package:mockmob/features/today/logic/road_board.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/road_board.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

void main() {
  setUpAll(loadAppFonts);

  final today = DateTime.utc(2026, 10, 13);
  final window = CuetDates.windowStart;
  DateTime dateOf(DateTime instant) => DateTime.utc(instant.year, instant.month, instant.day);

  group('the board', () {
    test('counts to the expected window until the student sets a day of their own', () {
      final board = buildRoadBoard(today: today, windowStart: window, plan: const RoadPlan(), attempts: const [], dateOf: dateOf);
      expect(board.examDate, window);
      expect(board.ownDate, isFalse);
      expect(board.daysToExam, window.difference(today).inDays);

      final own = buildRoadBoard(today: today, windowStart: window, plan: RoadPlan(examDate: DateTime.utc(2027, 5, 15)), attempts: const [], dateOf: dateOf);
      expect(own.examDate, DateTime.utc(2027, 5, 15));
      expect(own.ownDate, isTrue);
    });

    test('a day already gone, or past June, falls back to the expected window', () {
      for (final bad in [DateTime.utc(2026, 10, 1), DateTime.utc(2027, 7, 2)]) {
        final board = buildRoadBoard(today: today, windowStart: window, plan: RoadPlan(examDate: bad), attempts: const [], dateOf: dateOf);
        expect(board.ownDate, isFalse, reason: '$bad');
        expect(board.examDate, window);
      }
    });

    test('mocks taken count only full and NTA-style papers, and the newest one is named', () {
      final attempts = [
        paper(id: 'm2', completedAt: DateTime.utc(2026, 10, 10, 9), runs: const [('A', V.right, 3)]),
        paper(id: 'q1', completedAt: DateTime.utc(2026, 10, 12, 9), mode: 'quick', runs: const [('A', V.right, 3)]),
        paper(id: 'm1', completedAt: DateTime.utc(2026, 10, 1, 9), mode: 'nta', runs: const [('A', V.right, 3)]),
      ];
      final board = buildRoadBoard(today: today, windowStart: window, plan: const RoadPlan(mockTarget: 10), attempts: attempts, dateOf: dateOf);
      expect(board.mocksTaken, 2);
      expect(board.lastMockAt, DateTime.utc(2026, 10, 10));
      expect(board.mocksLeft, 8);
      expect(board.daysPerMock, board.daysToExam ~/ 8);
    });

    test('an unread record shows no count rather than zero', () {
      final board = buildRoadBoard(today: today, windowStart: window, plan: const RoadPlan(), attempts: null, dateOf: dateOf);
      expect(board.mocksTaken, isNull);
      expect(board.mocksLeft, isNull);
    });

    test('study days left keep board weeks at two, as the onboarding plan counts them', () {
      final plain = sessionsUntil(DateTime.utc(2026, 10, 13), DateTime.utc(2026, 11, 10), daysPerWeek: 4);
      expect(plain, 16);
      final boards = sessionsUntil(DateTime.utc(2027, 2, 15), DateTime.utc(2027, 3, 15), daysPerWeek: 5);
      expect(boards, 8, reason: 'four board weeks at two each');
      final light = sessionsUntil(DateTime.utc(2027, 2, 15), DateTime.utc(2027, 3, 15), daysPerWeek: 1);
      expect(light, 4, reason: 'a goal under two keeps its own count');
    });

    test('a first target is one mock a fortnight, at least five, never at or below what is done', () {
      expect(suggestedMockTarget(weeks: 28, taken: 0), 14);
      expect(suggestedMockTarget(weeks: 4, taken: 0), 5);
      expect(suggestedMockTarget(weeks: 4, taken: 9), 10);
    });

    test('the road model carries the board, and the big figure counts to the chosen day', () {
      final inputs = TodayInputs(now: tuesdayEvening, attempts: const [], roadPlan: RoadPlan(examDate: DateTime.utc(2027, 5, 22)));
      final road = buildToday(inputs).road!;
      expect(road.board!.ownDate, isTrue);
      expect(road.board!.examDate, DateTime.utc(2027, 5, 22));
    });
  });

  group('the plan on this phone', () {
    test('keeps the date and the target per account and reads them back', () async {
      final store = MemoryPrefsStore();
      ProviderContainer make() => ProviderContainer(overrides: [
            rhythmPrefsStoreProvider.overrideWithValue(store),
            userIdProvider.overrideWithValue('u1'),
          ]);
      final first = make();
      addTearDown(first.dispose);
      first.read(roadPlanProvider);
      await first.read(roadPlanProvider.notifier).setExamDate(DateTime(2027, 5, 15));
      await first.read(roadPlanProvider.notifier).setMockTarget(18);
      expect(first.read(roadPlanProvider), RoadPlan(examDate: DateTime.utc(2027, 5, 15), mockTarget: 18));

      final second = make();
      addTearDown(second.dispose);
      second.read(roadPlanProvider);
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);
      expect(second.read(roadPlanProvider), RoadPlan(examDate: DateTime.utc(2027, 5, 15), mockTarget: 18));

      await second.read(roadPlanProvider.notifier).setExamDate(null);
      expect(second.read(roadPlanProvider).examDate, isNull);
      expect(store.values.keys.where((k) => k.contains('exam_date')), isEmpty);
    });
  });

  group('the tiles', () {
    Future<List<Object>> pumpBoard(WidgetTester tester, RoadBoard board, MemoryPrefsStore store) async {
      final events = <Object>[];
      await pumpMockmob(
        tester,
        SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: RoadBoardGrid(board: board, onWeek: () => events.add('week'), onOpen: events.add),
          ),
        ),
        size: const Size(384, 900),
        disableAnimations: true,
        overrides: [
          rhythmPrefsStoreProvider.overrideWithValue(store),
          authSnapshotProvider.overrideWithBuild((ref, n) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha')),
        ],
      );
      await tester.pump();
      return events;
    }

    final board = RoadBoard(
      today: today,
      examDate: window,
      ownDate: false,
      daysToExam: window.difference(today).inDays,
      mocksTaken: 3,
      lastMockAt: DateTime.utc(2026, 10, 10),
      studyDaysLeft: 96,
      goal: 4,
      weekDone: 1,
      weekGoal: 4,
    );

    testWidgets('show the student their own numbers, and the week tile opens the week', (tester) async {
      final events = await pumpBoard(tester, board, MemoryPrefsStore());
      expect(find.text(TodayCopy.boardExpectedDate), findsOneWidget);
      expect(find.text('1 May'), findsOneWidget);
      expect(find.text('3'), findsOneWidget);
      expect(find.text(TodayCopy.boardSetTarget), findsOneWidget);
      expect(find.text('96'), findsOneWidget);
      expect(find.text('1 of 4'), findsOneWidget);
      await tester.tap(find.text(TodayCopy.boardThisWeek));
      await tester.pump();
      expect(events, ['week']);
    });

    testWidgets('the mocks sheet sets a target and keeps it on this phone', (tester) async {
      final store = MemoryPrefsStore();
      await pumpBoard(tester, board, store);
      await tester.tap(find.text(TodayCopy.boardMocks));
      await tester.pumpAndSettle();
      expect(find.text(TodayCopy.boardMocksSoFar(3, DateTime.utc(2026, 10, 10))), findsOneWidget);
      final start = suggestedMockTarget(weeks: board.weeksToExam, taken: 3);
      await tester.tap(find.bySemanticsLabel(TodayCopy.boardMore));
      await tester.pump();
      await tester.tap(find.text(TodayCopy.boardSaveTarget));
      await tester.pumpAndSettle();
      expect(store.values['road_mock_target_u'], start + 1);
    });

    testWidgets('the date sheet saves a day in the window', (tester) async {
      final store = MemoryPrefsStore();
      await pumpBoard(tester, board, store);
      await tester.tap(find.text(TodayCopy.boardExpectedDate));
      await tester.pumpAndSettle();
      expect(find.text(TodayCopy.boardDateBody), findsOneWidget);
      await tester.tap(find.text('15 May'));
      await tester.pumpAndSettle();
      expect(store.values['road_exam_date_u'], '2027-05-15');
    });
  });

  Future<void> pumpBody(WidgetTester tester, TodayView view, Size size) => pumpMockmob(
        tester,
        TodayBody(view: view, skeletonDelay: Duration.zero, callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {})),
        size: size,
        disableAnimations: true,
        overrides: [
          authSnapshotProvider.overrideWithBuild((ref, n) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha')),
          rhythmPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
        ],
      );

  testWidgets('a road below the first screen gets a cue that glides to it and goes once scrolled', (tester) async {
    final view = buildToday(TodayInputs(now: tuesdayEvening, firstName: 'Asha', attempts: [accountancyMock('m1', daysBefore(tuesdayEvening, 1))]));
    expect(view.road, isNotNull);
    // The gap under the hero sits at about 461 to 485 dp and the road heading at 670: a screen
    // 600 dp tall shows the gap (so the cue can be tapped) and still has the road below it.
    await pumpBody(tester, view, const Size(384, 600));
    await tester.pump();
    await tester.pump();
    final cue = find.bySemanticsLabel(RegExp('^Road to May'));
    expect(cue.hitTestable(), findsOneWidget);
    await tester.tap(cue);
    await tester.pumpAndSettle();
    expect(find.text(TodayCopy.roadTitle).hitTestable(), findsOneWidget, reason: 'the page glided to the road');
    expect(find.bySemanticsLabel(RegExp('^Road to May')).hitTestable(), findsNothing, reason: 'the cue is gone for the visit');
  });

  // Design critic 16 Oct, finding 2: the cue sat over the key at late night and over the chart
  // when a paper had ended. It now lives in the gap under the hero, so it never covers a card, a
  // key or a line, in any state.
  for (final (name, inputs) in [
    ('late night', ashaInputs(now: tuesdayLate)),
    ('ready', ashaInputs()),
    (
      'ended',
      ashaInputs(
        draft: TodayDraft(
          sessionId: 's8',
          subject: 'accountancy',
          isMock: true,
          mockNumber: 8,
          total: 50,
          answered: 31,
          acknowledgedAnswered: 31,
          endsAt: tuesdayEvening.subtract(const Duration(hours: 3)),
          resumable: false,
          attemptExists: false,
        ),
      ),
    ),
  ]) {
    testWidgets('$name: the more-below cue never overlaps a key, a line or the hero', (tester) async {
      await pumpBody(tester, buildToday(inputs), const Size(384, 853));
      await tester.pump();
      final slot = find.byType(MoreBelowSlot);
      expect(slot, findsOneWidget);
      final cueRect = tester.getRect(find.descendant(of: slot, matching: find.byType(MoreBelowCue)));
      final slotRect = tester.getRect(slot);
      expect(slotRect.contains(cueRect.topLeft) && slotRect.contains(cueRect.bottomRight - const Offset(0.01, 0.01)), isTrue,
          reason: 'the cue is drawn inside its own gap');
      for (final key in tester.widgetList(find.byType(KeyButton))) {
        final rect = tester.getRect(find.byWidget(key));
        expect(rect.overlaps(cueRect), isFalse, reason: 'the cue never covers a key');
      }
      for (final element in find.byType(RichText).evaluate()) {
        if (find.descendant(of: slot, matching: find.byWidget(element.widget)).evaluate().isNotEmpty) continue;
        final box = element.renderObject! as RenderBox;
        if (!box.hasSize) continue;
        final rect = box.localToGlobal(Offset.zero) & box.size;
        expect(rect.overlaps(cueRect), isFalse, reason: 'the cue never covers a line: ${(element.widget as RichText).text.toPlainText()}');
      }
    });
  }

  test('the error card says the move did not load, and why', () {
    final view = buildToday(TodayInputs(now: tuesdayEvening, attemptsFailed: true));
    final hero = view.hero! as MoveHero;
    expect(hero.subjectLine, TodayCopy.failTitle);
    expect(hero.secondary?.label, TodayCopy.practiseAnyway);
    final offline = buildToday(TodayInputs(now: tuesdayEvening, attemptsFailed: true, offline: true)).hero! as MoveHero;
    expect(offline.meaning, TodayCopy.unavailableOffline);
  });
}
