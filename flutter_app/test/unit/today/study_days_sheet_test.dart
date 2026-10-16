// L06 (owner 16 Oct: "when I change the study days, it's just showing 3 only to me"). From the road,
// Change days opens exactly one sheet (never a sheet over a sheet); choosing a fourth day redraws
// the ring with four segments and says "of 4 study days" beside this week's count, so the count is
// never read as the goal; and once the saved goal is back, the road reads "2 of 4" and the pace
// strip stands on 4.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/rhythm/copy.dart';
import 'package:mockmob/features/rhythm/widgets/goal_editor.dart';
import 'package:mockmob/features/rhythm/widgets/week_dial.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/widgets/road_rail.dart';
import 'package:mockmob/features/today/widgets/road_section.dart';
import 'package:mockmob/features/today/widgets/road_tuners.dart';

import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

TodayWeek _week(int goal, Set<int> planned) => TodayWeek(
      studied: const [true, true, false, false, false, false, false],
      todayIndex: 1,
      label: '2 of $goal study days',
      goal: goal,
      planned: planned,
      dates: const [12, 13, 14, 15, 16, 17, 18],
    );

void main() {
  testWidgets('Change days: one sheet, the ring follows the days chosen, and the road reads the saved goal', (tester) async {
    RoadRail.debugResetPeek();
    final road = ValueNotifier<RoadModel>(buildRoad(ashaInputs(week: _week(3, {0, 2, 4})))!);
    addTearDown(road.dispose);
    await pumpMockmob(
      tester,
      SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 400),
        child: ValueListenableBuilder<RoadModel>(
          valueListenable: road,
          builder: (context, r, _) => RoadSection(road: r, actions: RoadActions(savePace: (_) async {}, setExamDate: (_) async {}, setMockTarget: (_) async {})),
        ),
      ),
      size: const Size(390, 844),
      disableAnimations: true,
    );
    await tester.pumpAndSettle();
    expect(find.text(TodayCopy.readThisWeek(2, 3)), findsOneWidget);

    final change = find.text(TodayCopy.changeDays);
    await tester.ensureVisible(change);
    await tester.pumpAndSettle();
    await tester.tap(change);
    await tester.pumpAndSettle();

    // Exactly one sheet, straight away.
    expect(find.byType(GoalEditor), findsOneWidget);
    WeekDial dial() => tester.widget<WeekDial>(find.descendant(of: find.byType(GoalEditor), matching: find.byType(WeekDial)));
    expect(dial().goal, 3);
    expect(dial().done, 2);

    // Thursday is a rest day in the three-day plan: choosing it makes four.
    await tester.tap(find.descendant(of: find.byType(GoalEditor), matching: find.text('Thu')));
    await tester.pumpAndSettle();
    expect(dial().goal, 4);
    expect(dial().done, 2);
    expect(dial().showWords, isTrue);
    expect(find.descendant(of: find.byType(GoalEditor), matching: find.text(RhythmCopy.ofGoal(4))), findsOneWidget);

    Navigator.of(tester.element(find.byType(GoalEditor))).pop(4);
    await tester.pumpAndSettle();

    // The saved goal comes back through the rhythm read: the road says it.
    road.value = buildRoad(ashaInputs(week: _week(4, {0, 2, 3, 4})))!;
    await tester.pumpAndSettle();
    expect(find.text(TodayCopy.readThisWeek(2, 4)), findsOneWidget);
    expect(tester.widget<PaceStrip>(find.byType(PaceStrip)).value, 4);
  });
}
