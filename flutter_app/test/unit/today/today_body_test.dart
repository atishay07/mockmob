import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/rhythm_seen_repository.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart' show rhythmPrefsStoreProvider;
import 'package:mockmob/features/rhythm/rhythm.dart';
import 'package:mockmob/features/today/widgets/header_mobi.dart';
import 'package:mockmob/features/today/widgets/length_pill.dart';
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

  testWidgets('the volt key starts the repair; See why reports back; the length sits in the key', (tester) async {
    final events = await pumpToday(tester, buildToday(ashaInputs()));
    // TODAY-1017 4.2: "Start repair  15 min" in one key, then Change length and Something else.
    expect(find.text(TodayCopy.changeLength), findsOneWidget, reason: 'a move with more than one length offers to change it');
    expect(find.text(TodayCopy.somethingElse), findsOneWidget);
    expect(find.text('15 min'), findsOneWidget, reason: 'the key says the length once, after the verb');
    expect(find.text('Start repair'), findsOneWidget);
    expect(find.bySemanticsLabel(TodayCopy.startRepair(15)), findsOneWidget, reason: 'a screen reader hears the whole key');
    await tester.tap(find.text('Start repair'));
    await tester.tap(find.textContaining(TodayCopy.seeWhy, findRichText: true));
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
    // The Last paper row is the newest opened paper (Mock 7 is still sealed): the Business
    // Studies quick paper from four days before.
    final row = find.textContaining(', Business Studies');
    await tester.ensureVisible(row);
    await tester.tap(row);
    await tester.pump();
    final locations = [
      for (final e in events)
        if (e is TodayAction) (e.target as GoTo).location else if (e is GoTo) e.location,
    ];
    expect(locations, [AppRoutes.result('m7'), AppRoutes.practiceResult('q1')]);
  });

  testWidgets('the error state names what did not load, offers Try again and a way to practise', (tester) async {
    final events = await pumpToday(tester, buildToday(TodayInputs(now: tuesdayEvening, firstName: 'Asha', attemptsFailed: true)));
    expect(find.text(TodayCopy.failTitle), findsOneWidget);
    expect(find.text(TodayCopy.unavailableLine), findsOneWidget);
    await tester.tap(find.text(TodayCopy.tryAgain));
    await tester.pump();
    expect((events.single as TodayAction).target, isA<RetryLoad>());
    expect(find.text(TodayCopy.practiseAnyway), findsOneWidget);
  });

  testWidgets('a Try again that changed nothing says when it ran, in the card', (tester) async {
    final tried = DateTime.utc(2026, 10, 13, 17, 11);
    await pumpToday(tester, buildToday(TodayInputs(now: tuesdayEvening, firstName: 'Asha', attemptsFailed: true, lastTriedAt: tried)));
    expect(find.textContaining('Tried again at'), findsOneWidget);
    expect(find.textContaining('Still not loading.'), findsOneWidget);
    expect(find.byType(SnackBar), findsNothing);
  });

  testWidgets('the road card says this week in words, and Adjust plan opens the sheet', (tester) async {
    await pumpToday(tester, buildToday(ashaInputs()));
    expect(find.bySemanticsLabel(RegExp('^This week: 1 of 4 study days')), findsOneWidget);
    expect(find.text(TodayCopy.roadCardTitle), findsOneWidget);
    final adjust = find.byKey(const ValueKey('road-adjust'));
    await tester.ensureVisible(adjust);
    await tester.tap(adjust);
    await tester.pumpAndSettle();
    expect(find.text(TodayCopy.adjustDaysTitle), findsOneWidget);
    expect(find.text(TodayCopy.adjustMocksTitle), findsOneWidget);
    expect(find.text(TodayCopy.adjustDateTitle), findsOneWidget);
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
    final rows = alternativeRows(ashaInputs(attempts: [accountancyMock('clean', daysBefore(tuesdayEvening, 1))]), moveSubject: 'accountancy');
    expect(rows.map((r) => r.title), contains(TodayCopy.altReview));
    expect(rows.any((r) => r.note.contains('credit') || r.note.contains('Rs')), isFalse);
  });

  testWidgets('a practice move offers 5, 10 and 20 questions and the panel reports the count', (tester) async {
    final inputs = ashaInputs(attempts: [accountancyMock('clean', daysBefore(tuesdayEvening, 1))]);
    final events = await pumpToday(tester, buildToday(inputs));
    await tester.tap(find.text(TodayCopy.changeLength));
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

  /// Opens the Adjust plan sheet and its week list, where the whole road lives now.
  Future<void> openWeeks(WidgetTester tester) async {
    final adjust = find.byKey(const ValueKey('road-adjust'));
    await tester.ensureVisible(adjust);
    await tester.tap(adjust);
    await tester.pumpAndSettle();
    final weeks = find.byKey(const ValueKey('adjust-weeks'));
    await tester.ensureVisible(weeks);
    await tester.tap(weeks);
    await tester.pumpAndSettle();
  }

  testWidgets('the road keeps every stop: Adjust plan lists each one with its dates', (tester) async {
    await pumpToday(tester, buildToday(ashaInputs()));
    await openWeeks(tester);
    final stops = buildToday(ashaInputs()).road!.stops;
    for (final stop in stops) {
      expect(find.text(stop.title), findsWidgets, reason: stop.title);
      expect(find.textContaining(stop.when), findsWidgets, reason: '${stop.title} states its dates');
    }
  });

  testWidgets('a date that is still expected says so where its dates are shown', (tester) async {
    final view = buildToday(ashaInputs());
    await pumpToday(tester, view);
    await openWeeks(tester);
    expect(view.road!.stops.where((s) => s.expected).length, 3);
    expect(find.text(TodayCopy.expectedDates), findsOneWidget, reason: 'every date is expected: said once above the list');
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
    expect(find.text(TodayCopy.collegesRowTitle), findsOneWidget, reason: 'the colleges row stays');
  });

  testWidgets('once the exam window has closed Today shows no road and no CSAS wording', (tester) async {
    final view = buildToday(ashaInputs(now: DateTime.utc(2027, 6, 5, 8)));
    expect(view.road, isNull);
    await pumpToday(tester, view);
    expect(find.text(TodayCopy.roadCardTitle), findsNothing);
    expect(find.text(TodayCopy.collegesRowTitle), findsNothing);
    expect(find.textContaining('CSAS'), findsNothing);
  });

  testWidgets('the colleges row uses plain words, not portal names, and no estimate', (tester) async {
    await pumpToday(tester, buildToday(ashaInputs()));
    await tester.scrollUntilVisible(find.text(TodayCopy.collegesRowTitle), 300, scrollable: find.byType(Scrollable).first);
    expect(find.textContaining('CSAS'), findsNothing);
    expect(find.textContaining('admission.uod'), findsNothing);
    expect(find.text('Shri Ram College of Commerce'), findsOneWidget);
    expect(find.text('B.Com (Hons), 2026 Round 1. 2 more saved.'), findsOneWidget);
  });

  testWidgets('the header Mobi keeps pointing at the move card through a scroll and a text-size change', (tester) async {
    // TODAY-1017 4.6: no header Mobi on Today; the page still survives a scroll and a text-size change.
    final view = buildToday(ashaInputs());
    expect(view.header.mobi, isNull);
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
    expect(find.byType(HeaderMobi), findsNothing);
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
