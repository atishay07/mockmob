import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/logic/why_model.dart';
import 'package:mockmob/features/today/screens/alternatives_sheet.dart';
import 'package:mockmob/features/today/screens/today_body.dart';

import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

void main() {
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

  testWidgets('the volt pill starts the repair; the chips and Show me report back', (tester) async {
    final events = await pumpToday(tester, buildToday(ashaInputs()));
    await tester.tap(find.text(TodayCopy.startRepair(20)));
    await tester.tap(find.text('10 min'));
    await tester.tap(find.text(TodayCopy.showMe));
    await tester.pump();
    final action = events.whereType<TodayAction>().single;
    expect((action.target as GoTo).location, startsWith(AppRoutes.reviewRepair('m7', 'm7-q3')));
    expect(events, containsAll(['minutes:10', 'why:m7']));
  });

  testWidgets('offline, a start says why it is unavailable instead of failing', (tester) async {
    final events = await pumpToday(tester, buildToday(ashaInputs(offline: true)));
    expect(find.text(TodayCopy.connectToStart), findsOneWidget);
    expect(find.text('Updated 7:30 PM. You are offline.'), findsOneWidget);
    await tester.tap(find.text(TodayCopy.startRepair(20)));
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
    await tester.tap(find.text(TodayCopy.tryAgain));
    await tester.pump();
    expect((events.single as TodayAction).target, isA<RetryLoad>());
    expect(find.text(TodayCopy.choosePractice), findsOneWidget);
  });

  testWidgets('the week in the header has one spoken summary and opens the week', (tester) async {
    final events = await pumpToday(tester, buildToday(ashaInputs()));
    final week = find.bySemanticsLabel(RegExp('^1 of 4 study days'));
    expect(week, findsOneWidget);
    await tester.tap(find.byType(WeekBubbles));
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
}
