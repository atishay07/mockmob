import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/domain/cuet_dates.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/rhythm_seen_repository.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart' show rhythmPrefsStoreProvider;
import 'package:mockmob/features/rhythm/rhythm.dart';
import 'package:mockmob/features/today/widgets/header_mobi.dart';
import 'package:mockmob/features/today/widgets/length_pill.dart';
import 'package:mockmob/features/today/widgets/week_ledger.dart';
import 'package:mockmob/features/today/widgets/today_celebration.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/logic/why_model.dart';
import 'package:mockmob/features/today/screens/alternatives_sheet.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/road_timeline.dart' show RoadStops;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../core_data/support/test_db.dart';
import 'support/today_fixtures.dart';

void main() {
  setUpAll(loadAppFonts);

  final overrides = [
    authSnapshotProvider.overrideWithBuild(
      (ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha Verma'),
    ),
  ];

  Future<List<Object>> pumpToday(WidgetTester tester, TodayView view) async {
    final events = <Object>[];
    await pumpMockmob(
      tester,
      TodayBody(
        view: view,
        skeletonDelay: Duration.zero,
        callbacks: TodayCallbacks(
          onAction: events.add,
          onTarget: events.add,
          onMinutes: (m) => events.add('minutes:$m'),
          onShowMe: (id) => events.add('why:$id'),
          onWeek: () => events.add('week'),
        ),
      ),
      size: const Size(384, 1900),
      disableAnimations: true,
      overrides: overrides,
    );
    return events;
  }

  testWidgets('the volt pill starts the repair; Show me reports back; the length pill is beside the key', (tester) async {
    final events = await pumpToday(tester, buildToday(ashaInputs()));
    expect(find.byType(LengthPill), findsOneWidget, reason: 'a move with more than one length shows its length every day');
    expect(find.text('15 min'), findsOneWidget, reason: 'the pill says the length once');
    expect(find.text('Start repair'), findsOneWidget, reason: 'the key says the verb, not the length again');
    expect(find.bySemanticsLabel(TodayCopy.startRepair(15)), findsOneWidget, reason: 'a screen reader still hears the length on the key');
    await tester.tap(find.text('Start repair'));
    await tester.tap(find.textContaining(TodayCopy.showMe, findRichText: true));
    await tester.pump();
    final action = events.whereType<TodayAction>().single;
    expect((action.target as GoTo).location, startsWith(AppRoutes.reviewRepair('m7', 'm7-q3')));
    expect(events, contains('why:m7'));
  });

  testWidgets('offline, a start says why it is unavailable instead of failing', (tester) async {
    final events = await pumpToday(tester, buildToday(ashaInputs(offline: true)));
    expect(find.text(TodayCopy.connectToStart), findsOneWidget);
    expect(find.text('Updated 7:30 PM. You are offline.'), findsOneWidget);
    await tester.tap(find.text('Start repair'));
    await tester.pump();
    expect(events.whereType<TodayAction>(), isEmpty);
  });

  testWidgets('a sheet row opens its result; the sealed one opens the sealed sheet', (tester) async {
    final events = await pumpToday(tester, buildToday(ashaInputs(unopened: [(attemptId: 'm7', receivedAt: tuesdayEvening)])));
    await tester.tap(find.text(TodayCopy.openDirectly));
    await tester.tap(find.text('Mock 6'));
    await tester.pump();
    final locations = [
      for (final e in events)
        if (e is TodayAction) (e.target as GoTo).location else if (e is GoTo) e.location,
    ];
    expect(locations, [AppRoutes.result('m7'), AppRoutes.result('m6')]);
  });

  testWidgets('the error state offers Try again and a way to practise', (tester) async {
    final events = await pumpToday(tester, buildToday(TodayInputs(now: tuesdayEvening, firstName: 'Asha', attemptsFailed: true)));
    expect(find.text(TodayCopy.unavailableTitle), findsOneWidget);
    expect(find.text(TodayCopy.unavailableLine), findsOneWidget);
    expect(find.textContaining('move'), findsNothing);
    await tester.tap(find.text(TodayCopy.tryAgain));
    await tester.pump();
    expect((events.single as TodayAction).target, isA<RetryLoad>());
    expect(find.text(TodayCopy.choosePractice), findsOneWidget);
  });

  testWidgets('the week in the header has one spoken summary and opens the week', (tester) async {
    final events = await pumpToday(tester, buildToday(ashaInputs()));
    final week = find.bySemanticsLabel(RegExp('^1 of 4 study days'));
    expect(week, findsOneWidget);
    await tester.tap(find.descendant(of: find.byType(WeekLedger), matching: find.textContaining('study days')));
    await tester.pump();
    expect(events, contains('week'));
  });

  test('why: real counts and the chapters that lost marks', () {
    final model = buildWhy(ashaRecord(tuesdayEvening), 'm7', toDate: (d) => d)!;
    expect(TodayCopy.whyCounts(model.wrong, model.correct, model.blank), '6 wrong, 42 right, 2 not attempted.');
    expect(model.chapters.first.chapter, 'Partnership fundamentals');
    expect(model.chapters.first.wrong, 4);
    expect(model.early, isFalse);
    expect(buildWhy(ashaRecord(tuesdayEvening), 'missing', toDate: (d) => d), isNull);
  });

  test('alternatives keep Review and never carry a price', () {
    final rows = alternativeRows(subject: 'accountancy');
    expect(rows.map((r) => r.title), contains(TodayCopy.altReview));
    expect(rows.any((r) => r.note.contains('credit') || r.note.contains('Rs')), isFalse);
  });

  testWidgets('a practice move offers 5, 10 and 20 questions and the panel reports the count', (tester) async {
    final inputs = ashaInputs(attempts: [accountancyMock('clean', daysBefore(tuesdayEvening, 1))]);
    final events = await pumpToday(tester, buildToday(inputs));
    await tester.tap(find.byType(LengthPill));
    await tester.pumpAndSettle();
    Finder row(String n) => find.descendant(of: find.byType(LengthPanel), matching: find.text(n));
    expect(find.descendant(of: find.byType(LengthPanel), matching: find.text(TodayCopy.practiceLength)), findsOneWidget);
    expect(row('5 questions'), findsOneWidget);
    expect(row('10 questions'), findsOneWidget);
    expect(row('20 questions'), findsOneWidget);
    expect(row('15 questions'), findsNothing);
    await tester.tap(row('20 questions'));
    await tester.pumpAndSettle();
    expect(events, contains('minutes:20'));
  });

  testWidgets('the road lists every stop with its dates under the timeline', (tester) async {
    await pumpToday(tester, buildToday(ashaInputs()));
    final road = find.text(TodayCopy.roadTitle);
    await tester.scrollUntilVisible(road, 300, scrollable: find.byType(Scrollable).first);
    for (final stop in buildToday(ashaInputs()).road!.stops) {
      expect(find.text(stop.title), findsOneWidget, reason: stop.title);
      expect(find.text(stop.when), findsOneWidget, reason: '${stop.title} states its dates');
      if (stop.note != null) expect(find.text(stop.note!), findsOneWidget);
    }
    expect(find.text(CuetDates.registrationMonths), findsOneWidget);
  });

  testWidgets('when every road date is still expected, the word is said once above the stops, not on each row', (tester) async {
    final view = buildToday(ashaInputs());
    await pumpToday(tester, view);
    await tester.scrollUntilVisible(find.text(TodayCopy.roadTitle), 300, scrollable: find.byType(Scrollable).first);
    expect(view.road!.stops.where((s) => s.expected).length, 3);
    expect(find.text(TodayCopy.expectedDates), findsOneWidget);
    expect(find.text(TodayCopy.expectedTag), findsNothing);
  });

  testWidgets('a mix of expected and published dates tags only the expected stops', (tester) async {
    final stops = [
      for (final (i, s) in buildToday(ashaInputs()).road!.stops.indexed)
        RoadStop(kind: s.kind, title: s.title, when: s.when, start: s.start, end: s.end, note: s.note, expected: i != 0),
    ];
    await pumpMockmob(tester, RoadStops(stops: stops), size: const Size(384, 600), disableAnimations: true, overrides: overrides);
    expect(find.text(TodayCopy.expectedTag), findsNWidgets(2));
    expect(find.text(TodayCopy.expectedDates), findsNothing);
  });

  testWidgets('a stop that is not expected carries no tag', (tester) async {
    final stops = [
      for (final s in buildToday(ashaInputs()).road!.stops)
        RoadStop(kind: s.kind, title: s.title, when: s.when, start: s.start, end: s.end, note: s.note),
    ];
    await pumpMockmob(tester, RoadStops(stops: stops), size: const Size(384, 600), disableAnimations: true, overrides: overrides);
    expect(find.text(TodayCopy.expectedTag), findsNothing);
    expect(find.text(stops.first.title), findsOneWidget);
  });

  testWidgets('after the exam window opens the road says so instead of vanishing', (tester) async {
    await pumpToday(tester, buildToday(ashaInputs(now: DateTime.utc(2027, 5, 10, 8))));
    await tester.scrollUntilVisible(find.text(TodayCopy.windowOpen), 300, scrollable: find.byType(Scrollable).first);
    expect(find.text(TodayCopy.windowOpen), findsOneWidget);
    expect(find.text(TodayCopy.ladderTitle), findsOneWidget, reason: 'the college ladder stays');
  });

  testWidgets('once the exam window has closed Today shows no road and no CSAS wording', (tester) async {
    final view = buildToday(ashaInputs(now: DateTime.utc(2027, 6, 5, 8)));
    expect(view.road, isNull);
    await pumpToday(tester, view);
    expect(find.text(TodayCopy.roadTitle), findsNothing);
    expect(find.text(TodayCopy.ladderTitle), findsNothing);
    expect(find.textContaining('CSAS'), findsNothing);
  });

  testWidgets('the college ladder caption uses plain words, not portal names', (tester) async {
    await pumpToday(tester, buildToday(ashaInputs()));
    await tester.scrollUntilVisible(find.text(TodayCopy.ladderTitle), 300, scrollable: find.byType(Scrollable).first);
    expect(find.textContaining('CSAS'), findsNothing);
    expect(find.textContaining('admission.uod'), findsNothing);
    expect(find.text(TodayCopy.ladderCaption('UR')), findsOneWidget);
  });

  testWidgets('the header Mobi keeps pointing at the move card through a scroll and a text-size change', (tester) async {
    final view = buildToday(ashaInputs());
    expect(view.header.mobi!.kind, HeaderMobiKind.point);
    await pumpToday(tester, view);
    final list = find.byType(CustomScrollView);
    await tester.drag(list, const Offset(0, -300));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.drag(list, const Offset(0, 300));
    await tester.pump(const Duration(milliseconds: 100));
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await tester.pump(const Duration(milliseconds: 100));
    expect(tester.takeException(), isNull);
    expect(find.byType(HeaderMobi), findsOneWidget);
  });

  testWidgets('the first repair milestone renders its sentence under the week ending', (tester) async {
    final db = newTestDb();
    addTearDown(db.close);
    final at = DateTime(2026, 10, 12, 23, 51);
    await pumpMockmob(
      tester,
      const TodayCelebration(),
      overrides: [
        userIdProvider.overrideWithValue('u1'),
        rhythmSeenRepositoryProvider.overrideWithValue(RhythmSeenRepository(LocalScope(db, () => 'u1', () => at))),
        rhythmPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
        hapticsProvider.overrideWithValue(Haptics(enabled: false, driver: _NoHaptics())),
      ],
    );
    expect(find.text('That was your first repair.'), findsNothing, reason: 'nothing, and no gap, before it fires');
    final container = ProviderScope.containerOf(tester.element(find.byType(TodayCelebration)));
    await tester.runAsync(
      () => container.read(celebrationControllerProvider.notifier).celebrate(
            CelebrationEvent.milestone(RhythmMilestone(id: 'first_repair', achievedAt: at)),
          ),
    );
    for (var i = 0; i < 6; i++) {
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(find.text('That was your first repair.'), findsOneWidget);
  });
}

class _NoHaptics implements HapticDriver {
  @override
  Future<void> lightImpact() async {}

  @override
  Future<void> mediumImpact() async {}

  @override
  Future<void> selectionClick() async {}
}
